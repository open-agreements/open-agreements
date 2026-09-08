import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface NumberingSnapshot {
  paragraph: XmlElement;
  numId: string;
  ilvl: number;
  /** Nine scalar values; unseen levels use their effective starts, or zero if undefined. */
  counters: number[];
  /** Detached effective definition with instance overrides folded in. Never an input node. */
  effectiveAbstract: XmlElement;
}

function children(parent: XmlElement, local: string): XmlElement[] {
  return Array.from(parent.childNodes).filter((node): node is XmlElement => node.nodeType === 1
    && (node as XmlElement).namespaceURI === W && (node as XmlElement).localName === local);
}
function direct(parent: XmlElement | null, local: string): XmlElement | null {
  if (!parent) return null;
  const found = children(parent, local);
  if (found.length > 1) throw new Error(`numbering counters: duplicate ${local}`);
  return found[0] ?? null;
}
function attr(element: XmlElement, local: string): string {
  return element.getAttributeNS(W, local) ?? '';
}
function integer(raw: string, context: string, max = Number.MAX_SAFE_INTEGER): number {
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) {
    throw new Error(`numbering counters: invalid ${context}: ${raw}`);
  }
  return Number(raw);
}
function id(element: XmlElement, local: string): string {
  return String(integer(attr(element, local), local));
}

interface PartialNumbering { numId?: string; ilvl?: number }
function fromProperties(properties: XmlElement | null): PartialNumbering {
  const numPr = direct(properties, 'numPr');
  if (!numPr) return {};
  if (direct(numPr, 'numberingChange') || direct(numPr, 'ins')) {
    throw new Error('numbering counters: tracked numbering changes are unsupported');
  }
  const num = direct(numPr, 'numId');
  const level = direct(numPr, 'ilvl');
  return {
    ...(num ? { numId: id(num, 'val') } : {}),
    ...(level ? { ilvl: integer(attr(level, 'val'), 'paragraph level', 8) } : {}),
  };
}

function paragraphResolver(styles: XmlDocument | undefined): (p: XmlElement) => PartialNumbering {
  const definitions = new Map<string, XmlElement>();
  let defaultId: string | undefined;
  for (const style of Array.from(styles?.getElementsByTagNameNS(W, 'style') ?? [])) {
    if (attr(style, 'type') !== 'paragraph') continue;
    const key = attr(style, 'styleId');
    if (!key || definitions.has(key)) throw new Error('numbering counters: missing/duplicate paragraph style ID');
    definitions.set(key, style);
    if (['1', 'true', 'on'].includes(attr(style, 'default'))) {
      if (defaultId) throw new Error('numbering counters: multiple default paragraph styles');
      defaultId = key;
    }
  }
  const defaults = fromProperties(direct(direct(direct(styles?.documentElement ?? null, 'docDefaults'), 'pPrDefault'), 'pPr'));
  const cache = new Map<string, PartialNumbering>();
  const visiting = new Set<string>();
  const resolve = (key: string): PartialNumbering => {
    if (cache.has(key)) return cache.get(key)!;
    if (visiting.has(key)) throw new Error(`numbering counters: paragraph style cycle at ${key}`);
    const style = definitions.get(key);
    if (!style) throw new Error(`numbering counters: unresolved paragraph style ${key}`);
    visiting.add(key);
    const parent = direct(style, 'basedOn');
    const result = { ...(parent ? resolve(attr(parent, 'val')) : defaults), ...fromProperties(direct(style, 'pPr')) };
    visiting.delete(key);
    cache.set(key, result);
    return result;
  };
  return (paragraph) => {
    const properties = direct(paragraph, 'pPr');
    const style = direct(properties, 'pStyle');
    const styleId = style ? attr(style, 'val') : defaultId;
    return { ...(styleId ? resolve(styleId) : defaults), ...fromProperties(properties) };
  };
}

interface Level { start: number; restart: number }
interface Instance { abstract: XmlElement; levels: Map<number, Level>; values: Array<number | undefined> }

/**
 * Pure counter projection for a transient renderer copy, not editable-DOCX rewriting.
 * OOXML defaults: absent start = 0; absent lvlRestart = previous level; 0 = never.
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.levelrestart
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.startnumberingvalue
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.startoverridenumberingvalue
 */
export function resolveNumberingSnapshots(
  document: XmlDocument, styles: XmlDocument | undefined, numbering: XmlDocument,
): NumberingSnapshot[] {
  const abstracts = new Map<string, XmlElement>();
  const numbers = new Map<string, XmlElement>();
  const numberingRoot = numbering.documentElement;
  if (!numberingRoot) throw new Error('numbering counters: missing numbering document root');
  for (const node of children(numberingRoot, 'abstractNum')) {
    const key = id(node, 'abstractNumId');
    if (abstracts.has(key)) throw new Error(`numbering counters: duplicate abstractNum ${key}`);
    abstracts.set(key, node);
  }
  for (const node of children(numberingRoot, 'num')) {
    const key = id(node, 'numId');
    if (numbers.has(key)) throw new Error(`numbering counters: duplicate numId ${key}`);
    numbers.set(key, node);
  }
  const instances = new Map<string, Instance>();
  const instance = (numId: string): Instance => {
    if (instances.has(numId)) return instances.get(numId)!;
    const num = numbers.get(numId);
    const abstractId = num && direct(num, 'abstractNumId');
    const source = abstractId && abstracts.get(id(abstractId, 'val'));
    if (!num || !source) throw new Error(`numbering counters: unresolved numbering instance ${numId}`);
    if (direct(source, 'numStyleLink') || direct(source, 'styleLink')) {
      throw new Error(`numbering counters: numbering style links unsupported for ${numId}`);
    }
    const effective = source.cloneNode(true) as XmlElement;
    const levelNodes = new Map<number, XmlElement>();
    for (const node of children(effective, 'lvl')) {
      const level = integer(attr(node, 'ilvl'), 'abstract level', 8);
      if (levelNodes.has(level)) throw new Error(`numbering counters: duplicate level ${level}`);
      levelNodes.set(level, node);
    }
    const overridden = new Set<number>();
    for (const override of children(num, 'lvlOverride')) {
      const level = integer(attr(override, 'ilvl'), 'override level', 8);
      if (overridden.has(level)) throw new Error(`numbering counters: duplicate override ${level}`);
      overridden.add(level);
      const replacement = direct(override, 'lvl');
      let node = levelNodes.get(level);
      if (replacement) {
        if (integer(attr(replacement, 'ilvl'), 'override child level', 8) !== level) {
          throw new Error('numbering counters: override level mismatch');
        }
        const clone = replacement.cloneNode(true) as XmlElement;
        if (node) effective.replaceChild(clone, node); else effective.appendChild(clone);
        node = clone;
        levelNodes.set(level, node);
      }
      if (!node) throw new Error(`numbering counters: override references undefined level ${level}`);
      const startOverride = direct(override, 'startOverride');
      if (startOverride) {
        const startValue = integer(attr(startOverride, 'val'), 'startOverride');
        let start = direct(node, 'start');
        if (!start) { start = numbering.createElementNS(W, 'w:start'); node.insertBefore(start, node.firstChild); }
        start.setAttributeNS(W, 'w:val', String(startValue));
      }
    }
    const levels = new Map<number, Level>();
    for (const [level, node] of levelNodes) {
      const start = direct(node, 'start');
      const restart = direct(node, 'lvlRestart');
      const restartValue = restart ? integer(attr(restart, 'val'), 'lvlRestart', 9) : level;
      // A restart reference to this/lower level is ignored by OOXML, using the default.
      levels.set(level, { start: start ? integer(attr(start, 'val'), 'start') : 0, restart: restartValue > level ? level : restartValue });
      const text = direct(node, 'lvlText');
      for (const match of attr(text ?? node, 'val').matchAll(/%([1-9])/g)) {
        const referenced = Number(match[1]) - 1;
        if (referenced <= level && !levelNodes.has(referenced)) {
          throw new Error(`numbering counters: level ${level} references undefined ancestor ${referenced}`);
        }
      }
    }
    const result: Instance = { abstract: effective, levels, values: Array<number | undefined>(9).fill(undefined) };
    instances.set(numId, result);
    return result;
  };
  const resolveParagraph = paragraphResolver(styles);
  const snapshots: NumberingSnapshot[] = [];
  for (const paragraph of Array.from(document.getElementsByTagNameNS(W, 'p'))) {
    const resolved = resolveParagraph(paragraph);
    if (!resolved.numId || resolved.numId === '0') continue;
    const ilvl = resolved.ilvl ?? 0;
    const state = instance(resolved.numId);
    const definition = state.levels.get(ilvl);
    if (!definition) throw new Error(`numbering counters: undefined level ${ilvl} for ${resolved.numId}`);
    const prior = state.values[ilvl];
    state.values[ilvl] = prior === undefined ? definition.start : prior + 1;
    if (!Number.isSafeInteger(state.values[ilvl])) throw new Error('numbering counters: counter overflow');
    for (const [level, lower] of state.levels) {
      if (level > ilvl && lower.restart > 0 && ilvl < lower.restart) state.values[level] = undefined;
    }
    const counters = Array.from({ length: 9 }, (_, level) => state.values[level] ?? state.levels.get(level)?.start ?? 0);
    snapshots.push({ paragraph, numId: resolved.numId, ilvl, counters, effectiveAbstract: state.abstract.cloneNode(true) as XmlElement });
  }
  return snapshots;
}
