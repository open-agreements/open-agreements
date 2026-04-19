import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import yaml from 'js-yaml';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { loadMetadata } from './metadata.js';

const it = itAllure.epic('Discovery & Metadata');

type MetadataDict = {
  name: string;
  source_url: string;
  version: string;
  license: string;
  allow_derivatives: boolean;
  attribution_text: string;
  fields: Array<Record<string, unknown>>;
};

function writeTemplateDir(
  metadata: MetadataDict,
  sidecar?: { fields: Array<Record<string, unknown>> },
): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-sidecar-merge-'));
  writeFileSync(join(dir, 'metadata.yaml'), yaml.dump(metadata), 'utf-8');
  if (sidecar) {
    writeFileSync(
      join(dir, 'metadata.legal-context.yaml'),
      yaml.dump(sidecar),
      'utf-8',
    );
  }
  return dir;
}

const BASE_METADATA: MetadataDict = {
  name: 'Test Template',
  source_url: 'https://example.com/test',
  version: '1.0',
  license: 'CC-BY-4.0',
  allow_derivatives: true,
  attribution_text: 'Test attribution',
  fields: [
    {
      name: 'duration',
      type: 'string',
      description: 'How long',
    },
    {
      name: 'count',
      type: 'number',
      description: 'How many',
    },
  ],
};

describe('legal-context sidecar merge', () => {
  it.openspec('OA-TMP-020')(
    'merges sidecar default and rationale into the base field',
    () => {
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          {
            name: 'duration',
            default: '12 months',
            default_value_rationale: 'Conservative bound',
          },
        ],
      });
      try {
        const merged = loadMetadata(dir);
        const field = merged.fields.find((f) => f.name === 'duration');
        expect(field?.default).toBe('12 months');
        expect(field?.default_value_rationale).toBe('Conservative bound');
        // Other keys from metadata.yaml must pass through
        expect(field?.type).toBe('string');
        expect(field?.description).toBe('How long');
        // Un-managed field must be untouched
        const untouched = merged.fields.find((f) => f.name === 'count');
        expect(untouched?.default).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'rejects sidecar-only field names that do not appear in metadata.yaml',
    () => {
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          {
            name: 'renamed_field',  // not in metadata.yaml
            default: '12 months',
            default_value_rationale: 'some rationale',
          },
        ],
      });
      try {
        expect(() => loadMetadata(dir)).toThrow(/references unknown field\(s\): renamed_field/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'rejects single-ownership violation when metadata.yaml also sets an owned key',
    () => {
      const metadataWithDefault: MetadataDict = {
        ...BASE_METADATA,
        fields: [
          {
            name: 'duration',
            type: 'string',
            description: 'How long',
            default: '6 months',  // sidecar will also set this → violation
          },
          { name: 'count', type: 'number', description: 'How many' },
        ],
      };
      const dir = writeTemplateDir(metadataWithDefault, {
        fields: [
          {
            name: 'duration',
            default: '12 months',
            default_value_rationale: 'Conservative bound',
          },
        ],
      });
      try {
        expect(() => loadMetadata(dir)).toThrow(
          /Single-ownership violation.*duration\.default/,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'rejects duplicate sidecar entries for the same field',
    () => {
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          { name: 'duration', default: '12 months', default_value_rationale: 'a' },
          { name: 'duration', default: '18 months', default_value_rationale: 'b' },
        ],
      });
      try {
        expect(() => loadMetadata(dir)).toThrow(/Duplicate sidecar entry/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'rejects disallowed owned keys in the sidecar',
    () => {
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          {
            name: 'duration',
            default: '12 months',
            description: 'hand-edit sneaking in',  // not an owned key
          },
        ],
      });
      try {
        expect(() => loadMetadata(dir)).toThrow();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-004')(
    're-validates merged metadata: sidecar-injected value must match field type',
    () => {
      // metadata.yaml declares count as number. Sidecar tries to set a non-numeric default.
      // Without post-merge re-validation, this slips through.
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          {
            name: 'count',
            default: 'not a number',
            default_value_rationale: 'sidecar lies about the type',
          },
        ],
      });
      try {
        expect(() => loadMetadata(dir)).toThrow(/Default value must be valid for the declared field type/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'does nothing when no sidecar is present',
    () => {
      const dir = writeTemplateDir(BASE_METADATA);
      try {
        const merged = loadMetadata(dir);
        const field = merged.fields.find((f) => f.name === 'duration');
        expect(field?.default).toBeUndefined();
        expect(field?.default_value_rationale).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.openspec('OA-TMP-020')(
    'passes through fields only in metadata.yaml unchanged',
    () => {
      const dir = writeTemplateDir(BASE_METADATA, {
        fields: [
          // Only manages duration; count is untouched
          { name: 'duration', default: '12 months', default_value_rationale: 'Conservative' },
        ],
      });
      try {
        const merged = loadMetadata(dir);
        const count = merged.fields.find((f) => f.name === 'count');
        expect(count?.name).toBe('count');
        expect(count?.type).toBe('number');
        expect(count?.default).toBeUndefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
