/**
 * Bounded adapter for first-party canonical (.mdoc) templates.
 *
 * This is a source-derived contract: a bounded canonical Markdoc renderer
 * creates the fill-DOCX, then the reviewed generic fill pipeline executes it.
 * New MDoc directives and non-declarative DOCX expressions fail closed.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { listCommands } from 'docx-templates';
import yaml from 'js-yaml';
import { z } from 'zod';
import { runFillPipeline } from './unified-pipeline.js';
import { verifyTemplateFill } from './fill-utils.js';
import type { ConfirmClauseDescriptor } from './fill-pipeline.js';
import { FieldDefinitionSchema, TemplateMetadataSchema, loadMetadata, type FieldDefinition, type TemplateMetadata } from './metadata.js';
import { renderOriginalMarkdoc } from './original-contract-renderer/index.js';

const KEY = /^[a-z][a-z0-9_]{0,99}$/;
const MAX_STRING = 10_000;
const MAX_ARRAY = 1_000;
const SAFE_SOURCE_FILES = new Set([
  'metadata.yaml', 'template.mdoc', 'template.fill.docx', 'template.docx',
  'template.md', 'template-annotated.md', 'README.md',
]);

type CanonicalField = FieldDefinition & { ai_only?: boolean };
type Binding =
  | { kind: 'field'; field: string }
  | { kind: 'branch'; field: string }
  | { kind: 'array'; field: string; item: string; itemFields: string[] };
type DerivedGate = { field: string; expression: string; dependsOn: string[] };
type SyntheticGate = { field: string; anyOf?: string[]; allOf?: string[]; not?: string };

export interface OriginalContract {
  profile: 'oa-original-source-contract-v1';
  status: 'compiled-unverified';
  sourceDeclarative: true;
  sourceHashes: Record<string, string>;
  runtime: { hash: string; hashes: Record<string, string>; requiresRuntime: true; renderer: 'oa-generic-fill-pipeline' };
  capabilities: { requiresRuntime: true; genericFill: true; standalonePortable: false };
  /** Explicit compatibility boundaries, not silently ignored source directives. */
  renderingNotes: string[];
  source: { templateFile: 'canonical-generated.docx'; mdocFile: 'template.mdoc' };
  license: { license: string; allowDerivatives: boolean; distribution: string; attributionText?: string; sourceUrl?: string };
  /** Public metadata projection retained for compatibility and public callers. */
  metadata: TemplateMetadata;
  /** Complete source schema, including canonical-only/ai_only fields. */
  fields: CanonicalField[];
  publicFields: string[];
  /** Canonical AST references before source conditions are lowered to renderer gates. */
  sourceBindings: Binding[];
  bindings: Binding[];
  confirmClauses: ConfirmClauseDescriptor[];
  derivedGates: DerivedGate[];
  /** Renderer-owned condition gates. They are computed, never caller inputs. */
  syntheticGates: SyntheticGate[];
  runtimeFields: FieldDefinition[];
}

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function canonicalHash(parts: Record<string, string>): string {
  return sha256(Object.entries(parts).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}\0${v}\n`).join(''));
}

function filesBelow(path: string): string[] {
  const output: string[] = [];
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) output.push(...filesBelow(child));
    else output.push(child);
  }
  return output;
}

/** Hash repository source, or the installed package's executable runtime. */
function currentRuntime(): OriginalContract['runtime'] {
  const rootPath = fileURLToPath(new URL('../..', import.meta.url));
  const sourceRoot = join(rootPath, 'src/core');
  const installed = !existsSync(sourceRoot);
  const coreRoot = installed ? join(rootPath, 'dist/core') : sourceRoot;
  const paths = [
    ...filesBelow(coreRoot).filter(p => installed
      ? p.endsWith('.js') && !p.endsWith('.test.js')
      : p.endsWith('.ts') && !p.endsWith('.test.ts')),
    ...['package.json', 'package-lock.json', 'runtime-capabilities.json']
      .map(name => join(rootPath, name)).filter(path => existsSync(path)),
  ];
  const hashes = Object.fromEntries(paths.map(path => [relative(rootPath, path), sha256(readFileSync(path))]));
  return { hash: canonicalHash(hashes), hashes, requiresRuntime: true, renderer: 'oa-generic-fill-pipeline' };
}

function parseCanonicalFields(mdocPath: string): { fields: CanonicalField[]; derivedGates: DerivedGate[] } {
  const raw = readFileSync(mdocPath, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) throw new Error('Canonical source has no YAML frontmatter');
  const frontmatter = z.record(z.string(), z.unknown()).parse(yaml.load(match[1]));
  const sourceFields = z.array(z.unknown()).min(1).parse(frontmatter.fields);
  const seen = new Set<string>();
  const fields = sourceFields.map((rawField, index) => {
    const extra = z.object({ ai_only: z.boolean().optional(), derived_gate: z.string().min(1).optional() }).passthrough().parse(rawField);
    const field = FieldDefinitionSchema.parse(rawField);
    if (!KEY.test(field.name) || ['__proto__', 'constructor', 'prototype'].includes(field.name) || seen.has(field.name)) {
      throw new Error(`Invalid or duplicate canonical field at index ${index}: ${field.name}`);
    }
    seen.add(field.name);
    return { ...(extra.ai_only === undefined ? field : { ...field, ai_only: extra.ai_only }),
      ...(extra.derived_gate ? { derived_gate: extra.derived_gate } : {}) };
  });
  const fieldByName = new Map(fields.map(field => [field.name, field]));
  const derivedGates = fields.flatMap(field => {
    const expression = (field as CanonicalField & { derived_gate?: string }).derived_gate;
    if (!expression) return [];
    if (field.type !== 'boolean' || field.statutory_compliance_representation) throw new Error(`Invalid derived gate: ${field.name}`);
    const dependsOn = parseGateExpression(expression);
    if (!dependsOn.length || dependsOn.some(name => fieldByName.get(name)?.type !== 'boolean')) {
      throw new Error(`Unsupported derived gate expression: ${field.name}`);
    }
    return [{ field: field.name, expression, dependsOn }];
  });
  const byGate = new Map(derivedGates.map(gate => [gate.field, gate]));
  const ordered: DerivedGate[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitGate = (gate: DerivedGate): void => {
    if (visited.has(gate.field)) return;
    if (visiting.has(gate.field)) throw new Error(`Derived gate cycle: ${gate.field}`);
    visiting.add(gate.field);
    for (const dependency of gate.dependsOn) {
      const nested = byGate.get(dependency);
      if (nested) visitGate(nested);
    }
    visiting.delete(gate.field); visited.add(gate.field); ordered.push(gate);
  };
  for (const gate of derivedGates) visitGate(gate);
  return { fields, derivedGates: ordered };
}

/** Boolean-only mini grammar: identifiers, AND, OR, and parentheses; never JS. */
function parseGateExpression(expression: string): string[] {
  const tokens = expression.match(/AND|OR|[a-z][a-z0-9_]*|[()]/g) ?? [];
  if (!tokens.length || tokens.join('') !== expression.replace(/\s+/g, '')) throw new Error('Malformed derived gate');
  let at = 0;
  const names = new Set<string>();
  const primary = (): void => {
    const token = tokens[at++];
    if (token === '(') { or(); if (tokens[at++] !== ')') throw new Error('Malformed derived gate'); return; }
    if (!token || token === 'AND' || token === 'OR' || token === ')') throw new Error('Malformed derived gate');
    names.add(token);
  };
  const and = (): void => { primary(); while (tokens[at] === 'AND') { at++; primary(); } };
  const or = (): void => { and(); while (tokens[at] === 'OR') { at++; and(); } };
  or();
  if (at !== tokens.length) throw new Error('Malformed derived gate');
  return [...names].sort();
}

function evaluateGate(expression: string, data: Record<string, unknown>): boolean {
  const tokens = expression.match(/AND|OR|[a-z][a-z0-9_]*|[()]/g) ?? [];
  let at = 0;
  const primary = (): boolean => {
    const token = tokens[at++];
    if (token === '(') { const value = or(); if (tokens[at++] !== ')') throw new Error('Malformed derived gate'); return value; }
    if (!token || token === 'AND' || token === 'OR' || token === ')') throw new Error('Malformed derived gate');
    return data[token] === true;
  };
  const and = (): boolean => { let value = primary(); while (tokens[at] === 'AND') { at++; value = primary() && value; } return value; };
  const or = (): boolean => { let value = and(); while (tokens[at] === 'OR') { at++; value = and() || value; } return value; };
  const result = or();
  if (at !== tokens.length) throw new Error('Malformed derived gate');
  return result;
}

function assertSourceInventory(templateDir: string): void {
  for (const name of readdirSync(templateDir)) {
    if (!SAFE_SOURCE_FILES.has(name)) throw new Error(`Unsupported source artifact/stage: ${name}`);
  }
}


async function docxBindings(bytes: Buffer, fields: CanonicalField[]): Promise<Binding[]> {
  if (bytes.length > 32_000_000) throw new Error('DOCX size limit');
  const names = new Set(fields.map(field => field.name));
  const arrays = new Map(fields.filter(field => field.type === 'array').map(field => [field.name, field]));
  const loops = new Map<string, { field: string; itemFields: string[] }>();
  const bindings: Binding[] = [];
  const commands = await listCommands(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, ['{', '}']);
  for (const command of commands) {
    if (command.type === 'INS') {
      const nested = /^\$([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/.exec(command.code);
      if (nested) {
        const loop = loops.get(nested[1]);
        if (!loop || !loop.itemFields.includes(nested[2])) throw new Error(`Unsupported or unresolved DOCX command: ${command.raw}`);
        continue;
      }
      if (!KEY.test(command.code) || !names.has(command.code)) throw new Error(`Unsupported or unresolved DOCX command: ${command.raw}`);
      bindings.push({ kind: 'field', field: command.code });
    } else if (command.type === 'IF') {
      const negated = command.code.startsWith('!');
      const condition = negated ? command.code.slice(1) : command.code;
      const field = fields.find(candidate => candidate.name === condition);
      if (!KEY.test(condition) || !field || field.type === 'array' || field.type === 'multiselect') {
        throw new Error(`Unsupported DOCX condition: ${command.raw}`);
      }
      bindings.push({ kind: 'branch', field: condition });
    } else if (command.type === 'FOR') {
      const match = /^([a-z][a-z0-9_]*) IN ([a-z][a-z0-9_]*)$/.exec(command.code);
      const array = match && arrays.get(match[2]);
      if (!match || !array || !array.items) throw new Error(`Unsupported DOCX loop: ${command.raw}`);
      const itemFields = array.items.map(field => field.name).sort();
      loops.set(match[1], { field: match[2], itemFields });
      bindings.push({ kind: 'array', field: match[2], item: match[1], itemFields });
    } else if (command.type === 'END-FOR') {
      if (!KEY.test(command.code) || !loops.delete(command.code)) throw new Error(`Unbalanced DOCX loop: ${command.raw}`);
    } else if (command.type === 'END-IF') {
      if (command.code) throw new Error(`Unsupported DOCX condition terminator: ${command.raw}`);
    } else {
      throw new Error(`Unsupported DOCX command/stage: ${command.raw}`);
    }
  }
  if (loops.size) throw new Error('Unclosed DOCX loop');
  return bindings;
}

/** Render from the canonical MDoc AST; historical DOCX twins are never an input. */
async function renderCanonicalDocx(templateDir: string, fields: CanonicalField[]) {
  return renderOriginalMarkdoc(readFileSync(join(templateDir, 'template.mdoc'), 'utf8'), fields) as unknown as {
    buffer: Buffer; bindings: Binding[]; sourceBindings: Binding[]; syntheticGates?: SyntheticGate[]; confirmClauses: ConfirmClauseDescriptor[];
    compatibilityNotes?: string[];
  };
}

/** Compile a canonical original template into a serializable, source-bound manifest. */
export async function compileOriginalContract(templateDir: string): Promise<OriginalContract> {
  assertSourceInventory(templateDir);
  const mdocPath = join(templateDir, 'template.mdoc');
  if (!existsSync(mdocPath)) throw new Error('Original contract requires template.mdoc');
  const metadata = loadMetadata(templateDir);
  if (!metadata.allow_derivatives || !['CC-BY-4.0', 'CC0-1.0'].includes(metadata.license)) {
    throw new Error('Unsupported acquisition/permission profile');
  }
  const { fields, derivedGates } = parseCanonicalFields(mdocPath);
  // Re-run the repository's cross-field metadata invariants against the full
  // canonical projection (enum-derived maps, required_when references, etc.).
  TemplateMetadataSchema.parse({ ...metadata, fields });
  const publicFields = metadata.fields.map(field => field.name);
  if (new Set(publicFields).size !== publicFields.length || publicFields.some(name => !fields.some(field => field.name === name))) {
    throw new Error('Public metadata is not a projection of canonical fields');
  }
  const sourceHashes = Object.fromEntries(['metadata.yaml', 'template.mdoc'].map(name => [name, sha256(readFileSync(join(templateDir, name)))]));
  const rendered = await renderCanonicalDocx(templateDir, fields);
  const syntheticGates = rendered.syntheticGates ?? [];
  const runtimeFields = syntheticGates.map(gate => ({ name: gate.field, type: 'boolean' as const, description: 'Renderer-owned condition gate', default: 'false' }));
  const runtimeNames = new Set(runtimeFields.map(field => field.name));
  if (runtimeFields.some(field => !KEY.test(field.name)) || runtimeFields.length !== runtimeNames.size || [...runtimeNames].some(name => fields.some(field => field.name === name))) {
    throw new Error('Invalid renderer synthetic gates');
  }
  const bindings = await docxBindings(rendered.buffer, [...fields, ...runtimeFields]);
  const bindingKey = (binding: Binding) => JSON.stringify(binding);
  const emitted = new Set(bindings.map(bindingKey));
  if (rendered.bindings.some(binding => !emitted.has(bindingKey(binding)))) throw new Error('Renderer/DOCX binding mismatch');
  // Direct canonical references must survive lowering exactly. Conditions are
  // deliberately lowered to renderer-owned boolean gates, so validate their
  // dependency graph separately instead of pretending their names remain in DOCX.
  const direct = (binding: Binding) => binding.kind !== 'branch';
  const sourceDirect = rendered.sourceBindings.filter(direct).map(bindingKey).sort();
  const outputDirect = bindings.filter(direct).map(bindingKey).sort();
  if (!isDeepStrictEqual(sourceDirect, outputDirect)) throw new Error('Canonical source/DOCX direct-binding mismatch');
  const canonicalNames = new Set(fields.map(field => field.name));
  const declaredGates = new Set<string>();
  const referencedGates = new Set<string>();
  const conditionInputs = new Set<string>();
  for (const gate of syntheticGates) {
    if (declaredGates.has(gate.field)) throw new Error('Duplicate renderer synthetic gate');
    const dependencies = [...(gate.anyOf ?? []), ...(gate.allOf ?? []), ...(gate.not ? [gate.not] : [])];
    if (!dependencies.length || dependencies.some(name => !canonicalNames.has(name) && !declaredGates.has(name))) throw new Error('Unknown or forward renderer synthetic-gate dependency');
    for (const dependency of dependencies) {
      conditionInputs.add(dependency);
      if (declaredGates.has(dependency)) referencedGates.add(dependency);
    }
    declaredGates.add(gate.field);
  }
  for (const binding of rendered.sourceBindings) if (binding.kind === 'branch' && !conditionInputs.has(binding.field)) throw new Error('Canonical condition was not lowered to a renderer gate');
  for (const binding of bindings) if (binding.kind === 'branch' && runtimeNames.has(binding.field)) referencedGates.add(binding.field);
  if ([...declaredGates].some(name => !referencedGates.has(name))) throw new Error('Unreferenced renderer synthetic gate');
  return {
    profile: 'oa-original-source-contract-v1', status: 'compiled-unverified', sourceDeclarative: true,
    sourceHashes, runtime: currentRuntime(),
    capabilities: { requiresRuntime: true, genericFill: true, standalonePortable: false },
    renderingNotes: rendered.compatibilityNotes ?? [],
    source: { templateFile: 'canonical-generated.docx', mdocFile: 'template.mdoc' },
    license: { license: metadata.license, allowDerivatives: metadata.allow_derivatives, distribution: metadata.distribution ?? 'bundled',
      ...(metadata.attribution_text ? { attributionText: metadata.attribution_text } : {}),
      ...(metadata.source_url ? { sourceUrl: metadata.source_url } : {}) },
    metadata, fields, publicFields, sourceBindings: rendered.sourceBindings, bindings,
    confirmClauses: rendered.confirmClauses, derivedGates, syntheticGates, runtimeFields,
  };
}

function assertValue(field: FieldDefinition, value: unknown, path: string): void {
  const invalid = () => { throw new Error(`Invalid input: ${path}`); };
  if (field.type === 'string' || field.type === 'date') {
    if (typeof value !== 'string' || value.length > MAX_STRING) invalid();
  } else if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
  } else if (field.type === 'boolean') {
    if (typeof value !== 'boolean') invalid();
  } else if (field.type === 'enum') {
    if (typeof value !== 'string' || !field.options?.includes(value)) invalid();
  } else if (field.type === 'multiselect') {
    if (!Array.isArray(value) || value.length > MAX_ARRAY || value.some(item => typeof item !== 'string' || !field.options?.includes(item)) || new Set(value).size !== value.length) invalid();
  } else if (field.type === 'array') {
    if (!Array.isArray(value) || value.length > MAX_ARRAY || !field.items) invalid();
    const items = field.items!;
    const array = value as unknown[];
    for (const [index, item] of array.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) invalid();
      const record = item as Record<string, unknown>;
      const allowed = new Set(items.map(child => child.name));
      if (Object.keys(record).some(key => !allowed.has(key))) invalid();
      for (const child of items) if (record[child.name] !== undefined) assertValue(child, record[child.name], `${path}[${index}].${child.name}`);
    }
  }
}

/** Reject stale/tampered manifests and typed-invalid inputs, then use the current generic fill runtime. */
export async function fillOriginalContract(templateDir: string, contract: unknown, values: Record<string, unknown>, outputPath: string) {
  const current = await compileOriginalContract(templateDir);
  if (!isDeepStrictEqual(current, contract)) throw new Error('Contract/source/runtime mismatch; regenerate and verify');
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Invalid input object');
  const fields = new Map(current.fields.map(field => [field.name, field]));
  for (const [name, value] of Object.entries(values)) {
    const field = fields.get(name);
    if (!field) throw new Error(`Invalid input: ${name}`);
    assertValue(field, value, name);
  }
  if (current.derivedGates.some(gate => Object.hasOwn(values, gate.field))) throw new Error('Invalid input: derived gates are runtime-computed');
  // The manifest explicitly says this adapter needs the repository runtime.
  // Keep the public engine's two source-derived optional-row normalizations;
  // canonical-only fields otherwise flow directly through the shared pipeline.
  const blank = (value: unknown) => typeof value === 'string' && value.trim() === '_______';
  const temp = mkdtempSync(join(tmpdir(), 'oa-original-contract-'));
  try {
    const inputPath = join(temp, current.source.templateFile);
    writeFileSync(inputPath, (await renderCanonicalDocx(templateDir, current.fields)).buffer);
    return await runFillPipeline({
    inputPath, outputPath, values, fields: [...current.fields, ...current.runtimeFields], priorityFieldNames: current.metadata.priority_fields,
      coerceBooleans: true, fixSmartQuotes: true, verify: verifyTemplateFill,
      confirmClauses: current.confirmClauses,
      computeDisplayFields: data => {
        for (const gate of current.derivedGates) data[gate.field] = evaluateGate(gate.expression, data);
        // Typed strings are text, not Boolean coercions: the literal "false"
        // still supplies nonempty content to a string-dependent clause.
        const truth = (value: unknown) => value === true || (typeof value === 'string' && value.trim() !== '' && value.trim() !== '_______') || (typeof value === 'number' && Number.isFinite(value) && value !== 0);
        for (const gate of current.syntheticGates) {
          const all = (gate.allOf ?? []).every(name => truth(data[name]));
          const any = gate.anyOf === undefined || gate.anyOf.some(name => truth(data[name]));
          data[gate.field] = all && any && (gate.not === undefined || !truth(data[gate.not]));
        }
        for (const name of ['bonus_terms', 'equity_terms']) if (blank(data[name])) data[name] = '';
      },
    });
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
