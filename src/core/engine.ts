import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMetadata, loadCleanConfig, type TemplateMetadata } from './metadata.js';
import { loadSelectionsConfig } from './selector.js';
import { runFillPipeline } from './unified-pipeline.js';
import { BLANK_PLACEHOLDER, verifyTemplateFill } from './fill-utils.js';


export interface FillOptions {
  templateDir: string;
  values: Record<string, unknown>;
  outputPath: string;
  postProcess?: (outputPath: string) => void | Promise<void>;
}

export interface FillResult {
  outputPath: string;
  metadata: TemplateMetadata;
  fieldsUsed: string[];
}

/** Derive signatory display fields for a given prefix. Reusable across templates. */
function deriveSignatoryFields(
  data: Record<string, unknown>,
  prefix: string,
  fieldNames: Set<string>,
  str: (key: string) => string,
  isBlankPlaceholder: (val: unknown) => boolean,
): void {
  const typeKey = `${prefix}_type`;
  if (!fieldNames.has(typeKey)) return;

  const typeVal = str(typeKey);
  const isEntity = typeVal !== 'individual';
  data[`${prefix}_is_entity`] = isEntity;

  // Derive display fields: show value for entities, empty string for individuals
  for (const suffix of ['title', 'company']) {
    const srcKey = `${prefix}_${suffix}`;
    const displayKey = `${prefix}_${suffix}_display`;
    if (isEntity) {
      const val = data[srcKey];
      data[displayKey] = (val && !isBlankPlaceholder(val)) ? String(val) : '';
    } else {
      data[displayKey] = '';
      // Warn if entity-only fields are set for an individual
      const val = data[srcKey];
      if (val && !isBlankPlaceholder(val) && String(val).trim() !== '') {
        console.warn(
          `Warning: ${srcKey} is set but ${prefix}_type is "individual" — value will be ignored`
        );
      }
    }
  }

  // Normalize signature fields: blank instead of BLANK_PLACEHOLDER underscores
  for (const suffix of ['name', 'email', 'title', 'company']) {
    const key = `${prefix}_${suffix}`;
    if (isBlankPlaceholder(data[key])) {
      data[key] = '';
    }
  }
}

/**
 * Compute display fields for radio/checkbox groups in table rows.
 * docx-templates only allows one {IF} per table row, so multi-option rows
 * use a single computed display tag that the engine populates from input fields.
 *
 * This is template-specific logic — only activates when metadata declares
 * the relevant display field names.
 */
function computeDisplayFields(data: Record<string, unknown>, fieldNames: Set<string>): void {
  const str = (key: string): string => String(data[key] ?? '');
  const bool = (key: string): boolean => data[key] === true;
  const isBlankPlaceholder = (value: unknown): boolean =>
    typeof value === 'string' && value.trim() === BLANK_PLACEHOLDER;
  /** True when a display field should be computed (not yet set or defaulted to blank). */
  const needsCompute = (key: string): boolean => {
    const val = data[key];
    return !val || isBlankPlaceholder(val);
  };
  const toGoogleDocUrl = (value: string): string => {
    const raw = value.trim();
    if (raw === '') return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^docs\.google\.com\/document\/d\//i.test(raw)) return `https://${raw}`;
    if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) return `https://docs.google.com/document/d/${raw}/`;
    return raw;
  };

  // ── Signatory type derivation ──
  // Auto-discover role-based prefixes: match *_signatory_type
  for (const key of fieldNames) {
    if (key.endsWith('_signatory_type')) {
      const prefix = key.slice(0, -5); // strip "_type" → e.g. "provider_signatory"
      if (fieldNames.has(`${prefix}_name`) && fieldNames.has(`${prefix}_title`)) {
        deriveSignatoryFields(data, prefix, fieldNames, str, isBlankPlaceholder);
      }
    }
  }
  // Legacy backward compat: party_1_type, party_2_type (mutual NDA)
  for (const n of [1, 2]) {
    const legacyKey = `party_${n}_type`;
    if (fieldNames.has(legacyKey) && fieldNames.has(`party_${n}_name`) && fieldNames.has(`party_${n}_title`)) {
      deriveSignatoryFields(data, `party_${n}`, fieldNames, str, isBlankPlaceholder);
    }
  }

  // Optional cover-table rows in employment templates should disappear when blank.
  // The default blank placeholder is intentionally visible in most contexts,
  // but for these optional rows we normalize blank placeholders to empty strings
  // so {IF field} conditions evaluate false and remove the row.
  if (isBlankPlaceholder(data['bonus_terms'])) {
    data['bonus_terms'] = '';
  }
  if (isBlankPlaceholder(data['equity_terms'])) {
    data['equity_terms'] = '';
  }
  if (isBlankPlaceholder(data['cloud_drive_id'])) {
    data['cloud_drive_id'] = '';
  }
  const cloudDriveId = typeof data['cloud_drive_id'] === 'string' ? data['cloud_drive_id'].trim() : '';
  if (fieldNames.has('cloud_drive_id_footer')) {
    const docUrl = cloudDriveId ? toGoogleDocUrl(cloudDriveId) : '';
    data['cloud_drive_id_footer'] = docUrl ? `Document URL: ${docUrl}` : '';
  }

  // Order Date: "Date of last signature" or custom date
  if (fieldNames.has('order_date_display') && needsCompute('order_date_display')) {
    data['order_date_display'] = bool('order_date_is_last_signature')
      ? '( x )\tDate of last signature on this Order Form'
      : `( x )\t${str('custom_order_date')}`;
  }

  // Pilot fee: paid or free trial
  if (fieldNames.has('pilot_fee_display') && needsCompute('pilot_fee_display')) {
    data['pilot_fee_display'] = bool('pilot_is_free')
      ? '( x )\tFree trial'
      : `( x )\tFee for Pilot Period: ${str('pilot_fee')}`;
  }

  // Cloud Service Fees: build from selected checkboxes
  if (fieldNames.has('fees_display') && needsCompute('fees_display')) {
    const lines: string[] = [];
    if (bool('fee_is_per_unit')) {
      lines.push(`[ x ] ${str('fees')} per ${str('fee_unit')}`);
    }
    if (bool('fee_is_other')) {
      lines.push(`[ x ] Other fee structure: ${str('other_fee_structure')}`);
    }
    if (bool('fee_may_increase')) {
      lines.push(`[ x ] Fees may increase up to ${str('fee_increase_cap_pct')}% per renewal`);
    }
    if (bool('fee_will_increase')) {
      lines.push(`[ x ] Fees will increase ${str('fee_increase_fixed_pct')}% per renewal`);
    }
    if (bool('fee_inclusive_of_taxes')) {
      lines.push('[ x ] Fees are inclusive of taxes (modifies Standard Terms Section 4.1)');
    }
    data['fees_display'] = lines.join('\n');
  }

  // Payment Process: invoice or automatic
  if (fieldNames.has('payment_display') && needsCompute('payment_display')) {
    if (bool('payment_by_invoice')) {
      const freq = str('payment_frequency');
      const days = str('payment_terms_days');
      const from = str('payment_due_from');
      data['payment_display'] =
        `( x )\tPay by invoice\n` +
        `Provider will invoice Customer ${freq}.\n` +
        `Customer will pay each invoice within ${days} days of ${from}.`;
    } else {
      const freq = str('payment_frequency');
      data['payment_display'] =
        `( x )\tAutomatic payment\n` +
        `Customer authorizes Provider to charge the payment method on file ${freq}.`;
    }
  }

  // Auto-renewal
  if (fieldNames.has('auto_renewal_display') && needsCompute('auto_renewal_display')) {
    if (bool('auto_renew')) {
      const days = str('non_renewal_notice_days');
      data['auto_renewal_display'] =
        `( x )\tNon-Renewal Notice Date is ${days} days before the end of the current Subscription Period.`;
    } else {
      data['auto_renewal_display'] = '( x )\tThis Order does not automatically renew.';
    }
  }

  // Effective Date
  if (fieldNames.has('effective_date_display') && needsCompute('effective_date_display')) {
    data['effective_date_display'] = bool('effective_date_is_last_signature')
      ? '( x )\tDate of last Cover Page signature'
      : `( x )\t${str('custom_effective_date')}`;
  }

  // Covered Claims
  if (fieldNames.has('covered_claims_display') && needsCompute('covered_claims_display')) {
    const lines: string[] = [];
    if (bool('has_provider_covered_claims')) {
      lines.push('[ x ] Provider Covered Claims: [Any action, proceeding, or claim that the Cloud Service, when used by Customer as permitted under the Agreement, infringes or misappropriates a third party\u2019s intellectual property rights.]');
    }
    if (bool('has_customer_covered_claims')) {
      lines.push('[ x ] Customer Covered Claims: [Any action, proceeding, or claim that (1) the Customer Content, when used according to the Agreement, infringes or misappropriates a third party\u2019s intellectual property rights; or (2) results from the Customer\u2019s breach of Section 2.4.]');
    }
    data['covered_claims_display'] = lines.join('\n');
  }

  // General Cap Amount
  if (fieldNames.has('general_cap_display') && needsCompute('general_cap_display')) {
    if (bool('general_cap_is_multiplier')) {
      data['general_cap_display'] = `( x )\t${str('general_cap_multiplier')}x the Fees paid or payable by Customer in the 12 month period immediately preceding the claim`;
    } else if (bool('general_cap_is_dollar')) {
      data['general_cap_display'] = `( x )\t$${str('general_cap_dollar')}`;
    } else if (bool('general_cap_is_greater_of')) {
      data['general_cap_display'] = `( x )\tThe greater of $${str('general_cap_greater_dollar')} or ${str('general_cap_greater_multiplier')}x the Fees paid or payable by Customer in the 12 month period immediately preceding the claim`;
    }
  }
}

export async function fillTemplate(options: FillOptions): Promise<FillResult> {
  const { templateDir, values, outputPath } = options;

  const metadata = loadMetadata(templateDir);
  const fieldNames = new Set(metadata.fields.map((f) => f.name));

  // Warn about unknown keys not in metadata
  const unknownKeys = Object.keys(values).filter((k) => !fieldNames.has(k));
  if (unknownKeys.length > 0) {
    console.warn(`Warning: unknown field(s) not in metadata: ${unknownKeys.join(', ')}`);
  }

  // Build cleanPatch if replacements.json or clean.json exists
  const templatePath = join(templateDir, 'template.docx');
  const replacementsPath = join(templateDir, 'replacements.json');
  const cleanJsonPath = join(templateDir, 'clean.json');
  const hasReplacements = existsSync(replacementsPath);
  const hasCleanJson = existsSync(cleanJsonPath);
  const cleanPatch = (hasReplacements || hasCleanJson)
    ? {
        cleanConfig: loadCleanConfig(templateDir),
        replacements: hasReplacements
          ? JSON.parse(readFileSync(replacementsPath, 'utf-8')) as Record<string, string>
          : {},
      }
    : undefined;

  // Load selectionsConfig if selections.json exists
  const selectionsPath = join(templateDir, 'selections.json');
  const selectionsConfig = existsSync(selectionsPath)
    ? loadSelectionsConfig(selectionsPath)
    : undefined;

  const result = await runFillPipeline({
    inputPath: templatePath,
    outputPath,
    values,
    fields: metadata.fields,
    priorityFieldNames: metadata.priority_fields,
    cleanPatch,
    selectionsConfig,
    coerceBooleans: true,
    computeDisplayFields: (d) => computeDisplayFields(d, fieldNames),
    fixSmartQuotes: true,
    verify: (p) => verifyTemplateFill(p),
    postProcess: options.postProcess,
  });

  return {
    outputPath: result.outputPath,
    metadata,
    fieldsUsed: result.fieldsUsed,
  };
}
