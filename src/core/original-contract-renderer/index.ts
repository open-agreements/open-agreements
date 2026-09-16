/** Bounded canonical Markdoc renderer; a new profile, not legacy pagination. */
import Markdoc, { type Node } from '@markdoc/markdoc';
import yaml from 'js-yaml';
import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, HeightRule, LevelFormat,
  Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { FieldDefinition } from '../metadata.js';
import type { ConfirmClauseDescriptor } from '../fill-pipeline.js';

export type OriginalRenderBinding = { kind: 'field'; field: string } | { kind: 'branch'; field: string }
  | { kind: 'array'; field: string; item: string; itemFields: string[] };
export type SyntheticGate = { field: string; anyOf?: string[]; allOf?: string[]; not?: string };
export interface OriginalRenderResult {
  buffer: Buffer; profile: 'oa-original-markdoc-docx-v1'; bindings: OriginalRenderBinding[];
  sourceBindings: OriginalRenderBinding[]; syntheticGates: SyntheticGate[];
  confirmClauses: ConfirmClauseDescriptor[];
  clauses: Array<{ id: string; condition?: string; bodyLiteral: string }>;
  compatibilityNotes: string[];
}
type Block = Paragraph | Table;
type InlineStyle = { bold?: boolean; italics?: boolean; font?: string; size?: number; color?: string };
type Scope = { field: string; item: string; fields: Map<string, FieldDefinition>; used: Set<string> };
const KEY = /^[a-z][a-z0-9_]{0,99}$/;
const ID = /^[a-z][a-z0-9_-]{0,159}$/;
const ATTRIBUTES: Record<string, string[]> = {
  'agreement-section': ['type'], 'cover-terms': [],
  'cover-term': ['kind', 'label', 'field', 'include-when', 'include-when-any'],
  clause: ['id', 'type', 'include-when', 'confirm'], field: ['name'],
  'field-note': ['as_of', 'eyebrow', 'field'], requirement: ['id', 'value'],
  'signature-block': ['arrangement'], signer: ['id', 'kind', 'capacity', 'label'], repeat: ['field'],
};
const LAYOUTS = new Set(['cover-standard-signature-v1', 'traditional-consent-v1', 'checklist-list-v1', 'roster-list-v1']);
const FRONTMATTER_KEYS = new Set([
  'allow_derivatives', 'artifact_kind', 'artifact_type', 'attribution_text', 'capabilities', 'category',
  'description', 'distribution', 'document', 'fields', 'layout_id', 'license', 'maturity', 'mutation_policy',
  'name', 'omitted_clauses', 'party_roles', 'priority_fields', 'sections', 'signature_roles', 'source_url',
  'style_id', 'template_id', 'version',
]);
const DOCUMENT_KEYS = new Set([
  'title', 'label', 'version', 'license', 'defined_term_highlight_mode', 'include_cloud_doc_line',
  'cover_row_height', 'footer_font_size_half_points', 'presentation',
]);
const definedTerms = (text: string) => text.replace(/\[\[([^\]\r\n]+)\]\]/g, '“$1”');
function attr(node: Node, name: string, required = false): string | undefined {
  const value = node.attributes[name];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && !value.length)) throw new Error(`Invalid ${node.tag}.${name}`);
  return value;
}
function tag(node: Node): string {
  const name = node.tag;
  if (!name || !Object.hasOwn(ATTRIBUTES, name)) throw new Error(`Unsupported canonical tag: ${name}`);
  for (const key of Object.keys(node.attributes)) if (!ATTRIBUTES[name].includes(key)) throw new Error(`Unsupported ${name} attribute: ${key}`);
  return name;
}
function literal(node: Node): string {
  if (node.type === 'text') return String(node.attributes.content);
  if (node.type === 'softbreak') return ' ';
  if (node.type === 'tag' && ['field', 'field-note'].includes(node.tag ?? '')) return '';
  return node.children.map(literal).join(['clause', 'signer'].includes(node.tag ?? '') ? ' ' : '');
}

export async function renderOriginalMarkdoc(source: string, fields: FieldDefinition[]): Promise<OriginalRenderResult> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
  if (!match) throw new Error('Canonical source requires YAML frontmatter');
  const front = yaml.load(match[1]) as Record<string, unknown>;
  if (!front || !LAYOUTS.has(String(front.layout_id)) || front.style_id !== 'openagreements-default-v1') throw new Error('Unsupported canonical layout/style');
  for (const key of Object.keys(front)) if (!FRONTMATTER_KEYS.has(key)) throw new Error(`Unsupported canonical frontmatter setting: ${key}`);
  if (front.omitted_clauses !== undefined && front.omitted_clauses !== 'drop') throw new Error('Unsupported omitted-clause policy');
  const meta = front.document as Record<string, unknown> | undefined;
  if (!meta || typeof meta.title !== 'string') throw new Error('Canonical document title is required');
  for (const key of Object.keys(meta)) if (!DOCUMENT_KEYS.has(key)) throw new Error(`Unsupported canonical document setting: ${key}`);
  if (meta.presentation !== undefined && meta.presentation !== 'traditional') throw new Error('Unsupported document presentation');
  if (meta.defined_term_highlight_mode !== undefined && !['all_instances', 'definition_site_only', 'none'].includes(String(meta.defined_term_highlight_mode))) {
    throw new Error('Unsupported defined-term highlight mode');
  }
  // The native profile represents [[defined terms]] with typographic quotes
  // and never applies background highlighting. These legacy highlight modes
  // are therefore recognized compatibility declarations, not dropped prose.
  // This source flag controls the hosted/cloud reading surface, not DOCX
  // content. The bounded DOCX profile recognizes the only authored value so a
  // future false/alternate semantic cannot be accepted and silently ignored.
  if (meta.include_cloud_doc_line !== undefined && meta.include_cloud_doc_line !== true) throw new Error('Unsupported include_cloud_doc_line value');
  const compatibilityNotes = meta.include_cloud_doc_line === true
    ? ['document.include_cloud_doc_line=true is a legacy-inert compatibility flag; the native DOCX profile emits no cloud-document line.']
    : [];
  for (const key of ['cover_row_height', 'footer_font_size_half_points'] as const) {
    const value = meta[key];
    if (value !== undefined && (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > 20_000)) {
      throw new Error(`Invalid canonical document setting: ${key}`);
    }
  }
  for (const key of ['label', 'version', 'license'] as const) {
    const value = meta[key];
    if (value !== undefined && (typeof value !== 'string' || !value.length)) throw new Error(`Invalid canonical document setting: ${key}`);
  }
  const traditional = meta.presentation === 'traditional';
  const definedTermMode = String(meta.defined_term_highlight_mode ?? 'all_instances');
  const root = Markdoc.parse(match[2]);
  const fieldMap = new Map(fields.map(field => [field.name, field]));
  // Audit even presentation-omitted sections. A new unsupported directive in
  // the hidden cover summary must not be silently accepted as understood.
  const audit = (node: Node, itemFields?: ReadonlySet<string>): void => {
    if (node.errors.length) throw new Error(`Malformed Markdoc: ${node.errors.map(error => error.message).join('; ')}`);
    if (!['document', 'heading', 'paragraph', 'inline', 'text', 'softbreak', 'strong', 'em', 'list', 'item', 'tag'].includes(node.type)) {
      throw new Error(`Unsupported canonical AST node: ${node.type}`);
    }
    if (node.type === 'list' && node.attributes.ordered === true &&
      node.attributes.start !== undefined && node.attributes.start !== 1) {
      throw new Error('Unsupported ordered-list start: this profile starts lists at 1');
    }
    let scope = itemFields;
    if (node.type === 'tag') {
      const name = tag(node);
      if (name === 'repeat') {
        const collection = fieldMap.get(attr(node, 'field', true)!);
        if (itemFields || collection?.type !== 'array' || !collection.items?.length) throw new Error('Unsupported repeat shape');
        scope = new Set(collection.items.map(field => field.name));
      }
      for (const key of name === 'field' ? ['name'] : name === 'cover-term' || name === 'field-note' ? ['field'] : []) {
        const ref = attr(node, key, name !== 'cover-term');
        if (ref && (!KEY.test(ref) || (!fieldMap.has(ref) && !scope?.has(ref)))) throw new Error(`Unknown canonical field: ${ref}`);
      }
      const refs: unknown[] = [node.attributes['include-when'], node.attributes.confirm].filter(value => value !== undefined);
      const any = node.attributes['include-when-any'];
      if (any !== undefined) {
        if (!Array.isArray(any) || !any.length) throw new Error('Invalid include-when-any');
        refs.push(...any);
      }
      for (const ref of refs) if (typeof ref !== 'string' || !fieldMap.has(ref)) throw new Error(`Unknown canonical condition: ${String(ref)}`);
    }
    for (const child of node.children) audit(child, scope);
  };
  audit(root);
  const bindings: OriginalRenderBinding[] = [];
  const sourceBindings: OriginalRenderBinding[] = [];
  const syntheticGates: SyntheticGate[] = [];
  const confirmClauses: ConfirmClauseDescriptor[] = [];
  const clauses: OriginalRenderResult['clauses'] = [];
  const scopes: Scope[] = []; const pending: string[] = [];
  const definitionScopes: boolean[] = [];
  const clauseIds = new Set<string>(); const signerIds = new Set<string>();
  const sections = new Set<string>(); const sectionStack: string[] = []; const tagStack: string[] = [];
  let sequence = 0; let listSequence = 0;
  const listNumbering: Array<{ reference: string; levels: Array<{ level: number; format: typeof LevelFormat.DECIMAL; text: string; alignment: typeof AlignmentType.START }> }> = [];
  const requireField = (name: string, purpose: string): FieldDefinition => {
    if (!KEY.test(name) || !fieldMap.has(name)) throw new Error(`Unknown ${purpose}: ${name}`);
    return fieldMap.get(name)!;
  };
  const command = (value: string) => new Paragraph({ children: [new TextRun({ text: `{${value}}`, font: 'Arial', size: 22 })] });
  const run = (text: string, style: InlineStyle = {}) => new TextRun({ text: definedTerms(text), font: 'Arial', size: 22, ...style });
  const markedRuns = (text: string, style: InlineStyle): TextRun[] => {
    const parts = text.split(/(\[\[[^\]\r\n]+\]\])/g).filter(Boolean);
    return parts.map(part => {
      const match = /^\[\[([^\]\r\n]+)\]\]$/.exec(part);
      const highlight = Boolean(match) && (definedTermMode === 'all_instances' ||
        (definedTermMode === 'definition_site_only' && definitionScopes.includes(true)));
      return new TextRun({ text: match ? `“${match[1]}”` : part, font: 'Arial', size: 22, ...style,
        ...(highlight ? { bold: true, color: '117086' } : {}) });
    });
  };
  const fieldRun = (name: string, style: InlineStyle): TextRun => {
    const scope = scopes.at(-1);
    if (scope?.fields.has(name)) { scope.used.add(name); return run(`{$${scope.item}.${name}}`, style); }
    requireField(name, 'field');
    bindings.push({ kind: 'field', field: name }); sourceBindings.push({ kind: 'field', field: name });
    return run(`{${name}}`, style);
  };
  const newGate = (definition: Omit<SyntheticGate, 'field'>) => {
    const field = `oa_render_gate_${sequence++}`;
    if (fieldMap.has(field)) throw new Error(`Reserved renderer field collision: ${field}`);
    syntheticGates.push({ field, ...definition }); return field;
  };
  const condition = (node: Node): string | undefined => {
    const single = attr(node, 'include-when'); const any = node.attributes['include-when-any'];
    if (single !== undefined && any !== undefined) throw new Error('Ambiguous condition attributes');
    if (single === undefined && any === undefined) return undefined;
    const refs = single === undefined ? any : [single];
    if (!Array.isArray(refs) || !refs.length || refs.some(ref => typeof ref !== 'string')) throw new Error('Invalid include-when-any');
    for (const ref of refs as string[]) {
      const field = requireField(ref, 'condition');
      if (!['boolean', 'string', 'date', 'number', 'enum'].includes(field.type)) throw new Error(`Unsupported conditional type: ${field.type}`);
      sourceBindings.push({ kind: 'branch', field: ref });
    }
    return newGate({ anyOf: refs as string[] });
  };
  const wrap = (gate: string | undefined, contents: Block[]): Block[] => {
    if (!gate) return contents;
    bindings.push({ kind: 'branch', field: gate }); return [command(`IF ${gate}`), ...contents, command('END-IF')];
  };
  const inline = (nodes: Node[], style: InlineStyle = {}): TextRun[] => nodes.flatMap(node => {
    if (node.errors.length) throw new Error(`Malformed Markdoc: ${node.errors.map(error => error.message).join('; ')}`);
    if (node.type === 'text') return markedRuns(String(node.attributes.content), style);
    if (node.type === 'softbreak') return tagStack.includes('signer')
      ? [run(' ', style), new TextRun({ break: 1, font: 'Arial', size: 22 })]
      : [run(' ', style)];
    if (node.type === 'inline') return inline(node.children, style);
    if (node.type === 'strong') return inline(node.children, { ...style, bold: true });
    if (node.type === 'em') return inline(node.children, { ...style, italics: true });
    if (node.type === 'tag') {
      const name = tag(node);
      if (name === 'field') {
        if (node.children.length) throw new Error('field must be empty');
        return [fieldRun(attr(node, 'name', true)!, style)];
      }
      if (name === 'requirement') {
        attr(node, 'id', true); const value = attr(node, 'value');
        if (value !== undefined && !['parameterized', 'while-trade-secret'].includes(value)) throw new Error('Unsupported requirement value');
        return inline(node.children, style);
      }
    }
    throw new Error(`Unsupported inline node: ${node.type}/${node.tag ?? ''}`);
  });
  const paragraph = (runs: TextRun[], extra: ConstructorParameters<typeof Paragraph>[0] = {}) => new Paragraph({
    spacing: { after: 160, line: 264 }, children: runs, ...(typeof extra === 'object' ? extra : {}),
  });
  const blocks = (nodes: Node[], inClause = false): Block[] => nodes.flatMap(node => {
    if (node.errors.length) throw new Error(`Malformed Markdoc: ${node.errors.map(error => error.message).join('; ')}`);
    if (node.type === 'document') return blocks(node.children);
    if (node.type === 'paragraph' || node.type === 'inline') return [paragraph(inline(node.children))];
    if (node.type === 'heading') {
      const level = node.attributes.level;
      if (![1, 2, 3].includes(level)) throw new Error(`Unsupported heading level: ${level}`);
      return [paragraph(inline(node.children, { font: level === 1 ? 'Georgia' : 'Arial',
        size: level === 1 ? 46 : level === 2 ? 30 : 24, bold: level !== 1, color: level === 2 ? '117086' : '1D2021' }), {
        heading: level === 1 ? HeadingLevel.TITLE : level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        keepNext: true, spacing: { before: level === 1 ? 80 : 220, after: 140 },
        ...(inClause && level === 3 ? { numbering: { reference: 'oa-clause', level: 0 } } : {}),
      })];
    }
    if (node.type === 'list') {
      const ordered = node.attributes.ordered;
      if (typeof ordered !== 'boolean') throw new Error('Invalid list type');
      const reference = `oa-list-${listSequence++}`;
      if (ordered) listNumbering.push({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] });
      return node.children.flatMap(item => {
        if (item.type !== 'item') throw new Error('Invalid list child');
        const paras = item.children.every(child => child.type === 'paragraph') ? item.children : [item];
        return paras.map((part, index) => paragraph(inline(part.children), index === 0
          ? ordered ? { numbering: { reference, level: 0 } } : { bullet: { level: 0 } }
          : { indent: { left: 360 } }));
      });
    }
    if (node.type !== 'tag') throw new Error(`Unsupported canonical AST node: ${node.type}`);
    const name = tag(node); const parent = tagStack.at(-1);
    if (name === 'field') return [paragraph(inline([node]))];
    if (name === 'field-note') {
      for (const attribute of ATTRIBUTES[name]) attr(node, attribute, true);
      requireField(String(node.attributes.field), 'field-note');
      if (node.children.length) throw new Error('Nonempty field-note is unsupported');
      return []; // Explicit web-only guidance, not operative document text.
    }
    if (name === 'cover-term') {
      if (parent !== 'cover-terms') throw new Error('cover-term must be inside cover-terms');
      const kind = attr(node, 'kind', true)!; const label = attr(node, 'label', true)!;
      if (!['row', 'subrow', 'group'].includes(kind)) throw new Error('Unsupported cover-term kind');
      const value = attr(node, 'field');
      if (kind !== 'group' && !value) throw new Error('Non-group cover-term requires field');
      if (node.children.length) throw new Error('Nonempty cover-term is unsupported');
      const gate = condition(node);
      const labelCell = new TableCell({ ...(kind === 'group' ? { columnSpan: 2, shading: { fill: 'EDF3F5' } } : {}),
        children: [paragraph([new TextRun({ text: label, font: 'Arial', size: kind === 'subrow' ? 19 : 21, bold: true })])],
      });
      const cells = kind === 'group' ? [labelCell] : [labelCell, new TableCell({ children: [paragraph([fieldRun(value!, {})])] })];
      return wrap(gate, [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3000, 6360],
        borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.SINGLE, color: 'D7DEE1', size: 4 }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        rows: [new TableRow({ cantSplit: true,
          ...(typeof meta.cover_row_height === 'number' ? { height: { value: meta.cover_row_height, rule: HeightRule.ATLEAST } } : {}),
          children: cells })],
      })]);
    }
    if (name === 'repeat') {
      if (!['signature-block', 'clause'].includes(parent ?? '')) throw new Error('repeat must be inside a signature-block or clause');
      const field = attr(node, 'field', true)!; const definition = requireField(field, 'repeat');
      if (definition.type !== 'array' || !definition.items?.length || scopes.length) throw new Error('Unsupported repeat shape');
      const scope = { field, item: `${field}_item`, fields: new Map(definition.items.map(item => [item.name, item])), used: new Set<string>() };
      scopes.push(scope); tagStack.push(name); const contents = blocks(node.children, inClause); tagStack.pop(); scopes.pop();
      const binding: OriginalRenderBinding = { kind: 'array', field, item: scope.item, itemFields: [...scope.used].sort() };
      bindings.push(binding); sourceBindings.push(binding);
      return [command(`FOR ${scope.item} IN ${field}`), ...contents, command(`END-FOR ${scope.item}`)];
    }
    if (name === 'agreement-section') {
      if (parent) throw new Error('agreement-section must be top-level');
      const section = attr(node, 'type', true)!;
      if (!['cover_terms', 'standard_terms', 'signature'].includes(section) || sections.has(section)) throw new Error('Unsupported/duplicate agreement section');
      sections.add(section);
      // Traditional instruments intentionally omit the reader-facing summary.
      if (traditional && section === 'cover_terms') return [];
      sectionStack.push(section);
    } else if (name === 'clause') {
      if (parent !== 'agreement-section' || sectionStack.at(-1) !== 'standard_terms') throw new Error('clause must be a standard-terms section child');
      const id = attr(node, 'id', true)!;
      if (!ID.test(id) || clauseIds.has(id)) throw new Error(`Invalid/duplicate clause id: ${id}`);
      clauseIds.add(id); const type = attr(node, 'type');
      if (type !== undefined && type !== 'definitions') throw new Error('Unsupported clause type');
      clauses.push({ id, ...(node.attributes['include-when'] ? { condition: String(node.attributes['include-when']) } : {}), bodyLiteral: definedTerms(literal(node)) });
    } else if (name === 'signature-block') {
      if (parent !== 'agreement-section' || sectionStack.at(-1) !== 'signature') throw new Error('signature-block must be a signature-section child');
      if (!['stacked-consent-signers', 'entity-plus-individual'].includes(attr(node, 'arrangement', true)!)) throw new Error('Unsupported signature arrangement');
    } else if (name === 'signer') {
      const id = attr(node, 'id', true)!;
      if (!ID.test(id) || signerIds.has(id) || !['entity', 'individual'].includes(attr(node, 'kind', true)!) ||
        !['personal', 'through_representative', 'authorized'].includes(attr(node, 'capacity', true)!)) throw new Error('Invalid signer attributes');
      signerIds.add(id);
      attr(node, 'label', true);
      if (!['signature-block', 'repeat'].includes(parent ?? '')) throw new Error('signer must be inside signature-block/repeat');
    } else if (name === 'requirement') {
      attr(node, 'id', true); const value = attr(node, 'value');
      if (value !== undefined && !['parameterized', 'while-trade-secret'].includes(value)) throw new Error('Unsupported requirement value');
    } else if (name === 'cover-terms' && (parent !== 'agreement-section' || sectionStack.at(-1) !== 'cover_terms')) throw new Error('cover-terms must be a cover-terms section child');
    const gate = condition(node); tagStack.push(name);
    definitionScopes.push(name === 'clause' && node.attributes.type === 'definitions');
    const selectedChildren = traditional && name === 'agreement-section' && attr(node, 'type') === 'standard_terms'
      && node.children[0]?.type === 'heading' && literal(node.children[0]).trim() === meta.title
      ? node.children.slice(1) : node.children;
    const contents = blocks(selectedChildren, inClause || name === 'clause'); definitionScopes.pop(); tagStack.pop();
    if (name === 'agreement-section') sectionStack.pop();
    if (name === 'signer') {
      const label = attr(node, 'label', true)!;
      // Some canonical signers already begin with an explicit party caption.
      // Keep that authored caption rather than printing the metadata label twice.
      const authoredCaption = node.children[0] && ['paragraph', 'heading'].includes(node.children[0].type)
        && literal(node.children[0]).trim() === label;
      if (!authoredCaption) contents.unshift(paragraph([run(label, { bold: true })], { keepNext: true }));
    }
    const confirm = attr(node, 'confirm');
    if (confirm) {
      if (name !== 'clause') throw new Error('confirm is only supported on clauses');
      const field = requireField(confirm, 'confirmation');
      if (field.type !== 'boolean' || !field.statutory_compliance_representation || !field.confirm_note || !field.authority_url) throw new Error('Incomplete statutory confirmation metadata');
      const pendingGate = newGate({ allOf: gate ? [gate] : [], not: confirm }); pending.push(pendingGate);
      confirmClauses.push({ id: String(node.attributes.id), confirm, ...(node.attributes['include-when'] ? { condition: String(node.attributes['include-when']) } : {}) });
      sourceBindings.push({ kind: 'branch', field: confirm });
      contents.push(...wrap(pendingGate, [paragraph([new TextRun({
        text: `[CONFIRM before signing: ${field.confirm_note}; see ${field.authority_url}]`, font: 'Arial', size: 22, highlight: 'yellow', bold: true,
      })])]));
    }
    return wrap(gate, contents);
  });
  let children = blocks([root]);
  if (pending.length) {
    const globalGate = newGate({ anyOf: pending });
    children = [...wrap(globalGate, [paragraph([new TextRun({
      text: 'CONFIRM BEFORE SIGNING: Applicable statutory compliance facts remain unconfirmed. Review each highlighted confirmation notice before signing.',
      font: 'Arial', size: 22, bold: true, highlight: 'yellow',
    })])]), ...children];
  }
  if (!children.length) throw new Error('Canonical document has no rendered content');
  const document = new Document({ title: meta.title, creator: 'OpenAgreements',
    styles: { default: { document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 264, after: 160 } } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Georgia', size: 46, color: '1D2021' } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: 'Arial', size: 30, bold: true, color: '117086' } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', run: { font: 'Arial', size: 24, bold: true } },
    ] },
    numbering: { config: [{ reference: 'oa-clause', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] }, ...listNumbering] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: String(meta.label ?? meta.title), font: 'Arial', size: 18, color: '555555' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({
        text: `${meta.label ?? meta.title}${meta.version ? ` (v${meta.version})` : ''}${front.attribution_text ?? meta.license ? `. ${String(front.attribution_text ?? meta.license)}` : ''}`,
        font: 'Arial', size: typeof meta.footer_font_size_half_points === 'number' ? meta.footer_font_size_half_points : 16, color: '555555',
      })] })] }) }, children }],
  });
  return { buffer: Buffer.from(await Packer.toBuffer(document)), profile: 'oa-original-markdoc-docx-v1', bindings, sourceBindings, syntheticGates, confirmClauses, clauses, compatibilityNotes };
}
