import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { fillTemplate } from '../core/engine.js';
import { loadMetadata } from '../core/metadata.js';
import { findTemplateDir } from '../utils/paths.js';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const AgreementIdSchema = z.string().uuid();

export const AgreementRecordSchema = z.object({
  id: z.string().uuid(),
  template: z.object({
    id: z.string().min(1),
    version: z.string(),
    source_sha256: Sha256Schema,
  }),
  revision: z.number().int().positive(),
  terms: z.record(z.string(), z.unknown()),
  review: z.object({
    revision: z.number().int().positive(),
    warnings: z.array(z.string()),
    reviewed_at: z.string().datetime(),
  }).nullable(),
  rendered_document: z.object({
    revision: z.number().int().positive(),
    path: z.string(),
    sha256: Sha256Schema,
    rendered_at: z.string().datetime(),
  }).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AgreementRecord = z.infer<typeof AgreementRecordSchema>;

interface CommandOptions {
  root?: string;
}

function agreementsRoot(root?: string): string {
  return root ?? process.env.OPEN_AGREEMENTS_STATE_ROOT ?? join(process.cwd(), '.open-agreements', 'agreements');
}

function agreementDir(id: string, root?: string): string {
  return join(agreementsRoot(root), AgreementIdSchema.parse(id));
}

function recordPath(id: string, root?: string): string {
  return join(agreementDir(id, root), 'agreement.json');
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function readRecord(id: string, root?: string): AgreementRecord {
  const path = recordPath(id, root);
  if (!existsSync(path)) throw new Error(`Agreement not found: "${id}"`);
  return AgreementRecordSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
}

async function writeRecord(record: AgreementRecord, root?: string): Promise<void> {
  const dir = agreementDir(record.id, root);
  await mkdir(dir, { recursive: true });
  const target = recordPath(record.id, root);
  const temporary = join(dir, `.agreement-${process.pid}-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
  const { rename } = await import('node:fs/promises');
  await rename(temporary, target);
}

function resolveTemplateSource(templateDir: string): string {
  for (const name of ['template.docx', 'template.fill.docx']) {
    const candidate = join(templateDir, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Template source DOCX not found in ${templateDir}`);
}

function requireTemplate(templateId: string, capability: 'create' | 'review' | 'render') {
  const templateDir = findTemplateDir(templateId);
  if (!templateDir) throw new Error(`Template not found or not locally mutable: "${templateId}"`);
  const metadata = loadMetadata(templateDir);
  if (!metadata.capabilities.includes(capability)) {
    throw new Error(`Template "${templateId}" does not support the ${capability} capability`);
  }
  return { templateDir, metadata, sourcePath: resolveTemplateSource(templateDir) };
}

export interface AgreementCreateArgs extends CommandOptions {
  template: string;
  terms?: Record<string, unknown>;
  id?: string;
}

export async function runAgreementCreate(args: AgreementCreateArgs): Promise<AgreementRecord> {
  const { metadata, sourcePath } = requireTemplate(args.template, 'create');
  const id = args.id ?? randomUUID();
  if (existsSync(recordPath(id, args.root))) throw new Error(`Agreement already exists: "${id}"`);
  const now = new Date().toISOString();
  const record: AgreementRecord = {
    id,
    template: {
      id: args.template,
      version: metadata.version,
      source_sha256: sha256(readFileSync(sourcePath)),
    },
    revision: 1,
    terms: args.terms ?? {},
    review: null,
    rendered_document: null,
    created_at: now,
    updated_at: now,
  };
  AgreementRecordSchema.parse(record);
  await writeRecord(record, args.root);
  console.log(`Created agreement ${id} from ${args.template} (revision 1)`);
  return record;
}

export async function runAgreementList(args: CommandOptions & { json?: boolean } = {}): Promise<AgreementRecord[]> {
  const root = agreementsRoot(args.root);
  const records = !existsSync(root) ? [] : readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && AgreementIdSchema.safeParse(entry.name).success && existsSync(recordPath(entry.name, args.root)))
    .map((entry) => readRecord(entry.name, args.root))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  if (args.json) console.log(JSON.stringify(records, null, 2));
  else if (records.length === 0) console.log('No agreements found.');
  else records.forEach((record) => console.log(`${record.id}  ${record.template.id}  revision ${record.revision}`));
  return records;
}

export async function runAgreementShow(args: CommandOptions & { id: string; json?: boolean }): Promise<AgreementRecord> {
  const record = readRecord(args.id, args.root);
  if (args.json) console.log(JSON.stringify(record, null, 2));
  else {
    console.log(`${record.id}\nTemplate: ${record.template.id}@${record.template.version}\nRevision: ${record.revision}`);
    console.log(`Terms: ${Object.keys(record.terms).length}\nReview warnings: ${record.review?.warnings.length ?? 'not reviewed'}`);
    console.log(`Rendered: ${record.rendered_document?.path ?? 'not rendered'}`);
  }
  return record;
}

export interface AgreementUpdateArgs extends CommandOptions {
  id: string;
  terms: Record<string, unknown>;
  revision?: number;
}

export async function runAgreementUpdate(args: AgreementUpdateArgs): Promise<AgreementRecord> {
  const current = readRecord(args.id, args.root);
  const { metadata } = requireTemplate(current.template.id, 'create');
  if (metadata.mutation_policy === 'immutable') throw new Error(`Agreement ${args.id} is immutable`);
  if (args.revision !== undefined && args.revision !== current.revision) {
    throw new Error(`Revision conflict: expected ${args.revision}, current revision is ${current.revision}`);
  }
  const next: AgreementRecord = {
    ...current,
    revision: current.revision + 1,
    terms: { ...current.terms, ...args.terms },
    review: null,
    rendered_document: null,
    updated_at: new Date().toISOString(),
  };
  await writeRecord(next, args.root);
  console.log(`Updated agreement ${args.id} to revision ${next.revision}`);
  return next;
}

export async function runAgreementReview(args: CommandOptions & { id: string }): Promise<AgreementRecord> {
  const current = readRecord(args.id, args.root);
  const { metadata, sourcePath } = requireTemplate(current.template.id, 'review');
  const warnings: string[] = [];
  for (const field of metadata.priority_fields) {
    const value = current.terms[field];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      warnings.push(`Priority term is unfilled: ${field}`);
    }
  }
  if (metadata.version !== current.template.version) warnings.push(`Template version changed: ${current.template.version} -> ${metadata.version}`);
  if (sha256(readFileSync(sourcePath)) !== current.template.source_sha256) warnings.push('Template source SHA-256 has changed since creation');
  if (current.rendered_document && current.rendered_document.revision !== current.revision) warnings.push('Rendered document is stale');
  const next: AgreementRecord = {
    ...current,
    review: { revision: current.revision, warnings, reviewed_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  };
  await writeRecord(next, args.root);
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  console.log(`Reviewed agreement ${args.id}: ${warnings.length} warning(s)`);
  return next;
}

export interface AgreementRenderArgs extends CommandOptions {
  id: string;
  output?: string;
  renderer?: typeof fillTemplate;
}

export async function runAgreementRender(args: AgreementRenderArgs): Promise<AgreementRecord> {
  const current = readRecord(args.id, args.root);
  const { templateDir, sourcePath } = requireTemplate(current.template.id, 'render');
  if (sha256(readFileSync(sourcePath)) !== current.template.source_sha256) {
    throw new Error('Template source SHA-256 has changed; create a new agreement before rendering');
  }
  const outputPath = resolve(args.output ?? join(agreementDir(args.id, args.root), `document-r${current.revision}.docx`));
  await mkdir(dirname(outputPath), { recursive: true });
  await (args.renderer ?? fillTemplate)({ templateDir, values: current.terms, outputPath });
  const documentHash = sha256(readFileSync(outputPath));
  const next: AgreementRecord = {
    ...current,
    rendered_document: {
      revision: current.revision,
      path: outputPath,
      sha256: documentHash,
      rendered_at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
  await writeRecord(next, args.root);
  console.log(`Rendered agreement ${args.id}\nOutput: ${outputPath}\nSHA-256: ${documentHash}`);
  return next;
}

export function loadAgreementTerms(path?: string, sets: string[] = []): Record<string, unknown> {
  const terms = path
    ? z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(path, 'utf-8')))
    : {};
  for (const pair of sets) {
    const separator = pair.indexOf('=');
    if (separator < 1) throw new Error(`Invalid --set format: "${pair}" (expected key=value)`);
    terms[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return terms;
}
