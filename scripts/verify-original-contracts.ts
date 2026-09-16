#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import Markdoc from '@markdoc/markdoc';
import { DOMParser } from '@xmldom/xmldom';
import canonicalize from 'canonicalize';
import yaml from 'js-yaml';
import { fillTemplate } from '../src/core/engine.js';
import { compileOriginalContract, fillOriginalContract } from '../src/core/original-contract.js';
import { loadMetadata, type TemplateMetadata } from '../src/core/metadata.js';
import {
  expectedOriginalCaseInventory,
  generateOriginalVerificationCases,
} from './original-contract-cases.mjs';

export { generateVerificationCases } from './original-contract-cases.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const ORIGINALS_ROOTS = [
  join(ROOT, 'templates', 'openagreements-cc-by-4.0'),
  join(ROOT, 'templates', 'openagreements-cc0-1.0'),
] as const;
/** Backward-compatible name for callers targeting the CC-BY corpus alone. */
export const ORIGINALS_ROOT = ORIGINALS_ROOTS[0];
export const DEFAULT_EVIDENCE_ROOT = join(ROOT, '.cache', 'original-contracts');
const PROFILE = 'oa-original-contract-verification-v1';
const SOURCE_FILES = [
  'metadata.yaml', 'template.mdoc', 'template.docx', 'template.fill.docx',
  '.template.generated.json', 'clean.json', 'replacements.json', 'selections.json',
];
const RUNTIME_FILES = [
  'src/core/original-contract.ts', 'src/core/engine.ts',
  'src/core/original-contract-renderer/index.ts',
  'src/core/unified-pipeline.ts', 'scripts/verify-original-contracts.ts', 'package-lock.json',
  'scripts/original-contract-cases.mjs',
  'scripts/template_renderer/canonical-source.mjs', 'scripts/template_renderer/index.mjs',
  'scripts/template_renderer/layouts/cover-standard-signature-v1.mjs',
  'scripts/template_renderer/layouts/traditional-consent-v1.mjs',
  'scripts/template-specs/styles/openagreements-default-v1.json',
  'scripts/lib/docx-post-process.mjs',
];

type Values = Record<string, unknown>;
type GeneratedCase = { id: string; purpose: string; values: Values; mode?: 'legacy-parity' | 'canonical-only'; expected_error?: string };
type CaseResult = {
  id: string;
  purpose: string;
  status: 'passed' | 'blocked';
  reasons: string[];
  diagnostics?: string[];
  values_sha256: string;
  legacy_sha256?: string;
  declarative_sha256?: string;
  visible_text_sha256?: string;
  compared_entries?: number;
};

export interface VerificationReceipt {
  profile: typeof PROFILE;
  template_id: string;
  status: 'verified' | 'blocked';
  promotion: { eligible: boolean; reason: string };
  source: { digest: string; files: Record<string, string> };
  runtime: { digest: string; files: Record<string, string> };
  compiled_contract_sha256: string;
  case_inventory_sha256: string;
  coverage: {
    strategy: string;
    limits: string[];
    real_world_attestations_synthesized: false;
    synthetic_confirmation_true_cases: number;
    generated_cases: number;
  };
  cases: CaseResult[];
  summary: { passed: number; blocked: number; reasons: string[] };
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value: unknown): string {
  const serialized = canonicalize(value);
  if (serialized === undefined) throw new Error('Value cannot be canonicalized');
  return serialized;
}

function digestFiles(base: string, names: string[], requireAll = false): { digest: string; files: Record<string, string> } {
  const files: Record<string, string> = {};
  for (const name of names) {
    const path = join(base, name);
    if (existsSync(path)) files[name] = sha256(readFileSync(path));
    else if (requireAll) throw new Error(`Digest input is missing: ${path}`);
  }
  return { digest: sha256(canonical(files)), files };
}

function discoverOneRoot(root: string): string[] {
  if (!existsSync(root)) throw new Error(`Originals root does not exist: ${root}`);
  const entries = readdirSync(root, { withFileTypes: true });
  const nonDirectories = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
  if (nonDirectories.length) {
    throw new Error(`Originals root contains unexpected non-template entries: ${nonDirectories.join(', ')}`);
  }
  const dirs = entries.map((entry) => join(root, entry.name)).sort();
  if (dirs.length === 0) throw new Error(`No original templates discovered under ${root}`);
  for (const dir of dirs) {
    for (const required of ['metadata.yaml', 'template.mdoc']) {
      if (!existsSync(join(dir, required))) {
        throw new Error(`Discovered template ${relative(root, dir)} is incomplete: missing ${required}`);
      }
    }
    if (!existsSync(join(dir, 'template.fill.docx')) && !existsSync(join(dir, 'template.docx'))) {
      throw new Error(`Discovered template ${relative(root, dir)} has no DOCX source`);
    }
  }
  return dirs;
}

export function discoverOriginalTemplateDirs(roots: string | readonly string[] = ORIGINALS_ROOTS): string[] {
  const requested = typeof roots === 'string' ? [roots] : [...roots];
  const dirs = requested.flatMap(discoverOneRoot);
  const ids = dirs.map((dir) => basename(dir));
  if (new Set(ids).size !== ids.length) throw new Error('Original template IDs must be unique across license roots');
  return dirs.sort();
}

function zipEntries(path: string): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  for (const entry of new AdmZip(path).getEntries()) {
    if (!entry.isDirectory) entries.set(entry.entryName, entry.getData());
  }
  return entries;
}

function compareDocxEntries(leftPath: string, rightPath: string): { count: number; reasons: string[] } {
  const left = zipEntries(leftPath);
  const right = zipEntries(rightPath);
  const names = [...new Set([...left.keys(), ...right.keys()])].sort();
  const reasons: string[] = [];
  for (const name of names) {
    if (!left.has(name)) reasons.push(`declarative-only ZIP entry: ${name}`);
    else if (!right.has(name)) reasons.push(`legacy-only ZIP entry: ${name}`);
    else if (!left.get(name)!.equals(right.get(name)!)) reasons.push(`ZIP entry bytes differ: ${name}`);
  }
  return { count: names.length, reasons };
}

function renderedText(path: string): string {
  const parserErrors: string[] = [];
  const parser = new DOMParser({ onError: (level, message) => { if (level !== 'warning') parserErrors.push(message); } });
  const paragraphs: string[] = [];
  for (const [name, bytes] of zipEntries(path)) {
    if (!/^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(name)) continue;
    const doc = parser.parseFromString(bytes.toString('utf8'), 'application/xml');
    const nodes = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p');
    for (let index = 0; index < nodes.length; index++) {
      const textNodes = nodes[index].getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
      let text = '';
      for (let textIndex = 0; textIndex < textNodes.length; textIndex++) text += textNodes[textIndex].textContent ?? '';
      paragraphs.push(text.replace(/\s+/g, ' ').trim());
    }
  }
  if (parserErrors.length) throw new Error(`Malformed OOXML text part: ${parserErrors[0]}`);
  return paragraphs.filter(Boolean).join('\n');
}

function bodyParagraphs(path: string): string[] {
  const entry = zipEntries(path).get('word/document.xml');
  if (!entry) throw new Error('DOCX has no word/document.xml');
  const errors: string[] = [];
  const parser = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message); } });
  const doc = parser.parseFromString(entry.toString('utf8'), 'application/xml');
  if (errors.length) throw new Error(`Malformed word/document.xml: ${errors[0]}`);
  const nodes = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p');
  const paragraphs: string[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const texts = nodes[index].getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
    let value = '';
    for (let textIndex = 0; textIndex < texts.length; textIndex++) value += texts[textIndex].textContent ?? '';
    value = value.replace(/\s+/g, ' ').trim();
    if (value) paragraphs.push(value);
  }
  return paragraphs;
}

function independentArtifactChecks(
  path: string,
  testCase: GeneratedCase,
  metadata: TemplateMetadata,
  bindings: Awaited<ReturnType<typeof compileOriginalContract>>['bindings'],
): string[] {
  const reasons: string[] = [];
  const text = renderedText(path);
  const unresolved = text.match(/\{(?:IF|END-IF|FOR|END-FOR|INS|EXEC|QUERY|[A-Za-z_][A-Za-z0-9_]*)\b[^}]*\}/g) ?? [];
  if (unresolved.length) reasons.push(`unresolved template marker(s): ${[...new Set(unresolved)].slice(0, 5).join(', ')}`);
  for (const field of metadata.fields) {
    const value = testCase.values[field.name];
    if (field.type !== 'array' || !Array.isArray(value) || value.length === 0) continue;
    for (let row = 0; row < value.length; row++) {
      const rowValues = value[row] as Values;
      const boundItems = new Set(bindings.filter((binding) => binding.kind === 'array' && binding.field === field.name).flatMap((binding) => binding.itemFields));
      const sentinels = Object.entries(rowValues)
        .filter(([name, item]) => boundItems.has(name) && typeof item === 'string' && item.startsWith('OA_VERIFY_'))
        .map(([, item]) => item as string);
      for (const sentinel of sentinels) {
        const occurrences = text.split(sentinel).length - 1;
        if (occurrences !== 1) reasons.push(`array ${field.name} row ${row + 1} sentinel expected once, found ${occurrences}: ${sentinel}`);
      }
    }
  }
  return reasons;
}

function evaluateBooleanGate(expression: string, values: Values): boolean {
  const tokens = expression.match(/AND|OR|[a-z][a-z0-9_]*|[()]/g) ?? [];
  if (!tokens.length || tokens.join('') !== expression.replace(/\s+/g, '')) throw new Error(`Malformed derived gate: ${expression}`);
  let at = 0;
  const primary = (): boolean => {
    const token = tokens[at++];
    if (token === '(') { const value = or(); if (tokens[at++] !== ')') throw new Error(`Malformed derived gate: ${expression}`); return value; }
    if (!token || token === 'AND' || token === 'OR' || token === ')') throw new Error(`Malformed derived gate: ${expression}`);
    return values[token] === true;
  };
  const and = (): boolean => { let value = primary(); while (tokens[at] === 'AND') { at++; value = primary() && value; } return value; };
  const or = (): boolean => { let value = and(); while (tokens[at] === 'OR') { at++; value = and() || value; } return value; };
  const result = or();
  if (at !== tokens.length) throw new Error(`Malformed derived gate: ${expression}`);
  return result;
}

type MarkdocNode = {
  type: string;
  tag?: string;
  attributes?: Record<string, unknown>;
  children?: MarkdocNode[];
};

function sourceConditionOracle(
  templateDir: string,
  contract: Awaited<ReturnType<typeof compileOriginalContract>>,
  suppliedValues: Values,
  outputPath: string,
): string[] {
  const effective: Values = {};
  for (const field of contract.fields) {
    if (field.default !== undefined) {
      effective[field.name] = field.type === 'boolean' ? field.default === 'true'
        : field.type === 'number' ? Number(field.default) : field.default;
    } else if (field.type === 'boolean') effective[field.name] = false;
  }
  Object.assign(effective, suppliedValues);
  for (const field of contract.fields) {
    if (field.derived) effective[field.name] = field.derived.map[String(effective[field.derived.from])] ?? false;
  }
  for (const gate of contract.derivedGates) effective[gate.field] = evaluateBooleanGate(gate.expression, effective);
  const rawSource = readFileSync(join(templateDir, 'template.mdoc'), 'utf8');
  const traditional = /^---\r?\n[\s\S]*?\bpresentation:\s*traditional\b[\s\S]*?\r?\n---/m.test(rawSource);
  const source = rawSource.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const normalizedSource = source.replace(/\s+/g, ' ');
  const ast = Markdoc.parse(source) as unknown as MarkdocNode;
  const output = renderedText(outputPath).replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];
  const count = (haystack: string, needle: string): number => needle ? haystack.split(needle).length - 1 : 0;
  const truth = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return !['', '_______'].includes(value.trim());
    return typeof value === 'number' && Number.isFinite(value) && value !== 0;
  };
  const literalChunks = (node: MarkdocNode): string[] => {
    if (node.type === 'text') return [String(node.attributes?.content ?? '').replace(/\[\[([^\]]+)\]\]/g, '“$1”').replace(/\s+/g, ' ').trim()];
    if (node.type === 'tag' && node.tag === 'field') return [];
    return (node.children ?? []).flatMap(literalChunks);
  };
  const walk = (node: MarkdocNode): void => {
    if (node.type === 'tag' && node.tag === 'clause' && typeof node.attributes?.confirm === 'string') {
      const confirmName = node.attributes.confirm;
      const field = contract.fields.find((candidate) => candidate.name === confirmName);
      const applicableName = typeof node.attributes['include-when'] === 'string' ? node.attributes['include-when'] : undefined;
      const applicable = applicableName ? truth(effective[applicableName]) : true;
      const confirmed = effective[confirmName] === true;
      for (const proof of [field?.confirm_note, field?.authority_url].filter((item): item is string => Boolean(item))) {
        const actual = count(output, proof);
        const expectedPresent = applicable && !confirmed;
        if ((actual > 0) !== expectedPresent) reasons.push(`confirmation ${confirmName} expected ${expectedPresent ? 'present' : 'absent'} proof, found ${actual}: ${proof}`);
      }
    }
    if (node.type === 'tag' && node.tag === 'clause' && typeof node.attributes?.['include-when'] === 'string') {
      const condition = node.attributes['include-when'];
      const active = truth(effective[condition]);
      const chunks = literalChunks(node).filter((text) => text.length >= 12);
      const heading = chunks[0];
      const uniqueHeading = heading && count(normalizedSource, heading) === 1 ? heading : undefined;
      const uniqueWindow = chunks.find((text) => text.length >= 50 && count(normalizedSource, text) === 1);
      const proofs = [...new Set([uniqueHeading, uniqueWindow].filter((text): text is string => Boolean(text)))];
      for (const proof of proofs) {
        const actual = count(output, proof);
        const expected = active ? 1 : 0;
        if (actual !== expected) reasons.push(`${active ? 'active' : 'inactive'} source branch ${condition} expected ${expected} occurrence(s), found ${actual}: ${proof.slice(0, 100)}`);
      }
      return;
    }
    if (!traditional && node.type === 'tag' && node.tag === 'cover-term') {
      const direct = typeof node.attributes?.['include-when'] === 'string' ? [node.attributes['include-when']] : [];
      const any = Array.isArray(node.attributes?.['include-when-any'])
        ? node.attributes!['include-when-any'].filter((item): item is string => typeof item === 'string') : [];
      const conditions = direct.length ? direct : any;
      const label = typeof node.attributes?.label === 'string' ? node.attributes.label : undefined;
      if (conditions.length && label && count(normalizedSource, label) === 1) {
        const active = direct.length ? truth(effective[direct[0]]) : conditions.some((name) => truth(effective[name]));
        const actual = count(output, label);
        const expected = active ? 1 : 0;
        if (actual !== expected) reasons.push(`cover branch ${conditions.join(' OR ')} expected ${expected} label occurrence(s), found ${actual}: ${label}`);
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(ast);
  const frontmatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(rawSource);
  const front = yaml.load(frontmatch?.[1] ?? '') as {
    document?: { title?: string; label?: string; version?: string; license?: string; presentation?: string };
    attribution_text?: string;
  };
  // Inspect separate package parts, not the combined visible text: attribution
  // accidentally moved into the body is not a preserved running footer.
  const parts = zipEntries(outputPath);
  const footerLabel = front.document?.label ?? front.document?.title ?? '';
  const footerVersion = front.document?.version ? ` (v${front.document.version})` : '';
  const footerAttribution = front.attribution_text ?? front.document?.license;
  for (const [kind, expectedText] of [
    // Publisher attribution belongs in the footer, not the filled document's
    // identity. A neutral title avoids implying this is the publisher's policy.
    ['header', front.document?.title ?? ''],
    ['footer', `${footerLabel}${footerVersion}${footerAttribution ? `. ${footerAttribution}` : ''}Page  of `],
  ] as const) {
    const found = [...parts].filter(([name]) => new RegExp(`^word/${kind}\\d+\\.xml$`).test(name));
    if (found.length !== 1) {
      reasons.push(`source ${kind} expected one package part, found ${found.length}`);
      continue;
    }
    const doc = new DOMParser().parseFromString(found[0][1].toString('utf8'), 'application/xml');
    const textNodes = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't');
    let text = '';
    for (let index = 0; index < textNodes.length; index++) text += textNodes[index].textContent ?? '';
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    if (normalize(text) !== normalize(expectedText)) reasons.push(`source ${kind} text/attribution was not preserved`);
    if (kind === 'footer') {
      const instructions = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'instrText');
      const fields = Array.from({ length: instructions.length }, (_, index) => instructions[index].textContent?.trim());
      if (fields.filter(field => field === 'PAGE').length !== 1 || fields.filter(field => field === 'NUMPAGES').length !== 1) {
        reasons.push('source footer requires one PAGE and one NUMPAGES field');
      }
    }
  }
  const conditional = (node: MarkdocNode): boolean => {
    const one = node.attributes?.['include-when'];
    const any = node.attributes?.['include-when-any'];
    if (typeof one === 'string') return truth(effective[one]);
    if (Array.isArray(any)) return any.some((name) => typeof name === 'string' && truth(effective[name]));
    return true;
  };
  let repeatedFieldTypes: Map<string, string> | undefined;
  const formatValue = (name: string, scope?: Values): string => {
    const itemField = scope !== undefined && repeatedFieldTypes?.has(name);
    const value = itemField ? scope?.[name] : effective[name];
    if (value === undefined || value === null) return '_______';
    if (value === '') return '';
    const fieldType = itemField ? repeatedFieldTypes?.get(name) : contract.fields.find((candidate) => candidate.name === name)?.type;
    if (fieldType === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
    }
    return String(value);
  };
  const inlineText = (node: MarkdocNode, scope?: Values): string => {
    if (node.type === 'text') return String(node.attributes?.content ?? '').replace(/\[\[([^\]]+)\]\]/g, '“$1”');
    if (node.type === 'softbreak' || node.type === 'hardbreak') return ' ';
    if (node.type === 'tag' && node.tag === 'field') return formatValue(String(node.attributes?.name ?? ''), scope);
    if (node.type === 'tag' && node.tag === 'field-note') return '';
    return (node.children ?? []).map((child) => inlineText(child, scope)).join('');
  };
  const expected: string[] = [];
  let pendingConfirmation = false;
  const emit = (value: string): void => {
    // docx-templates' command tokenizer removes the source space immediately before the literal legacy token ".PDF".
    const normalized = value.replace(/\s+/g, ' ').replace(/ \.PDF/g, '.PDF').trim();
    if (normalized) expected.push(normalized);
  };
  const blocks = (nodes: MarkdocNode[], scope?: Values, section?: string): void => {
    for (const node of nodes) {
      if (node.type === 'paragraph' || node.type === 'inline' || node.type === 'heading') { emit(inlineText(node, scope)); continue; }
      if (node.type === 'list' || node.type === 'item' || node.type === 'document') { blocks(node.children ?? [], scope, section); continue; }
      if (node.type !== 'tag') continue;
      if (node.tag === 'field-note') continue;
      if (node.tag === 'field') { emit(inlineText(node, scope)); continue; }
      if (node.tag === 'agreement-section') {
        const nextSection = String(node.attributes?.type ?? '');
        if (traditional && nextSection === 'cover_terms') continue;
        const children = [...(node.children ?? [])];
        if (traditional && nextSection === 'standard_terms' && children[0]?.type === 'heading' && inlineText(children[0]).trim() === front.document?.title) children.shift();
        blocks(children, scope, nextSection); continue;
      }
      if (!conditional(node)) continue;
      if (node.tag === 'cover-term') {
        emit(String(node.attributes?.label ?? ''));
        if (typeof node.attributes?.field === 'string') emit(formatValue(node.attributes.field, scope));
        continue;
      }
      if (node.tag === 'repeat') {
        const name = String(node.attributes?.field ?? '');
        const rows = effective[name];
        const previousTypes = repeatedFieldTypes;
        repeatedFieldTypes = new Map((contract.fields.find(field => field.name === name)?.items ?? []).map(field => [field.name, field.type]));
        if (Array.isArray(rows)) for (const row of rows) blocks(node.children ?? [], row as Values, section);
        repeatedFieldTypes = previousTypes;
        continue;
      }
      if (node.tag === 'signer') {
        const first = node.children?.[0];
        const label = String(node.attributes?.label ?? '');
        const alreadyAuthored = first && ['paragraph', 'heading'].includes(first.type ?? '')
          && literalChunks(first).join('').trim() === label;
        if (!alreadyAuthored) emit(label);
      }
      blocks(node.children ?? [], scope, section);
      if (node.tag === 'clause' && typeof node.attributes?.confirm === 'string' && !truth(effective[node.attributes.confirm])) {
        const field = contract.fields.find((candidate) => candidate.name === node.attributes!.confirm);
        emit(`[CONFIRM before signing: ${field?.confirm_note}; see ${field?.authority_url}]`);
        pendingConfirmation = true;
      }
    }
  };
  blocks(ast.children ?? []);
  if (pendingConfirmation) expected.unshift('CONFIRM BEFORE SIGNING: Applicable statutory compliance facts remain unconfirmed. Review each highlighted confirmation notice before signing.');
  const actual = bodyParagraphs(outputPath);
  if (canonical(expected) !== canonical(actual)) {
    const length = Math.max(expected.length, actual.length);
    const mismatch = Array.from({ length }, (_, index) => index).find((index) => expected[index] !== actual[index]) ?? 0;
    reasons.push(`ordered body oracle mismatch at paragraph ${mismatch + 1}: expected ${JSON.stringify(expected[mismatch] ?? '<end>')}, found ${JSON.stringify(actual[mismatch] ?? '<end>')} (expected ${expected.length}, found ${actual.length})`);
  }
  return reasons;
}

/** Independent source-AST/body oracle for adversarial mutation tests. Empty means pass. */
export const verifyOriginalSemanticOracle = sourceConditionOracle;

export async function verifyOriginalTemplate(templateDir: string, evidenceRoot = DEFAULT_EVIDENCE_ROOT): Promise<VerificationReceipt> {
  const templateId = basename(templateDir);
  const outputDir = join(evidenceRoot, templateId);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(outputDir, 'cases'), { recursive: true });
  const source = digestFiles(templateDir, SOURCE_FILES);
  const runtime = digestFiles(ROOT, RUNTIME_FILES, true);
  let contract: Awaited<ReturnType<typeof compileOriginalContract>>;
  try {
    contract = await compileOriginalContract(templateDir);
  } catch (error) {
    const reason = `compile blocked: ${error instanceof Error ? error.message : String(error)}`;
    const receipt: VerificationReceipt = {
      profile: PROFILE, template_id: templateId, status: 'blocked',
      promotion: { eligible: false, reason: 'Compilation did not produce a source-bound contract; compiled-only promotion is forbidden.' },
      source, runtime, compiled_contract_sha256: '', case_inventory_sha256: '',
      coverage: {
        strategy: 'Compilation failed closed before generated fill cases could execute.',
        limits: [reason], real_world_attestations_synthesized: false, synthetic_confirmation_true_cases: 0, generated_cases: 0,
      },
      cases: [], summary: { passed: 0, blocked: 1, reasons: [reason] },
    };
    writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    return receipt;
  }
  const metadata = contract.metadata as TemplateMetadata;
  // Independently reload the public projection; a manifest cannot replace the source metadata it claims to bind.
  if (canonical(metadata) !== canonical(loadMetadata(templateDir))) throw new Error(`${templateId}: compiled metadata differs from source metadata`);
  const cases = generateOriginalVerificationCases(contract) as GeneratedCase[];
  const caseInventory = expectedOriginalCaseInventory(contract);
  if (caseInventory.length !== cases.length) throw new Error(`${templateId}: case inventory length differs from generated cases`);
  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const legacyPath = join(outputDir, 'cases', `${testCase.id}.legacy.docx`);
    const declarativePath = join(outputDir, 'cases', `${testCase.id}.declarative.docx`);
    const reasons: string[] = [];
    const diagnostics: string[] = [];
    try {
      await fillOriginalContract(templateDir, contract, testCase.values, declarativePath);
      if (testCase.expected_error) reasons.push(`expected rejection did not occur: ${testCase.expected_error}`);
      const comparison = { count: zipEntries(declarativePath).size, reasons: [] as string[] };
      if (testCase.mode !== 'canonical-only') {
        await fillTemplate({ templateDir, values: testCase.values, outputPath: legacyPath });
        const legacyComparison = compareDocxEntries(declarativePath, legacyPath);
        diagnostics.push(...legacyComparison.reasons.map((reason) => `legacy parity: ${reason}`));
      }
      reasons.push(
        ...independentArtifactChecks(declarativePath, testCase, { ...metadata, fields: contract.fields }, contract.bindings),
        ...sourceConditionOracle(templateDir, contract, testCase.values, declarativePath),
      );
      results.push({
        id: testCase.id, purpose: testCase.purpose,
        status: reasons.length ? 'blocked' : 'passed', reasons,
        ...(diagnostics.length ? { diagnostics } : {}),
        values_sha256: sha256(canonical(testCase.values)),
        ...(existsSync(legacyPath) ? { legacy_sha256: sha256(readFileSync(legacyPath)) } : {}),
        declarative_sha256: sha256(readFileSync(declarativePath)),
        visible_text_sha256: sha256(renderedText(declarativePath)),
        compared_entries: comparison.count,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (testCase.expected_error && message.includes(testCase.expected_error)) {
        let legacyReason: string | undefined;
        if (existsSync(declarativePath)) legacyReason = 'declarative fill leaked an output artifact after expected rejection';
        if (testCase.mode !== 'canonical-only') {
          try {
            await fillTemplate({ templateDir, values: testCase.values, outputPath: legacyPath });
            legacyReason ??= 'legacy fill unexpectedly accepted the invalid case';
          } catch (legacyError) {
            const legacyMessage = legacyError instanceof Error ? legacyError.message : String(legacyError);
            if (!legacyMessage.includes(testCase.expected_error)) legacyReason ??= `legacy rejected for a different reason: ${legacyMessage}`;
          }
        }
        results.push({
          id: testCase.id, purpose: testCase.purpose, status: legacyReason ? 'blocked' : 'passed',
          reasons: legacyReason ? [legacyReason] : [], diagnostics: [`expected rejection: ${message}`],
          values_sha256: sha256(canonical(testCase.values)),
        });
        continue;
      }
      results.push({
        id: testCase.id, purpose: testCase.purpose, status: 'blocked',
        reasons: [`${error instanceof Error ? error.name : 'Error'}: ${message}`],
        values_sha256: sha256(canonical(testCase.values)),
      });
    }
  }
  const blocked = results.filter((result) => result.status === 'blocked');
  const receipt: VerificationReceipt = {
    profile: PROFILE,
    template_id: templateId,
    status: blocked.length ? 'blocked' : 'verified',
    promotion: blocked.length
      ? { eligible: false, reason: `${blocked.length} verification case(s) blocked; compiled-only contracts cannot be promoted.` }
      : { eligible: true, reason: 'Every generated parity and artifact-integrity case passed for the recorded source and runtime digests.' },
    source,
    runtime,
    compiled_contract_sha256: sha256(canonical(contract)),
    case_inventory_sha256: sha256(canonical(caseInventory)),
    coverage: {
      strategy: 'One-factor typed coverage over a full-field baseline: every enum option, every non-attestation Boolean polarity, every multiselect option, and every array at 0/1/2 rows. Legacy ZIP parity differences are diagnostic because canonical rendering may intentionally repair stale flattened artifacts.',
      limits: [
        'Boolean combinations are not exhaustively expanded to 2^N; each polarity is exercised independently against the baseline.',
        'Pairwise interactions are covered only when represented by the baseline plus a one-factor case.',
        'Ordinary cases keep statutory compliance representations false. Separately labelled SYNTHETIC-NOT-ATTESTATION cases exercise the mechanical true path and are never reusable as user facts.',
      ],
      real_world_attestations_synthesized: false,
      synthetic_confirmation_true_cases: cases.filter((testCase) => testCase.id.includes('SYNTHETIC-NOT-ATTESTATION')).length,
      generated_cases: cases.length,
    },
    cases: results,
    summary: {
      passed: results.length - blocked.length,
      blocked: blocked.length,
      reasons: [...new Set(blocked.flatMap((result) => result.reasons))],
    },
  };
  writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export async function verifyOriginalCatalog(roots: string | readonly string[] = ORIGINALS_ROOTS, evidenceRoot = DEFAULT_EVIDENCE_ROOT): Promise<VerificationReceipt[]> {
  mkdirSync(evidenceRoot, { recursive: true });
  const dirs = discoverOriginalTemplateDirs(roots);
  // Privacy-policy evidence is produced first, while discovery still fixes the complete corpus.
  dirs.sort((a, b) => Number(basename(b) === 'openagreements-privacy-policy') - Number(basename(a) === 'openagreements-privacy-policy') || a.localeCompare(b));
  const receipts: VerificationReceipt[] = [];
  for (const dir of dirs) {
    const receipt = await verifyOriginalTemplate(dir, evidenceRoot);
    receipts.push(receipt);
    console.log(JSON.stringify({ event: 'original-contract-verified', template_id: receipt.template_id, status: receipt.status, passed: receipt.summary.passed, blocked: receipt.summary.blocked, generated_cases: receipt.coverage.generated_cases }));
  }
  const catalog = {
    profile: `${PROFILE}-catalog`,
    discovered_templates: dirs.map((dir) => basename(dir)),
    receipts: receipts.map((receipt) => ({ template_id: receipt.template_id, status: receipt.status, source_digest: receipt.source.digest, runtime_digest: receipt.runtime.digest })),
    status: receipts.every((receipt) => receipt.status === 'verified') ? 'verified' : 'blocked',
  };
  writeFileSync(join(evidenceRoot, 'catalog-receipt.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return receipts;
}

async function main(): Promise<void> {
  const receipts = await verifyOriginalCatalog();
  const blocked = receipts.filter((receipt) => receipt.status === 'blocked');
  console.log(`Verified ${receipts.length - blocked.length}/${receipts.length} discovered original templates.`);
  if (blocked.length) {
    console.error(`Blocked: ${blocked.map((receipt) => receipt.template_id).join(', ')}`);
    throw new Error(`${blocked.length} original template(s) are not eligible for promotion; see ${DEFAULT_EVIDENCE_ROOT}`);
  }
}

if (
  process.argv.slice(1).some((arg) => resolve(arg) === fileURLToPath(import.meta.url)) ||
  (process.argv[1]?.includes('vite-node') === true && process.env.VITEST === undefined)
) {
  await main();
}
