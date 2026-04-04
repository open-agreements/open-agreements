import { describe, expect, it } from 'vitest';
import { searchTemplates } from './template-search.js';

// ---------------------------------------------------------------------------
// Fixture: representative subset of real templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    name: 'common-paper-mutual-nda',
    display_name: 'Common Paper Mutual NDA',
    category: 'confidentiality',
    description: 'A mutual non-disclosure agreement cover page based on Common Paper\'s standard terms.',
    source: 'Common Paper',
    fields: [
      { name: 'purpose', section: 'Terms' },
      { name: 'effective_date', section: 'Terms' },
      { name: 'governing_law', section: 'Legal' },
      { name: 'party_1_name', section: 'Signature Block' },
    ],
  },
  {
    name: 'common-paper-one-way-nda',
    display_name: 'Common Paper One-Way NDA',
    category: 'confidentiality',
    description: 'A one-way (unilateral) non-disclosure agreement cover page based on Common Paper\'s standard terms.',
    source: 'Common Paper',
    fields: [
      { name: 'purpose', section: 'Terms' },
      { name: 'effective_date', section: 'Terms' },
    ],
  },
  {
    name: 'common-paper-data-processing-agreement',
    display_name: 'Common Paper Data Processing Agreement',
    category: 'data-compliance',
    description: 'A data processing agreement cover page and standard terms. Covers GDPR and data protection compliance.',
    source: 'Common Paper',
    fields: [
      { name: 'data_subjects', section: 'Terms' },
      { name: 'governing_law', section: 'Legal' },
    ],
  },
  {
    name: 'common-paper-business-associate-agreement',
    display_name: 'Common Paper Business Associate Agreement',
    category: 'data-compliance',
    description: 'A HIPAA business associate agreement cover page and standard terms.',
    source: 'Common Paper',
    fields: [
      { name: 'effective_date', section: 'Terms' },
    ],
  },
  {
    name: 'openagreements-employment-offer-letter',
    display_name: 'OpenAgreements Employment Offer Letter',
    category: 'employment',
    description: 'A startup-focused employment offer letter template for full-time or part-time positions.',
    source: 'OpenAgreements',
    fields: [
      { name: 'employee_name', section: 'Employee Details' },
      { name: 'salary', section: 'Compensation' },
    ],
  },
  {
    name: 'openagreements-restrictive-covenant-wyoming',
    display_name: 'OpenAgreements Employee Restrictive Covenant (Wyoming)',
    category: 'employment',
    description: 'Wyoming-specific employee restrictive covenant agreement with modular non-compete, non-solicit, and non-disclosure provisions.',
    source: 'OpenAgreements',
    fields: [
      { name: 'employee_name', section: 'Employee Details' },
      { name: 'non_compete_duration', section: 'Covenants' },
    ],
  },
  {
    name: 'nvca-stock-purchase-agreement',
    display_name: 'NVCA Model Stock Purchase Agreement',
    category: 'venture-financing',
    description: 'Series preferred stock purchase agreement for venture capital financings, covering purchase terms, representations, and closing conditions.',
    source: 'NVCA',
    fields: [
      { name: 'company_name', section: 'Deal Terms' },
      { name: 'investor_name', section: 'Deal Terms' },
      { name: 'valuation_cap', section: 'Deal Terms' },
    ],
  },
  {
    name: 'nvca-indemnification-agreement',
    display_name: 'NVCA Model Indemnification Agreement',
    category: 'venture-financing',
    description: 'Director and officer indemnification agreement for venture-backed companies.',
    source: 'NVCA',
    fields: [
      { name: 'company_name', section: 'Parties' },
      { name: 'indemnitee_name', section: 'Parties' },
    ],
  },
  {
    name: 'common-paper-cloud-service-agreement',
    display_name: 'Common Paper Cloud Service Agreement',
    category: 'sales-licensing',
    description: 'A cloud service agreement with order form and framework terms, based on Common Paper\'s standard terms. Covers SaaS and cloud services.',
    source: 'Common Paper',
    fields: [
      { name: 'provider_name', section: 'Parties' },
      { name: 'customer_name', section: 'Parties' },
      { name: 'subscription_term', section: 'Terms' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Ranking tests
// ---------------------------------------------------------------------------

describe('searchTemplates — ranking', () => {
  it('ranks NDA templates at the top for query "NDA"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'NDA' });
    const top3Ids = results.slice(0, 3).map((r) => r.template_id);
    expect(top3Ids).toContain('common-paper-mutual-nda');
    expect(top3Ids).toContain('common-paper-one-way-nda');
  });

  it('finds DPA via description term "GDPR"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'GDPR' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('common-paper-data-processing-agreement');
  });

  it('finds SAFE via field name "valuation cap"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'valuation cap' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('nvca-stock-purchase-agreement');
  });

  it('finds restrictive covenant for "wyoming"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'wyoming' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('openagreements-restrictive-covenant-wyoming');
  });

  it('finds indemnification agreement for "indemnification"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'indemnification' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('nvca-indemnification-agreement');
  });

  it('finds BAA for "hipaa"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'hipaa' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('common-paper-business-associate-agreement');
  });

  it('returns results sorted by descending score', () => {
    const results = searchTemplates(TEMPLATES, { query: 'agreement' });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });
});

// ---------------------------------------------------------------------------
// Fuzzy and prefix tests
// ---------------------------------------------------------------------------

describe('searchTemplates — fuzzy and prefix', () => {
  it('handles typo "restirctive" via fuzzy matching', () => {
    const results = searchTemplates(TEMPLATES, { query: 'restirctive covenant' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].template_id).toBe('openagreements-restrictive-covenant-wyoming');
  });

  it('handles prefix "rest" matching "restrictive"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'rest' });
    const ids = results.map((r) => r.template_id);
    expect(ids).toContain('openagreements-restrictive-covenant-wyoming');
  });

  it('does not produce noisy fuzzy results for short acronym "nda"', () => {
    const results = searchTemplates(TEMPLATES, { query: 'nda' });
    // All results should be NDA-related, not random fuzzy matches
    for (const r of results) {
      const isNdaRelated =
        r.display_name.toLowerCase().includes('nda') ||
        r.description.toLowerCase().includes('nda') ||
        r.description.toLowerCase().includes('non-disclosure');
      expect(isNdaRelated).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Filter tests
// ---------------------------------------------------------------------------

describe('searchTemplates — filters', () => {
  it('filters by category (exact, case-insensitive)', () => {
    const results = searchTemplates(TEMPLATES, { query: 'agreement', category: 'employment' });
    for (const r of results) {
      expect(r.category).toBe('employment');
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('filters by source (exact, case-insensitive)', () => {
    const results = searchTemplates(TEMPLATES, { query: 'agreement', source: 'NVCA' });
    for (const r of results) {
      expect(r.source).toBe('NVCA');
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles case-insensitive category filter', () => {
    const lower = searchTemplates(TEMPLATES, { query: 'agreement', category: 'employment' });
    const upper = searchTemplates(TEMPLATES, { query: 'agreement', category: 'Employment' });
    expect(lower.map((r) => r.template_id)).toEqual(upper.map((r) => r.template_id));
  });

  it('handles case-insensitive source filter', () => {
    const lower = searchTemplates(TEMPLATES, { query: 'agreement', source: 'nvca' });
    const upper = searchTemplates(TEMPLATES, { query: 'agreement', source: 'NVCA' });
    expect(lower.map((r) => r.template_id)).toEqual(upper.map((r) => r.template_id));
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('searchTemplates — edge cases', () => {
  it('returns empty array for non-matching query', () => {
    const results = searchTemplates(TEMPLATES, { query: 'xyznonexistent' });
    expect(results).toEqual([]);
  });

  it('respects max_results', () => {
    const results = searchTemplates(TEMPLATES, { query: 'agreement', max_results: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('defaults max_results to 10', () => {
    const results = searchTemplates(TEMPLATES, { query: 'agreement' });
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('includes field_count in results', () => {
    const results = searchTemplates(TEMPLATES, { query: 'NDA' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].field_count).toBe(4); // mutual NDA has 4 fields
  });

  it('includes score in results', () => {
    const results = searchTemplates(TEMPLATES, { query: 'NDA' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Category propagation (validates metadata-backed categories)
// ---------------------------------------------------------------------------

describe('searchTemplates — category propagation', () => {
  it('NVCA recipes have venture-financing category, not general', () => {
    const results = searchTemplates(TEMPLATES, { query: 'NVCA', category: 'venture-financing' });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.category).toBe('venture-financing');
    }
  });

  it('NDA templates have confidentiality category', () => {
    const results = searchTemplates(TEMPLATES, { query: 'NDA', category: 'confidentiality' });
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.category).toBe('confidentiality');
    }
  });
});
