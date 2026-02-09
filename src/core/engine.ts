import { createReport } from 'docx-templates';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMetadata, type TemplateMetadata } from './metadata.js';

export interface FillOptions {
  templateDir: string;
  values: Record<string, string | boolean>;
  outputPath: string;
}

export interface FillResult {
  outputPath: string;
  metadata: TemplateMetadata;
  fieldsUsed: string[];
}

/**
 * Compute display fields for radio/checkbox groups in table rows.
 * docx-templates only allows one {IF} per table row, so multi-option rows
 * use a single computed display tag that the engine populates from input fields.
 */
function computeDisplayFields(data: Record<string, string | boolean>, metadata: TemplateMetadata): void {
  const fieldNames = new Set(metadata.fields.map((f) => f.name));
  const str = (key: string): string => String(data[key] ?? '');
  const bool = (key: string): boolean => data[key] === true;

  // Order Date: "Date of last signature" or custom date
  if (fieldNames.has('order_date_display') && !data['order_date_display']) {
    data['order_date_display'] = bool('order_date_is_last_signature')
      ? '( x )\tDate of last signature on this Order Form'
      : `( x )\t${str('custom_order_date')}`;
  }

  // Pilot fee: paid or free trial
  if (fieldNames.has('pilot_fee_display') && !data['pilot_fee_display']) {
    data['pilot_fee_display'] = bool('pilot_is_free')
      ? '( x )\tFree trial'
      : `( x )\tFee for Pilot Period: ${str('pilot_fee')}`;
  }

  // Cloud Service Fees: build from selected checkboxes
  if (fieldNames.has('fees_display') && !data['fees_display']) {
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
  if (fieldNames.has('payment_display') && !data['payment_display']) {
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
  if (fieldNames.has('auto_renewal_display') && !data['auto_renewal_display']) {
    if (bool('auto_renew')) {
      const days = str('non_renewal_notice_days');
      data['auto_renewal_display'] =
        `( x )\tNon-Renewal Notice Date is ${days} days before the end of the current Subscription Period.`;
    } else {
      data['auto_renewal_display'] = '( x )\tThis Order does not automatically renew.';
    }
  }

  // Effective Date
  if (fieldNames.has('effective_date_display') && !data['effective_date_display']) {
    data['effective_date_display'] = bool('effective_date_is_last_signature')
      ? '( x )\tDate of last Cover Page signature'
      : `( x )\t${str('custom_effective_date')}`;
  }

  // Covered Claims
  if (fieldNames.has('covered_claims_display') && !data['covered_claims_display']) {
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
  if (fieldNames.has('general_cap_display') && !data['general_cap_display']) {
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

  const missing = metadata.fields
    .filter((f) => f.required && !(f.name in values))
    .map((f) => f.name);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  // Fill in defaults for optional fields not provided by the user
  for (const field of metadata.fields) {
    if (!(field.name in values)) {
      values[field.name] = field.default ?? '';
    }
  }

  // Coerce boolean fields to actual JS booleans for IF conditions.
  // docx-templates evaluates {IF field} in a JS context where the string
  // "false" is truthy — only actual `false` is falsy.
  const data: Record<string, string | boolean> = { ...values };
  for (const field of metadata.fields) {
    if (field.type === 'boolean' && field.name in data) {
      const v = data[field.name];
      data[field.name] = v === true || v === 'true';
    }
  }

  // Compute display fields for templates that use radio/checkbox groups.
  // docx-templates only allows one IF per table row, so multi-option rows
  // use a single computed display tag instead of per-option conditionals.
  computeDisplayFields(data, metadata);

  const templatePath = join(templateDir, 'template.docx');
  const templateBuf = readFileSync(templatePath);

  // Warn about unknown keys not in metadata
  const metadataFieldNames = new Set(metadata.fields.map((f) => f.name));
  const unknownKeys = Object.keys(data).filter((k) => !metadataFieldNames.has(k));
  if (unknownKeys.length > 0) {
    console.warn(`Warning: unknown field(s) not in metadata: ${unknownKeys.join(', ')}`);
  }

  const output = await createReport({
    template: templateBuf,
    data,
    cmdDelimiter: ['{', '}'],
    fixSmartQuotes: true,
  });

  writeFileSync(outputPath, output);

  return {
    outputPath,
    metadata,
    fieldsUsed: Object.keys(data),
  };
}
