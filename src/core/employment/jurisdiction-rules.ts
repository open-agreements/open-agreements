export type RuleConfidence = 'low' | 'medium' | 'high';

export interface JurisdictionRuleTrigger {
  template_ids?: string[];
  field_equals?: Record<string, string>;
  field_includes?: Record<string, string>;
  field_one_of?: Record<string, string[]>;
  field_empty?: string[];
}

export interface JurisdictionRule {
  rule_id: string;
  jurisdiction: string;
  category: string;
  trigger: JurisdictionRuleTrigger;
  message: string;
  source_reference: string;
  source_date: string;
  confidence: RuleConfidence;
}

export const EMPLOYMENT_JURISDICTION_RULES: JurisdictionRule[] = [
  {
    rule_id: 'emp-jur-ca-restrictive-covenants-001',
    jurisdiction: 'California',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-employment-offer-letter',
        'openagreements-employee-ip-inventions-assignment',
      ],
      field_includes: {
        governing_law: 'california',
      },
    },
    message:
      'California generally limits employee non-compete terms. Confirm any restrictive-covenant language with licensed counsel.',
    source_reference:
      'California Business and Professions Code section 16600 and California Assembly Bill 1076.',
    source_date: '2024-01-01',
    confidence: 'high',
  },
  {
    rule_id: 'emp-jur-ca-inventions-carveout-001',
    jurisdiction: 'California',
    category: 'employee_inventions',
    trigger: {
      template_ids: ['openagreements-employee-ip-inventions-assignment'],
      field_includes: {
        governing_law: 'california',
      },
      field_one_of: {
        prior_inventions_disclosure: ['none listed', 'none', 'n/a'],
      },
    },
    message:
      'California limits assignment of certain employee inventions. Verify carveout and notice language with licensed counsel.',
    source_reference: 'California Labor Code sections 2870 to 2872.',
    source_date: '2024-01-01',
    confidence: 'high',
  },
  {
    rule_id: 'emp-jur-wa-noncompete-thresholds-001',
    jurisdiction: 'Washington',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-employment-offer-letter',
        'openagreements-employee-ip-inventions-assignment',
      ],
      field_includes: {
        governing_law: 'washington',
      },
    },
    message:
      'Washington imposes statutory limits on non-compete enforceability, including compensation thresholds and notice conditions.',
    source_reference: 'Revised Code of Washington section 49.62.',
    source_date: '2024-01-01',
    confidence: 'medium',
  },
];
