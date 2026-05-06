/**
 * Direct behavior tests for `api/_shared.ts`.
 *
 * Closes #200: the endpoint integration tests (`mcp-contract.test.ts`,
 * `api-endpoints.test.ts`) full-mock `_shared.ts`, leaving the real
 * service-layer logic uncovered. These tests import `_shared.ts` directly
 * with NO `vi.mock`, so they exercise the real internal/external/recipe
 * routing, metadata aggregation, and Zod validation paths.
 *
 * Pattern follows `api-download-tokens.test.ts` (top-level await import,
 * no mocking).
 */

import { afterAll, describe, expect } from 'vitest';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { itAllure, allureJsonAttachment } from './helpers/allure-test.js';

const {
  handleListTemplates,
  handleGetTemplate,
  handleFill,
  handleCreateChecklist,
  generateRedlineFromFill,
} = await import('../api/_shared.js');

// Cosmetic cleanup: handleFill writes /tmp/<template>-<uuid>.docx and never
// deletes. CI /tmp is ephemeral but local devs run repeatedly.
afterAll(() => {
  const tmp = tmpdir();
  for (const entry of readdirSync(tmp)) {
    if (
      /^bonterms-mutual-nda-[0-9a-f-]+\.docx$/.test(entry)
      || /^yc-safe-valuation-cap-[0-9a-f-]+\.docx$/.test(entry)
    ) {
      try { rmSync(join(tmp, entry)); } catch { /* ignore */ }
    }
  }
});

// Magic bytes for ZIP / DOCX. Used as a smoke-level invariant that handleFill
// returned a real DOCX (not the mock `Buffer.from('mock-docx-content')`).
function isDocxZip(base64: string): boolean {
  const head = Buffer.from(base64, 'base64').slice(0, 2).toString();
  return head === 'PK';
}

// ---------------------------------------------------------------------------
// Discovery & Metadata
// ---------------------------------------------------------------------------

const itDiscovery = itAllure.epic('Discovery & Metadata');

describe('_shared.ts — discovery (handleListTemplates / handleGetTemplate)', () => {
  itDiscovery.openspec('OA-CLI-012')(
    'handleListTemplates aggregates real internal+external+recipe items, sorted by name, with real cliVersion',
    async () => {
      const result = handleListTemplates();

      // cliVersion comes from real package.json — proves we are not mocked.
      // The mock returns '0.1.1'; real package.json is 0.7.x.
      expect(result.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.cliVersion).not.toBe('0.1.1');

      // Items must include at least one of each kind: internal, external, recipe.
      const ids = result.items.map((t) => t.name);
      expect(ids).toContain('bonterms-mutual-nda'); // internal
      expect(ids).toContain('yc-safe-valuation-cap'); // external
      // recipe presence confirms recipe branch ran
      expect(ids.some((id) => id.startsWith('nvca-'))).toBe(true);

      // Sorted by name (case-sensitive locale compare per impl).
      const sorted = [...ids].sort((a, b) => a.localeCompare(b));
      expect(ids).toEqual(sorted);

      await allureJsonAttachment('list-templates-summary.json', {
        cliVersion: result.cliVersion,
        itemCount: result.items.length,
        firstFiveIds: ids.slice(0, 5),
      });
    },
  );

  itDiscovery.openspec('OA-TMP-014')(
    'handleListTemplates surfaces external template yc-safe-valuation-cap with real CC-BY-ND-4.0 license',
    () => {
      const result = handleListTemplates();
      const yc = result.items.find((t) => t.name === 'yc-safe-valuation-cap');
      expect(yc).toBeDefined();
      // These values exist only in real metadata; mocks would not have them.
      expect(yc?.license).toBe('CC-BY-ND-4.0');
      expect(yc?.source).toBe('Y Combinator');
      expect(yc?.attribution_text).toMatch(/Y Combinator/);
    },
  );

  itDiscovery.openspec('OA-CLI-012')(
    'handleGetTemplate returns mapped TemplateItem for an internal template with real metadata',
    () => {
      const item = handleGetTemplate('bonterms-mutual-nda');
      expect(item).not.toBeNull();
      expect(item?.name).toBe('bonterms-mutual-nda');
      expect(item?.display_name).toBe('Bonterms Mutual NDA');
      expect(item?.license).toBe('CC0-1.0');
      expect(item?.attribution_text).toMatch(/Bonterms/);
      // For CC-BY-style attribution, source must be the publishing org
      // ('Bonterms'), not the bare hosting domain ('github.com').
      expect(item?.source).toBe('Bonterms');
      // priority_fields must be flagged required.
      const partyOne = item?.fields.find((f) => f.name === 'party_1_name');
      expect(partyOne?.required).toBe(true);
      // Non-priority fields must be optional.
      const sigName = item?.fields.find((f) => f.name === 'party_1_signatory_name');
      expect(sigName?.required).toBe(false);
    },
  );

  // (unbound) Behaviour — handleFill rejects unknown templates with a
  // structured failure envelope. There is no canonical OpenSpec scenario
  // describing this surface explicitly; a binding would be padding.
  itDiscovery('handleFill returns a structured failure for an unknown template', async () => {
    const result = await handleFill('this-template-does-not-exist-xyz', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/^Unknown template:/);
      expect(result.error).toContain('this-template-does-not-exist-xyz');
    }
  });

  // (unbound) Behaviour — handleCreateChecklist Zod failure path.
  itDiscovery('handleCreateChecklist returns a structured failure for an invalid payload', async () => {
    const result = await handleCreateChecklist({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.startsWith('Invalid closing checklist payload:')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Filling & Rendering
// ---------------------------------------------------------------------------

const itFill = itAllure.epic('Filling & Rendering');

describe('_shared.ts — filling (handleFill / generateRedlineFromFill)', () => {
  itFill.openspec('OA-TMP-005')(
    'handleFill produces a real DOCX for an internal template (bonterms-mutual-nda)',
    async () => {
      const values = {
        party_1_name: 'Acme Corp',
        party_2_name: 'Globex Inc',
        effective_date: '2026-04-24',
      };
      const result = await handleFill('bonterms-mutual-nda', values);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(isDocxZip(result.base64)).toBe(true);
        expect(result.metadata.template).toBe('bonterms-mutual-nda');
        // Real metadata invariants — mocks return 'CC-BY-4.0' here.
        expect(result.metadata.license).toBe('CC0-1.0');
        // missingFields is high-cardinality and depends on optional fields;
        // assert only the high-signal facts (provided keys not missing,
        // intentionally-omitted required key IS missing).
        for (const provided of Object.keys(values)) {
          expect(result.metadata.missingFields).not.toContain(provided);
        }
        // We did not provide `purpose`, so it must appear in missingFields.
        expect(result.metadata.missingFields).toContain('purpose');

        await allureJsonAttachment('handle-fill-bonterms-summary.json', {
          template: result.metadata.template,
          license: result.metadata.license,
          filledFieldCount: result.metadata.filledFieldCount,
          totalFieldCount: result.metadata.totalFieldCount,
          missingFieldsSample: result.metadata.missingFields.slice(0, 5),
        });
      }
    },
  );

  itFill.openspec('OA-TMP-012')(
    'handleFill produces a DOCX for an external template (yc-safe-valuation-cap) and routes through the external branch',
    async () => {
      const values = {
        company_name: 'Acme Inc.',
        investor_name: 'Globex Ventures LLC',
        purchase_amount: '100,000',
        valuation_cap: '10,000,000',
        date_of_safe: '2026-04-24',
        state_of_incorporation: 'Delaware',
        governing_law_jurisdiction: 'Delaware',
        company: 'Acme Inc.',
        name: 'Jane Doe',
        title: 'CEO',
      };
      const result = await handleFill('yc-safe-valuation-cap', values);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(isDocxZip(result.base64)).toBe(true);
        expect(result.metadata.template).toBe('yc-safe-valuation-cap');
        // CC-BY-ND-4.0 is the literal scenario invariant from OA-TMP-012;
        // proves the external routing branch executed.
        expect(result.metadata.license).toBe('CC-BY-ND-4.0');
        expect(result.metadata.attribution).toMatch(/Y Combinator/);
      }
    },
  );

  // (unbound) Behaviour — generateRedlineFromFill returns null for non-recipe
  // templates. The recipe-truthy branch is heavy (re-runs runRecipe with
  // keepIntermediate, then compareDocuments) and remains an intentional
  // remaining gap after this PR.
  itFill('generateRedlineFromFill returns null for a non-recipe template', async () => {
    // Need *some* base64 to pass through; impl bails out before decoding it.
    const result = await generateRedlineFromFill(
      'bonterms-mutual-nda',
      Buffer.from('unused').toString('base64'),
      'source',
      {},
    );
    expect(result).toBeNull();
  });
});
