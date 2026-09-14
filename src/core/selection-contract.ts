/** Local compiler pilot: data-only radio selections and legacy signature families.
 * Not a general template engine or a claim that every catalog entry is complete.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import { listCommands } from 'docx-templates';
import { z } from 'zod';
import { loadMetadata, loadCleanConfig } from './metadata.js';
import { cleanDocument } from './field-selector/cleaner.js';
import { patchDocument } from './field-selector/patcher.js';
import { runFillPipeline } from './unified-pipeline.js';
import { BLANK_PLACEHOLDER, verifyTemplateFill } from './fill-utils.js';

const engineHash = '38facbeab04d647641ed42dcd501a12fbc0ea8e21261af600becb3de9465a329';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const safeKey = /^[a-z][a-z0-9_]{0,99}$/;
const selectionSchema = z.object({ groups: z.array(z.object({
  id: z.string(), type: z.enum(['radio', 'checkbox']), options: z.array(z.object({
    label: z.string().optional(), marker: z.string().min(1),
    trigger: z.union([z.literal('default'), z.object({ field: z.string(), equals: z.union([z.string(), z.boolean()]).optional() }).strict()]),
  }).strict()).min(2).max(10),
}).strict()).min(1).max(20) }).strict();

type Rule = { op: 'signature-display'; source: string; target: string; typeField: string } |
  { op: 'blank-to-empty'; target: string };

function paragraphs(bytes: Buffer): string[] {
  const zip = new AdmZip(bytes);
  if (zip.getEntries().reduce((n, e) => n + e.header.size, 0) > 64_000_000) throw new Error('DOCX expansion limit');
  return zip.getEntries().filter(e => /^word\/.*\.xml$/.test(e.entryName)).flatMap(e => {
    const doc = new DOMParser().parseFromString(e.getData().toString('utf8'), 'application/xml');
    return Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p'))
      .map(p => getParagraphText(p as unknown as Parameters<typeof getParagraphText>[0]));
  });
}

/** Compile from canonical source data; no hand-maintained per-template field pack. */
export async function compileSelectionContract(templateDir: string) {
  if (digest(readFileSync(new URL('./engine.ts', import.meta.url))) !== engineHash) throw new Error('Legacy signature mapping requires re-verification after engine update');
  // Refuse unimplemented transformation stages rather than silently skip them.
  const allowed = new Set(['metadata.yaml', 'selections.json', 'replacements.json', 'template.docx', 'README.md']);
  if (readdirSync(templateDir).some(name => !allowed.has(name))) throw new Error('Unsupported source artifact/stage');
  const metadata = loadMetadata(templateDir);
  if (metadata.distribution !== 'bundled' || !metadata.allow_derivatives || !['CC0-1.0', 'CC-BY-4.0'].includes(metadata.license)) throw new Error('Unsupported acquisition/permission profile');
  const fieldKeys = new Set(['name', 'type', 'description', 'display_label', 'section', 'default', 'options']);
  for (const f of metadata.fields) {
    if (!safeKey.test(f.name) || ['constructor', 'prototype', '__proto__'].includes(f.name) ||
      !['string', 'date', 'enum', 'boolean'].includes(f.type) || Object.keys(f).some(k => !fieldKeys.has(k))) throw new Error(`Unsupported field: ${f.name}`);
  }
  const names = new Set(metadata.fields.map(f => f.name));
  if (names.size !== metadata.fields.length) throw new Error('Duplicate field');
  const unimplemented = ['bonus_terms', 'equity_terms', 'order_date_display', 'pilot_fee_display', 'fees_display', 'payment_display', 'auto_renewal_display', 'effective_date_display', 'covered_claims_display', 'general_cap_display'];
  for (const n of [1, 2]) {
    unimplemented.push(`party_${n}_signatory_name_and_title`, `party_${n}_notice_email_check`, `party_${n}_notice_postal_check`);
    if (names.has(`party_${n}_signatory_company`) && names.has(`party_${n}_name`)) throw new Error('Unsupported signatory company fallback');
  }
  if (unimplemented.some(name => names.has(name))) throw new Error('Unsupported legacy computed-field family');
  const selections = existsSync(join(templateDir, 'selections.json'))
    ? selectionSchema.parse(JSON.parse(readFileSync(join(templateDir, 'selections.json'), 'utf8')))
    : { groups: [] };
  const replacements = existsSync(join(templateDir, 'replacements.json'))
    ? z.record(z.string().min(1).max(1000), z.string()).parse(JSON.parse(readFileSync(join(templateDir, 'replacements.json'), 'utf8')))
    : undefined;
  let docx = readFileSync(join(templateDir, 'template.docx'));
  if (docx.length > 16_000_000) throw new Error('DOCX size limit');
  if (replacements) {
    if (!Object.keys(replacements).length || Object.keys(replacements).length > 100) throw new Error('Replacement count limit');
    const originalText = paragraphs(docx);
    for (const [search, target] of Object.entries(replacements)) {
      const match = /^\{([a-z][a-z0-9_]{0,99})\}$/.exec(target);
      if (!match || !names.has(match[1]) || !originalText.some(p => p.includes(search))) throw new Error('Unsupported or unmatched literal replacement');
    }
    const temp = mkdtempSync(join(tmpdir(), 'oa-contract-compile-'));
    try {
      const cleaned = join(temp, 'cleaned.docx'), patched = join(temp, 'patched.docx');
      await cleanDocument(join(templateDir, 'template.docx'), cleaned, loadCleanConfig(templateDir));
      await patchDocument(cleaned, patched, replacements);
      docx = readFileSync(patched);
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  const text = paragraphs(docx);
  const markers = new Set<string>();
  for (const g of selections.groups) {
    if (g.options.filter(o => o.trigger === 'default').length !== (g.type === 'radio' ? 1 : 0)) throw new Error('Invalid selection defaults');
    const triggers = new Set<string>();
    const triggerFields = new Set<string>();
    for (const o of g.options) {
      if (markers.has(o.marker) || text.filter(p => p.includes(o.marker)).length !== 1) throw new Error(`Selection marker must match exactly once: ${o.marker}`);
      markers.add(o.marker);
      if (o.trigger !== 'default') {
        const trigger = o.trigger;
        const field = metadata.fields.find(f => f.name === trigger.field);
        if (!field) throw new Error('Unknown selection trigger');
        if (o.trigger.equals === undefined ? field.type !== 'boolean' :
          typeof o.trigger.equals !== (field.type === 'boolean' ? 'boolean' : 'string')) throw new Error('Invalid selection trigger type');
        triggerFields.add(o.trigger.field);
        const key = JSON.stringify([o.trigger.field, o.trigger.equals]);
        if (triggers.has(key)) throw new Error('Ambiguous selection trigger');
        triggers.add(key);
      }
    }
    if (g.type === 'radio' && triggerFields.size !== 1) throw new Error('Radio alternatives must use one trigger field');
  }
  const rules: Rule[] = [];
  // Same discovery convention as the reviewed engine; not a template-ID switch.
  const prefixes = [...new Set([
    ...[...names].filter(name => name.endsWith('_signatory_type')).map(name => name.slice(0, -5)),
    'party_1', 'party_2',
  ])];
  for (const prefix of prefixes) {
    if (!names.has(`${prefix}_type`)) continue;
    const type = metadata.fields.find(f => f.name === `${prefix}_type`)!;
    if (type.type !== 'enum' || !isDeepStrictEqual(type.options, ['entity', 'individual'])) throw new Error('Unsupported signature type');
    for (const suffix of ['title', 'company']) {
      const source = `${prefix}_${suffix}`;
      if (!names.has(source) || names.has(`${source}_display`)) throw new Error('Incomplete/conflicting signature family');
      rules.push({ op: 'signature-display', source, target: `${source}_display`, typeField: `${prefix}_type` });
    }
    for (const suffix of ['name', 'email', 'title', 'company']) {
      const target = `${prefix}_${suffix}`;
      if (!names.has(target)) throw new Error('Incomplete signature family');
      rules.push({ op: 'blank-to-empty', target });
    }
  }
  const available = new Set([...names, ...rules.map(r => r.target)]);
  const commands = await listCommands(Uint8Array.from(docx).buffer, ['{', '}']);
  if (!commands.length || commands.some(c => c.type !== 'INS' || !safeKey.test(c.code) || !available.has(c.code))) throw new Error('Unsupported or unresolved DOCX command');
  const bindings = [...new Set(commands.map(c => c.code))].sort();
  return {
    profile: 'oa-selection-signature-pilot-v3', status: 'compiled-unverified',
    sourceHashes: Object.fromEntries(['metadata.yaml', 'selections.json', 'replacements.json', 'template.docx'].filter(name => existsSync(join(templateDir, name))).map(name => [name, digest(readFileSync(join(templateDir, name)))])),
    compatibility: { engineHash, ruleFamily: 'legacy-role-signature-v2', renderer: 'oa-unified-pipeline' },
    metadata, selections, replacements, rules, bindings,
  };
}
export type SelectionContract = Awaited<ReturnType<typeof compileSelectionContract>>;

/** Recompile and compare before interpreting: rejects tampered contracts and source drift. */
export async function fillSelectionContract(templateDir: string, contract: unknown, values: Record<string, unknown>, outputPath: string) {
  const current = await compileSelectionContract(templateDir);
  if (!isDeepStrictEqual(current, contract)) throw new Error('Contract/source mismatch; regenerate and verify');
  for (const [key, value] of Object.entries(values)) {
    const field = current.metadata.fields.find(f => f.name === key);
    if (!field || (field.type === 'boolean' ? typeof value !== 'boolean' : typeof value !== 'string' || value.length > 10_000) || (field.type === 'enum' && !field.options?.includes(value as string))) throw new Error(`Invalid input: ${key}`);
  }
  const ignored: string[] = [];
  const result = await runFillPipeline({
    inputPath: join(templateDir, 'template.docx'), outputPath, values,
    fields: current.metadata.fields, priorityFieldNames: current.metadata.priority_fields,
    cleanPatch: current.replacements ? { cleanConfig: loadCleanConfig(templateDir), replacements: current.replacements } : undefined,
    selectionsConfig: current.selections.groups.length ? current.selections : undefined, selectionsZeroMatchPolicy: 'error',
    coerceBooleans: true, fixSmartQuotes: true, verify: verifyTemplateFill,
    computeDisplayFields: data => {
      const blank = (v: unknown) => typeof v === 'string' && v.trim() === BLANK_PLACEHOLDER;
      for (const rule of current.rules) {
        if (rule.op === 'blank-to-empty') {
          if (blank(data[rule.target])) data[rule.target] = '';
        } else {
          const value = data[rule.source];
          const entity = data[rule.typeField] !== 'individual';
          data[rule.target] = entity && value && !blank(value) ? String(value) : '';
          if (!entity && value && !blank(value) && String(value).trim()) ignored.push(`${rule.source} ignored for individual`);
        }
      }
    },
  });
  return { ...result, warnings: [...result.warnings, ...ignored] };
}
