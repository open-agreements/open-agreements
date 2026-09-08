import type {Document, Element, Node} from '@xmldom/xmldom';
import type {NumberingSnapshot} from './numbering-counters.js';
import {preserveXmlSpace} from './ooxml-parts.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function fail(message: string): never { throw new Error(`render-copy REF: ${message}`); }
const attr = (node: Element, name: string) => node.getAttributeNS(W, name) ?? '';
const is = (node: Node, name: string): boolean => node.nodeType === 1 && (node as Element).namespaceURI === W && node.localName === name;
function all(root: Node): Element[] {
  const out: Element[] = [];
  const visit = (node: Node) => { if (node.nodeType === 1) out.push(node as Element); for (const child of Array.from(node.childNodes)) visit(child); };
  visit(root);
  return out;
}
function ancestor(node: Node, name: string): Element | undefined {
  for (let current: Node | null = node; current; current = current.parentNode) if (is(current, name)) return current as Element;
  return undefined;
}
function direct(node: Element, name: string): Element | undefined {
  const found = Array.from(node.childNodes).filter((child): child is Element => is(child, name));
  if (found.length > 1) fail(`duplicate ${name}`);
  return found[0];
}

function englishOrdinalLanguage(snapshot: NumberingSnapshot, level: Element, styles?: Document): void {
  const definitions = styles ? Array.from(styles.getElementsByTagNameNS(W, 'style')) : [];
  const runLanguage = (properties?: Element): string | undefined => {
    const language = properties && direct(properties, 'lang');
    return language && attr(language, 'val') || undefined;
  };
  const styleLanguage = (id: string, visited = new Set<string>()): string | undefined => {
    if (visited.has(id)) fail('cyclic language style inheritance');
    visited.add(id);
    const matches = definitions.filter(node => attr(node, 'styleId') === id);
    if (matches.length !== 1) fail(`missing or duplicate language style ${id}`);
    const style = matches[0];
    const paragraph = direct(style, 'pPr');
    const own = runLanguage(direct(style, 'rPr')) ?? runLanguage(paragraph && direct(paragraph, 'rPr'));
    if (own) return own;
    const base = direct(style, 'basedOn');
    return base ? styleLanguage(attr(base, 'val'), visited) : undefined;
  };
  const propertiesLanguage = (properties?: Element): string | undefined => {
    const own = runLanguage(properties);
    if (own) return own;
    const characterStyle = properties && direct(properties, 'rStyle');
    return characterStyle ? styleLanguage(attr(characterStyle, 'val')) : undefined;
  };
  const paragraph = direct(snapshot.paragraph, 'pPr');
  const paragraphStyle = paragraph && direct(paragraph, 'pStyle');
  const defaults = styles?.documentElement ? direct(styles.documentElement, 'docDefaults') : undefined;
  const defaultRun = defaults && direct(defaults, 'rPrDefault');
  const defaultStyles = definitions.filter(node => attr(node, 'type') === 'paragraph' && ['1', 'true', 'on'].includes(attr(node, 'default')));
  if (defaultStyles.length > 1) fail('ambiguous default paragraph language style');
  const styleId = paragraphStyle ? attr(paragraphStyle, 'val') : defaultStyles[0] && attr(defaultStyles[0], 'styleId');
  const language = propertiesLanguage(direct(level, 'rPr')) ??
    propertiesLanguage(paragraph && direct(paragraph, 'rPr')) ??
    (styleId ? styleLanguage(styleId) : undefined) ?? runLanguage(defaultRun && direct(defaultRun, 'rPr'));
  if (!language || !/^en(?:-[a-z0-9]+)*$/i.test(language)) fail(`ordinalText requires known English numbering language, got ${language ?? 'unknown'}`);
}

function formatted(value: number, format: string, snapshot: NumberingSnapshot, level: Element, styles?: Document): string {
  if (!Number.isSafeInteger(value) || value < 0) return fail('invalid counter');
  if (format === 'decimal') return String(value);
  if (format === 'ordinalText') {
    englishOrdinalLanguage(snapshot, level, styles);
    const words = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
    return words[value - 1] ?? fail('ordinalText counter outside supported 1..20 range');
  }
  // Keep the supported alphabetic range explicit rather than assuming Excel's
  // base-26 convention for Word's extended alphabetic numbering.
  if (format === 'lowerLetter' || format === 'upperLetter') {
    if (value < 1 || value > 26) return fail('alphabetic counter outside supported 1..26 range');
    return String.fromCharCode((format === 'lowerLetter' ? 96 : 64) + value);
  }
  if (format === 'lowerRoman' || format === 'upperRoman') {
    if (value < 1 || value > 3999) return fail('Roman counter outside supported 1..3999 range');
    let remaining = value; let result = '';
    for (const [number, token] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) {
      while (remaining >= number) { result += token; remaining -= number; }
    }
    return format === 'lowerRoman' ? result.toLowerCase() : result;
  }
  return fail(`unsupported number format ${format}`);
}

function label(snapshot: NumberingSnapshot, mode: 'n' | 'r' | 'w', context?: NumberingSnapshot, styles?: Document, suppressText = false): string {
  const levels = new Map<number, Element>();
  for (const node of Array.from(snapshot.effectiveAbstract.childNodes)) if (is(node, 'lvl')) levels.set(Number(attr(node as Element, 'ilvl')), node as Element);
  let from = 0;
  // Context is an explicit numbered paragraph snapshot, never a heading inferred
  // from text or style. Different list instances never share numeric context.
  if (mode === 'r' && context?.numId === snapshot.numId) {
    while (from < snapshot.ilvl && from <= context.ilvl && snapshot.counters[from] === context.counters[from]) from++;
  }
  const targetLevel = levels.get(snapshot.ilvl) ?? fail('missing target level');
  const legal = direct(targetLevel, 'isLgl');
  if (legal && !['', '1', 'true', 'on', '0', 'false', 'off'].includes(attr(legal, 'val'))) fail('invalid isLgl');
  const decimal = !!legal && !['0', 'false', 'off'].includes(attr(legal, 'val'));
  const render = (index: number, minimum: number, ownOnly: boolean): string => {
    const level = levels.get(index) ?? fail(`missing ancestor level ${index}`);
    const originalTemplate = attr(direct(level, 'lvlText') ?? fail('missing lvlText'), 'val');
    if (/[^\sA-Za-z0-9.()[\]:%-]/.test(originalTemplate)) fail(`unsupported lvlText ${originalTemplate}`);
    // Microsoft REF t suppresses literal text, not alphabetic counter values.
    // Work on literal template segments before expanding numeric placeholders.
    const template = suppressText ? originalTemplate.split(/(%[1-9])/g).map(part => /^%[1-9]$/.test(part) ? part : part.replace(/[A-Za-z]+/g, '').trim()).join('') : originalTemplate;
    const matches = Array.from(template.matchAll(/%([1-9])/g));
    if (!matches.length || /%/.test(template.replace(/%[1-9]/g, ''))) fail(`unsupported lvlText ${template}`);
    const refs = matches.map(match => Number(match[1]) - 1);
    if (refs[refs.length - 1] !== index || refs.some((ref, i) => ref > index || (i > 0 && ref !== refs[i - 1] + 1))) fail(`unsupported placeholder hierarchy ${template}`);
    // A compound level label is indivisible: native REF r retains ancestor
    // placeholders embedded in this level's own template, just as REF n does.
    // Relative context suppresses only separately prepended ancestor levels.
    const retained = matches;
    if (!retained.length) return fail('empty relative label');
    // Preserve the current level's literal punctuation and all embedded tokens.
    const prefix = template.slice(0, matches[0].index!);
    const text = prefix + template.slice(retained[0].index!);
    const rendered = text.replace(/%([1-9])/g, (_token, raw: string) => {
      const ref = Number(raw) - 1;
      const definition = levels.get(ref) ?? fail(`missing referenced level ${ref}`);
      const format = decimal ? 'decimal' : attr(direct(definition, 'numFmt') ?? fail('missing numFmt'), 'val');
      return formatted(snapshot.counters[ref], format, snapshot, definition, styles);
    });
    const first = Number(retained[0][1]) - 1;
    return !ownOnly && first > minimum ? render(first - 1, minimum, false) + rendered : rendered;
  };
  const result = render(snapshot.ilvl, mode === 'n' ? 0 : from, mode === 'n').replace(/[.\s]+$/, '');
  return result || fail('empty paragraph label');
}

interface Instruction {target: string; mode: 'n' | 'r' | 'w'; suppressText: boolean}
function instruction(raw: string): Instruction | undefined {
  const match = /^\s*REF\s+(?:"([^"]+)"|([^\s\\]+))([\s\S]*)$/i.exec(raw);
  if (!match) { if (/^\s*REF(?:\s|$)/i.test(raw)) fail('malformed REF instruction'); return undefined; }
  const rest = match[3];
  if (!/\\[nrw](?=\s|\\|$)/i.test(rest)) return undefined; // Non-numeric text REF stays a field.
  let cursor = 0; let mode: Instruction['mode'] | undefined; const seen = new Set<string>();
  while (cursor < rest.length) {
    const tail = rest.slice(cursor);
    const token = /^\s*(?:\\([nrwht])|\\\*\s*(MERGEFORMAT))(?=\s|\\|$)/i.exec(tail);
    if (!token) { if (!tail.trim()) break; return fail(`unsupported REF switches: ${rest}`); }
    const key = (token[1] ?? '*').toLowerCase();
    if (seen.has(key)) fail('duplicate REF switch');
    seen.add(key);
    // LibreOffice's DOCX importer gives r > n > w, independent of flag order.
    // This is the PDF-renderer policy, not a claim about all Word versions.
    if (['n', 'r', 'w'].includes(key) && (!mode || ['w', 'n', 'r'].indexOf(key) > ['w', 'n', 'r'].indexOf(mode))) mode = key as Instruction['mode'];
    cursor += token[0].length;
  }
  return {target: match[1] ?? match[2], mode: mode ?? fail('missing numeric REF mode'), suppressText: seen.has('t')};
}

interface Field {code: string; paragraph: Element; texts: Element[]; controls: Element[]; simple?: Element; end?: Element}

/**
 * Materialize numeric REF results in the disposable DOM BEFORE cloning list
 * instances. No IO; all fields/targets/labels preflight before the first edit.
 * Microsoft switch semantics: MS-OE376 2.1.523, sections c/e/f:
 * https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/20bc6d15-ba77-479f-82f4-db3cf7447334
 * The disposable LibreOffice render policy uses the previous numbered snapshot
 * for an unnumbered source paragraph; no preceding snapshot means empty context.
 * Combined numeric switches use LibreOffice precedence r > n > w. The t switch
 * follows Microsoft Word's literal-text suppression (an explicit interop fix,
 * because native LibreOffice ignores t), with ASCII literal words supported.
 * English ordinalText is bounded to 1..20 with verified inherited language.
 * Historical Microsoft-authored switch documentation:
 * https://documentation.help/MS-Office-Word-2003/worefBOOKMARK1.htm
 */
export function materializeNumberingReferences(document: Document, snapshots: NumberingSnapshot[], styles?: Document): number {
  const elements = all(document);
  const snapshotByParagraph = new Map<Element, NumberingSnapshot>();
  for (const snapshot of snapshots) {
    if (snapshot.paragraph.ownerDocument !== document || snapshotByParagraph.has(snapshot.paragraph)) fail('invalid or duplicate snapshot paragraph');
    snapshotByParagraph.set(snapshot.paragraph, snapshot);
  }
  const fields: Field[] = [];
  const precedingSnapshot = new Map<Element, NumberingSnapshot>();
  let previous: NumberingSnapshot | undefined;
  for (const node of elements) {
    if (!is(node, 'p') || ancestor(node, 'txbxContent')) continue;
    previous = snapshotByParagraph.get(node) ?? previous;
    if (previous) precedingSnapshot.set(node, previous);
  }
  let active: Field | undefined; let separated = false;
  const skipped = new Set<Element>();
  for (const node of elements) {
    if (skipped.has(node)) continue;
    if (is(node, 'fldSimple')) {
      if (active) fail('nested field');
      const descendants = all(node).slice(1);
      if (descendants.some(child => is(child, 'fldSimple') || is(child, 'fldChar') || is(child, 'instrText'))) fail('nested simple field');
      for (const child of descendants) skipped.add(child);
      fields.push({code: attr(node, 'instr'), paragraph: ancestor(node, 'p') ?? fail('field outside paragraph'), texts: descendants.filter(child => is(child, 't')), controls: [], simple: node});
    } else if (is(node, 'fldChar')) {
      const kind = attr(node, 'fldCharType');
      if (kind === 'begin') {
        if (active) fail('nested complex field');
        active = {code: '', paragraph: ancestor(node, 'p') ?? fail('field outside paragraph'), texts: [], controls: [node]}; separated = false;
      } else {
        if (!active || ancestor(node, 'p') !== active.paragraph) fail('unpaired or cross-paragraph field');
        active.controls.push(node);
        if (kind === 'separate') { if (separated) fail('duplicate field separator'); separated = true; }
        else if (kind === 'end') { if (!separated) fail('field lacks separator'); active.end = node; fields.push(active); active = undefined; }
        else fail(`unsupported fldCharType ${kind}`);
      }
    } else if (is(node, 'instrText')) {
      if (!active || separated || ancestor(node, 'p') !== active.paragraph) fail('instruction outside field code');
      active.code += node.textContent ?? ''; active.controls.push(node);
    } else if (active && separated && is(node, 't')) {
      if (ancestor(node, 'p') !== active.paragraph) fail('cross-paragraph field result');
      active.texts.push(node);
    }
    else if (active && separated && ['tab', 'br', 'cr', 'drawing', 'object', 'sym'].some(name => is(node, name))) fail('non-text field result');
  }
  if (active) fail('unclosed field');
  const selected = fields.flatMap(field => { const parsed = instruction(field.code); return parsed ? [{field, parsed}] : []; });
  const plans = selected.map(({field, parsed}) => {
    if (ancestor(field.paragraph, 'txbxContent')) fail('numeric REF in textbox is unsupported');
    if (field.simple && all(field.simple).some(node => ['tab', 'br', 'cr', 'drawing', 'object', 'sym'].some(name => is(node, name)))) fail('non-text simple field result');
    const insertionRun = !field.simple && !field.texts.length ? ancestor(field.end!, 'r') ?? fail('field end outside run') : undefined;
    const starts = elements.filter(node => is(node, 'bookmarkStart') && attr(node, 'name') === parsed.target);
    if (starts.length !== 1) fail(`target ${parsed.target} has ${starts.length} bookmark starts`);
    const start = starts[0];
    const rawId = attr(start, 'id');
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) fail(`target ${parsed.target} has invalid bookmark ID`);
    const sameId = (node: Element) => /^\d+$/.test(attr(node, 'id')) && Number(attr(node, 'id')) === Number(rawId);
    if (elements.filter(node => is(node, 'bookmarkStart') && sameId(node)).length !== 1) fail(`target ${parsed.target} has duplicate numeric bookmark ID`);
    const ends = elements.filter(node => is(node, 'bookmarkEnd') && sameId(node));
    if (ends.length !== 1) fail(`target ${parsed.target} has ${ends.length} bookmark ends`);
    const startIndex = elements.indexOf(start); const endIndex = elements.indexOf(ends[0]);
    if (endIndex <= startIndex) fail(`target ${parsed.target} has reversed range`);
    const paragraphs = new Set(elements.slice(startIndex, endIndex + 1).map(node => ancestor(node, 'p')).filter((p): p is Element => !!p));
    const targetParagraph = ancestor(start, 'p') ?? fail('bookmark start outside paragraph');
    // LibreOffice numeric REF resolves the bookmark's START paragraph, even if
    // the range includes further numbered paragraphs. Nested stories remain
    // unsupported; an unnumbered start is never replaced with a later heading.
    if ([...paragraphs].some(paragraph => ancestor(paragraph.parentNode!, 'p') || ancestor(paragraph, 'txbxContent'))) fail(`target ${parsed.target} spans ambiguous paragraphs`);
    if (ancestor(targetParagraph, 'txbxContent')) fail('numbered textbox target unsupported');
    const snapshot = snapshotByParagraph.get(targetParagraph) ?? fail(`target ${parsed.target} is not a numbered paragraph`);
    const value = label(snapshot, parsed.mode, precedingSnapshot.get(field.paragraph), styles, parsed.suppressText);
    return {field, value, insertionRun};
  });
  for (const {field, value, insertionRun} of plans) {
    let offset = 0;
    if (!field.texts.length) {
      const run = field.simple ? document.createElementNS(W, 'w:r') : insertionRun!;
      const text = document.createElementNS(W, 'w:t'); run.appendChild(text);
      if (field.simple) field.simple.appendChild(run);
      field.texts.push(text);
    }
    field.texts.forEach((text, index) => {
      const length = index === field.texts.length - 1 ? value.length - offset : Math.min((text.textContent ?? '').length, value.length - offset);
      text.textContent = value.slice(offset, offset + length); offset += length;
      preserveXmlSpace(text);
    });
    for (const control of field.controls) control.parentNode!.removeChild(control);
    if (field.simple) {
      const parent = field.simple.parentNode!;
      while (field.simple.firstChild) parent.insertBefore(field.simple.firstChild, field.simple);
      parent.removeChild(field.simple);
    }
  }
  return plans.length;
}
