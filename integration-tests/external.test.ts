import { describe, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { ExternalMetadataSchema } from '../src/core/metadata.js';
import { validateExternal } from '../src/core/validation/external.js';
import {
  allureAttachment,
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const ROOT = new URL('..', import.meta.url).pathname;
const BIN = join(ROOT, 'bin/open-agreements.js');
const EXTERNAL_DIR = join(ROOT, 'content', 'external');
const itDiscovery = itAllure.epic('Discovery & Metadata');
const itFilling = itAllure.epic('Filling & Rendering');
const itCompliance = itAllure.epic('Compliance & Governance');

interface ListedTemplate {
  name: string;
  license?: string;
  source?: string;
}

describe('ExternalMetadataSchema', () => {
  itDiscovery('accepts valid external metadata', async () => {
    const input = {
      name: 'Test SAFE',
      source_url: 'https://example.com/safe',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Based on Example SAFE',
      source_sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      fields: [],
    };
    await allureParameter('schema', 'ExternalMetadataSchema');
    await allureJsonAttachment('external-metadata-input.json', input);
    const result = await allureStep('Validate metadata payload', () =>
      ExternalMetadataSchema.safeParse(input)
    );
    await allureJsonAttachment('external-metadata-parse-result.json', result);

    await allureStep('Assert schema accepts valid payload', () => {
      expect(result.success).toBe(true);
    });
  });

  itDiscovery.openspec('OA-TMP-013')('rejects missing source_sha256', async () => {
    const input = {
      name: 'Test SAFE',
      source_url: 'https://example.com/safe',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Based on Example SAFE',
      fields: [],
    };
    await allureParameter('schema', 'ExternalMetadataSchema');
    await allureJsonAttachment('external-metadata-input.json', input);
    const result = await allureStep('Validate metadata payload', () =>
      ExternalMetadataSchema.safeParse(input)
    );
    await allureJsonAttachment('external-metadata-parse-result.json', result);

    await allureStep('Assert schema rejects payload without source hash', () => {
      expect(result.success).toBe(false);
    });
  });

  itDiscovery('accepts CC-BY-ND-4.0 license', async () => {
    const input = {
      name: 'Test',
      source_url: 'https://example.com',
      version: '1.0',
      license: 'CC-BY-ND-4.0',
      allow_derivatives: false,
      attribution_text: 'Attribution',
      source_sha256: 'a'.repeat(64),
      fields: [],
    };
    await allureParameter('license', 'CC-BY-ND-4.0');
    const result = await allureStep('Validate external license value', () =>
      ExternalMetadataSchema.safeParse(input)
    );
    await allureJsonAttachment('external-license-parse-result.json', result);
    expect(result.success).toBe(true);
  });

  itDiscovery('rejects non-CC license', async () => {
    const input = {
      name: 'Test',
      source_url: 'https://example.com',
      version: '1.0',
      license: 'MIT',
      allow_derivatives: false,
      attribution_text: 'Attribution',
      source_sha256: 'a'.repeat(64),
      fields: [],
    };
    await allureParameter('license', 'MIT');
    const result = await allureStep('Validate external license value', () =>
      ExternalMetadataSchema.safeParse(input)
    );
    await allureJsonAttachment('external-license-parse-result.json', result);
    expect(result.success).toBe(false);
  });
});

describe('External template validation', () => {
  const externalIds = existsSync(EXTERNAL_DIR)
    ? readdirSync(EXTERNAL_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

  itCompliance.each(externalIds)('validates %s', async (id) => {
    await allureParameter('external_template_id', id);
    const dir = join(EXTERNAL_DIR, id);
    const result = await allureStep('Validate external template directory', () =>
      validateExternal(dir, id)
    );
    await allureJsonAttachment(`${id}-external-validation-result.json`, result);
    await allureStep('Assert external template validation passes', () => {
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('External fill end-to-end', () => {
  itFilling.openspec('OA-TMP-012')('fills yc-safe-valuation-cap with sample values', async () => {
    const output = '/tmp/test-ext-valuation-cap.docx';
    const command =
      `node ${BIN} fill yc-safe-valuation-cap` +
      ` --set company_name="Test Co"` +
      ` --set investor_name="Investor LLC"` +
      ` --set purchase_amount="50,000"` +
      ` --set valuation_cap="5,000,000"` +
      ` --set date_of_safe="January 1, 2026"` +
      ` --set state_of_incorporation="Delaware"` +
      ` --set governing_law_jurisdiction="California"` +
      ` --set company="Test Co"` +
      ` --set name="Alice"` +
      ` --set title="CEO"` +
      ` -o ${output}`;

    await allureParameter('template_id', 'yc-safe-valuation-cap');
    await allureAttachment('external-fill-command.txt', command);
    const result = await allureStep('Run CLI fill command', () =>
      execSync(command, { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 })
    );
    await allureAttachment('external-fill-stdout.txt', result);

    await allureStep('Assert fill command wrote output', () => {
      expect(result).toContain('Filled');
      expect(result).toContain(output);
      expect(existsSync(output)).toBe(true);
    });
  });

  itFilling('fills yc-safe-pro-rata-side-letter with sample values', async () => {
    const output = '/tmp/test-ext-pro-rata.docx';
    const command =
      `node ${BIN} fill yc-safe-pro-rata-side-letter` +
      ` --set company_name="Test Co"` +
      ` --set investor_name="Investor LLC"` +
      ` --set date_of_safe="January 1, 2026"` +
      ` --set company_name_caps="TEST CO"` +
      ` --set investor_name_caps="INVESTOR LLC"` +
      ` --set name="Alice"` +
      ` --set title="CEO"` +
      ` -o ${output}`;
    await allureParameter('template_id', 'yc-safe-pro-rata-side-letter');
    await allureAttachment('external-fill-command.txt', command);

    const result = await allureStep('Run CLI fill command', () =>
      execSync(command, { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 })
    );
    await allureAttachment('external-fill-stdout.txt', result);

    await allureStep('Assert fill command wrote output', () => {
      expect(result).toContain('Filled');
      expect(existsSync(output)).toBe(true);
    });
  });
});

describe('list includes external templates', () => {
  itDiscovery.openspec('OA-TMP-014')('list --json includes yc-safe templates', async () => {
    const output = await allureStep('Run list --json', () => execSync(`node ${BIN} list --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    }));
    await allureAttachment('list-json-output.txt', output);
    const parsed = JSON.parse(output) as { items: ListedTemplate[] };
    const names = parsed.items.map((item) => item.name);
    expect(names).toContain('yc-safe-valuation-cap');
    expect(names).toContain('yc-safe-discount');
    expect(names).toContain('yc-safe-mfn');
    expect(names).toContain('yc-safe-pro-rata-side-letter');
  });

  itDiscovery('external templates have CC-BY-ND-4.0 license', async () => {
    const output = await allureStep('Run list --json', () => execSync(`node ${BIN} list --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 10_000,
    }));
    const parsed = JSON.parse(output) as { items: ListedTemplate[] };
    const ycItems = parsed.items.filter((item) => item.name.startsWith('yc-safe-'));
    await allureJsonAttachment('yc-safe-list-items.json', ycItems);
    expect(ycItems.length).toBe(4);
    for (const item of ycItems) {
      expect(item.license).toBe('CC-BY-ND-4.0');
      expect(item.source).toBe('Y Combinator');
    }
  });
});
