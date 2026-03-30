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
  it.openspec('OA-FIL-016')('generates disclaimer + findings + jurisdiction warnings for matching rules', () => {
    const templateId = 'openagreements-employee-ip-inventions-assignment';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-02-13T10:00:00.000Z',
      values: {
        company_name: 'Acme, Inc.',
        employee_name: 'Taylor Developer',
        effective_date: '2026-03-01',
        confidential_information_definition: 'non-public business information',
        return_of_materials_timing: 'within 5 days of termination',
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

  it.openspec('OA-FIL-016')('does not fabricate jurisdiction warnings when no rule matches', () => {
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

  it.openspec('OA-FIL-016')('produces deterministic baseline variance findings against selected baseline template', () => {
    const templateId = 'openagreements-employee-ip-inventions-assignment';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      baselineTemplateId: templateId,
      generatedAt: '2026-02-13T10:00:00.000Z',
      values: {
        company_name: 'Acme, Inc.',
        employee_name: 'Taylor Developer',
        effective_date: '2026-03-01',
        confidential_information_definition: 'non-public business information',
        return_of_materials_timing: 'within 5 days of termination',
        governing_law: 'Delaware',
        venue: 'San Francisco County, California',
      },
    });

    const baselineVariance = memo.findings.filter((finding) => finding.category === 'baseline_variance');
    expect(baselineVariance.length).toBeGreaterThan(0);

    const governingLawVariance = baselineVariance.find((finding) =>
      finding.id.includes('governing_law')
    );
    expect(governingLawVariance).toBeDefined();
  });

  it.openspec('OA-FIL-016')('renders markdown output with mandatory disclaimer and citations', () => {
    const templateId = 'openagreements-employment-confidentiality-acknowledgement';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-02-13T10:00:00.000Z',
      values: {
        company_name: 'Acme, Inc.',
        employee_name: 'Taylor Developer',
        policy_effective_date: '2026-03-01',
        approved_tools_scope: 'company-managed systems',
        data_access_scope: 'least privilege',
        security_reporting_contact: 'security@acme.example',
        acknowledgement_date: '2026-03-01',
        signatory_name: 'Taylor Developer',
      },
    });

    const markdown = renderEmploymentMemoMarkdown(memo);
    expect(markdown).toContain('## Disclaimer');
    expect(markdown).toContain(EMPLOYMENT_MEMO_DISCLAIMER);
    expect(markdown).toContain('source_date:');
  });
});

describe('wyoming restrictive covenant memo', () => {
  it.openspec('OA-FIL-016')('generates SF 107 jurisdiction warnings for Wyoming governing law', () => {
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
        restriction_pathways: 'Executive or Management Personnel',
        competitive_business_definition: 'Software development services',
        covered_customers_scope: 'Customers served by Employee in the prior 24 months',
        covered_employees_scope: 'All engineering department employees',
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

  it.openspec('OA-FIL-016')('warns when restriction pathway is none but non-compete fields populated', () => {
    const templateId = 'openagreements-restrictive-covenant-wyoming';
    const metadata = loadMetadata(mustFindTemplateDir(templateId));

    const memo = generateEmploymentMemo({
      templateId,
      templateMetadata: metadata,
      generatedAt: '2026-03-30T10:00:00.000Z',
      values: {
        employer_name: 'Mountain Corp',
        employee_name: 'Jane Doe',
        worker_category: 'Other',
        restriction_pathways: 'None',
        governing_law: 'Wyoming',
      },
    });

    const pathwayWarning = memo.findings.find((f) =>
      f.category === 'jurisdiction_warning' && f.id.includes('pathway-none')
    );
    expect(pathwayWarning).toBeDefined();
    expect(pathwayWarning!.summary).toContain('void');
  });

  it.openspec('OA-FIL-016')('flags high-severity finding when worker category is blank', () => {
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

  it.openspec('OA-FIL-016')('generates duration range warning for non-compete exceeding 24 months', () => {
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
        restriction_pathways: 'Executive or Management Personnel',
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

  it.openspec('OA-FIL-016')('generates low-severity note for non-compete duration of 18 months', () => {
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
        restriction_pathways: 'Executive or Management Personnel',
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

  it.openspec('OA-FIL-016')('does not generate duration warning for 12 months', () => {
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
        restriction_pathways: 'Executive or Management Personnel',
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
  it.openspec('OA-FIL-017')('rewrites prescriptive wording and blocks prohibited phrases', () => {
    const rewritten = applyAdviceLanguageGuard('We recommend this plan. You should use the best strategy.');

    expect(rewritten).not.toContain('We recommend');
    expect(rewritten).not.toContain('You should');
    expect(rewritten).not.toContain('best strategy');

    expect(hasProhibitedAdviceLanguage(rewritten)).toBe(false);
    expect(hasProhibitedAdviceLanguage('Our advice is to do X')).toBe(true);
  });
});
