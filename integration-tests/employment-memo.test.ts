import { describe, expect } from 'vitest';
import { loadMetadata } from '../src/core/metadata.js';
import { findTemplateDir } from '../src/utils/paths.js';
import { itAllure } from './helpers/allure-test.js';
import {
  EMPLOYMENT_MEMO_DISCLAIMER,
  applyAdviceLanguageGuard,
  generateEmploymentMemo,
  hasProhibitedAdviceLanguage,
  renderEmploymentMemoMarkdown,
} from '../src/core/employment/memo.js';

function mustFindTemplateDir(templateId: string): string {
  const templateDir = findTemplateDir(templateId);
  if (!templateDir) {
    throw new Error(`Template not found in tests: ${templateId}`);
  }
  return templateDir;
}

const it = itAllure.epic('Compliance & Governance');

describe('employment memo generator', () => {
  it('generates disclaimer + findings + jurisdiction warnings for matching rules', () => {
    const templateId = 'openagreements-confidentiality-invention-assignment-agreement';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-02-13T10:00:00.000Z',
      values: {
        company_name: 'Acme, Inc.',
        company_signatory_name: 'Dana Founder',
        company_signatory_title: 'Chief Executive Officer',
        employee_name: 'Taylor Developer',
        effective_date: '2026-03-01',
        prior_inventions_disclosure: 'US Patent 1,234,567',
        excluded_inventions_statement: 'See Exhibit A',
        return_of_materials_timing: 'within 5 days of termination',
        post_termination_assistance: 'reasonable cooperation for 12 months',
        governing_law: 'California',
        venue: 'San Francisco County, California',
      },
    });

    expect(memo.memo_version).toBe('1.0.0');
    expect(memo.generated_at).toBe('2026-02-13T10:00:00.000Z');
    expect(memo.disclaimer).toBe(EMPLOYMENT_MEMO_DISCLAIMER);

    const jurisdictionWarnings = memo.findings.filter((finding) => finding.category === 'jurisdiction_warning');
    expect(jurisdictionWarnings.length).toBeGreaterThan(0);

    expect(memo.findings.every((finding) => finding.evidence.length > 0)).toBe(true);
    expect(memo.findings.every((finding) => finding.citations.length > 0)).toBe(true);

    const hasSourceDate = jurisdictionWarnings.every((warning) =>
      warning.citations.every((citation) => citation.source_date.length > 0)
    );
    expect(hasSourceDate).toBe(true);

    expect(memo.counsel_escalation.escalation_recommended).toBe(true);
    expect(memo.counsel_escalation.high_risk_finding_ids.length).toBeGreaterThan(0);
  });

  it('does not fabricate jurisdiction warnings when no rule matches', () => {
    const templateId = 'openagreements-employment-offer-letter';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-02-13T10:00:00.000Z',
      jurisdiction: 'Texas',
      values: {
        employer_name: 'Acme, Inc.',
        employee_name: 'Taylor Developer',
        position_title: 'Senior Software Engineer',
        employment_type: 'full-time',
        start_date: '2026-03-01',
        base_salary: '$220,000 annualized',
        work_location: 'Remote (United States)',
        governing_law: 'Texas',
        offer_expiration_date: '2026-02-28',
      },
    });

    expect(memo.findings.some((finding) => finding.category === 'jurisdiction_warning')).toBe(false);
    expect(memo.disclaimer).toContain('not legal advice');
  });

  it('renders markdown output with mandatory disclaimer and citations', () => {
    // Retargeted from the dropped confidentiality-acknowledgement template to CIIAA
    // to keep coverage of renderEmploymentMemoMarkdown (a still-supported template).
    const templateId = 'openagreements-confidentiality-invention-assignment-agreement';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-02-13T10:00:00.000Z',
      values: {
        company_name: 'Acme, Inc.',
        company_signatory_name: 'Dana Founder',
        company_signatory_title: 'Chief Executive Officer',
        employee_name: 'Taylor Developer',
        effective_date: '2026-03-01',
        prior_inventions_disclosure: 'US Patent 1,234,567',
        excluded_inventions_statement: 'See Exhibit A',
        return_of_materials_timing: 'within 5 days of termination',
        post_termination_assistance: 'reasonable cooperation for 12 months',
        governing_law: 'California',
        venue: 'San Francisco County, California',
      },
    });

    const markdown = renderEmploymentMemoMarkdown(memo);
    expect(markdown).toContain('## Disclaimer');
    expect(markdown).toContain(EMPLOYMENT_MEMO_DISCLAIMER);
    expect(markdown).toContain('source_date:');
  });
});

describe('wyoming restrictive covenant memo', () => {
  it('generates SF 107 jurisdiction warnings for Wyoming governing law', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        employee_title: 'VP Engineering',
        worker_category: 'Executive',
        applicable_noncompete_exceptions: 'Executive or Management Personnel',
        competitive_business_definition: 'Software development services',
        covered_customer_period: '24 months',
        covered_employee_period: '12 months',
        governing_law: 'Wyoming',
      },
    });

    const jurisdictionWarnings = memo.findings.filter((f) => f.category === 'jurisdiction_warning');
    expect(jurisdictionWarnings.length).toBeGreaterThan(0);

    const sf107Warning = jurisdictionWarnings.find((f) => f.id.includes('wy-s1-23-108'));
    expect(sf107Warning).toBeDefined();
    expect(sf107Warning!.summary).toContain('1-23-108');

    const hasslerWarning = jurisdictionWarnings.find((f) => f.id.includes('hassler'));
    expect(hasslerWarning).toBeDefined();
    expect(hasslerWarning!.summary).toContain('Hassler');
  });

  it('flags high-severity finding when worker category is blank', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        governing_law: 'Wyoming',
      },
    });

    const workerFinding = memo.findings.find((f) =>
      f.id.includes('worker-category') && f.severity === 'high'
    );
    expect(workerFinding).toBeDefined();
  });

  it('generates duration range warning for non-compete exceeding 24 months', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        worker_category: 'Executive',
        applicable_noncompete_exceptions: 'Executive or Management Personnel',
        noncompete_duration: '3 years',
        governing_law: 'Wyoming',
      },
    });

    const durationWarning = memo.findings.find((f) =>
      f.id.includes('noncompete-duration-range')
    );
    expect(durationWarning).toBeDefined();
    expect(durationWarning!.severity).toBe('high');
    expect(durationWarning!.summary).toContain('Hassler');
  });

  it('generates low-severity note for non-compete duration of 18 months', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        worker_category: 'Executive',
        applicable_noncompete_exceptions: 'Executive or Management Personnel',
        noncompete_duration: '18 months',
        governing_law: 'Wyoming',
      },
    });

    const durationNote = memo.findings.find((f) =>
      f.id.includes('noncompete-duration-range')
    );
    expect(durationNote).toBeDefined();
    expect(durationNote!.severity).toBe('low');
  });

  it('does not generate duration warning for 12 months', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        worker_category: 'Executive',
        applicable_noncompete_exceptions: 'Executive or Management Personnel',
        noncompete_duration: '12 months',
        governing_law: 'Wyoming',
      },
    });

    const durationWarning = memo.findings.find((f) =>
      f.id.includes('noncompete-duration-range')
    );
    expect(durationWarning).toBeUndefined();
  });
});

describe('employment memo language guard', () => {
  it('rewrites prescriptive wording and blocks prohibited phrases', () => {
    const rewritten = applyAdviceLanguageGuard('We recommend this plan. You should use the best strategy.');

    expect(rewritten).not.toContain('We recommend');
    expect(rewritten).not.toContain('You should');
    expect(rewritten).not.toContain('best strategy');

    expect(hasProhibitedAdviceLanguage(rewritten)).toBe(false);
    expect(hasProhibitedAdviceLanguage('Our advice is to do X')).toBe(true);
  });
});
