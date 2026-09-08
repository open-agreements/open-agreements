/**
 * Founder-separation companion memo.
 *
 * Every `--memo` attempt against a founder template used to fail as
 * "employment-only" (legal-explainer#2572), so a user filling a founder
 * separation package got the documents and nothing that recorded WHICH source
 * records the package leaned on, WHICH branch of each optional provision was
 * taken, WHAT was still unresolved, or WHICH approvals the package still
 * needed. This module produces that companion.
 *
 * Two rules govern what this memo may say.
 *
 * 1. It is operational information, never legal advice. It reuses the same
 *    `../memo/advice-language.js` guard the employment memo established, and
 *    asserts on the finished artifact that no prescriptive phrasing survived.
 *
 * 2. It reports only what the fill values and the template metadata actually
 *    establish. OpenAgreements never receives the RSPA, the CIIAA, the charter,
 *    the stock ledger, or a certificate image — a founder fill supplies figures
 *    ABOUT those records, not the records. So a share count in the values is
 *    recorded as ASSERTED and listed as unresolved until reconciled against the
 *    original; the memo never claims a vesting schedule reconciles. That
 *    restraint is the point: a package whose unvested-share figure cannot be
 *    derived from anything supplied is exactly what an unresolved-facts section
 *    exists to surface.
 */

import { type TemplateMetadata } from '../metadata.js';
import {
  applyAdviceLanguageGuard,
  assertMemoArtifactHasNoProhibitedAdviceLanguage,
} from '../memo/advice-language.js';
import { resolveMemoDispatch } from '../memo/families.js';

export type FounderMemoFormat = 'json' | 'markdown' | 'both';
export type FounderUnresolvedSeverity = 'low' | 'medium' | 'high';
export type FounderApprovalStatus =
  | 'recorded_in_values'
  | 'not_recorded'
  | 'depends_on_records_not_supplied';

export interface FounderSourceDocument {
  id: string;
  label: string;
  /** Field whose value cites the record, when the citation came from a field. */
  cited_by_field?: string;
  /** The citation text exactly as the fill supplied it. */
  cited_as?: string;
  /** Always false: a fill supplies facts about these records, never the records. */
  supplied_to_this_tool: false;
  dependency_note: string;
}

export interface FounderBranchDecision {
  id: string;
  field: string;
  selected: string;
  available_options: string[];
  options_not_selected: string[];
  consequence: string;
  /** Other templates in the package that read the same field and must agree. */
  must_match_in?: string[];
}

export interface FounderUnresolvedFact {
  id: string;
  severity: FounderUnresolvedSeverity;
  summary: string;
  evidence_fields: string[];
  follow_up_question: string;
}

export interface FounderApproval {
  id: string;
  approval: string;
  status: FounderApprovalStatus;
  evidence_fields: string[];
  note: string;
}

export interface FounderMemoCounselEscalation {
  escalation_recommended: boolean;
  reason: string;
  high_severity_ids: string[];
  /** Approvals whose authority rests on records this tool never received. */
  outstanding_approval_dependency_ids: string[];
  guidance: string;
  follow_up_questions: string[];
}

export interface FounderMemo {
  memo_version: string;
  generated_at: string;
  template_id: string;
  matter_family: 'founder-separation';
  document_name: string;
  disclaimer: string;
  source_documents: FounderSourceDocument[];
  branch_decisions: FounderBranchDecision[];
  unresolved_facts: FounderUnresolvedFact[];
  approvals: FounderApproval[];
  counsel_escalation: FounderMemoCounselEscalation;
}

export interface GenerateFounderMemoOptions {
  templateId: string;
  templateMetadata: TemplateMetadata;
  values: Record<string, unknown>;
  generatedAt?: string;
}

const MEMO_VERSION = '1.0.0';

export const FOUNDER_MEMO_DISCLAIMER =
  'This founder separation memo provides operational information about template fields, the records those fields cite, and the branch choices taken in this fill. It is not legal advice, does not recommend legal strategy, and does not predict legal outcomes. Consult a licensed attorney for legal advice.';

/**
 * Fields whose value is a citation to a governing record the fill does not
 * supply. Each becomes a source-document entry and an unresolved fact: the
 * document was named, not read.
 */
const SOURCE_DOCUMENT_FIELDS: Record<string, { id: string; label: string }> = {
  rspa_reference: {
    id: 'restricted-stock-purchase-agreement',
    label: 'Restricted Stock Purchase Agreement',
  },
  ciiaa_reference: {
    id: 'ciiaa',
    label: 'Confidential Information and Invention Assignment Agreement',
  },
  certificate_number: { id: 'stock-certificate', label: 'Stock certificate' },
  certificate_numbers: { id: 'stock-certificates', label: 'Stock certificate(s)' },
  original_certificate_number: {
    id: 'original-stock-certificate',
    label: 'Original stock certificate',
  },
  replacement_certificate_number: {
    id: 'replacement-stock-certificate',
    label: 'Replacement stock certificate',
  },
  minute_book_location: { id: 'minute-book', label: 'Corporate minute book and records' },
  cap_table_system: { id: 'cap-table-system', label: 'Capitalization table system of record' },
};

/**
 * Records the family structurally depends on but no field cites. These are
 * listed as dependencies to confirm, never as documents asserted to exist.
 */
const IMPLICIT_SOURCE_DEPENDENCIES: Record<
  string,
  Array<{ id: string; label: string; dependency_note: string }>
> = {
  'openagreements-founder-separation-board-consent': [
    {
      id: 'charter-and-bylaws',
      label: 'Certificate of incorporation and bylaws',
      dependency_note:
        'Board size, vacancy mechanics, and written-consent authority come from the charter and bylaws. Neither is supplied to this tool; confirm the board action taken here is permitted by the originals before execution.',
    },
  ],
  'openagreements-founder-separation-stockholder-consent': [
    {
      id: 'charter-and-bylaws',
      label: 'Certificate of incorporation and bylaws',
      dependency_note:
        'Stockholder written-consent authority, the required vote, and any charter amendment mechanics come from the charter and bylaws. Neither is supplied to this tool; confirm against the originals before execution.',
    },
    {
      id: 'stock-ledger',
      label: 'Stock ledger',
      dependency_note:
        'Whether the listed stockholder signatories hold the shares needed to act by written consent depends on the stock ledger, which is not supplied to this tool.',
    },
  ],
  'openagreements-founder-stock-repurchase-agreement': [
    {
      id: 'spousal-consent',
      label: 'Spousal consent to the Restricted Stock Purchase Agreement, if one was taken',
      dependency_note:
        'Whether a spousal consent was taken with the Restricted Stock Purchase Agreement, and whether it reaches this repurchase, is not established by any value supplied to this tool. Confirm from the original agreement and its attachments.',
    },
  ],
  'openagreements-founder-stock-assignment-separate': [
    {
      id: 'stock-ledger',
      label: 'Stock ledger',
      dependency_note:
        'The shares this assignment transfers must match the ledger and the certificate it is separate from. Neither is supplied to this tool.',
    },
  ],
  'openagreements-founder-separation-cap-table-update-instructions': [
    {
      id: 'stock-ledger',
      label: 'Stock ledger',
      dependency_note:
        'The certificate numbers and share counts these instructions cancel must match the ledger, which is not supplied to this tool.',
    },
  ],
};

/**
 * Share-count fields. Each carries a figure that is ASSERTED by the fill and
 * cannot be derived from anything supplied — the vesting schedule that produces
 * it lives in the Restricted Stock Purchase Agreement. The memo records the
 * figure and the dependency; it never states that the figure reconciles.
 */
const ASSERTED_SHARE_FIGURE_FIELDS = [
  'unvested_share_count',
  'shares_repurchased',
  'shares_assigned',
  'shares_cancelled',
  'original_certificate_share_count',
  'repurchased_share_count',
  'retained_share_count',
  'aggregate_price',
  'repurchase_price_per_share',
] as const;

interface BranchSpec {
  field: string;
  consequences: Record<string, string>;
  mustMatchIn?: string[];
}

const BRANCH_SPECS: Record<string, BranchSpec[]> = {
  'openagreements-founder-separation-board-consent': [
    {
      field: 'vacancy_action',
      consequences: {
        'reduce-board-size':
          'The consent reduces the authorized number of directors, conditioned on any amendment to the certificate of incorporation required to effect the reduction having become effective. It appoints no one to the seat the founder vacated. Whether that amendment exists or is effective is not established by anything supplied to this tool.',
        'appoint-replacement':
          'The consent appoints a named replacement director to the vacated seat under section 223 of the Delaware General Corporation Law, to hold office until the next election of directors and until a successor is elected and qualified. The authorized number of directors is unchanged.',
        'leave-vacant':
          'The consent leaves the vacated seat open, to be filled in accordance with the certificate of incorporation, the bylaws, and applicable law. The authorized number of directors is unchanged, so the board operates below it until the seat is filled.',
      },
    },
    {
      field: 'share_disposition',
      consequences: {
        'cancelled-retired':
          'Repurchased shares are cancelled and retired, returning to the pool of authorized but unissued shares.',
        'held-as-treasury':
          'Repurchased shares are held as treasury shares rather than retired, so they remain issued.',
      },
      mustMatchIn: ['openagreements-founder-separation-cap-table-update-instructions'],
    },
  ],
  'openagreements-founder-separation-cap-table-update-instructions': [
    {
      field: 'share_disposition',
      consequences: {
        'cancelled-retired':
          'The instructions direct that repurchased shares be cancelled and retired in the cap-table system.',
        'held-as-treasury':
          'The instructions direct that repurchased shares be recorded as treasury shares rather than retired.',
      },
      mustMatchIn: ['openagreements-founder-separation-board-consent'],
    },
  ],
  'openagreements-founder-separation-stockholder-consent': [
    {
      field: 'stockholder_action',
      consequences: {
        'remove-director':
          'The consent removes a named director under section 141(k) of the Delaware General Corporation Law and provides that the resulting vacancy is addressed under the certificate of incorporation, the bylaws, and Delaware law. It does not itself fill the vacancy.',
        'amend-charter-board-size':
          'The consent adopts and approves an amendment to the certificate of incorporation fixing the authorized number of directors, in substantially the form presented to the stockholders, and authorizes officers to execute and file a certificate of amendment with the Delaware Secretary of State. That amendment is a separate document not supplied to this tool, and this consent alone does not make it effective.',
        other:
          'A generic stockholder-reserved action is approved and officers are authorized to effect it. The specific action is not constrained by the template, so what was approved depends entirely on the description the drafter supplied.',
      },
    },
  ],
  'openagreements-founder-stock-repurchase-agreement': [
    {
      field: 'include_mutual_release',
      consequences: {
        true: 'A mutual release is included, so the agreement disposes of claims within the release scope stated in the fill, beyond the share repurchase itself.',
        false:
          'No release is included, so this agreement disposes of the share repurchase only and releases no claims. Whether any claims exist between the company and the founder, and whether another document releases them, is not established by anything supplied to this tool.',
      },
    },
  ],
};

/**
 * Conditional dependencies: when `field` holds one of `whenValueIn`, the
 * `requires` field must be filled or the package is incomplete.
 */
const CONDITIONAL_REQUIREMENTS: Record<
  string,
  Array<{ field: string; whenValueIn: string[]; requires: string; summary: string }>
> = {
  'openagreements-founder-separation-board-consent': [
    {
      field: 'vacancy_action',
      whenValueIn: ['appoint-replacement'],
      requires: 'replacement_director_name',
      summary:
        'vacancy_action selects appoint-replacement but replacement_director_name is blank, so the consent appoints no one.',
    },
  ],
  'openagreements-founder-separation-stockholder-consent': [
    {
      field: 'stockholder_action',
      whenValueIn: ['remove-director'],
      requires: 'removed_director_name',
      summary:
        'stockholder_action selects remove-director but removed_director_name is blank, so the consent names no director to remove.',
    },
  ],
  'openagreements-founder-stock-repurchase-agreement': [
    {
      field: 'include_mutual_release',
      whenValueIn: ['true'],
      requires: 'release_scope',
      summary:
        'include_mutual_release is true but release_scope is blank, so the scope of the released claims is undefined.',
    },
  ],
};

interface ApprovalSpec {
  id: string;
  approval: string;
  evidenceFields: string[];
  recordedNote: string;
  missingNote: string;
}

const APPROVAL_SPECS: Record<string, ApprovalSpec[]> = {
  'openagreements-founder-separation-board-consent': [
    {
      id: 'board-written-consent',
      approval: 'Board approval by unanimous written consent',
      evidenceFields: ['director_signatories'],
      recordedNote:
        'Director signatories are recorded in the fill. Whether they are the full board entitled to act by written consent depends on the charter, bylaws, and board records, none of which are supplied to this tool.',
      missingNote:
        'No director signatories are recorded, so the consent has no signature block content and cannot evidence board approval as filled.',
    },
  ],
  'openagreements-founder-separation-stockholder-consent': [
    {
      id: 'stockholder-written-consent',
      approval: 'Stockholder approval by written consent',
      evidenceFields: ['stockholder_signatories'],
      recordedNote:
        'Stockholder signatories are recorded in the fill. Whether they hold the shares needed for the required vote depends on the stock ledger, which is not supplied to this tool.',
      missingNote:
        'No stockholder signatories are recorded, so the consent cannot evidence stockholder approval as filled.',
    },
  ],
  'openagreements-founder-stock-repurchase-agreement': [
    {
      id: 'company-signatory',
      approval: 'Company execution by an authorized officer',
      evidenceFields: ['signatory_name', 'signatory_title'],
      recordedNote:
        'A company signatory and title are recorded. Signing authority for this transaction depends on the charter, bylaws, and any board delegation, none of which are supplied to this tool.',
      missingNote: 'No company signatory or title is recorded for execution.',
    },
  ],
  'openagreements-founder-share-repurchase-notice': [
    {
      id: 'company-signatory',
      approval: 'Company execution of the repurchase election by an authorized officer',
      evidenceFields: ['signatory_name', 'signatory_title'],
      recordedNote:
        'A company signatory and title are recorded. Whether the election itself required prior board authorization depends on the Restricted Stock Purchase Agreement, which is not supplied to this tool.',
      missingNote: 'No company signatory or title is recorded for the election notice.',
    },
  ],
  'openagreements-founder-separation-cap-table-update-instructions': [
    {
      id: 'instructing-officer',
      approval: 'Instructions given by an authorized officer',
      evidenceFields: ['signatory_name', 'signatory_title'],
      recordedNote: 'An instructing officer and title are recorded.',
      missingNote: 'No instructing officer or title is recorded.',
    },
  ],
  'openagreements-founder-separation-records-checklist': [
    {
      id: 'certifying-officer',
      approval: 'Officer certification of the records filing',
      evidenceFields: ['certifying_officer_name', 'certifying_officer_title'],
      recordedNote: 'A certifying officer and title are recorded.',
      missingNote: 'No certifying officer or title is recorded.',
    },
  ],
  'openagreements-founder-ip-confidentiality-confirmation': [
    {
      id: 'company-signatory',
      approval: 'Company execution by an authorized officer',
      evidenceFields: ['signatory_name', 'signatory_title'],
      recordedNote: 'A company signatory and title are recorded.',
      missingNote: 'No company signatory or title is recorded.',
    },
  ],
  // The founder signs these two alone; no company approval is taken. The
  // profile exists so the memo says that in terms rather than emitting an empty
  // Approvals section, which reads as "nothing was required".
  'openagreements-founder-separation-resignation-letter': [
    {
      id: 'founder-signature',
      approval: 'Founder signature. No company approval is taken by this document',
      evidenceFields: ['founder_name'],
      recordedNote:
        'The founder is named as the signer. This document is the founder\'s own act; the board and stockholder actions that respond to the resignation are separate documents in the package.',
      missingNote: 'No founder is named, so the letter has no signer.',
    },
  ],
  'openagreements-founder-stock-assignment-separate': [
    {
      id: 'founder-signature',
      approval: 'Founder signature. No company approval is taken by this document',
      evidenceFields: ['founder_name'],
      recordedNote:
        'The founder is named as the assignor. Whether a signature guarantee or a spousal consent is also needed depends on the certificate, the ledger, and the underlying purchase agreement, none of which are supplied to this tool.',
      missingNote: 'No founder is named, so the assignment has no assignor.',
    },
    {
      id: 'attorney-in-fact',
      approval: 'Appointment of an attorney-in-fact to transfer the shares on the books',
      evidenceFields: ['attorney_in_fact'],
      recordedNote:
        'An attorney-in-fact is named to effect the transfer on the corporate books.',
      missingNote:
        'No attorney-in-fact is named, so the assignment identifies no one authorized to transfer the shares on the books.',
    },
  ],
};

/**
 * Templates the founder memo has an authored approval profile for. A founder
 * template that ships without one still produces a memo, but without the
 * approval section the family exists to provide — so
 * `integration-tests/memo-families.test.ts` asserts this covers every installed
 * founder template, and a new one fails the gate until its profile is written.
 */
export function founderTemplateIdsWithApprovalProfile(): string[] {
  return Object.keys(APPROVAL_SPECS).sort((left, right) => left.localeCompare(right));
}

export function isFounderTemplateId(templateId: string): boolean {
  return resolveMemoDispatch(templateId)?.family === 'founder-separation';
}

export function generateFounderMemo(options: GenerateFounderMemoOptions): FounderMemo {
  if (!isFounderTemplateId(options.templateId)) {
    throw new Error(
      `Template "${options.templateId}" is not in the founder separation family and cannot produce a founder memo.`
    );
  }

  const { values: fieldValues, arrays: arrayEvidence } = resolveFounderFieldValues(
    options.templateMetadata,
    options.values
  );

  const sourceDocuments = buildSourceDocuments(options.templateId, fieldValues);
  const branchDecisions = buildBranchDecisions(options.templateId, options.templateMetadata, fieldValues);
  const unresolvedFacts = buildUnresolvedFacts({
    templateId: options.templateId,
    templateMetadata: options.templateMetadata,
    fieldValues,
    arrayEvidence,
  });
  const approvals = buildApprovals(options.templateId, fieldValues);

  const memo: FounderMemo = {
    memo_version: MEMO_VERSION,
    generated_at: options.generatedAt ?? new Date().toISOString(),
    template_id: options.templateId,
    matter_family: 'founder-separation',
    document_name: options.templateMetadata.name,
    disclaimer: FOUNDER_MEMO_DISCLAIMER,
    source_documents: sourceDocuments.map((entry) => ({
      ...entry,
      dependency_note: applyAdviceLanguageGuard(entry.dependency_note),
    })),
    branch_decisions: branchDecisions.map((entry) => ({
      ...entry,
      consequence: applyAdviceLanguageGuard(entry.consequence),
    })),
    unresolved_facts: unresolvedFacts.map((entry) => ({
      ...entry,
      summary: applyAdviceLanguageGuard(entry.summary),
      follow_up_question: applyAdviceLanguageGuard(entry.follow_up_question),
    })),
    approvals: approvals.map((entry) => ({ ...entry, note: applyAdviceLanguageGuard(entry.note) })),
    counsel_escalation: buildFounderCounselEscalation(unresolvedFacts, approvals),
  };

  // Walks the finished artifact rather than a hand-listed set of sections: a
  // citation echoed back from a field value is emitted too, and was previously
  // unchecked.
  assertMemoArtifactHasNoProhibitedAdviceLanguage(memo);
  return memo;
}

/**
 * Normalize a fill's values against the template's declared fields. Booleans
 * and numbers become their literal text; an array becomes a count-bearing
 * summary so an empty signatory list is distinguishable from an absent one.
 */
interface ArrayFieldEvidence {
  /** How many entries the fill supplied, usable or not. */
  supplied: number;
  /** Entries that actually carry a name. Only these count as evidence. */
  usableNames: string[];
}

interface ResolvedFounderValues {
  values: Record<string, string>;
  /** Structured view of array-valued fields, keyed by field name. */
  arrays: Record<string, ArrayFieldEvidence>;
}

function resolveFounderFieldValues(
  metadata: TemplateMetadata,
  values: Record<string, unknown>
): ResolvedFounderValues {
  const resolved: Record<string, string> = {};
  const arrays: Record<string, ArrayFieldEvidence> = {};

  for (const field of metadata.fields) {
    const value = values[field.name];

    if (typeof value === 'boolean') {
      resolved[field.name] = value ? 'true' : 'false';
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      resolved[field.name] = String(value);
      continue;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      resolved[field.name] = value.trim();
      continue;
    }
    if (Array.isArray(value)) {
      const evidence = summarizeArrayValue(value);
      arrays[field.name] = evidence;
      // An entry with no usable name is NOT evidence that a signatory exists.
      // Falling back to a bare count let `[{name: ''}]` read as a recorded
      // approval.
      resolved[field.name] = evidence.usableNames.join(', ');
      continue;
    }
    if (typeof field.default === 'string' && field.default.trim().length > 0) {
      resolved[field.name] = field.default.trim();
      continue;
    }
    resolved[field.name] = '';
  }

  return { values: resolved, arrays };
}

function summarizeArrayValue(value: unknown[]): ArrayFieldEvidence {
  const usableNames = value
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && 'name' in entry) {
        const name = (entry as { name?: unknown }).name;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter((entry) => entry.length > 0);

  return { supplied: value.length, usableNames };
}

function buildSourceDocuments(
  templateId: string,
  fieldValues: Record<string, string>
): FounderSourceDocument[] {
  const documents: FounderSourceDocument[] = [];

  for (const [fieldName, spec] of Object.entries(SOURCE_DOCUMENT_FIELDS)) {
    const cited = fieldValues[fieldName];
    if (cited === undefined || cited.length === 0) continue;
    documents.push({
      id: spec.id,
      label: spec.label,
      cited_by_field: fieldName,
      cited_as: cited,
      supplied_to_this_tool: false,
      dependency_note:
        `This document is cited by ${fieldName} but is not supplied to this tool. Every figure and term this fill takes from it is asserted, not verified. Condition execution on review of the original.`,
    });
  }

  for (const implicit of IMPLICIT_SOURCE_DEPENDENCIES[templateId] ?? []) {
    documents.push({
      id: implicit.id,
      label: implicit.label,
      supplied_to_this_tool: false,
      dependency_note: implicit.dependency_note,
    });
  }

  return documents;
}

function buildBranchDecisions(
  templateId: string,
  metadata: TemplateMetadata,
  fieldValues: Record<string, string>
): FounderBranchDecision[] {
  const decisions: FounderBranchDecision[] = [];
  const fieldByName = new Map(metadata.fields.map((field) => [field.name, field]));

  for (const spec of BRANCH_SPECS[templateId] ?? []) {
    const field = fieldByName.get(spec.field);
    if (!field) continue;

    const selected = fieldValues[spec.field] ?? '';
    const availableOptions = field.options && field.options.length > 0
      ? [...field.options].map((option) => String(option))
      : Object.keys(spec.consequences);

    const consequence = selected.length === 0
      ? `No value is selected for ${spec.field}, so the branch this document takes is undetermined.`
      : spec.consequences[selected]
        ?? `Value "${selected}" is selected for ${spec.field}. It is not one of the branch values this memo describes, so the rendered branch is not characterized here.`;

    decisions.push({
      id: `branch-${templateId}-${spec.field}`,
      field: spec.field,
      selected: selected.length === 0 ? '<empty>' : selected,
      available_options: availableOptions,
      options_not_selected: availableOptions.filter((option) => option !== selected),
      consequence:
        `${consequence} The options not selected are recorded here so the elected branch is unambiguous on review; this memo does not characterize how the rendered document lays the options out.`,
      must_match_in: spec.mustMatchIn,
    });
  }

  return decisions;
}

function buildUnresolvedFacts(args: {
  templateId: string;
  templateMetadata: TemplateMetadata;
  fieldValues: Record<string, string>;
  arrayEvidence: Record<string, ArrayFieldEvidence>;
}): FounderUnresolvedFact[] {
  const facts: FounderUnresolvedFact[] = [];
  const { templateId, templateMetadata, fieldValues, arrayEvidence } = args;

  for (const fieldName of templateMetadata.priority_fields) {
    if ((fieldValues[fieldName] ?? '').length > 0) continue;
    facts.push({
      id: `unresolved-${templateId}-blank-${fieldName}`,
      severity: 'high',
      summary: `Priority field ${fieldName} is blank, so the document renders without a term the template treats as required.`,
      evidence_fields: [fieldName],
      follow_up_question: `Can the party responsible for this package supply ${fieldName} before execution?`,
    });
  }

  for (const requirement of CONDITIONAL_REQUIREMENTS[templateId] ?? []) {
    const gate = fieldValues[requirement.field] ?? '';
    if (!requirement.whenValueIn.includes(gate)) continue;
    if ((fieldValues[requirement.requires] ?? '').length > 0) continue;
    facts.push({
      id: `unresolved-${templateId}-conditional-${requirement.requires}`,
      severity: 'high',
      summary: requirement.summary,
      evidence_fields: [requirement.field, requirement.requires],
      follow_up_question: `Can the party responsible for this package supply ${requirement.requires}, or select a different ${requirement.field}?`,
    });
  }

  for (const fieldName of ASSERTED_SHARE_FIGURE_FIELDS) {
    const value = fieldValues[fieldName];
    if (value === undefined || value.length === 0) continue;
    facts.push({
      id: `unresolved-${templateId}-asserted-${fieldName}`,
      severity: 'high',
      summary:
        `${fieldName} is recorded as "${value}". This figure is asserted by the fill, not derived from any record supplied to this tool: the vesting schedule, price, and share totals that produce it live in the Restricted Stock Purchase Agreement and the stock ledger. This memo does not state that the figure reconciles.`,
      evidence_fields: [fieldName],
      follow_up_question: `Can ${fieldName} be reconciled against the vesting schedule in the original Restricted Stock Purchase Agreement and the stock ledger before execution?`,
    });
  }

  // A date the memo cannot read is reported. Previously an input like
  // "03/15/2026" was accepted by the fill and then silently skipped by every
  // date check, so the memo looked as though it had assessed the window.
  for (const field of templateMetadata.fields) {
    if (field.type !== 'date') continue;
    const value = fieldValues[field.name] ?? '';
    if (value.length === 0) continue;
    if (parseIsoDate(value) !== undefined) continue;
    facts.push({
      id: `unresolved-${templateId}-unreadable-date-${field.name}`,
      severity: 'high',
      summary:
        `${field.name} is recorded as "${value}", which this memo cannot read as a calendar date (expected YYYY-MM-DD). Every date check that depends on ${field.name} was skipped, so no timing in this document has been assessed against it.`,
      evidence_fields: [field.name],
      follow_up_question: `Can ${field.name} be restated as a YYYY-MM-DD date so the timing checks can run?`,
    });
  }

  // An array field whose entries carry no usable name is not evidence.
  for (const [fieldName, evidence] of Object.entries(arrayEvidence)) {
    if (evidence.supplied === 0 || evidence.usableNames.length > 0) continue;
    facts.push({
      id: `unresolved-${templateId}-unnamed-entries-${fieldName}`,
      severity: 'high',
      summary:
        `${fieldName} was supplied with ${evidence.supplied} entr${evidence.supplied === 1 ? 'y' : 'ies'}, none of which carries a name. The document has no one to name, and this memo treats the field as recording no one.`,
      evidence_fields: [fieldName],
      follow_up_question: `Which names belong in ${fieldName}?`,
    });
  }

  facts.push(...buildRepurchaseWindowFacts(templateId, fieldValues));

  const boardSizeFact = buildBoardSizeFact(templateId, fieldValues, arrayEvidence);
  if (boardSizeFact) facts.push(boardSizeFact);

  return facts;
}

/**
 * The repurchase election window is the one interval this family states
 * arithmetically: the RSPA gives the company `repurchase_window_days` after
 * `termination_date` to elect. Both, plus `closing_date`, are supplied on the
 * election notice, so the ordering is checkable without any external record —
 * and the window LENGTH itself still comes from the RSPA, which is not.
 */
function buildRepurchaseWindowFacts(
  templateId: string,
  fieldValues: Record<string, string>
): FounderUnresolvedFact[] {
  const facts: FounderUnresolvedFact[] = [];
  const terminationDate = parseIsoDate(fieldValues.termination_date);
  const closingDate = parseIsoDate(fieldValues.closing_date);
  const windowDays = parseNonNegativeInteger(fieldValues.repurchase_window_days);

  if (terminationDate && closingDate && closingDate.getTime() < terminationDate.getTime()) {
    facts.push({
      id: `unresolved-${templateId}-closing-before-termination`,
      severity: 'high',
      summary:
        `closing_date (${fieldValues.closing_date}) precedes termination_date (${fieldValues.termination_date}), so the repurchase closes before the event that triggers it.`,
      evidence_fields: ['termination_date', 'closing_date'],
      follow_up_question: 'Which of the two dates is correct in the underlying records?',
    });
  }

  if (terminationDate && closingDate && windowDays !== undefined) {
    const deadline = new Date(terminationDate.getTime() + windowDays * 24 * 60 * 60 * 1000);
    if (closingDate.getTime() > deadline.getTime()) {
      facts.push({
        id: `unresolved-${templateId}-closing-outside-window`,
        severity: 'high',
        summary:
          `closing_date (${fieldValues.closing_date}) falls after the ${windowDays}-day window measured from termination_date (${fieldValues.termination_date}).`,
        evidence_fields: ['termination_date', 'closing_date', 'repurchase_window_days'],
        follow_up_question:
          'Does the Restricted Stock Purchase Agreement measure the repurchase window from a different date, or run it to election rather than closing?',
      });
    }
  }

  if (windowDays !== undefined) {
    facts.push({
      id: `unresolved-${templateId}-window-source`,
      severity: 'medium',
      summary:
        `The ${windowDays}-day repurchase window is taken from the fill, not from the Restricted Stock Purchase Agreement, which is not supplied to this tool. Whether the window runs to election or to closing is likewise not established here.`,
      evidence_fields: ['repurchase_window_days'],
      follow_up_question:
        'Does the original Restricted Stock Purchase Agreement state this window length and what it runs to?',
    });
  }

  return facts;
}

function buildBoardSizeFact(
  templateId: string,
  fieldValues: Record<string, string>,
  arrayEvidence: Record<string, ArrayFieldEvidence>
): FounderUnresolvedFact | undefined {
  if (templateId !== 'openagreements-founder-separation-board-consent') return undefined;
  const boardSizeAfter = parseNonNegativeInteger(fieldValues.board_size_after);
  if (boardSizeAfter === undefined) return undefined;

  // Counted from the structured entries. Splitting the rendered display string
  // on commas turned a director named "Rivera, Alex" into two directors.
  const signatoryCount = arrayEvidence.director_signatories?.usableNames.length ?? 0;

  if (signatoryCount === boardSizeAfter) return undefined;

  return {
    id: `unresolved-${templateId}-board-size-vs-signatories`,
    severity: 'medium',
    summary:
      `board_size_after is ${boardSizeAfter} but ${signatoryCount} director signator${signatoryCount === 1 ? 'y is' : 'ies are'} recorded. Whether the recorded signatories are the directors entitled to act depends on the board records and bylaws, which are not supplied to this tool.`,
    evidence_fields: ['board_size_after', 'director_signatories'],
    follow_up_question:
      'Do the board records show the recorded signatories as the directors in office at the consent date?',
  };
}

function buildApprovals(
  templateId: string,
  fieldValues: Record<string, string>
): FounderApproval[] {
  const approvals: FounderApproval[] = [];

  for (const spec of APPROVAL_SPECS[templateId] ?? []) {
    const filled = spec.evidenceFields.filter((fieldName) => (fieldValues[fieldName] ?? '').length > 0);
    const allFilled = filled.length === spec.evidenceFields.length;
    approvals.push({
      id: `approval-${templateId}-${spec.id}`,
      approval: spec.approval,
      status: allFilled ? 'recorded_in_values' : 'not_recorded',
      evidence_fields: spec.evidenceFields,
      note: allFilled ? spec.recordedNote : spec.missingNote,
    });
  }

  if (fieldValues.rspa_reference !== undefined && fieldValues.rspa_reference.length > 0) {
    approvals.push({
      id: `approval-${templateId}-rspa-authority`,
      approval:
        'Authority for the repurchase under the cited Restricted Stock Purchase Agreement',
      status: 'depends_on_records_not_supplied',
      evidence_fields: ['rspa_reference'],
      note:
        'The repurchase right, its price, and any consent it requires come from the cited Restricted Stock Purchase Agreement, which is not supplied to this tool. This memo records the citation, not the terms.',
    });
  }

  return approvals;
}

function buildFounderCounselEscalation(
  unresolvedFacts: FounderUnresolvedFact[],
  approvals: FounderApproval[]
): FounderMemoCounselEscalation {
  const highSeverityIds = unresolvedFacts
    .filter((fact) => fact.severity === 'high')
    .map((fact) => fact.id);
  const missingApprovalIds = approvals
    .filter((approval) => approval.status === 'not_recorded')
    .map((approval) => approval.id);
  const dependentApprovalIds = approvals
    .filter((approval) => approval.status === 'depends_on_records_not_supplied')
    .map((approval) => approval.id);

  const allIds = [...highSeverityIds, ...missingApprovalIds];
  const escalationRecommended = allIds.length > 0;

  // The summary must not contradict the approvals section. It previously read
  // "every listed approval is recorded" while an approval in the same memo was
  // marked depends_on_records_not_supplied. A recorded name and title is
  // evidence that the fill named a signatory, never evidence that anyone signed
  // or that the signer had authority.
  const dependencyNote = dependentApprovalIds.length > 0
    ? ` ${dependentApprovalIds.length} approval${dependentApprovalIds.length === 1 ? '' : 's'} in this memo `
      + `depend${dependentApprovalIds.length === 1 ? 's' : ''} on records not supplied to this tool and `
      + `remain${dependentApprovalIds.length === 1 ? 's' : ''} unverified.`
    : '';

  const recordedNote =
    ' A signatory recorded in the fill evidences only that the fill named one; it does not establish that '
    + 'the document was signed or that the signer had authority to sign it.';

  const reason = escalationRecommended
    ? `One or more unresolved facts are high severity or a required approval is not recorded.${dependencyNote}`
    : `No unresolved fact is high severity and no listed approval is missing from the fill.${dependencyNote}`;

  const guidance = escalationRecommended
    ? 'Unresolved facts or unrecorded approvals were detected. Share this informational memo, the fill values, '
      + 'and the cited source documents with licensed counsel before the package is executed.'
      + recordedNote
    : 'No high-severity unresolved fact and no missing approval were detected from the supplied values. The '
      + 'source documents this package cites were still not supplied to this tool and remain unverified.'
      + recordedNote;

  const followUps = [
    'Which of the cited source documents can be produced and reviewed before execution?',
    'Which unresolved figures need to be reconciled against the corporate records?',
  ];
  if (dependentApprovalIds.length > 0) {
    followUps.push(
      'Which of the approvals that depend on records not supplied here can be confirmed from the originals?'
    );
  }

  return {
    escalation_recommended: escalationRecommended,
    reason: applyAdviceLanguageGuard(reason),
    high_severity_ids: allIds,
    outstanding_approval_dependency_ids: dependentApprovalIds,
    guidance: applyAdviceLanguageGuard(guidance),
    follow_up_questions: followUps.map((question) => applyAdviceLanguageGuard(question)),
  };
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // `new Date('2026-02-30T00:00:00Z')` rolls over to March 2 rather than
  // failing. Round-tripping rejects a date that does not exist.
  return parsed.toISOString().slice(0, 10) === trimmed ? parsed : undefined;
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  return Number.parseInt(value.trim(), 10);
}

export function renderFounderMemoMarkdown(memo: FounderMemo): string {
  const lines: string[] = [];
  lines.push('# Founder Separation Companion Memo');
  lines.push('');
  lines.push(`- Memo version: ${memo.memo_version}`);
  lines.push(`- Generated at: ${memo.generated_at}`);
  lines.push(`- Template ID: ${memo.template_id}`);
  lines.push(`- Document: ${memo.document_name}`);
  lines.push(`- Matter family: ${memo.matter_family}`);
  lines.push('');
  lines.push('## Disclaimer');
  lines.push(memo.disclaimer);
  lines.push('');

  lines.push('## Source Documents Relied On');
  if (memo.source_documents.length === 0) {
    lines.push('This document cites no external record through its fields.');
  } else {
    lines.push('None of these records is supplied to this tool. Each entry records a dependency, not a verification.');
    lines.push('');
    for (const entry of memo.source_documents) {
      lines.push(`### ${entry.label}`);
      if (entry.cited_by_field) lines.push(`- Cited by field: ${entry.cited_by_field}`);
      if (entry.cited_as) lines.push(`- Cited as: ${entry.cited_as}`);
      lines.push(`- Supplied to this tool: no`);
      lines.push(`- Note: ${entry.dependency_note}`);
      lines.push('');
    }
  }
  lines.push('');

  lines.push('## Branch Decisions');
  if (memo.branch_decisions.length === 0) {
    lines.push('This document has no optional branch.');
  } else {
    for (const entry of memo.branch_decisions) {
      lines.push(`### ${entry.field}`);
      lines.push(`- Selected: ${entry.selected}`);
      lines.push(`- Available options: ${entry.available_options.join(', ')}`);
      lines.push(
        `- Not selected: ${entry.options_not_selected.length === 0 ? 'none' : entry.options_not_selected.join(', ')}`
      );
      lines.push(`- Consequence: ${entry.consequence}`);
      if (entry.must_match_in && entry.must_match_in.length > 0) {
        lines.push(`- Must match the same field in: ${entry.must_match_in.join(', ')}`);
      }
      lines.push('');
    }
  }
  lines.push('');

  lines.push('## Unresolved Facts');
  if (memo.unresolved_facts.length === 0) {
    lines.push('No unresolved fact was detected from the supplied values.');
  } else {
    for (const entry of memo.unresolved_facts) {
      lines.push(`### ${entry.id}`);
      lines.push(`- Severity: ${entry.severity}`);
      lines.push(`- Summary: ${entry.summary}`);
      lines.push(`- Evidence fields: ${entry.evidence_fields.join(', ')}`);
      lines.push(`- Follow-up: ${entry.follow_up_question}`);
      lines.push('');
    }
  }
  lines.push('');

  lines.push('## Approvals');
  if (memo.approvals.length === 0) {
    lines.push('This document records no approval.');
  } else {
    for (const entry of memo.approvals) {
      lines.push(`### ${entry.approval}`);
      lines.push(`- Status: ${entry.status}`);
      lines.push(`- Evidence fields: ${entry.evidence_fields.join(', ')}`);
      lines.push(`- Note: ${entry.note}`);
      lines.push('');
    }
  }
  lines.push('');

  lines.push('## Counsel Escalation');
  lines.push(`- Escalation recommended: ${memo.counsel_escalation.escalation_recommended ? 'yes' : 'no'}`);
  lines.push(`- Reason: ${memo.counsel_escalation.reason}`);
  lines.push(
    `- High-severity items: ${memo.counsel_escalation.high_severity_ids.length === 0 ? 'none' : memo.counsel_escalation.high_severity_ids.join(', ')}`
  );
  lines.push(
    `- Approvals depending on records not supplied: ${memo.counsel_escalation.outstanding_approval_dependency_ids.length === 0 ? 'none' : memo.counsel_escalation.outstanding_approval_dependency_ids.join(', ')}`
  );
  lines.push(`- Guidance: ${memo.counsel_escalation.guidance}`);
  lines.push('- Follow-up questions:');
  for (const question of memo.counsel_escalation.follow_up_questions) {
    lines.push(`  - ${question}`);
  }

  return lines.join('\n');
}
