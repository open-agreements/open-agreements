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
