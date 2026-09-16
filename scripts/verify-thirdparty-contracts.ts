#!/usr/bin/env npx tsx

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import canonicalize from 'canonicalize';
import { listCommands } from 'docx-templates';
import { fillTemplate } from '../src/core/engine.js';
import { compileSelectionContract, fillSelectionContract, type SelectionContract } from '../src/core/selection-contract.js';
import { loadMetadata, type FieldDefinition } from '../src/core/metadata.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const THIRDPARTY_ROOTS = [
  join(ROOT, 'templates', 'common-paper-cc-by-4.0'),
  join(ROOT, 'templates', 'bonterms-cc0-1.0'),
] as const;
export const THIRDPARTY_EVIDENCE_ROOT = join(ROOT, '.cache', 'common-paper-declarative', 'thirdparty');
const PROFILE = 'oa-thirdparty-contract-verification-v1';
const EXPECTED_DENOMINATOR = 25;
const KNOWN_CORRUPT_SOURCES: Record<string, string> = {
  'common-paper-order-form-with-sla': 'Known source ambiguity: simple replacements [ # ] and [__] overwrite unrelated SLA values; parity cannot establish fidelity.',
  'common-paper-design-partner-agreement': 'Known source ambiguity: simple replacement [ # ] overwrites feedback-session count, term length, and invoice days; parity cannot establish fidelity.',
};

type Values = Record<string, unknown>;
type GeneratedCase = { id: string; purpose: string; values: Values };
type CaseReceipt = {
  id: string;
  purpose: string;
  status: 'verified' | 'blocked';
  reasons: string[];
  values_sha256: string;
  declarative_sha256?: string;
  legacy_sha256?: string;
  visible_text_sha256?: string;
  compared_entries?: number;
  comparison_profile?: 'legacy-exact' | 'legacy-explicit-empty-selection-inputs';
  normalized_selection_fields?: string[];
  reference_input_sha256?: string;
  reference_sha256?: string;
  raw_legacy_differences?: string[];
};
export type ThirdpartyReceipt = {
  profile: typeof PROFILE;
  template_id: string;
  artifact_class: 'fillable' | 'static-validated-copy';
  status: 'verified' | 'validated-copy' | 'blocked';
  promotion: { eligible: boolean; reason: string };
  source_hashes?: Record<string, string>;
  compiled_contract_sha256: string | null;
  runtime: { digest: string; files: Record<string, string> };
  case_inventory: { count: number; digest: string; cases: Array<{ id: string; input_sha256: string }> };
  compile_error?: string;
  cases: CaseReceipt[];
  summary: { generated: number; verified: number; blocked: number; reasons: string[] };
};

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown): string => {
  const serialized = canonicalize(value);
  if (serialized === undefined) throw new Error('Value cannot be canonicalized');
  return serialized;
};
const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 140);

function filesRecursively(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  });
}

function runtimeFingerprint(): { digest: string; files: Record<string, string> } {
  const verifier = fileURLToPath(import.meta.url);
  const paths = [
    ...filesRecursively(join(ROOT, 'src', 'core')).filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts')),
    join(ROOT, 'package.json'), join(ROOT, 'package-lock.json'), verifier,
  ].sort();
  const files = Object.fromEntries(paths.map((path) => [relative(ROOT, path), sha256(readFileSync(path))]));
  return { digest: sha256(canonical(files)), files };
}

function sourceFingerprint(templateDir: string): Record<string, string> {
  return Object.fromEntries(readdirSync(templateDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'README.md').map((entry) => entry.name).sort()
    .map((name) => [name, sha256(readFileSync(join(templateDir, name)))]));
}

function inventory(cases: GeneratedCase[]): ThirdpartyReceipt['case_inventory'] {
  const entries = cases.map((item) => ({ id: item.id, input_sha256: sha256(canonical(item.values)) }));
  return { count: entries.length, digest: sha256(canonical(entries)), cases: entries };
}

export function discoverThirdpartyTemplateDirs(roots: readonly string[] = THIRDPARTY_ROOTS): string[] {
  const dirs = roots.flatMap((root) => {
    if (!existsSync(root)) throw new Error(`Third-party template root is missing: ${root}`);
    const entries = readdirSync(root, { withFileTypes: true });
    const files = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
    if (files.length) throw new Error(`Unexpected entry in third-party root ${root}: ${files.join(', ')}`);
    return entries.map((entry) => join(root, entry.name));
  }).sort();
  if (dirs.length !== EXPECTED_DENOMINATOR) {
    throw new Error(`Third-party denominator changed: expected ${EXPECTED_DENOMINATOR}, discovered ${dirs.length}`);
  }
  for (const dir of dirs) {
    for (const required of ['metadata.yaml', 'template.docx']) {
      if (!existsSync(join(dir, required))) throw new Error(`Discovered template missing ${required}: ${relative(ROOT, dir)}`);
    }
  }
  return dirs;
}

function representative(field: FieldDefinition, ordinal: number): unknown {
  if (field.default !== undefined) {
    if (field.type === 'boolean') return field.default === 'true';
    return field.default;
  }
  switch (field.type) {
    case 'boolean': return false;
    case 'date': return '2026-09-16';
    case 'enum': return field.options?.[0] ?? '';
    case 'string': return `OA_VERIFY_${field.name}_${ordinal}`;
    default: return '';
  }
}

function baseline(contract: SelectionContract): Values {
  const extended = contract as SelectionContract & { computedFields?: string[]; rules: Array<{ op: string; target: string }> };
  const readonly = new Set(extended.computedFields ?? extended.rules.filter((rule) => rule.op !== 'copy-if-blank').map((rule) => rule.target));
  return Object.fromEntries(contract.metadata.fields.filter((field) => !readonly.has(field.name))
    .map((field, index) => [field.name, representative(field, index)]));
}

function forceInactive(values: Values, field: FieldDefinition | undefined): void {
  if (!field) return;
  if (field.type === 'boolean') values[field.name] = false;
  else if (field.type === 'string' || field.type === 'date') values[field.name] = '';
}

export function generateThirdpartyCases(contract: SelectionContract): GeneratedCase[] {
  const extended = contract as SelectionContract & { computedFields?: string[]; rules: Array<{ op: string; target: string }> };
  const readonly = new Set(extended.computedFields ?? extended.rules.filter((rule) => rule.op !== 'copy-if-blank').map((rule) => rule.target));
  const fields = contract.metadata.fields.filter((field) => !readonly.has(field.name));
  const byName = new Map(fields.map((field) => [field.name, field]));
  const cases: GeneratedCase[] = [
    { id: 'baseline', purpose: 'Representative typed value for every public field.', values: baseline(contract) },
    { id: 'empty-defaults', purpose: 'No caller values; exercise authored defaults and blank normalization.', values: {} },
  ];
  for (const field of fields) {
    if (field.type === 'boolean') {
      for (const value of [false, true]) cases.push({
        id: `boolean-${field.name}-${value}`,
        purpose: `Boolean polarity ${field.name}=${value}.`,
        values: { ...baseline(contract), [field.name]: value },
      });
    } else if (field.type === 'enum') {
      for (const value of field.options ?? []) cases.push({
        id: `enum-${field.name}-${value}`,
        purpose: `Enum alternative ${field.name}=${value}.`,
        values: { ...baseline(contract), [field.name]: value },
      });
    }
  }
  for (const group of contract.selections.groups) {
    for (let index = 0; index < group.options.length; index++) {
      const values = baseline(contract);
      for (const option of group.options) {
        if (option.trigger !== 'default') forceInactive(values, byName.get(option.trigger.field));
      }
      const option = group.options[index];
      if (option.trigger !== 'default') {
        const field = byName.get(option.trigger.field);
        if (option.trigger.equals !== undefined) values[option.trigger.field] = option.trigger.equals;
        else if (field?.type === 'boolean') values[option.trigger.field] = true;
        else values[option.trigger.field] = `OA_VERIFY_SELECTION_${group.id}_${index + 1}`;
      }
      cases.push({
        id: `selection-${group.id}-${index + 1}`,
        purpose: `Selection group ${group.id}, option ${index + 1}: ${option.label ?? option.marker}.`,
        values,
      });
    }
  }
  const unique = new Map<string, GeneratedCase>();
  for (const item of cases) unique.set(sha256(JSON.stringify(item.values, Object.keys(item.values).sort())), item);
  const result = [...unique.values()];
  const ids = result.map((item) => item.id); const stems = ids.map(safeId);
  if (new Set(ids).size !== ids.length) throw new Error('Generated case IDs are not unique');
  if (new Set(stems).size !== stems.length) throw new Error('Generated case filename stems are not unique');
  return result;
}

function zipEntries(path: string): Map<string, Buffer> {
  return new Map(new AdmZip(path).getEntries().filter((entry) => !entry.isDirectory)
    .map((entry) => [entry.entryName, entry.getData()]));
}

function meaningfulEntry(name: string): boolean {
  return name === '[Content_Types].xml' || name === '_rels/.rels' || /^word\//.test(name);
}

function compareMeaningfulEntries(leftPath: string, rightPath: string): { count: number; reasons: string[] } {
  const left = zipEntries(leftPath); const right = zipEntries(rightPath);
  const names = [...new Set([...left.keys(), ...right.keys()])].filter(meaningfulEntry).sort();
  const reasons: string[] = [];
  for (const name of names) {
    if (!left.has(name)) reasons.push(`declarative output missing meaningful ZIP entry: ${name}`);
    else if (!right.has(name)) reasons.push(`legacy output missing meaningful ZIP entry: ${name}`);
    else if (!left.get(name)!.equals(right.get(name)!)) reasons.push(`meaningful ZIP entry differs: ${name}`);
  }
  return { count: names.length, reasons };
}

function bodyParagraphs(path: string): string[] {
  const zip = new AdmZip(path); const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('Output is missing word/document.xml');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf8'), 'application/xml');
  return Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))
    .map((paragraph) => getParagraphText(paragraph as unknown as Parameters<typeof getParagraphText>[0]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function documentParagraphs(path: string): string[] {
  const zip = new AdmZip(path); const paragraphs: string[] = [];
  for (const entry of zip.getEntries().filter((item) => /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(item.entryName))) {
    const doc = new DOMParser().parseFromString(entry.getData().toString('utf8'), 'application/xml');
    paragraphs.push(...Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))
      .map((paragraph) => getParagraphText(paragraph as unknown as Parameters<typeof getParagraphText>[0]).replace(/\s+/g, ' ').trim())
      .filter(Boolean));
  }
  return paragraphs;
}

function attributionProofs(sourcePath: string): string[] {
  const paragraphs = documentParagraphs(sourcePath);
  const licensed = paragraphs.filter((text) => /CC BY 4\.0|CC0 1\.0|free to use under/i.test(text));
  const branded = paragraphs.filter((text) => /Common Paper|Bonterms/i.test(text));
  const candidates = licensed.length ? licensed : branded;
  return [...new Set(candidates)];
}

function selectionParagraphs(path: string, cellContext?: string): string[] {
  if (!cellContext) return bodyParagraphs(path);
  const entry = new AdmZip(path).getEntry('word/document.xml');
  if (!entry) throw new Error('Output is missing word/document.xml');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf8'), 'application/xml');
  const cells = Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'tc'));
  const matching = cells.filter((cell) => getParagraphText(cell as unknown as Parameters<typeof getParagraphText>[0]).includes(cellContext));
  if (matching.length !== 1) throw new Error(`Selection cellContext expected one output cell, found ${matching.length}: ${cellContext}`);
  return Array.from(matching[0].getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))
    .map((paragraph) => getParagraphText(paragraph as unknown as Parameters<typeof getParagraphText>[0]).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function independentOutputChecks(path: string, contract: SelectionContract, supplied: Values): Promise<string[]> {
  const reasons: string[] = [];
  const bytes = readFileSync(path);
  const commands = await listCommands(Uint8Array.from(bytes).buffer, ['{', '}']);
  if (commands.length) reasons.push(`unresolved DOCX command(s): ${commands.slice(0, 5).map((item) => item.code).join(', ')}`);
  const effective = Object.fromEntries(contract.metadata.fields.map((field) => [field.name,
    supplied[field.name] ?? (field.default !== undefined ? representative(field, 0) : field.type === 'boolean' ? false : '_______')]));
  const truth = (value: unknown): boolean => value === true || (typeof value === 'string' && value.trim() !== '' && value.trim() !== '_______');
  for (const group of contract.selections.groups) {
    const scopedParagraphs = selectionParagraphs(path, group.cellContext);
    const nondefault = group.options.map((option) => option.trigger === 'default' ? false
      : option.trigger.equals === undefined ? truth(effective[option.trigger.field]) : effective[option.trigger.field] === option.trigger.equals);
    for (let index = 0; index < group.options.length; index++) {
      const option = group.options[index];
      const active = option.trigger === 'default' ? !nondefault.some(Boolean) : nondefault[index];
      const resolvedMarker = option.marker.replace(/\{([a-z][a-z0-9_]*)\}/g, (_all, name: string) => {
        if (Object.hasOwn(supplied, name)) return supplied[name] === undefined || supplied[name] === null ? '' : String(supplied[name]);
        const field = contract.metadata.fields.find((candidate) => candidate.name === name);
        if (field?.default !== undefined) return String(representative(field, 0));
        return '_______';
      }).replace(/\s+/g, ' ').trim();
      const fieldOnlyMarker = /^\{[a-z][a-z0-9_]*\}$/.test(option.marker);
      if (!fieldOnlyMarker && !resolvedMarker) reasons.push(`cannot construct independent selection proof: ${group.id}/${index + 1}`);
      const matches = scopedParagraphs.filter((text) => fieldOnlyMarker
        ? text.replace(/^(?:\(\s*x?\s*\)|\[\s*x?\s*\]|☐|☑|☒)\s*/i, '').trim() === resolvedMarker
        : text.includes(resolvedMarker));
      if (active && matches.length !== 1) reasons.push(`active selection ${group.id}/${index + 1} expected once, found ${matches.length}: ${resolvedMarker}`);
      if (!active && matches.length) reasons.push(`inactive selection ${group.id}/${index + 1} survived ${matches.length} time(s): ${resolvedMarker}`);
      if (active && matches.some((text) => !/^(?:\(\s*x\s*\)|\[\s*x\s*\]|☑|☒)\s*/i.test(text))) {
        reasons.push(`active selection ${group.id}/${index + 1} is not checked: ${matches[0]}`);
      }
    }
  }
  return reasons;
}

function attributionChecks(sourcePath: string, outputPath: string): string[] {
  const output = documentParagraphs(outputPath);
  return attributionProofs(sourcePath).flatMap((proof) => output.includes(proof) ? [] : [`source attribution/license paragraph was not preserved: ${proof}`]);
}

/**
 * Independent reference inputs for the adapter's explicit blank-selection
 * semantics. Do not change the shared legacy engine, invent field values, or
 * waive ZIP parity: compare against a real legacy fill with only source-declared
 * presence-trigger placeholders answered explicitly empty. If that changes
 * unrelated visible content, full-package comparison still blocks promotion.
 */
export function selectionReferenceInputs(contract: SelectionContract, supplied: Values): { values: Values; fields: string[] } {
  const fields = new Set<string>();
  for (const group of contract.selections.groups) for (const option of group.options) {
    const trigger = option.trigger;
    if (trigger === 'default' || trigger.equals !== undefined) continue;
    const field = contract.metadata.fields.find(candidate => candidate.name === trigger.field);
    if (field?.type !== 'string') continue;
    const effective = Object.hasOwn(supplied, field.name) ? supplied[field.name] : field.default ?? '_______';
    if (typeof effective === 'string' && effective.trim() === '_______') fields.add(field.name);
  }
  const names = [...fields].sort();
  return { values: { ...supplied, ...Object.fromEntries(names.map(name => [name, ''])) }, fields: names };
}

export async function verifyThirdpartyTemplate(templateDir: string, evidenceRoot = THIRDPARTY_EVIDENCE_ROOT): Promise<ThirdpartyReceipt> {
  const templateId = basename(templateDir); const outputDir = join(evidenceRoot, templateId);
  rmSync(outputDir, { recursive: true, force: true }); mkdirSync(join(outputDir, 'cases'), { recursive: true });
  const runtime = runtimeFingerprint();
  const metadata = loadMetadata(templateDir);
  const sourceHashes = sourceFingerprint(templateDir);
  const sourceCommands = await listCommands(Uint8Array.from(readFileSync(join(templateDir, 'template.docx'))).buffer, ['{', '}']);
  const staticCopy = metadata.fields.length === 0 && sourceCommands.length === 0;
  let contract: SelectionContract;
  try {
    contract = await compileSelectionContract(templateDir);
  } catch (error) {
    const compileError = error instanceof Error ? error.message : String(error);
    const receipt: ThirdpartyReceipt = {
      profile: PROFILE, template_id: templateId, artifact_class: 'fillable', status: 'blocked',
      promotion: { eligible: false, reason: `Compilation blocked: ${compileError}` }, compile_error: compileError,
      source_hashes: sourceHashes, compiled_contract_sha256: null, runtime, case_inventory: inventory([]),
      cases: [], summary: { generated: 0, verified: 0, blocked: 1, reasons: [`compile: ${compileError}`] },
    };
    writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`); return receipt;
  }
  if (staticCopy) {
    const staticCase: GeneratedCase = { id: 'static-source-copy', purpose: 'Compile, fill, and validate the shipped unparameterized DOCX copy.', values: {} };
    const declarative = join(outputDir, 'cases', 'static-source-copy.declarative.docx');
    const reasons: string[] = [];
    try {
      await fillSelectionContract(templateDir, contract, {}, declarative);
      if (!readFileSync(declarative).equals(readFileSync(join(templateDir, 'template.docx')))) reasons.push('Static passthrough output is not byte-identical to template.docx');
      if (!bodyParagraphs(declarative).length) reasons.push('Static DOCX has no visible body text');
      if (!attributionProofs(join(templateDir, 'template.docx')).length) reasons.push('Static DOCX has no source attribution/license paragraph');
      reasons.push(...await independentOutputChecks(declarative, contract, {}));
      reasons.push(...attributionChecks(join(templateDir, 'template.docx'), declarative));
    } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
    const receipt: ThirdpartyReceipt = {
      profile: PROFILE, template_id: templateId, artifact_class: 'static-validated-copy',
      status: reasons.length ? 'blocked' : 'validated-copy',
      promotion: { eligible: false, reason: reasons[0] ?? 'Compiled and validated an exact-byte static source copy; this artifact is not fillable.' },
      source_hashes: contract.sourceHashes, compiled_contract_sha256: sha256(canonical(contract)), runtime,
      case_inventory: inventory([staticCase]),
      cases: [{ id: staticCase.id, purpose: staticCase.purpose, status: reasons.length ? 'blocked' : 'verified', reasons,
        values_sha256: sha256(canonical(staticCase.values)),
        ...(existsSync(declarative) ? { declarative_sha256: sha256(readFileSync(declarative)),
          visible_text_sha256: sha256(canonical(bodyParagraphs(declarative))) } : {}) }],
      summary: { generated: 0, verified: 0, blocked: reasons.length ? 1 : 0, reasons },
    };
    writeFileSync(join(outputDir, 'contract.json'), `${JSON.stringify(contract, null, 2)}\n`);
    writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`); return receipt;
  }
  const cases = generateThirdpartyCases(contract); const receipts: CaseReceipt[] = [];
  for (const testCase of cases) {
    const stem = safeId(testCase.id); const declarative = join(outputDir, 'cases', `${stem}.declarative.docx`);
    const legacy = join(outputDir, 'cases', `${stem}.legacy.docx`); const reasons: string[] = [];
    try {
      const next = await fillSelectionContract(templateDir, contract, testCase.values, declarative);
      const previous = await fillTemplate({ templateDir, values: testCase.values, outputPath: legacy });
      const reference = selectionReferenceInputs(contract, testCase.values);
      const referencePath = reference.fields.length ? join(outputDir, 'cases', `${stem}.selection-reference.docx`) : legacy;
      const expected = reference.fields.length
        ? await fillTemplate({ templateDir, values: reference.values, outputPath: referencePath }) : previous;
      const rawDifferences = compareMeaningfulEntries(declarative, legacy).reasons;
      if (JSON.stringify(next.fieldsUsed) !== JSON.stringify(previous.fieldsUsed)) rawDifferences.push('raw legacy fieldsUsed differs');
      const comparison = compareMeaningfulEntries(declarative, referencePath); reasons.push(...comparison.reasons);
      const declarativeText = bodyParagraphs(declarative); const legacyText = bodyParagraphs(legacy);
      if (JSON.stringify(declarativeText) !== JSON.stringify(legacyText)) rawDifferences.push('raw legacy ordered body differs');
      if (JSON.stringify(declarativeText) !== JSON.stringify(bodyParagraphs(referencePath))) reasons.push('ordered visible body text differs from reference output');
      if (JSON.stringify(next.fieldsUsed) !== JSON.stringify(expected.fieldsUsed)) reasons.push('fieldsUsed differs from reference output');
      reasons.push(...await independentOutputChecks(declarative, contract, testCase.values));
      reasons.push(...attributionChecks(join(templateDir, 'template.docx'), declarative));
      receipts.push({
        id: testCase.id, purpose: testCase.purpose, status: reasons.length ? 'blocked' : 'verified', reasons,
        values_sha256: sha256(JSON.stringify(testCase.values, Object.keys(testCase.values).sort())),
        declarative_sha256: sha256(readFileSync(declarative)), legacy_sha256: sha256(readFileSync(legacy)),
        visible_text_sha256: sha256(JSON.stringify(declarativeText)), compared_entries: comparison.count,
        comparison_profile: reference.fields.length ? 'legacy-explicit-empty-selection-inputs' : 'legacy-exact',
        normalized_selection_fields: reference.fields,
        reference_input_sha256: sha256(canonical(reference.values)),
        reference_sha256: sha256(readFileSync(referencePath)), raw_legacy_differences: rawDifferences,
      });
    } catch (error) {
      receipts.push({ id: testCase.id, purpose: testCase.purpose, status: 'blocked',
        reasons: [`${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : String(error)}`],
        values_sha256: sha256(JSON.stringify(testCase.values, Object.keys(testCase.values).sort())),
      });
    }
  }
  const blocked = receipts.filter((item) => item.status === 'blocked');
  const sourceGuard = KNOWN_CORRUPT_SOURCES[templateId] ? [KNOWN_CORRUPT_SOURCES[templateId]] : [];
  const reasons = [...new Set([...sourceGuard, ...blocked.flatMap((item) => item.reasons)])];
  const status = reasons.length ? 'blocked' : 'verified';
  const receipt: ThirdpartyReceipt = {
    profile: PROFILE, template_id: templateId, artifact_class: 'fillable', status,
    promotion: status === 'verified'
      ? { eligible: true, reason: 'Every generated case passed full reference parity and independent artifact checks; any explicit-empty selection reference is identified per case.' }
      : { eligible: false, reason: sourceGuard[0] ?? `${blocked.length} generated case(s) blocked.` },
    source_hashes: contract.sourceHashes, compiled_contract_sha256: sha256(canonical(contract)), runtime,
    case_inventory: inventory(cases), cases: receipts,
    summary: { generated: receipts.length, verified: receipts.length - blocked.length, blocked: blocked.length + sourceGuard.length, reasons },
  };
  writeFileSync(join(outputDir, 'contract.json'), `${JSON.stringify(contract, null, 2)}\n`);
  writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`); return receipt;
}

export async function verifyThirdpartyCatalog(evidenceRoot = THIRDPARTY_EVIDENCE_ROOT): Promise<ThirdpartyReceipt[]> {
  mkdirSync(evidenceRoot, { recursive: true });
  const dirs = discoverThirdpartyTemplateDirs(); const receipts: ThirdpartyReceipt[] = [];
  for (const dir of dirs) {
    const receipt = await verifyThirdpartyTemplate(dir, evidenceRoot); receipts.push(receipt);
    console.log(JSON.stringify({ event: 'thirdparty-contract-verified', template_id: receipt.template_id, status: receipt.status,
      generated: receipt.summary.generated, verified: receipt.summary.verified, blocked: receipt.summary.blocked }));
  }
  const catalog = {
    profile: `${PROFILE}-catalog`, denominator: dirs.length,
    discovered_templates: dirs.map((dir) => basename(dir)),
    verified_fillable: receipts.filter((item) => item.status === 'verified').length,
    validated_static_copies: receipts.filter((item) => item.status === 'validated-copy').length,
    blocked: receipts.filter((item) => item.status === 'blocked').length,
    status: receipts.some((item) => item.status === 'blocked') ? 'blocked' : 'verified',
    receipts: receipts.map((item) => ({ template_id: item.template_id, artifact_class: item.artifact_class,
      status: item.status, promotion: item.promotion, compiled_contract_sha256: item.compiled_contract_sha256,
      runtime_digest: item.runtime.digest, case_inventory_digest: item.case_inventory.digest })),
  };
  writeFileSync(join(evidenceRoot, 'catalog-receipt.json'), `${JSON.stringify(catalog, null, 2)}\n`); return receipts;
}

async function main(): Promise<void> {
  const receipts = await verifyThirdpartyCatalog(); const blocked = receipts.filter((item) => item.status === 'blocked');
  const verified = receipts.filter((item) => item.status === 'verified').length;
  const staticCopies = receipts.filter((item) => item.status === 'validated-copy').length;
  console.log(`Third-party verification: ${verified} fillable verified; ${staticCopies} static copy validated; ${blocked.length} blocked; ${receipts.length} total.`);
  if (blocked.length) process.exitCode = 1;
}

if (
  process.argv.slice(1).some((arg) => resolve(arg) === fileURLToPath(import.meta.url)) ||
  (process.argv[1]?.includes('vite-node') === true && process.env.VITEST === undefined)
) {
  void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
