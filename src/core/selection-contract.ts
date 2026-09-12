/** Local compiler pilot: data-only radio selections and legacy signature families.
 * Not a general template engine or a claim that every catalog entry is complete.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { getParagraphText } from '@usejunior/docx-core';
import { listCommands } from 'docx-templates';
import { z } from 'zod';
import { loadMetadata } from './metadata.js';
import { runFillPipeline } from './unified-pipeline.js';
import { BLANK_PLACEHOLDER, verifyTemplateFill } from './fill-utils.js';

const engineHash = '38facbeab04d647641ed42dcd501a12fbc0ea8e21261af600becb3de9465a329';
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const safeKey = /^[a-z][a-z0-9_]{0,99}$/;
const selectionSchema = z.object({ groups: z.array(z.object({
  id: z.string(), type: z.literal('radio'), options: z.array(z.object({
    label: z.string().optional(), marker: z.string().min(1),
    trigger: z.union([z.literal('default'), z.object({ field: z.string(), equals: z.string() }).strict()]),
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
  const allowed = new Set(['metadata.yaml', 'selections.json', 'template.docx', 'README.md']);
  if (readdirSync(templateDir).some(name => !allowed.has(name))) throw new Error('Unsupported source artifact/stage');
  const metadata = loadMetadata(templateDir);
  if (metadata.distribution !== 'bundled' || !metadata.allow_derivatives || !['CC0-1.0', 'CC-BY-4.0'].includes(metadata.license)) throw new Error('Unsupported acquisition/permission profile');
  const fieldKeys = new Set(['name', 'type', 'description', 'display_label', 'section', 'default', 'options']);
  for (const f of metadata.fields) {
    if (!safeKey.test(f.name) || ['constructor', 'prototype', '__proto__'].includes(f.name) ||
      !['string', 'date', 'enum'].includes(f.type) || Object.keys(f).some(k => !fieldKeys.has(k))) throw new Error(`Unsupported field: ${f.name}`);
  }
  const names = new Set(metadata.fields.map(f => f.name));
  if (names.size !== metadata.fields.length) throw new Error('Duplicate field');
  const selections = selectionSchema.parse(JSON.parse(readFileSync(join(templateDir, 'selections.json'), 'utf8')));
  const docx = readFileSync(join(templateDir, 'template.docx'));
  if (docx.length > 16_000_000) throw new Error('DOCX size limit');
  const text = paragraphs(docx);
  const markers = new Set<string>();
  for (const g of selections.groups) {
    if (g.options.filter(o => o.trigger === 'default').length !== 1) throw new Error('Radio group needs one default');
    const triggers = new Set<string>();
    const triggerFields = new Set<string>();
    for (const o of g.options) {
      if (markers.has(o.marker) || text.filter(p => p.includes(o.marker)).length !== 1) throw new Error(`Selection marker must match exactly once: ${o.marker}`);
      markers.add(o.marker);
      if (o.trigger !== 'default') {
        if (!names.has(o.trigger.field)) throw new Error('Unknown selection trigger');
        triggerFields.add(o.trigger.field);
        if (triggers.has(o.trigger.equals)) throw new Error('Ambiguous selection trigger');
        triggers.add(o.trigger.equals);
      }
    }
    if (triggerFields.size !== 1) throw new Error('Radio alternatives must use one trigger field');
  }
  const rules: Rule[] = [];
  // Explicitly bounded to the existing engine's party_1 / party_2 convention.
  for (const prefix of ['party_1', 'party_2']) {
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
    profile: 'oa-radio-signature-pilot-v1', status: 'compiled-unverified',
    sourceHashes: Object.fromEntries(['metadata.yaml', 'selections.json', 'template.docx'].map(name => [name, digest(readFileSync(join(templateDir, name)))])),
    compatibility: { engineHash, ruleFamily: 'legacy-party-signature-v1', renderer: 'oa-unified-pipeline' },
    metadata, selections, rules, bindings,
  };
}
export type SelectionContract = Awaited<ReturnType<typeof compileSelectionContract>>;

/** Recompile and compare before interpreting: rejects tampered contracts and source drift. */
export async function fillSelectionContract(templateDir: string, contract: unknown, values: Record<string, unknown>, outputPath: string) {
  const current = await compileSelectionContract(templateDir);
  if (!isDeepStrictEqual(current, contract)) throw new Error('Contract/source mismatch; regenerate and verify');
  for (const [key, value] of Object.entries(values)) {
    const field = current.metadata.fields.find(f => f.name === key);
    if (!field || typeof value !== 'string' || value.length > 10_000 || (field.type === 'enum' && !field.options?.includes(value))) throw new Error(`Invalid input: ${key}`);
  }
  const ignored: string[] = [];
  const result = await runFillPipeline({
    inputPath: join(templateDir, 'template.docx'), outputPath, values,
    fields: current.metadata.fields, priorityFieldNames: current.metadata.priority_fields,
    selectionsConfig: current.selections, selectionsZeroMatchPolicy: 'error',
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
