import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface EngineHarnessOptions {
  metadataFields: string[];
}

interface EngineHarness {
  fillTemplate: (args: {
    templateDir: string;
    values: Record<string, unknown>;
    outputPath: string;
  }) => Promise<{
    outputPath: string;
    metadata: { name: string; fields: Array<{ name: string }>; required_fields: string[] };
    fieldsUsed: string[];
  }>;
  BLANK_PLACEHOLDER: string;
  spies: {
    loadMetadata: ReturnType<typeof vi.fn>;
    loadCleanConfig: ReturnType<typeof vi.fn>;
    loadSelectionsConfig: ReturnType<typeof vi.fn>;
    runFillPipeline: ReturnType<typeof vi.fn>;
    verifyTemplateFill: ReturnType<typeof vi.fn>;
  };
}

const it = itAllure.epic('Filling & Rendering');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.unmock('../src/core/metadata.js');
  vi.unmock('../src/core/selector.js');
  vi.unmock('../src/core/unified-pipeline.js');
  vi.unmock('../src/core/fill-utils.js');
  vi.restoreAllMocks();
  vi.resetModules();
});

function createTemplateFixture(opts: { withReplacements: boolean; withSelections: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), 'oa-engine-fill-'));
  tempDirs.push(dir);

  writeFileSync(join(dir, 'template.docx'), Buffer.from('fake-docx-bytes'));

  if (opts.withReplacements) {
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify({ '[Company Name]': '{company_name}' }, null, 2));
  }

  if (opts.withSelections) {
    writeFileSync(join(dir, 'selections.json'), JSON.stringify({ groups: [] }, null, 2));
  }

  return dir;
}

async function loadEngineHarness(opts: EngineHarnessOptions): Promise<EngineHarness> {
  vi.resetModules();

  const BLANK_PLACEHOLDER = '__BLANK__';

  const loadMetadata = vi.fn(() => ({
    name: 'Fixture Template',
    fields: opts.metadataFields.map((name) => ({
      name,
      type: 'string',
      description: name,
    })),
    required_fields: [] as string[],
  }));

  const loadCleanConfig = vi.fn(() => ({ mode: 'fixture' }));
  const loadSelectionsConfig = vi.fn(() => ({ groups: [] }));
  const verifyTemplateFill = vi.fn(() => ({ passed: true, checks: [] }));

  const runFillPipeline = vi.fn(async (args: {
    outputPath: string;
    values: Record<string, unknown>;
    computeDisplayFields: (values: Record<string, unknown>) => void;
    verify: (path: string) => unknown;
  }) => {
    args.computeDisplayFields(args.values);
    args.verify(args.outputPath);
    return {
      outputPath: args.outputPath,
      fieldsUsed: Object.keys(args.values),
    };
  });

  vi.doMock('../src/core/metadata.js', () => ({
    loadMetadata,
    loadCleanConfig,
  }));

  vi.doMock('../src/core/selector.js', () => ({
    loadSelectionsConfig,
  }));

  vi.doMock('../src/core/unified-pipeline.js', () => ({
    runFillPipeline,
  }));

  vi.doMock('../src/core/fill-utils.js', () => ({
    BLANK_PLACEHOLDER,
    verifyTemplateFill,
  }));

  const module = await import('../src/core/engine.js');

  return {
    fillTemplate: module.fillTemplate,
    BLANK_PLACEHOLDER,
    spies: {
      loadMetadata,
      loadCleanConfig,
      loadSelectionsConfig,
      runFillPipeline,
      verifyTemplateFill,
    },
  };
}

describe('fillTemplate display field coverage', () => {
  it('computes invoice/free-trial display fields, normalizes blank placeholders, and forwards clean/selections config', async () => {
    const harness = await loadEngineHarness({
      metadataFields: [
        'order_date_display',
        'pilot_fee_display',
        'fees_display',
        'payment_display',
        'auto_renewal_display',
        'effective_date_display',
        'covered_claims_display',
        'general_cap_display',
        'cloud_drive_id_footer',
      ],
    });

    const templateDir = createTemplateFixture({ withReplacements: true, withSelections: true });

    const values: Record<string, unknown> = {
      bonus_terms: harness.BLANK_PLACEHOLDER,
      equity_terms: harness.BLANK_PLACEHOLDER,
      cloud_drive_id: harness.BLANK_PLACEHOLDER,
      order_date_is_last_signature: true,
      pilot_is_free: true,
      fee_is_per_unit: true,
      fees: '$10',
      fee_unit: 'seat/month',
      fee_is_other: true,
      other_fee_structure: 'Custom fee',
      fee_may_increase: true,
      fee_increase_cap_pct: '5',
      fee_will_increase: true,
      fee_increase_fixed_pct: '3',
      fee_inclusive_of_taxes: true,
      payment_by_invoice: true,
      payment_frequency: 'monthly',
      payment_terms_days: '30',
      payment_due_from: 'invoice date',
      auto_renew: true,
      non_renewal_notice_days: '60',
      effective_date_is_last_signature: true,
      has_provider_covered_claims: true,
      has_customer_covered_claims: true,
      general_cap_is_multiplier: true,
      general_cap_multiplier: '2',
      unknown_input_field: 'ignored value',
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await allureStep('Run fillTemplate for invoice/free-trial display branch coverage', async () =>
      harness.fillTemplate({
        templateDir,
        values,
        outputPath: '/tmp/engine-fill-output-1.docx',
      })
    );

    await allureJsonAttachment('engine-fill-display-invoice.json', {
      result,
      values,
      pipelineCall: harness.spies.runFillPipeline.mock.calls[0]?.[0],
      warnings: warnSpy.mock.calls.map((call) => String(call[0])),
    });

    const pipelineCall = harness.spies.runFillPipeline.mock.calls[0]?.[0] as {
      cleanPatch?: unknown;
      selectionsConfig?: unknown;
    };

    expect(harness.spies.loadCleanConfig).toHaveBeenCalledWith(templateDir);
    expect(harness.spies.loadSelectionsConfig).toHaveBeenCalledTimes(1);
    expect(pipelineCall.cleanPatch).toBeTruthy();
    expect(pipelineCall.selectionsConfig).toBeTruthy();
    expect(values.bonus_terms).toBe('');
    expect(values.equity_terms).toBe('');
    expect(values.cloud_drive_id).toBe('');
    expect(values.cloud_drive_id_footer).toBe('');
    expect(values.order_date_display).toBe('( x )\tDate of last signature on this Order Form');
    expect(values.pilot_fee_display).toBe('( x )\tFree trial');
    expect(String(values.fees_display)).toContain('[ x ] $10 per seat/month');
    expect(String(values.fees_display)).toContain('Other fee structure: Custom fee');
    expect(String(values.payment_display)).toContain('Pay by invoice');
    expect(values.auto_renewal_display).toBe(
      '( x )\tNon-Renewal Notice Date is 60 days before the end of the current Subscription Period.'
    );
    expect(values.effective_date_display).toBe('( x )\tDate of last Cover Page signature');
    expect(String(values.covered_claims_display)).toContain('Provider Covered Claims');
    expect(String(values.covered_claims_display)).toContain('Customer Covered Claims');
    expect(values.general_cap_display).toBe(
      '( x )\t2x the Fees paid or payable by Customer in the 12 month period immediately preceding the claim'
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown_input_field'));
    expect(harness.spies.verifyTemplateFill).toHaveBeenCalledWith('/tmp/engine-fill-output-1.docx');
  });

  it('computes automatic-payment, custom date, dollar cap, and cloud drive URL variants', async () => {
    const harness = await loadEngineHarness({
      metadataFields: [
        'order_date_display',
        'pilot_fee_display',
        'payment_display',
        'auto_renewal_display',
        'effective_date_display',
        'general_cap_display',
        'cloud_drive_id_footer',
        'covered_claims_display',
      ],
    });

    const templateDir = createTemplateFixture({ withReplacements: false, withSelections: false });

    const values: Record<string, unknown> = {
      cloud_drive_id: 'docs.google.com/document/d/abc12345678901234567',
      order_date_is_last_signature: false,
      custom_order_date: 'March 1, 2026',
      pilot_is_free: false,
      pilot_fee: '$1000',
      payment_by_invoice: false,
      payment_frequency: 'quarterly',
      auto_renew: false,
      effective_date_is_last_signature: false,
      custom_effective_date: 'March 5, 2026',
      has_provider_covered_claims: false,
      has_customer_covered_claims: true,
      general_cap_is_dollar: true,
      general_cap_dollar: '50000',
    };

    const result = await harness.fillTemplate({
      templateDir,
      values,
      outputPath: '/tmp/engine-fill-output-2.docx',
    });

    await allureJsonAttachment('engine-fill-display-automatic.json', {
      result,
      values,
      pipelineCall: harness.spies.runFillPipeline.mock.calls[0]?.[0],
    });

    const pipelineCall = harness.spies.runFillPipeline.mock.calls[0]?.[0] as {
      cleanPatch?: unknown;
      selectionsConfig?: unknown;
    };

    expect(pipelineCall.cleanPatch).toBeUndefined();
    expect(pipelineCall.selectionsConfig).toBeUndefined();
    expect(values.cloud_drive_id_footer).toBe('Document URL: https://docs.google.com/document/d/abc12345678901234567');
    expect(values.order_date_display).toBe('( x )\tMarch 1, 2026');
    expect(values.pilot_fee_display).toBe('( x )\tFee for Pilot Period: $1000');
    expect(String(values.payment_display)).toContain('Automatic payment');
    expect(values.auto_renewal_display).toBe('( x )\tThis Order does not automatically renew.');
    expect(values.effective_date_display).toBe('( x )\tMarch 5, 2026');
    expect(values.covered_claims_display).toContain('Customer Covered Claims');
    expect(values.general_cap_display).toBe('( x )\t$50000');
  });

  it('supports google-doc-id expansion and preserves precomputed display fields', async () => {
    const harness = await loadEngineHarness({
      metadataFields: [
        'general_cap_display',
        'payment_display',
        'cloud_drive_id_footer',
      ],
    });

    const templateDir = createTemplateFixture({ withReplacements: false, withSelections: false });

    const values: Record<string, unknown> = {
      cloud_drive_id: 'abcdefghijklmnopqrstuvwxyz123456',
      payment_display: 'PRESET PAYMENT DISPLAY',
      payment_by_invoice: false,
      payment_frequency: 'monthly',
      general_cap_display: 'PRESET CAP DISPLAY',
      general_cap_is_greater_of: true,
      general_cap_greater_dollar: '25000',
      general_cap_greater_multiplier: '3',
    };

    await harness.fillTemplate({
      templateDir,
      values,
      outputPath: '/tmp/engine-fill-output-3.docx',
    });

    await allureJsonAttachment('engine-fill-display-precomputed.json', {
      values,
      pipelineCall: harness.spies.runFillPipeline.mock.calls[0]?.[0],
    });

    expect(values.cloud_drive_id_footer).toBe('Document URL: https://docs.google.com/document/d/abcdefghijklmnopqrstuvwxyz123456/');
    expect(values.payment_display).toBe('PRESET PAYMENT DISPLAY');
    expect(values.general_cap_display).toBe('PRESET CAP DISPLAY');
  });
});
