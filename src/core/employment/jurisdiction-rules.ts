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
  {
    rule_id: 'emp-jur-wy-s1-23-108-scope-001',
    jurisdiction: 'Wyoming',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-restrictive-covenant-wyoming',
        'openagreements-employment-offer-letter',
      ],
      field_includes: {
        governing_law: 'wyoming',
      },
    },
    message:
      'Wyoming Stat. section 1-23-108 (SF 107, effective July 1, 2025) voids most non-compete covenants except via specific statutory pathways: executive or management personnel, trade secret protection, sale of business, or training-expense recovery. Confirm applicability with licensed counsel.',
    source_reference:
      'Wyoming Statute section 1-23-108 (Senate File 107, 2025 Session).',
    source_date: '2025-07-01',
    confidence: 'high',
  },
  {
    rule_id: 'emp-jur-wy-hassler-no-reform-001',
    jurisdiction: 'Wyoming',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-restrictive-covenant-wyoming',
      ],
      field_includes: {
        governing_law: 'wyoming',
      },
    },
    message:
      'Wyoming courts may void overbroad restrictive covenants entirely rather than reform them. Hassler v. Circle C Resources, 2022 WY 28. Ensure each covenant is narrowly tailored to avoid full invalidation.',
    source_reference:
      'Hassler v. Circle C Resources, 2022 WY 28 (Wyoming Supreme Court).',
    source_date: '2022-02-25',
    confidence: 'high',
  },
  {
    rule_id: 'emp-jur-wy-pathway-none-noncompete-001',
    jurisdiction: 'Wyoming',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-restrictive-covenant-wyoming',
      ],
      field_one_of: {
        restriction_pathways: ['none'],
      },
    },
    message:
      'Restriction pathway is set to none, but non-compete-adjacent covenants (non-competition, non-dealing, or non-investment) may be included. Under Wyoming Stat. section 1-23-108, these provisions are likely void without a lawful statutory pathway.',
    source_reference:
      'Wyoming Statute section 1-23-108 (Senate File 107, 2025 Session).',
    source_date: '2025-07-01',
    confidence: 'high',
  },
  {
    rule_id: 'emp-jur-wy-nonsolicitation-uncertainty-001',
    jurisdiction: 'Wyoming',
    category: 'restrictive_covenants',
    trigger: {
      template_ids: [
        'openagreements-restrictive-covenant-wyoming',
      ],
      field_includes: {
        governing_law: 'wyoming',
      },
    },
    message:
      'Practitioner sources flag uncertainty about whether Wyoming Stat. section 1-23-108 could reach certain non-solicitation provisions depending on how they function. No separate Wyoming non-solicitation statute was identified in this review. Confirm enforceability with licensed counsel.',
    source_reference:
      'Littler Mendelson analysis of Wyoming SF 107; Faegre Drinker analysis noting broad "any person" statutory phrasing.',
    source_date: '2025-07-01',
    confidence: 'medium',
  },
];
