import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import type { NumberingContinuations } from '../metadata.js';
import { NumberingContinuationsSchema } from '../metadata.js';
import { createParagraphNumberingResolver } from './paragraph-numbering.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
/** Only plans returned by validateNumberingContinuationSource are accepted. */
export interface ValidatedNumberingContinuations { readonly sourceNumId: string; readonly sourceSha256: string }
const plans = new WeakMap<ValidatedNumberingContinuations, NumberingContinuations>();
const anchorKey = (text: string) => text.replaceAll('[', '').replaceAll(']', '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
const text = (paragraph: Element) => Array.from(paragraph.getElementsByTagNameNS(W, 't')).map(node => node.textContent).join('');
function elements(parent: Element, local: string): Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1
    && (node as Element).namespaceURI === W && (node as Element).localName === local);
}
function one(parent: Element, local: string): Element {
  const found = elements(parent, local);
  if (found.length !== 1) throw new Error(`numbering continuations: expected exactly one ${local}`);
  return found[0];
}
function numbers(numbering: Document): Map<string, Element> {
  if (!numbering.documentElement) throw new Error('numbering continuations: missing numbering root');
  const result = new Map<string, Element>();
  for (const num of elements(numbering.documentElement, 'num')) {
    const id = num.getAttributeNS(W, 'numId') ?? '';
    if (result.has(id)) throw new Error('numbering continuations: duplicate numbering instance');
    result.set(id, num);
  }
  return result;
}
function checkShape(numbering: Document, config: NumberingContinuations): void {
  const nums = numbers(numbering);
  const source = nums.get(config.source_num_id);
  if (!source) throw new Error('numbering continuations: missing source instance');
  const abstractId = one(source, 'abstractNumId').getAttributeNS(W, 'val');
  const abstracts = Array.from(numbering.getElementsByTagNameNS(W, 'abstractNum')).filter(node => node.getAttributeNS(W, 'abstractNumId') === abstractId);
  if (abstracts.length !== 1 || elements(abstracts[0], 'numStyleLink').length || elements(abstracts[0], 'styleLink').length) {
    throw new Error('numbering continuations: missing, ambiguous or style-linked source abstract');
  }
  for (const heading of config.headings) {
    const num = nums.get(heading.num_id);
    if (!num || one(num, 'abstractNumId').getAttributeNS(W, 'val') !== abstractId) {
      throw new Error(`numbering continuations: ${heading.num_id} does not share the declared source abstract`);
    }
    const starts: Record<string, number> = {};
    for (const child of Array.from(num.childNodes).filter((node): node is Element => node.nodeType === 1)) {
      if (child.namespaceURI !== W || !['abstractNumId', 'lvlOverride'].includes(child.localName ?? '')) {
        throw new Error('numbering continuations: unsupported instance properties');
      }
      if (child.localName !== 'lvlOverride') continue;
      const index = child.getAttributeNS(W, 'ilvl') ?? '';
      const start = one(child, 'startOverride');
      const elementChildren = Array.from(child.childNodes).filter(node => node.nodeType === 1);
      const raw = start.getAttributeNS(W, 'val') ?? '';
      if (elementChildren.length !== 1 || !/^[0-8]$/.test(index) || !/^\d+$/.test(raw) || starts[index] !== undefined) {
        throw new Error('numbering continuations: expected startOverride-only shape');
      }
      starts[index] = Number(raw);
    }
    const keys = Object.keys(starts).sort();
    if (keys.join(',') !== Object.keys(heading.expected_starts).sort().join(',')
      || keys.some(key => starts[key] !== heading.expected_starts[key])) {
      throw new Error(`numbering continuations: start overrides drifted for ${heading.num_id}`);
    }
  }
}

function declaredParagraphs(document: Document, styles: Document, config: NumberingContinuations, source: boolean): Set<Element> {
  const resolve = createParagraphNumberingResolver(styles);
  const paragraphs = Array.from(document.getElementsByTagNameNS(W, 'p'));
  const result = new Set<Element>();
  for (const heading of config.headings) {
    const anchored = paragraphs.filter(paragraph => anchorKey(text(paragraph)) === anchorKey(heading.anchor));
    const owned = paragraphs.filter(paragraph => resolve(paragraph)?.numId === heading.num_id);
    // Selection may remove a validated source heading. It may not leave a
    // mismatched or multiply-used declared numbering instance behind.
    if (!source && anchored.length === 0 && owned.length === 0) continue;
    if (anchored.length !== 1 || owned.length !== 1 || anchored[0] !== owned[0]) {
      throw new Error(`numbering continuations: missing or ambiguous anchor/instance for ${heading.num_id}`);
    }
    const resolved = resolve(anchored[0]);
    if (resolved?.ilvl !== heading.ilvl || resolved.outlineLvl !== heading.ilvl) {
      throw new Error(`numbering continuations: heading level/outline drifted for ${heading.num_id}`);
    }
    result.add(anchored[0]);
  }
  return result;
}

/** Validate the original source, before selections/fill mutate its bytes. */
export function validateNumberingContinuationSource(sourcePath: string, input: NumberingContinuations): ValidatedNumberingContinuations {
  const config = NumberingContinuationsSchema.parse(input);
  const bytes = readFileSync(sourcePath);
  if (createHash('sha256').update(bytes).digest('hex') !== config.source_sha256) {
    throw new Error('numbering continuations: source SHA-256 mismatch');
  }
  const zip = new AdmZip(bytes);
  const parser = new DOMParser({ onError: (level, message) => { if (level !== 'warning') throw new Error(message); } });
  const part = (name: string) => {
    const entry = zip.getEntry(`word/${name}.xml`);
    if (!entry) throw new Error(`numbering continuations: missing ${name} part`);
    return parser.parseFromString(entry.getData().toString('utf8'), 'text/xml');
  };
  const numbering = part('numbering');
  checkShape(numbering, config);
  declaredParagraphs(part('document'), part('styles'), config, true);
  const plan = Object.freeze({ sourceNumId: config.source_num_id, sourceSha256: config.source_sha256 });
  plans.set(plan, config);
  return plan;
}

export function resolveNumberingContinuationParagraphs(
  document: Document, styles: Document, numbering: Document, plan: ValidatedNumberingContinuations,
): Set<Element> {
  const config = plans.get(plan);
  if (!config) throw new Error('numbering continuations: unvalidated source plan');
  checkShape(numbering, config);
  return declaredParagraphs(document, styles, config, false);
}
