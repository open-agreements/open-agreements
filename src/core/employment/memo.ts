import { type TemplateMetadata, loadMetadata } from '../metadata.js';
import { findTemplateDir } from '../../utils/paths.js';
import {
  EMPLOYMENT_JURISDICTION_RULES,
  type JurisdictionRule,
  type RuleConfidence,
} from './jurisdiction-rules.js';

export type FindingCategory = 'clause_presence' | 'baseline_variance' | 'jurisdiction_warning';
export type FindingSeverity = 'low' | 'medium' | 'high';
export type FindingConfidence = RuleConfidence;
export type MemoFormat = 'json' | 'markdown' | 'both';

export interface MemoEvidence {
  type: 'field' | 'rule' | 'template';
  reference: string;
  value?: string;
}

export interface MemoCitation {
  source: string;
  source_date: string;
}

export interface EmploymentMemoFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  summary: string;
  evidence: MemoEvidence[];
  citations: MemoCitation[];
  follow_up_questions: string[];
}

export interface EmploymentMemoCounselEscalation {
  escalation_recommended: boolean;
  reason: string;
  high_risk_finding_ids: string[];
  guidance: string;
  follow_up_questions: string[];
}

export interface EmploymentMemo {
  memo_version: string;
  generated_at: string;
  template_id: string;
  baseline_template_id?: string;
  jurisdiction: string;
  disclaimer: string;
  findings: EmploymentMemoFinding[];
  counsel_escalation: EmploymentMemoCounselEscalation;
}

export interface GenerateEmploymentMemoOptions {
  templateId: string;
  templateMetadata: TemplateMetadata;
  values: Record<string, string | boolean>;
  generatedAt?: string;
  jurisdiction?: string;
  baselineTemplateId?: string;
}

interface ClauseSignal {
  id: string;
  field: string;
  missingSeverity: FindingSeverity;
  presentSeverity?: FindingSeverity;
  missingSummary: string;
  presentSummary: string;
  followUpQuestionWhenMissing?: string;
  isPresent?: (value: string) => boolean;
}

const EMPLOYMENT_TEMPLATE_IDS = new Set<string>([
  'openagreements-employment-offer-letter',
  'openagreements-employee-ip-inventions-assignment',
  'openagreements-employment-confidentiality-acknowledgement',
]);

const TEMPLATE_SOURCE_DATES: Record<string, string> = {
  'openagreements-employment-offer-letter': '2026-02-10',
  'openagreements-employee-ip-inventions-assignment': '2026-02-10',
  'openagreements-employment-confidentiality-acknowledgement': '2026-02-10',
};

const MEMO_VERSION = '1.0.0';

export const EMPLOYMENT_MEMO_DISCLAIMER =
  'This employment memo provides operational information about template fields and cited sources. It is not legal advice, does not recommend legal strategy, and does not predict legal outcomes. Consult a licensed attorney for legal advice.';

const ADVICE_REWRITE_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bwe recommend\b/gi, replacement: 'this memo flags' },
  { pattern: /\byou should\b/gi, replacement: 'consider' },
  { pattern: /\byou must\b/gi, replacement: 'consider whether it is necessary to' },
  { pattern: /\bbest strategy\b/gi, replacement: 'possible operational approach' },
  { pattern: /\bour advice\b/gi, replacement: 'this informational output' },
  { pattern: /\bi advise\b/gi, replacement: 'this output notes' },
  { pattern: /\bthe right strategy\b/gi, replacement: 'one operational option' },
];

const ADVICE_BLOCK_PATTERNS: RegExp[] = [
  /\bwe recommend\b/i,
  /\byou should\b/i,
  /\byou must\b/i,
  /\bbest strategy\b/i,
  /\bour advice\b/i,
  /\bi advise\b/i,
  /\bthe right strategy\b/i,
];

const CLAUSE_SIGNALS: Record<string, ClauseSignal[]> = {
  'openagreements-employment-offer-letter': [
    {
      id: 'base-salary',
      field: 'base_salary',
      missingSeverity: 'high',
      missingSummary: 'Compensation clause signal is missing because base_salary is blank.',
      presentSummary: 'Compensation clause signal is present based on the base_salary value.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether compensation terms are complete enough for this offer letter?',
    },
    {
      id: 'bonus-terms',
      field: 'bonus_terms',
      missingSeverity: 'medium',
      missingSummary: 'Bonus clause signal is missing because bonus_terms is blank.',
      presentSummary: 'Bonus clause signal is present based on the bonus_terms value.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether bonus language needs additional conditions for this role?',
    },
    {
      id: 'equity-terms',
      field: 'equity_terms',
      missingSeverity: 'medium',
      missingSummary: 'Equity clause signal is missing because equity_terms is blank.',
      presentSummary: 'Equity clause signal is present based on the equity_terms value.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether equity terms should be addressed in this offer letter?',
    },
    {
      id: 'offer-expiration',
      field: 'offer_expiration_date',
      missingSeverity: 'medium',
      missingSummary: 'Offer expiration signal is missing because offer_expiration_date is blank.',
      presentSummary:
        'Offer expiration signal is present based on the offer_expiration_date value.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether an offer acceptance deadline should be added?',
    },
  ],
  'openagreements-employee-ip-inventions-assignment': [
    {
      id: 'prior-inventions-disclosure',
      field: 'prior_inventions_disclosure',
      missingSeverity: 'high',
      missingSummary:
        'Prior inventions disclosure appears unspecified based on prior_inventions_disclosure.',
      presentSummary:
        'Prior inventions disclosure appears present based on prior_inventions_disclosure.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether prior inventions should be listed before signature?',
      isPresent: (value) => {
        const normalized = normalizeForCompare(value);
        return (
          normalized.length > 0
          && normalized !== 'none'
          && normalized !== 'none listed'
          && normalized !== 'n/a'
        );
      },
    },
    {
      id: 'excluded-inventions-statement',
      field: 'excluded_inventions_statement',
      missingSeverity: 'high',
      missingSummary:
        'Excluded inventions carveout signal is missing because excluded_inventions_statement is blank.',
      presentSummary:
        'Excluded inventions carveout signal is present based on excluded_inventions_statement.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether a statutory carveout statement is required for this jurisdiction?',
    },
    {
      id: 'confidential-information-definition',
      field: 'confidential_information_definition',
      missingSeverity: 'high',
      missingSummary:
        'Confidential information definition signal is missing because confidential_information_definition is blank.',
      presentSummary:
        'Confidential information definition signal is present based on confidential_information_definition.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether confidential information scope is defined clearly enough?',
    },
    {
      id: 'return-of-materials',
      field: 'return_of_materials_timing',
      missingSeverity: 'medium',
      missingSummary:
        'Return-of-materials signal is missing because return_of_materials_timing is blank.',
      presentSummary:
        'Return-of-materials signal is present based on return_of_materials_timing.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether return and deletion timing should be explicit?',
    },
  ],
  'openagreements-employment-confidentiality-acknowledgement': [
    {
      id: 'approved-tools-scope',
      field: 'approved_tools_scope',
      missingSeverity: 'medium',
      missingSummary:
        'Approved tools scope signal is missing because approved_tools_scope is blank.',
      presentSummary:
        'Approved tools scope signal is present based on approved_tools_scope.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether approved tools and systems need clearer scope?',
    },
    {
      id: 'data-access-scope',
      field: 'data_access_scope',
      missingSeverity: 'medium',
      missingSummary:
        'Data access scope signal is missing because data_access_scope is blank.',
      presentSummary: 'Data access scope signal is present based on data_access_scope.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether access scope language needs additional limits?',
    },
    {
      id: 'security-reporting-contact',
      field: 'security_reporting_contact',
      missingSeverity: 'high',
      missingSummary:
        'Security reporting contact signal is missing because security_reporting_contact is blank.',
      presentSummary:
        'Security reporting contact signal is present based on security_reporting_contact.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether reporting paths and notification timing should be expanded?',
    },
    {
      id: 'post-employment-obligations',
      field: 'post_employment_obligations',
      missingSeverity: 'medium',
      missingSummary:
        'Post-employment obligations signal is missing because post_employment_obligations is blank.',
      presentSummary:
        'Post-employment obligations signal is present based on post_employment_obligations.',
      followUpQuestionWhenMissing:
        'Can licensed counsel confirm whether post-employment confidentiality language is complete?',
    },
  ],
};

export function isEmploymentTemplateId(templateId: string): boolean {
  return EMPLOYMENT_TEMPLATE_IDS.has(templateId);
}

export function applyAdviceLanguageGuard(input: string): string {
  let output = input;
  for (const rule of ADVICE_REWRITE_RULES) {
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output.trim();
}

export function hasProhibitedAdviceLanguage(input: string): boolean {
  return ADVICE_BLOCK_PATTERNS.some((pattern) => pattern.test(input));
}

export function generateEmploymentMemo(options: GenerateEmploymentMemoOptions): EmploymentMemo {
  if (!isEmploymentTemplateId(options.templateId)) {
    throw new Error(
      `Template "${options.templateId}" is not in the employment pack and cannot produce an employment memo.`
    );
  }

  const fieldValues = resolveEffectiveFieldValues(options.templateMetadata, options.values);
  const jurisdiction =
    normalizeJurisdiction(
      options.jurisdiction
      ?? fieldValues.governing_law
      ?? fieldValues.venue
      ?? 'Unspecified'
    ) || 'Unspecified';

  const findings: EmploymentMemoFinding[] = [];
  findings.push(
    ...buildClauseFindings({
      templateId: options.templateId,
      templateMetadata: options.templateMetadata,
      fieldValues,
    })
  );

  let baselineMetadata: TemplateMetadata | undefined;
  if (options.baselineTemplateId) {
    baselineMetadata = loadBaselineMetadata(options.baselineTemplateId);
    findings.push(
      ...buildBaselineVarianceFindings({
        templateId: options.templateId,
        baselineTemplateId: options.baselineTemplateId,
        templateMetadata: options.templateMetadata,
        baselineMetadata,
        fieldValues,
      })
    );
  }

  findings.push(...buildJurisdictionWarningFindings(options.templateId, jurisdiction, fieldValues));

  const sanitizedFindings = findings
    .map((finding) => sanitizeFinding(finding))
    .filter((finding) => finding.evidence.length > 0);

  const counselEscalation = buildCounselEscalation(sanitizedFindings);

  const memo: EmploymentMemo = {
    memo_version: MEMO_VERSION,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    template_id: options.templateId,
    baseline_template_id: options.baselineTemplateId,
    jurisdiction,
    disclaimer: EMPLOYMENT_MEMO_DISCLAIMER,
    findings: sanitizedFindings,
    counsel_escalation: counselEscalation,
  };

  assertMemoHasNoProhibitedAdviceLanguage(memo);
  return memo;
}

export function renderEmploymentMemoMarkdown(memo: EmploymentMemo): string {
  const lines: string[] = [];
  lines.push('# Employment Negotiation Memo');
  lines.push('');
  lines.push(`- Memo version: ${memo.memo_version}`);
  lines.push(`- Generated at: ${memo.generated_at}`);
  lines.push(`- Template ID: ${memo.template_id}`);
  if (memo.baseline_template_id) {
    lines.push(`- Baseline template ID: ${memo.baseline_template_id}`);
  }
  lines.push(`- Jurisdiction: ${memo.jurisdiction}`);
  lines.push('');
  lines.push('## Disclaimer');
  lines.push(memo.disclaimer);
  lines.push('');
  lines.push('## Findings');

  if (memo.findings.length === 0) {
    lines.push('No deterministic findings were generated from the configured checks.');
    lines.push('');
  }

  for (const finding of memo.findings) {
    lines.push(`### ${finding.id}`);
    lines.push(`- Category: ${finding.category}`);
    lines.push(`- Severity: ${finding.severity}`);
    lines.push(`- Confidence: ${finding.confidence}`);
    lines.push(`- Summary: ${finding.summary}`);
    lines.push('- Evidence:');
    if (finding.evidence.length === 0) {
      lines.push('  - none');
    } else {
      for (const evidence of finding.evidence) {
        const withValue = evidence.value === undefined ? '' : ` (value: ${JSON.stringify(evidence.value)})`;
        lines.push(`  - ${evidence.type}: ${evidence.reference}${withValue}`);
      }
    }
    lines.push('- Citations:');
    if (finding.citations.length === 0) {
      lines.push('  - none');
    } else {
      for (const citation of finding.citations) {
        lines.push(`  - ${citation.source} (source_date: ${citation.source_date})`);
      }
    }
    lines.push('- Follow-up questions:');
    if (finding.follow_up_questions.length === 0) {
      lines.push('  - none');
    } else {
      for (const question of finding.follow_up_questions) {
        lines.push(`  - ${question}`);
      }
    }
    lines.push('');
  }

  lines.push('## Counsel Escalation');
  lines.push(`- Escalation recommended: ${memo.counsel_escalation.escalation_recommended ? 'yes' : 'no'}`);
  lines.push(`- Reason: ${memo.counsel_escalation.reason}`);
  lines.push(
    `- High-risk findings: ${memo.counsel_escalation.high_risk_finding_ids.length === 0 ? 'none' : memo.counsel_escalation.high_risk_finding_ids.join(', ')}`
  );
  lines.push(`- Guidance: ${memo.counsel_escalation.guidance}`);
  lines.push('- Follow-up questions:');
  if (memo.counsel_escalation.follow_up_questions.length === 0) {
    lines.push('  - none');
  } else {
    for (const question of memo.counsel_escalation.follow_up_questions) {
      lines.push(`  - ${question}`);
    }
  }

  return lines.join('\n');
}

function resolveEffectiveFieldValues(
  metadata: TemplateMetadata,
  values: Record<string, string | boolean>
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const field of metadata.fields) {
    const value = values[field.name];
    if (typeof value === 'boolean') {
      resolved[field.name] = value ? 'true' : 'false';
      continue;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      resolved[field.name] = value.trim();
      continue;
    }
    if (field.default && field.default.trim().length > 0) {
      resolved[field.name] = field.default.trim();
      continue;
    }
    resolved[field.name] = '';
  }

  return resolved;
}

function buildClauseFindings(args: {
  templateId: string;
  templateMetadata: TemplateMetadata;
  fieldValues: Record<string, string>;
}): EmploymentMemoFinding[] {
  const sourceDate = getTemplateSourceDate(args.templateId);
  const signals = CLAUSE_SIGNALS[args.templateId] ?? [];
  const findings: EmploymentMemoFinding[] = [];

  for (const signal of signals) {
    const observedValue = args.fieldValues[signal.field] ?? '';
    const isPresent = signal.isPresent ? signal.isPresent(observedValue) : observedValue.trim().length > 0;

    findings.push({
      id: `clause-${args.templateId}-${signal.id}`,
      category: 'clause_presence',
      severity: isPresent ? (signal.presentSeverity ?? 'low') : signal.missingSeverity,
      confidence: isPresent ? 'high' : 'medium',
      summary: isPresent ? signal.presentSummary : signal.missingSummary,
      evidence: [
        {
          type: 'field',
          reference: `${args.templateId}.${signal.field}`,
          value: observedValue.length > 0 ? observedValue : '<empty>',
        },
        {
          type: 'template',
          reference: args.templateId,
          value: args.templateMetadata.version,
        },
      ],
      citations: [
        {
          source: `${args.templateMetadata.name} metadata field ${signal.field}`,
          source_date: sourceDate,
        },
      ],
      follow_up_questions: signal.followUpQuestionWhenMissing && !isPresent
        ? [signal.followUpQuestionWhenMissing]
        : [],
    });
  }

  return findings;
}

function buildBaselineVarianceFindings(args: {
  templateId: string;
  baselineTemplateId: string;
  templateMetadata: TemplateMetadata;
  baselineMetadata: TemplateMetadata;
  fieldValues: Record<string, string>;
}): EmploymentMemoFinding[] {
  const findings: EmploymentMemoFinding[] = [];
  const baselineFieldMap = new Map(args.baselineMetadata.fields.map((field) => [field.name, field]));
  const sharedFieldNames = args.templateMetadata.fields
    .map((field) => field.name)
    .filter((fieldName) => baselineFieldMap.has(fieldName))
    .sort((left, right) => left.localeCompare(right));

  for (const fieldName of sharedFieldNames) {
    const baselineField = baselineFieldMap.get(fieldName);
    if (!baselineField) {
      continue;
    }

    const currentValue = args.fieldValues[fieldName] ?? '';
    const baselineDefault = baselineField.default?.trim() ?? '';
    const baselineRequiresField = args.baselineMetadata.required_fields.includes(fieldName);

    if (baselineDefault.length > 0 && currentValue.length > 0 && currentValue !== baselineDefault) {
      findings.push({
        id: `baseline-${args.templateId}-${args.baselineTemplateId}-${fieldName}`,
        category: 'baseline_variance',
        severity: varianceSeverityForField(fieldName),
        confidence: 'high',
        summary:
          `Field ${fieldName} differs from the baseline template default value.`,
        evidence: [
          {
            type: 'field',
            reference: `${args.templateId}.${fieldName}`,
            value: currentValue,
          },
          {
            type: 'template',
            reference: `${args.baselineTemplateId}.${fieldName}`,
            value: baselineDefault,
          },
        ],
        citations: [
          {
            source: `${args.templateMetadata.name} metadata field ${fieldName}`,
            source_date: getTemplateSourceDate(args.templateId),
          },
          {
            source: `${args.baselineMetadata.name} metadata field ${fieldName}`,
            source_date: getTemplateSourceDate(args.baselineTemplateId),
          },
        ],
        follow_up_questions: [
          `Can licensed counsel confirm whether the ${fieldName} variance is acceptable for ${args.baselineTemplateId}?`,
        ],
      });
    }

    if (baselineRequiresField && currentValue.length === 0) {
      findings.push({
        id: `baseline-required-${args.templateId}-${args.baselineTemplateId}-${fieldName}`,
        category: 'baseline_variance',
        severity: 'high',
        confidence: 'high',
        summary:
          `Field ${fieldName} is required by baseline template ${args.baselineTemplateId} but is blank in the current draft.`,
        evidence: [
          {
            type: 'field',
            reference: `${args.templateId}.${fieldName}`,
            value: '<empty>',
          },
          {
            type: 'template',
            reference: `${args.baselineTemplateId}.required_fields`,
            value: fieldName,
          },
        ],
        citations: [
          {
            source: `${args.baselineMetadata.name} required_fields metadata`,
            source_date: getTemplateSourceDate(args.baselineTemplateId),
          },
        ],
        follow_up_questions: [
          `Can licensed counsel confirm whether ${fieldName} is required before signature?`,
        ],
      });
    }
  }

  return findings;
}

function buildJurisdictionWarningFindings(
  templateId: string,
  jurisdiction: string,
  fieldValues: Record<string, string>
): EmploymentMemoFinding[] {
  const findings: EmploymentMemoFinding[] = [];

  for (const rule of EMPLOYMENT_JURISDICTION_RULES) {
    if (normalizeJurisdiction(rule.jurisdiction) !== normalizeJurisdiction(jurisdiction)) {
      continue;
    }

    if (!ruleMatches(templateId, fieldValues, rule)) {
      continue;
    }

    const evidence: MemoEvidence[] = [
      {
        type: 'rule',
        reference: rule.rule_id,
        value: JSON.stringify(rule.trigger),
      },
    ];

    const triggerFieldNames = getTriggerFieldNames(rule);
    for (const fieldName of triggerFieldNames) {
      evidence.push({
        type: 'field',
        reference: `${templateId}.${fieldName}`,
        value: fieldValues[fieldName] ?? '<empty>',
      });
    }

    findings.push({
      id: `jurisdiction-${rule.rule_id}`,
      category: 'jurisdiction_warning',
      severity: rule.category === 'restrictive_covenants' ? 'high' : 'medium',
      confidence: rule.confidence,
      summary: rule.message,
      evidence,
      citations: [
        {
          source: rule.source_reference,
          source_date: rule.source_date,
        },
      ],
      follow_up_questions: [
        `Can licensed counsel confirm how ${rule.category} rules in ${rule.jurisdiction} apply to this draft?`,
      ],
    });
  }

  return findings;
}

function buildCounselEscalation(findings: EmploymentMemoFinding[]): EmploymentMemoCounselEscalation {
  const highRiskFindingIds = findings
    .filter((finding) => finding.severity === 'high')
    .map((finding) => finding.id);

  const escalationRecommended = highRiskFindingIds.length > 0;

  const baseGuidance = escalationRecommended
    ? 'High-risk findings were detected. Share this informational memo and cited sources with licensed counsel before finalizing terms.'
    : 'No high-risk findings were detected. You can still route this informational memo to licensed counsel for confirmation.';

  const followUpQuestions = escalationRecommended
    ? [
      'Which findings require jurisdiction-specific legal analysis before signature?',
      'Which clauses should be revised before the draft is finalized?',
    ]
    : [];

  return {
    escalation_recommended: escalationRecommended,
    reason: escalationRecommended
      ? 'One or more findings are marked high severity.'
      : 'No findings are marked high severity.',
    high_risk_finding_ids: highRiskFindingIds,
    guidance: applyAdviceLanguageGuard(baseGuidance),
    follow_up_questions: followUpQuestions.map((question) => applyAdviceLanguageGuard(question)),
  };
}

function sanitizeFinding(finding: EmploymentMemoFinding): EmploymentMemoFinding {
  return {
    ...finding,
    summary: applyAdviceLanguageGuard(finding.summary),
    follow_up_questions: finding.follow_up_questions.map((question) => applyAdviceLanguageGuard(question)),
  };
}

function assertMemoHasNoProhibitedAdviceLanguage(memo: EmploymentMemo): void {
  const textSections: string[] = [memo.disclaimer, memo.counsel_escalation.reason, memo.counsel_escalation.guidance];

  for (const finding of memo.findings) {
    textSections.push(finding.summary, ...finding.follow_up_questions);
  }

  for (const text of textSections) {
    if (hasProhibitedAdviceLanguage(text)) {
      throw new Error(`Memo text contains prohibited advice-like language: "${text}"`);
    }
  }
}

function loadBaselineMetadata(baselineTemplateId: string): TemplateMetadata {
  const baselineTemplateDir = findTemplateDir(baselineTemplateId);
  if (!baselineTemplateDir) {
    throw new Error(`Baseline template "${baselineTemplateId}" could not be found in templates/.`);
  }
  return loadMetadata(baselineTemplateDir);
}

function ruleMatches(
  templateId: string,
  fieldValues: Record<string, string>,
  rule: JurisdictionRule
): boolean {
  const trigger = rule.trigger;

  if (trigger.template_ids && !trigger.template_ids.includes(templateId)) {
    return false;
  }

  if (trigger.field_equals) {
    for (const [fieldName, expected] of Object.entries(trigger.field_equals)) {
      if (normalizeForCompare(fieldValues[fieldName] ?? '') !== normalizeForCompare(expected)) {
        return false;
      }
    }
  }

  if (trigger.field_includes) {
    for (const [fieldName, expectedSubstring] of Object.entries(trigger.field_includes)) {
      const normalizedValue = normalizeForCompare(fieldValues[fieldName] ?? '');
      if (!normalizedValue.includes(normalizeForCompare(expectedSubstring))) {
        return false;
      }
    }
  }

  if (trigger.field_one_of) {
    for (const [fieldName, allowedValues] of Object.entries(trigger.field_one_of)) {
      const normalizedValue = normalizeForCompare(fieldValues[fieldName] ?? '');
      const allowedNormalized = allowedValues.map((value) => normalizeForCompare(value));
      if (!allowedNormalized.includes(normalizedValue)) {
        return false;
      }
    }
  }

  if (trigger.field_empty) {
    for (const fieldName of trigger.field_empty) {
      if (normalizeForCompare(fieldValues[fieldName] ?? '').length > 0) {
        return false;
      }
    }
  }

  return true;
}

function getTriggerFieldNames(rule: JurisdictionRule): string[] {
  const fieldNames = new Set<string>();

  if (rule.trigger.field_equals) {
    for (const fieldName of Object.keys(rule.trigger.field_equals)) {
      fieldNames.add(fieldName);
    }
  }

  if (rule.trigger.field_includes) {
    for (const fieldName of Object.keys(rule.trigger.field_includes)) {
      fieldNames.add(fieldName);
    }
  }

  if (rule.trigger.field_one_of) {
    for (const fieldName of Object.keys(rule.trigger.field_one_of)) {
      fieldNames.add(fieldName);
    }
  }

  if (rule.trigger.field_empty) {
    for (const fieldName of rule.trigger.field_empty) {
      fieldNames.add(fieldName);
    }
  }

  return [...fieldNames].sort((left, right) => left.localeCompare(right));
}

function normalizeJurisdiction(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    return 'Unspecified';
  }
  return normalized
    .split(/\s+/)
    .map((piece) => (piece.length > 0 ? `${piece[0].toUpperCase()}${piece.slice(1).toLowerCase()}` : piece))
    .join(' ');
}

function normalizeForCompare(input: string): string {
  return input.trim().toLowerCase();
}

function varianceSeverityForField(fieldName: string): FindingSeverity {
  const highRiskFields = new Set(['governing_law', 'venue', 'excluded_inventions_statement']);
  return highRiskFields.has(fieldName) ? 'high' : 'medium';
}

function getTemplateSourceDate(templateId: string): string {
  return TEMPLATE_SOURCE_DATES[templateId] ?? '2026-02-10';
}
