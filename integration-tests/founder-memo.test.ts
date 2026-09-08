import { describe, expect } from 'vitest';
import { loadMetadata } from '../src/core/metadata.js';
import { findTemplateDir } from '../src/utils/paths.js';
import { itAllure } from './helpers/allure-test.js';
import {
  FOUNDER_MEMO_DISCLAIMER,
  generateFounderMemo,
  isFounderTemplateId,
  renderFounderMemoMarkdown,
} from '../src/core/founder/memo.js';
import { hasProhibitedAdviceLanguage } from '../src/core/memo/advice-language.js';

const it = itAllure.epic('Compliance & Governance');

function mustFindTemplateDir(templateId: string): string {
  const templateDir = findTemplateDir(templateId);
  if (!templateDir) throw new Error(`Template not found in tests: ${templateId}`);
  return templateDir;
}

/**
 * Synthetic founder-separation matter. Mirrors the shape of the frozen
 * open-counsel benchmark facts: a repurchase whose share figures come from a
 * Restricted Stock Purchase Agreement that is NOT supplied to this tool. The
 * benchmark's own vesting schedule does not reconcile to the prescribed
 * unvested figure (a tracked corpus defect), which is exactly why the memo
 * must record the figure as ASSERTED and must never claim it reconciles.
 */
const REPURCHASE_NOTICE_VALUES = {
  company_legal_name: 'Nimbus Forge, Inc.',
  founder_name: 'Maya Chen',
  rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
  termination_date: '2026-03-15',
  repurchase_window_days: 90,
  unvested_share_count: '3,300,000 shares of Common Stock',
  repurchase_price_per_share: '$0.0001',
  aggregate_price: '$330.00',
  closing_date: '2026-03-27',
  signatory_name: 'Alex Rivera',
  signatory_title: 'Chief Executive Officer and President',
};

function memoForRepurchaseNotice(overrides: Record<string, unknown> = {}) {
  const templateId = 'openagreements-founder-share-repurchase-notice';
  return generateFounderMemo({
    templateId,
    templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
    values: { ...REPURCHASE_NOTICE_VALUES, ...overrides },
    generatedAt: '2026-09-08T00:00:00.000Z',
  });
}

describe('founder separation companion memo', () => {
  it('emits the four companion sections with the mandatory disclaimer', () => {
    const memo = memoForRepurchaseNotice();

    expect(memo.matter_family).toBe('founder-separation');
    expect(memo.disclaimer).toBe(FOUNDER_MEMO_DISCLAIMER);
    expect(memo.generated_at).toBe('2026-09-08T00:00:00.000Z');

    expect(memo.source_documents.length).toBeGreaterThan(0);
    expect(memo.unresolved_facts.length).toBeGreaterThan(0);
    expect(memo.approvals.length).toBeGreaterThan(0);
  });

  it('records a cited source document as relied on but never supplied', () => {
    const memo = memoForRepurchaseNotice();
    const rspa = memo.source_documents.find((entry) => entry.cited_by_field === 'rspa_reference');

    expect(rspa).toBeDefined();
    expect(rspa?.cited_as).toBe(REPURCHASE_NOTICE_VALUES.rspa_reference);
    expect(rspa?.supplied_to_this_tool).toBe(false);
  });

  /**
   * The load-bearing restraint. The unvested figure cannot be derived from
   * anything the fill supplies, so the memo reports it as asserted and asks for
   * reconciliation. It must NOT state that the schedule reconciles.
   */
  it('surfaces an asserted share figure as unresolved without claiming it reconciles', () => {
    const memo = memoForRepurchaseNotice();
    const fact = memo.unresolved_facts.find((entry) =>
      entry.evidence_fields.includes('unvested_share_count')
    );

    expect(fact).toBeDefined();
    expect(fact?.severity).toBe('high');
    expect(fact?.summary).toContain(REPURCHASE_NOTICE_VALUES.unvested_share_count);
    expect(fact?.summary).toContain('asserted');
    expect(fact?.summary).toContain('does not state that the figure reconciles');

    const allText = [
      ...memo.unresolved_facts.map((entry) => entry.summary),
      ...memo.source_documents.map((entry) => entry.dependency_note),
    ].join(' ');
    expect(allText).not.toMatch(/\breconciles to\b|\bvesting reconciles\b|\bfigures reconcile\b/i);
  });

  it('flags a closing date outside the stated repurchase window', () => {
    const memo = memoForRepurchaseNotice({ closing_date: '2026-08-01' });
    const outside = memo.unresolved_facts.find((entry) => entry.id.endsWith('closing-outside-window'));

    expect(outside).toBeDefined();
    expect(outside?.severity).toBe('high');
  });

  it('does not flag a closing date inside the stated repurchase window', () => {
    const memo = memoForRepurchaseNotice();
    expect(memo.unresolved_facts.some((entry) => entry.id.endsWith('closing-outside-window'))).toBe(false);
  });

  it('flags a closing date that precedes the termination it follows from', () => {
    const memo = memoForRepurchaseNotice({ closing_date: '2026-03-01' });
    expect(memo.unresolved_facts.some((entry) => entry.id.endsWith('closing-before-termination'))).toBe(true);
  });

  it('records both branch options for a board consent and names the sibling document that must agree', () => {
    const templateId = 'openagreements-founder-separation-board-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        removed_offices: 'Chief Product Officer and Secretary',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        vacancy_action: 'reduce-board-size',
        share_disposition: 'cancelled-retired',
        board_size_after: 2,
        director_signatories: [{ name: 'Alex Rivera' }, { name: 'Priya Shah' }],
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    const vacancy = memo.branch_decisions.find((entry) => entry.field === 'vacancy_action');
    expect(vacancy?.selected).toBe('reduce-board-size');
    expect(vacancy?.options_not_selected).toEqual(['appoint-replacement', 'leave-vacant']);

    const disposition = memo.branch_decisions.find((entry) => entry.field === 'share_disposition');
    expect(disposition?.must_match_in).toContain(
      'openagreements-founder-separation-cap-table-update-instructions'
    );

    const boardApproval = memo.approvals.find((entry) => entry.id.endsWith('board-written-consent'));
    expect(boardApproval?.status).toBe('recorded_in_values');
  });

  it('reports an approval as not recorded when no signatory evidences it', () => {
    const templateId = 'openagreements-founder-separation-stockholder-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        stockholder_action: 'other',
        stockholder_signatories: [],
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    const approval = memo.approvals.find((entry) => entry.id.endsWith('stockholder-written-consent'));
    expect(approval?.status).toBe('not_recorded');
    expect(memo.counsel_escalation.escalation_recommended).toBe(true);
  });

  it('flags a conditional field left blank by the branch that requires it', () => {
    const templateId = 'openagreements-founder-separation-board-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        vacancy_action: 'appoint-replacement',
        replacement_director_name: '',
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(
      memo.unresolved_facts.some((entry) => entry.id.endsWith('conditional-replacement_director_name'))
    ).toBe(true);
  });

  it('reports every blank priority field as unresolved', () => {
    const templateId = 'openagreements-founder-separation-resignation-letter';
    const templateMetadata = loadMetadata(mustFindTemplateDir(templateId));
    const memo = generateFounderMemo({
      templateId,
      templateMetadata,
      values: {},
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    // Derived from metadata, never hardcoded.
    for (const fieldName of templateMetadata.priority_fields) {
      expect(
        memo.unresolved_facts.some((entry) => entry.evidence_fields.includes(fieldName)),
        fieldName
      ).toBe(true);
    }
  });

  it('keeps every emitted string free of prescriptive advice language', () => {
    const memo = memoForRepurchaseNotice();
    const markdown = renderFounderMemoMarkdown(memo);

    expect(hasProhibitedAdviceLanguage(markdown)).toBe(false);
    expect(markdown).toContain('# Founder Separation Companion Memo');
    expect(markdown).toContain('## Source Documents Relied On');
    expect(markdown).toContain('## Branch Decisions');
    expect(markdown).toContain('## Unresolved Facts');
    expect(markdown).toContain('## Approvals');
    expect(markdown).toContain(FOUNDER_MEMO_DISCLAIMER);
  });

  /**
   * Regression tests for the six findings the Codex peer review of PR #822
   * reproduced against the real CLI. Each asserts the specific behaviour that
   * was wrong, not merely that the code runs.
   */

  it('rejects prescriptive language that arrives through a field value, without rewriting the value', () => {
    // The guard used to check a hand-listed set of sections, so a citation
    // echoed back from `rspa_reference` reached the artifact unchecked.
    expect(() => memoForRepurchaseNotice({rspa_reference: 'Agreement in which you should waive all claims'}))
      .toThrow(/prohibited advice-like language/);
  });

  it('guards a branch selection value too', () => {
    const templateId = 'openagreements-founder-separation-stockholder-consent';
    expect(() =>
      generateFounderMemo({
        templateId,
        templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
        values: {
          company_legal_name: 'Nimbus Forge, Inc.',
          consent_date: '2026-03-16',
          founder_name: 'Maya Chen',
          stockholder_action: 'you should remove the director',
          stockholder_signatories: [{name: 'Alex Rivera'}],
        },
      })
    ).toThrow(/prohibited advice-like language/);
  });

  it('never says every approval is recorded while an approval depends on records not supplied', () => {
    const memo = memoForRepurchaseNotice();
    const dependent = memo.approvals.filter(
      (entry) => entry.status === 'depends_on_records_not_supplied'
    );
    expect(dependent.length).toBeGreaterThan(0);

    expect(memo.counsel_escalation.outstanding_approval_dependency_ids).toEqual(
      dependent.map((entry) => entry.id)
    );
    expect(memo.counsel_escalation.reason).not.toContain('every listed approval is recorded');
    expect(memo.counsel_escalation.reason).toContain('depend');
    expect(memo.counsel_escalation.guidance).toContain('does not establish that');
  });

  it('reports a date it cannot read instead of silently skipping every check that uses it', () => {
    const memo = memoForRepurchaseNotice({termination_date: '03/15/2026', closing_date: '08/01/2026'});
    const unreadable = memo.unresolved_facts.filter((entry) => entry.id.includes('unreadable-date'));

    expect(unreadable.length).toBeGreaterThan(0);
    expect(unreadable.map((entry) => entry.evidence_fields).flat()).toContain('termination_date');
    expect(unreadable[0].severity).toBe('high');
  });

  it('rejects an ISO date that only parses by calendar rollover', () => {
    const memo = memoForRepurchaseNotice({closing_date: '2026-02-30'});
    expect(
      memo.unresolved_facts.some(
        (entry) => entry.id.includes('unreadable-date') && entry.evidence_fields.includes('closing_date')
      )
    ).toBe(true);
  });

  it('does not treat a signatory entry with a blank name as recorded approval evidence', () => {
    const templateId = 'openagreements-founder-separation-board-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        vacancy_action: 'reduce-board-size',
        director_signatories: [{name: ''}],
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    const approval = memo.approvals.find((entry) => entry.id.endsWith('board-written-consent'));
    expect(approval?.status).toBe('not_recorded');
    expect(
      memo.unresolved_facts.some((entry) => entry.id.includes('unnamed-entries-director_signatories'))
    ).toBe(true);
  });

  it('counts directors from the structured entries, not from comma-separated display text', () => {
    const templateId = 'openagreements-founder-separation-board-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        vacancy_action: 'reduce-board-size',
        board_size_after: 2,
        // A comma INSIDE a name previously split into a third director.
        director_signatories: [{name: 'Rivera, Alex'}, {name: 'Priya Shah'}],
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    expect(memo.unresolved_facts.some((entry) => entry.id.endsWith('board-size-vs-signatories'))).toBe(false);
  });

  it('keeps the conditions the consent documents actually state in the branch prose', () => {
    const templateId = 'openagreements-founder-separation-board-consent';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        consent_date: '2026-03-16',
        founder_name: 'Maya Chen',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        vacancy_action: 'reduce-board-size',
        director_signatories: [{name: 'Alex Rivera'}],
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    const vacancy = memo.branch_decisions.find((entry) => entry.field === 'vacancy_action');
    // Option A in the document is expressly conditioned on the charter amendment
    // required to effect the reduction having become effective.
    expect(vacancy?.consequence).toContain('certificate of incorporation required to effect the reduction');
  });

  it('does not claim the status of claims outside the agreement when no release is included', () => {
    const templateId = 'openagreements-founder-stock-repurchase-agreement';
    const memo = generateFounderMemo({
      templateId,
      templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
      values: {
        company_legal_name: 'Nimbus Forge, Inc.',
        founder_name: 'Maya Chen',
        rspa_reference: 'Restricted Stock Purchase Agreement dated January 12, 2024',
        shares_repurchased: '3,300,000 shares of Common Stock',
        aggregate_price: '$330.00',
        include_mutual_release: false,
      },
      generatedAt: '2026-09-08T00:00:00.000Z',
    });

    const release = memo.branch_decisions.find((entry) => entry.field === 'include_mutual_release');
    expect(release?.consequence).not.toContain('remain open');
    expect(release?.consequence).toContain('is not established by anything supplied to this tool');
  });

  it('refuses to generate a founder memo for a template outside the family', () => {
    const templateId = 'openagreements-employment-offer-letter';
    expect(isFounderTemplateId(templateId)).toBe(false);
    expect(() =>
      generateFounderMemo({
        templateId,
        templateMetadata: loadMetadata(mustFindTemplateDir(templateId)),
        values: {},
      })
    ).toThrow(/not in the founder separation family/);
  });
});
