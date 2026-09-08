import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { StyleSeparatorSpacingProfileSchema, type StyleSeparatorSpacingProfile } from '../metadata.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
function fail(reason: string): never { throw new Error(`render-copy spacing: ${reason}`); }
const children = (e: XmlElement) => Array.from(e.childNodes).filter(n => n.nodeType === 1) as XmlElement[];
const direct = (e: XmlElement, name: string) => children(e).find(n => n.namespaceURI === W && n.localName === name);
const val = (e: XmlElement | undefined) => e?.getAttributeNS(W, 'val');
const on = (e: XmlElement | undefined) => !!e && !['0', 'false', 'off'].includes(val(e) ?? '');
type Boundary = StyleSeparatorSpacingProfile['boundaries'][number];

export interface StyleSeparatorSpacingOptions {
  sourcePath: string;
  sourceSha256: string;
  profile: StyleSeparatorSpacingProfile;
}
export interface StyleSeparatorSpacingReceipt {
  sourceSha256: string;
  profileSha256: string;
  replacements: number;
  headingParaIds: string[];
}

/** Prefix-independent semantic fingerprint; only runtime-owned numbering and
 * non-rendering editing-session IDs are excluded. Text whitespace is retained. */
function semantic(e: XmlElement | undefined): unknown {
  if (!e) return null;
  const attributes = Array.from(e.attributes)
    .filter(a => a.namespaceURI !== 'http://www.w3.org/2000/xmlns/' && !(a.namespaceURI === W && a.localName?.startsWith('rsid')))
    // Fill serializes all text with xml:space=preserve. Where there is no edge
    // whitespace this does not change layout; retain it otherwise.
    .filter(a => !(a.namespaceURI === 'http://www.w3.org/XML/1998/namespace' && a.localName === 'space'
      && e.namespaceURI === W && e.localName === 't' && (e.textContent ?? '') === (e.textContent ?? '').trim()))
    .map(a => [a.namespaceURI ?? '', a.localName, a.value]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return [e.namespaceURI, e.localName, attributes,
    Array.from(e.childNodes).flatMap(n => n.nodeType === 1
      ? ((n as XmlElement).namespaceURI === W && (n as XmlElement).localName === 'numPr' ? [] : [semantic(n as XmlElement)])
      : n.nodeType === 3 && ['t', 'instrText'].includes(e.localName ?? '') ? [n.nodeValue] : [])];
}

function parse(zip: AdmZip, name: string): XmlDocument {
  const entry = zip.getEntry(name);
  if (!entry) fail(`missing ${name}`);
  return new DOMParser({ onError: (level, message) => { if (level !== 'warning') fail(message); } })
    .parseFromString(entry.getData().toString('utf8'), 'text/xml');
}

function styleChain(styles: XmlDocument, id: string): XmlElement[] {
  const result: XmlElement[] = [];
  while (id) {
    const matches = Array.from(styles.getElementsByTagNameNS(W, 'style')).filter(s => s.getAttributeNS(W, 'styleId') === id);
    if (matches.length !== 1 || result.includes(matches[0])) fail('missing, duplicate or cyclic paragraph style');
    result.push(matches[0]); id = val(direct(matches[0], 'basedOn')) ?? '';
  }
  return result;
}

function describe(zip: AdmZip, document: XmlDocument, styles: XmlDocument, boundary: Omit<Boundary, 'expected_layout_sha256'>) {
  const paragraphs = Array.from(document.getElementsByTagNameNS(W, 'p'));
  const find = (id: string) => {
    const matches = paragraphs.filter(p => p.getAttributeNS(W14, 'paraId') === id);
    if (matches.length !== 1) fail(`paragraph ${id} missing or duplicated`);
    return matches[0];
  };
  const heading = find(boundary.heading_para_id), continuation = find(boundary.continuation_para_id);
  const parent = heading.parentNode as XmlElement;
  if (parent.namespaceURI !== W || parent.localName !== 'body' || continuation.parentNode !== parent
    || children(parent)[children(parent).indexOf(heading) + 1] !== continuation) fail('declared pair is not adjacent in the main body');
  const hp = direct(heading, 'pPr'), cp = direct(continuation, 'pPr');
  if (!hp || !cp) fail('paragraph properties missing');
  const hs = val(direct(hp, 'pStyle')), cs = val(direct(cp, 'pStyle'));
  if (!hs || !cs || hs === cs) fail('distinct heading and continuation styles required');
  const headingStyles = styleChain(styles, hs), continuationStyles = styleChain(styles, cs);
  if (!continuationStyles.includes(headingStyles[0])) fail('continuation must inherit the heading style family');
  const toggles = ['b', 'i', 'bCs', 'iCs', 'vanish'];
  if (continuationStyles.slice(0, continuationStyles.indexOf(headingStyles[0])).some(s =>
    toggles.some(name => s.getElementsByTagNameNS(W, name).length))) fail('ambiguous continuation style toggles');
  const defaults = styles.getElementsByTagNameNS(W, 'docDefaults')[0];
  const defaultP = defaults && direct(direct(defaults, 'pPrDefault') ?? defaults, 'pPr');
  const propertyChain = (chain: XmlElement[], p: XmlElement) => [defaultP, ...chain.slice().reverse().map(s => direct(s, 'pPr')), p].filter(Boolean) as XmlElement[];
  const hChain = propertyChain(headingStyles, hp), cChain = propertyChain(continuationStyles, cp);
  for (const p of [...hChain, ...cChain]) {
    for (const name of ['framePr', 'sectPr', 'pPrChange', 'pageBreakBefore']) if (direct(p, name)) fail(`unsupported ${name}`);
    const spacing = direct(p, 'spacing');
    if (spacing && ['beforeLines', 'beforeAutospacing', 'afterAutospacing'].some(a => spacing.hasAttributeNS(W, a))) fail('unsupported automatic or line-unit spacing');
  }
  const hMark = direct(hp, 'rPr');
  if (!hMark || !on(direct(hMark, 'vanish')) || !on(direct(hMark, 'specVanish'))) fail('heading requires an explicit hidden style separator');
  for (const p of [heading, continuation]) {
    for (const name of ['ins', 'del', 'moveFrom', 'moveTo', 'rPrChange', 'pPrChange', 'br', 'cr', 'drawing', 'pict']) {
      if (p.getElementsByTagNameNS(W, name).length) fail(`unsupported boundary ${name}`);
    }
  }
  for (const p of [...hChain.slice(0, -1), ...cChain]) {
    const mark = direct(p, 'rPr');
    if (mark && (direct(mark, 'vanish') || direct(mark, 'rStyle'))) fail('ambiguous inherited or continuation mark visibility');
  }
  const before = direct(hp, 'spacing')?.getAttributeNS(W, 'before');
  if (before !== String(boundary.before_twips)) fail('heading before-spacing mismatch');
  let continuationBefore = '0';
  for (const p of cChain) {
    const spacing = direct(p, 'spacing');
    if (spacing?.hasAttributeNS(W, 'before')) continuationBefore = spacing.getAttributeNS(W, 'before')!;
  }
  if (continuationBefore !== '0') fail('continuation already has before-spacing');
  const headingRuns = children(heading).filter(e => e.namespaceURI === W && e.localName === 'r');
  if (children(heading).some(e => e.namespaceURI !== W || !['pPr', 'r', 'bookmarkStart', 'bookmarkEnd'].includes(e.localName ?? ''))) fail('unsupported heading container');
  const firstRun = children(continuation).find(e => e.namespaceURI === W && e.localName === 'r');
  if (firstRun && children(continuation).slice(0, children(continuation).indexOf(firstRun)).some(e =>
    e.namespaceURI !== W || !['pPr', 'bookmarkStart', 'bookmarkEnd'].includes(e.localName ?? ''))) fail('unsupported continuation prefix container');
  if (!headingRuns.length || !firstRun || !/^\.(?:\s|$)/.test(Array.from(firstRun.getElementsByTagNameNS(W, 't')).map(t => t.textContent).join(''))
    || children(firstRun).some(n => n.namespaceURI !== W || !['rPr', 't'].includes(n.localName ?? ''))) fail('expected plain leading period run');
  if (heading.getElementsByTagNameNS(W, 'instrText').length || heading.getElementsByTagNameNS(W, 'fldSimple').length) fail('field-bearing heading unsupported');
  const characterStyles = (run: XmlElement) => {
    const id = val(direct(direct(run, 'rPr') ?? run, 'rStyle'));
    const chain = id ? styleChain(styles, id) : [];
    if (chain.some(s => s.getAttributeNS(W, 'type') !== 'character'
      || toggles.some(name => s.getElementsByTagNameNS(W, name).length)
      || s.getElementsByTagNameNS(W, 'rPrChange').length)) fail('unsupported character style');
    return chain;
  };
  const metrics = (chain: XmlElement[], run: XmlElement) => {
    const properties = [defaults && direct(direct(defaults, 'rPrDefault') ?? defaults, 'rPr'), ...chain.slice().reverse().map(s => direct(s, 'rPr')),
      ...characterStyles(run).slice().reverse().map(s => direct(s, 'rPr')), direct(run, 'rPr')];
    const values = new Map<string, unknown>();
    for (const p of properties) if (p) for (const node of children(p)) {
      if (['rFonts', 'sz', 'szCs', 'position', 'vertAlign', 'b', 'i', 'bCs', 'iCs', 'spacing', 'w', 'kern'].includes(node.localName ?? '')) values.set(node.localName!, semantic(node));
    }
    return JSON.stringify([...values].sort(([a], [b]) => a.localeCompare(b)));
  };
  const bodyMetrics = metrics(continuationStyles, firstRun);
  if (headingRuns.some(r => metrics(headingStyles, r) !== bodyMetrics)) fail('heading and period metrics differ');
  const endSection = paragraphs.slice(paragraphs.indexOf(continuation)).map(p => direct(p, 'pPr')).filter(Boolean)
    .map(p => direct(p!, 'sectPr')).find(Boolean) ?? direct(parent, 'sectPr');
  if (!endSection || !direct(endSection, 'pgSz') || !direct(endSection, 'pgMar')) fail('explicit section geometry required');
  const geometry = ['pgSz', 'pgMar', 'cols', 'docGrid'].map(n => semantic(direct(endSection, n)));
  const settings = zip.getEntry('word/settings.xml') ? parse(zip, 'word/settings.xml') : undefined;
  // The leading period may share a run with caller-dependent body prose. Bind
  // its formatting and punctuation, not the mutable remainder of that prose.
  const descriptor = [semantic(hp), semantic(cp), headingRuns.map(semantic), [semantic(direct(firstRun, 'rPr')), '.'],
    headingStyles.map(semantic), continuationStyles.map(semantic), [...headingRuns, firstRun].flatMap(characterStyles).map(semantic), semantic(defaults), geometry,
    semantic(settings?.getElementsByTagNameNS(W, 'compat')[0])];
  return { heading, continuation, hp, cp, fingerprint: hash(JSON.stringify(descriptor)) };
}

/** Authoring aid only: canonical authors must independently render/audit the
 * source shape before declaring this hash. This does not prove line wrapping. */
export function inspectStyleSeparatorSpacingSource(sourcePath: string, boundary: Omit<Boundary, 'expected_layout_sha256'>): string {
  const zip = new AdmZip(readFileSync(sourcePath));
  return describe(zip, parse(zip, 'word/document.xml'), parse(zip, 'word/styles.xml'), boundary).fingerprint;
}

export function applyStyleSeparatorSpacing(zip: AdmZip, document: XmlDocument, styles: XmlDocument | undefined, options: StyleSeparatorSpacingOptions): StyleSeparatorSpacingReceipt {
  const profile = StyleSeparatorSpacingProfileSchema.parse(options.profile);
  const bytes = readFileSync(options.sourcePath);
  if (!/^[0-9a-f]{64}$/.test(options.sourceSha256) || hash(bytes) !== options.sourceSha256) fail('source SHA-256 mismatch');
  if (!styles) fail('missing styles');
  const source = new AdmZip(bytes), sourceDocument = parse(source, 'word/document.xml'), sourceStyles = parse(source, 'word/styles.xml');
  // Validate EVERY pair before mutating even the disposable in-memory copy.
  const plans = profile.boundaries.map(boundary => {
    const original = describe(source, sourceDocument, sourceStyles, boundary);
    if (original.fingerprint !== boundary.expected_layout_sha256) fail('declared source layout fingerprint mismatch');
    const current = describe(zip, document, styles, boundary);
    if (current.fingerprint !== original.fingerprint) fail('input layout differs from declared source shape');
    return { ...current, boundary };
  });
  for (const { hp, cp, boundary } of plans) {
    direct(hp, 'spacing')!.setAttributeNS(W, 'w:before', '0');
    let spacing = direct(cp, 'spacing');
    if (!spacing) {
      spacing = document.createElementNS(W, 'w:spacing');
      const before = children(cp).find(n => ['ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'].includes(n.localName ?? ''));
      cp.insertBefore(spacing, before ?? null);
    }
    spacing.setAttributeNS(W, 'w:before', String(boundary.before_twips));
  }
  return { sourceSha256: options.sourceSha256, profileSha256: hash(JSON.stringify(profile)), replacements: plans.length,
    headingParaIds: profile.boundaries.map(b => b.heading_para_id) };
}
