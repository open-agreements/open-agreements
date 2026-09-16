import { describe, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { itAllure } from './helpers/allure-test.js';
import { probePublishedSchemas } from '../scripts/probe_published_schemas.mjs';

const it = itAllure.epic('Platform & Distribution');

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CANONICAL_SCHEMA_URL =
  'https://openagreements.org/schemas/skill-quality-card.schema.json';
const SCHEMA_PATH = resolve(
  REPO_ROOT,
  'schemas/skill-quality-card/skill-quality-card.schema.json',
);
const CARD_PATH = resolve(
  REPO_ROOT,
  'skills/legal-explainers/non-compete-contract-explainer/quality-card.json',
);
const PLUGIN_CARD_PATH = resolve(
  REPO_ROOT,
  'plugins/open-agreements/skills/non-compete-contract-explainer/quality-card.json',
);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, any>;
const card = JSON.parse(readFileSync(CARD_PATH, 'utf8')) as Record<string, unknown>;

function compile() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

/** A structurally valid card, so each negative case isolates one mutation. */
function mutate(patch: Record<string, unknown>) {
  return { ...card, ...patch };
}

describe('skill quality card schema', () => {
  it('declares the canonical public $id it is served under', () => {
    expect(schema.$id).toBe(CANONICAL_SCHEMA_URL);
    expect(schema.additionalProperties).toBe(false);
  });

  it('pins instance $schema to that same canonical URL', () => {
    // The card is published away from this repository — into the npm tarball
    // and the marketplace plugin — where a relative path resolves to nothing.
    expect(schema.properties.$schema.const).toBe(CANONICAL_SCHEMA_URL);
    expect(schema.required).toContain('$schema');
  });

  it('keeps the four split review dates required', () => {
    for (const field of [
      'content_packaged_at',
      'law_checked_through',
      'human_reviewed_at',
      'next_review_due',
    ]) {
      expect(schema.required).toContain(field);
      expect(schema.properties[field]).toBeDefined();
    }
  });

  it('keeps coverage and review statuses controlled', () => {
    expect(schema.properties.review.properties.claim.const).toBe('lawyer-reviewed');
    expect(schema.properties.review.required).toEqual(
      expect.arrayContaining(['claim', 'reviewer_registry', 'verification']),
    );
    expect(schema.properties.coverage.required).toEqual(
      expect.arrayContaining(['jurisdictions', 'manifest']),
    );
    expect(schema.properties.coverage.properties.jurisdictions.type).toBe('integer');
  });
});

describe('non-compete quality card', () => {
  it('validates against the published schema', () => {
    const validate = compile();
    expect(validate(card)).toBe(true);
  });

  it('references the schema by absolute canonical URL', () => {
    expect(card.$schema).toBe(CANONICAL_SCHEMA_URL);
  });

  it('rejects a relative $schema reference', () => {
    const validate = compile();
    expect(
      validate(
        mutate({
          $schema: '../../../schemas/skill-quality-card/skill-quality-card.schema.json',
        }),
      ),
    ).toBe(false);
  });

  it('rejects an unknown field', () => {
    const validate = compile();
    expect(validate(mutate({ snapshotAsOf: '2026-08-30' }))).toBe(false);
  });

  it('rejects a missing review date', () => {
    const validate = compile();
    const { law_checked_through: _dropped, ...withoutDate } = card;
    expect(validate(withoutDate)).toBe(false);
  });

  it('rejects a malformed date', () => {
    const validate = compile();
    expect(validate(mutate({ content_packaged_at: '2026-13-45' }))).toBe(false);
  });

  it('rejects an uncontrolled review claim', () => {
    const validate = compile();
    expect(
      validate(mutate({ review: { ...(card.review as object), claim: 'self-attested' } })),
    ).toBe(false);
  });
});

describe('quality card publication', () => {
  it('is projected into the Claude marketplace plugin byte-for-byte', () => {
    expect(readFileSync(PLUGIN_CARD_PATH)).toEqual(readFileSync(CARD_PATH));
  });
});

describe('published-schema probe', () => {
  /** Serve `body` at every URL the probe requests, and report its verdict. */
  async function probeAgainst(body: unknown): Promise<string | null> {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
    try {
      await probePublishedSchemas();
      return null;
    } catch (error) {
      return (error as Error).message;
    } finally {
      globalThis.fetch = original;
    }
  }

  it('accepts the schema this repository publishes', async () => {
    expect(await probeAgainst(schema)).toBeNull();
  });

  it('rejects a served schema whose pinned instance version is wrong', async () => {
    // The previous check compared `schema_version` at the document root, where
    // a JSON Schema never carries it, so this exact document passed.
    const wrong = structuredClone(schema);
    wrong.properties.schema_version.const = 'WRONG';
    expect(await probeAgainst(wrong)).toMatch(/properties\.schema_version/);
  });

  it('rejects a served schema that drops a required field', async () => {
    const wrong = structuredClone(schema);
    wrong.required = (wrong.required as string[]).filter((field) => field !== 'human_reviewed_at');
    expect(await probeAgainst(wrong)).toMatch(/differs from this repository/);
  });

  it('treats key order as equivalent', async () => {
    expect(await probeAgainst(Object.fromEntries(Object.entries(schema).reverse()))).toBeNull();
  });
});
