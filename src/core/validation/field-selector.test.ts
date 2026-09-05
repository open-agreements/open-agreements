import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { validateFieldSelector } from './field-selector.js';

const it = itAllure.epic('FieldSelectors');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

interface FixtureField {
  name: string;
  type?: string;
  description?: string;
  default?: string;
}

interface FixtureSpec {
  fields: FixtureField[];
  replacements?: Record<string, unknown>;
  computed?: Record<string, unknown>;
  normalize?: Record<string, unknown>;
  selections?: Record<string, unknown>;
  anchoredBindings?: Record<string, unknown>;
  repeatableTables?: Record<string, unknown>;
  /** field ids to write minimal fields/<id>.json selector recipes for */
  recipes?: string[];
  templateManifest?: Record<string, unknown>;
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writeFixture(spec: FixtureSpec): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-field-selector-validate-'));
  tempDirs.push(dir);

  const fieldsYaml = spec.fields
    .map((f) => {
      const lines = [
        `  - name: ${f.name}`,
        `    type: ${f.type ?? 'string'}`,
        `    description: ${f.description ?? 'test field'}`,
      ];
      if (f.default !== undefined) lines.push(`    default: "${f.default}"`);
      return lines.join('\n');
    })
    .join('\n');

  writeFileSync(
    join(dir, 'metadata.yaml'),
    [
      'name: Fixture Selector',
      'source_url: https://example.com/source.docx',
      "source_version: '2026'",
      'license_note: test fixture',
      'artifact_type: field-selector',
      'source_sha256: ' + 'a'.repeat(64),
      'fields:',
      fieldsYaml,
      '',
    ].join('\n'),
  );

  if (spec.replacements) {
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify(spec.replacements, null, 2));
  }
  if (spec.computed) {
    writeFileSync(join(dir, 'computed.json'), JSON.stringify(spec.computed, null, 2));
  }
  if (spec.normalize) {
    writeFileSync(join(dir, 'normalize.json'), JSON.stringify(spec.normalize, null, 2));
  }
  if (spec.selections) {
    writeFileSync(join(dir, 'selections.json'), JSON.stringify(spec.selections, null, 2));
  }
  if (spec.anchoredBindings) {
    writeFileSync(join(dir, 'anchored-paragraph-bindings.json'), JSON.stringify(spec.anchoredBindings, null, 2));
  }
  if (spec.repeatableTables) {
    writeFileSync(join(dir, 'repeatable-tables.json'), JSON.stringify(spec.repeatableTables, null, 2));
  }
  if (spec.recipes || spec.templateManifest) {
    mkdirSync(join(dir, 'fields'), { recursive: true });
  }
  for (const fieldId of spec.recipes ?? []) {
    writeFileSync(
      join(dir, 'fields', `${fieldId}.json`),
      JSON.stringify(
        {
          schema_version: 1,
          field_id: fieldId,
          field_label: fieldId,
          description: 'test recipe',
          source_template_version: '2026',
          occurrences: [{ primary: { kind: 'regex', pattern: '\\[SLOT\\]' } }],
          failure_behavior: 'warn',
        },
        null,
        2,
      ),
    );
  }
  if (spec.templateManifest) {
    writeFileSync(
      join(dir, 'template-manifest.json'),
      JSON.stringify(
        {
          schema_version: 1,
          template_id: 'fixture-selector',
          template_version: '2026',
          source_sha256: 'a'.repeat(64),
          ...spec.templateManifest,
        },
        null,
        2,
      ),
    );
  }

  return dir;
}

// ---------------------------------------------------------------------------
// Binding reachability (issue #621)
// ---------------------------------------------------------------------------

describe('validateFieldSelector binding reachability', () => {
  it('fails a metadata field bound by nothing, naming the field', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unbound field "dead_field"'))).toBe(true);
    expect(result.errors.some((e) => e.includes('company_name'))).toBe(false);
  });

  it('passes a field bound only via a normalize.json replacement tag', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'board_size' }],
      replacements: { '[COMPANY]': '{company_name}' },
      normalize: {
        paragraph_rules: [
          {
            id: 'fill-board-size',
            section_heading: 'Board',
            paragraph_contains: 'authorized size of the Board',
            replacements: { '[______]': '{board_size}' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('passes a field bound only via a selections.json trigger', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'include_arbitration' }],
      replacements: { '[COMPANY]': '{company_name}' },
      selections: {
        groups: [
          {
            id: 'arbitration',
            type: 'checkbox',
            standalone: true,
            options: [{ marker: '[ ]', trigger: { field: 'include_arbitration', equals: true } }],
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('passes fields bound through anchored labels and repeatable table rows', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'signatory_name' }, { name: 'investors', type: 'array' }],
      replacements: { '[COMPANY]': '{company_name}' },
      anchoredBindings: {
        groups: [{
          id: 'signature', start_anchor: 'COMPANY:', end_anchor: 'INVESTORS:', expected_group_matches: 1,
          bindings: [{ label: 'Name:', field: 'signatory_name', expected_matches: 1, insert_after_label: true, preserve_following_tabs: true }],
        }],
      },
      repeatableTables: {
        schema_version: 1,
        tables: [{
          id: 'investors', rows_field: 'investors',
          prototype_cells: ['[Investor Name]'],
          columns: [{ field: 'name' }],
        }],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('passes a field wired only through a computed chain ending in a real binding', () => {
    // gate_field is read by a computed predicate; the rule's set_fill target
    // (computed_slot, unpublished) is bound via replacements.json — so
    // gate_field affects the document and must be considered reachable.
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'gate_field', type: 'boolean', default: 'false' }],
      replacements: { '[COMPANY]': '{company_name}', '[CLAUSE]': '{computed_slot}' },
      computed: {
        rules: [
          {
            id: 'gate-to-slot',
            when_all: [{ field: 'gate_field', op: 'truthy' }],
            set_fill: { computed_slot: 'the clause text' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('propagates computed reachability across a multi-hop chain', () => {
    // outer_gate → rule sets mid_slot; mid_slot → rule sets bound_slot;
    // bound_slot is bound in replacements.json.
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'outer_gate', type: 'boolean', default: 'false' }],
      replacements: { '[COMPANY]': '{company_name}', '[CLAUSE]': '{bound_slot}' },
      computed: {
        rules: [
          {
            id: 'outer-to-mid',
            when_all: [{ field: 'outer_gate', op: 'truthy' }],
            set_fill: { mid_slot: 'yes' },
          },
          {
            id: 'mid-to-bound',
            when_all: [{ field: 'mid_slot', op: 'eq', value: 'yes' }],
            set_fill: { bound_slot: 'clause text' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('fails a field referenced only in a computed predicate with no terminal binding', () => {
    // audit_gate is read by a rule that only writes set_audit — audit-only
    // assignments do not affect the document, so audit_gate is unbound.
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'audit_gate', type: 'boolean', default: 'false' }],
      replacements: { '[COMPANY]': '{company_name}' },
      computed: {
        rules: [
          {
            id: 'audit-only',
            when_all: [{ field: 'audit_gate', op: 'truthy' }],
            set_audit: { audit_note: 'observed' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unbound field "audit_gate"'))).toBe(true);
  });

  it('fails a field whose computed rule sets only an unbound target', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'gate_field', type: 'boolean', default: 'false' }],
      replacements: { '[COMPANY]': '{company_name}' },
      computed: {
        rules: [
          {
            id: 'gate-to-nowhere',
            when_all: [{ field: 'gate_field', op: 'truthy' }],
            set_fill: { orphan_slot: 'never written anywhere' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unbound field "gate_field"'))).toBe(true);
  });

  it('passes a field used only via ${field} interpolation into a terminal-bound set_fill target', () => {
    // The computed evaluator's interpolate() substitutes ${source_field} into
    // computed_slot's value, and computed_slot is bound via replacements.json —
    // so source_field genuinely affects the document.
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'source_field' }],
      replacements: { '[COMPANY]': '{company_name}', '[SLOT]': '{computed_slot}' },
      computed: {
        rules: [
          {
            id: 'interpolate',
            set_fill: { computed_slot: 'Value: ${source_field}' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('propagates ${field} interpolation reachability across a multi-hop chain', () => {
    // source_field → ${} into mid_slot → ${} into bound_slot → replacements.json
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'source_field' }],
      replacements: { '[COMPANY]': '{company_name}', '[SLOT]': '{bound_slot}' },
      computed: {
        rules: [
          {
            id: 'source-to-mid',
            set_fill: { mid_slot: 'Mid: ${source_field}' },
          },
          {
            id: 'mid-to-bound',
            set_fill: { bound_slot: 'Bound: ${mid_slot}' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('fails a field interpolated only into an unbound set_fill target', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'source_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
      computed: {
        rules: [
          {
            id: 'interpolate-to-nowhere',
            set_fill: { orphan_slot: 'Value: ${source_field}' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unbound field "source_field"'))).toBe(true);
  });

  it('fails a field interpolated only into a set_audit value', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'source_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
      computed: {
        rules: [
          {
            id: 'audit-interpolation',
            set_audit: { audit_note: 'Observed: ${source_field}' },
          },
        ],
      },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unbound field "source_field"'))).toBe(true);
  });

  it('passes a field bound only via a fields/<name>.json selector recipe', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'agreement_date', type: 'date' }],
      replacements: { '[COMPANY]': '{company_name}' },
      recipes: ['agreement_date'],
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('does not run the reachability rule on scaffolds (metadata-only)', () => {
    const dir = writeFixture({ fields: [{ name: 'anything' }] });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.scaffold).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Parse-failure suppression: a broken reachability input reports its own
// error and must NOT cascade into secondary "unbound field" errors.
// ---------------------------------------------------------------------------

describe('validateFieldSelector reachability parse-failure suppression', () => {
  function expectSuppressed(dir: string, parseErrorFragment: string): void {
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(parseErrorFragment))).toBe(true);
    expect(result.errors.some((e) => e.includes('unbound field'))).toBe(false);
  }

  it('suppresses unbound-field errors when computed.json is malformed', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
    });
    writeFileSync(join(dir, 'computed.json'), '{not valid json');
    expectSuppressed(dir, 'computed.json');
  });

  it('suppresses unbound-field errors when normalize.json is malformed', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
    });
    writeFileSync(join(dir, 'normalize.json'), JSON.stringify({ paragraph_rules: [{ id: 'x' }] }));
    expectSuppressed(dir, 'normalize.json');
  });

  it('suppresses unbound-field errors when selections.json is malformed', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
    });
    writeFileSync(join(dir, 'selections.json'), JSON.stringify({ groups: [] }));
    expectSuppressed(dir, 'selections.json');
  });

  it('suppresses unbound-field errors when replacements.json fails to parse', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
    });
    writeFileSync(join(dir, 'replacements.json'), '{invalid json');
    expectSuppressed(dir, 'replacements.json');
  });

  it('suppresses unbound-field errors when a selector contract is malformed', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'dead_field' }],
      replacements: { '[COMPANY]': '{company_name}' },
    });
    mkdirSync(join(dir, 'fields'), { recursive: true });
    writeFileSync(join(dir, 'fields', 'company_name.json'), '{broken');
    expectSuppressed(dir, 'selector contracts');
  });
});

// ---------------------------------------------------------------------------
// Migrated-key integrity (issue #621, stricter selector-template rule)
// ---------------------------------------------------------------------------

describe('validateFieldSelector migrated-key integrity', () => {
  it('fails when a migrated key does not exist in replacements.json', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }],
      replacements: { '[COMPANY]': '{company_name}' },
      recipes: ['company_name'],
      templateManifest: { migrated_keys: ['[GHOST KEY]'] },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('migrated key "[GHOST KEY]" not found in replacements.json')),
    ).toBe(true);
  });

  it('fails when a migrated key maps to a field with no selector recipe', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }, { name: 'orphan_field' }],
      replacements: { '[COMPANY]': '{company_name}', '[ORPHAN]': '{orphan_field}' },
      recipes: ['company_name'],
      templateManifest: { migrated_keys: ['[ORPHAN]'] },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.includes('migrated key "[ORPHAN]" maps to field "orphan_field"') && e.includes('no fields/orphan_field.json'),
      ),
    ).toBe(true);
  });

  it('passes when every migrated key exists and maps to recipe-backed fields', () => {
    const dir = writeFixture({
      fields: [{ name: 'company_name' }],
      replacements: { '[COMPANY]': '{company_name}' },
      recipes: ['company_name'],
      templateManifest: { migrated_keys: ['[COMPANY]'] },
    });
    const result = validateFieldSelector(dir, 'fixture');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Current repo state stays green (issue #621 suggested test 4)
// ---------------------------------------------------------------------------

describe('validateFieldSelector against committed field-selectors', () => {
  it('passes every committed field-selector template', () => {
    const familyDir = join(process.cwd(), 'templates', 'nvca-free-non-redistributable');
    expect(existsSync(familyDir)).toBe(true);
    const entries = readdirSync(familyDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    expect(entries.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const entry of entries) {
      const dir = join(familyDir, entry.name);
      if (!existsSync(join(dir, 'metadata.yaml'))) continue;
      const result = validateFieldSelector(dir, entry.name);
      for (const error of result.errors) {
        failures.push(`${entry.name}: ${error}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
