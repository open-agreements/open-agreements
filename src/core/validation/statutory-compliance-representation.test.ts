import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.js';
import { checkStatutoryComplianceReps } from './template.js';

const it = itAllure.epic('Compliance & Governance');

const FIELD = {
  name: 'notice_confirmed',
  statutory_compliance_representation: true as const,
  authority_url: 'https://www.flsenate.gov/Laws/Statutes/2025/542.45',
};

// extractDocxText joins paragraph runs with '' and paragraphs with '\n', so the
// rendered confirm block looks like the negated marker, the bracket, then END-IF
// on consecutive lines.
function renderedConfirmText(url = FIELD.authority_url): string {
  return [
    'Employer advised Employee in writing of the right to seek counsel.',
    '{IF !notice_confirmed}',
    `[CONFIRM before signing: the required notice was actually given; see ${url}]`,
    '{END-IF}',
  ].join('\n');
}

describe('checkStatutoryComplianceReps', () => {
  it.openspec('OA-TMP-064')('passes when the {IF !field} + [CONFIRM …] bracket is present with a matching authority_url', () => {
    const errors: string[] = [];
    checkStatutoryComplianceReps(renderedConfirmText(), [FIELD], errors);
    expect(errors).toEqual([]);
  });

  it.openspec('OA-TMP-064')('fails when only {IF !field} is present without the CONFIRM bracket (legacy when=/omitted loophole)', () => {
    const errors: string[] = [];
    // Mimics the old when=/omitted output: {IF !field} exists but no bracket.
    const legacy = 'Body.\n{IF !notice_confirmed}\n[Intentionally Omitted.]\n{END-IF}';
    checkStatutoryComplianceReps(legacy, [FIELD], errors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/must be gated by a clause confirm=/);
  });

  it.openspec('OA-TMP-064')('fails when the bracket URL drifts from the metadata authority_url', () => {
    const errors: string[] = [];
    checkStatutoryComplianceReps(renderedConfirmText('https://example.com/wrong'), [FIELD], errors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/does not match the URL in its rendered \[CONFIRM …\] bracket/);
  });

  it.openspec('OA-TMP-064')('fails when the bracket URL has an extra suffix (equality, not substring)', () => {
    const errors: string[] = [];
    checkStatutoryComplianceReps(renderedConfirmText(`${FIELD.authority_url}-extra`), [FIELD], errors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/does not match the URL/);
  });

  it.openspec('OA-TMP-064')('fails when the body is gated by an affirmative {IF field} (legacy when=/omitted spoof)', () => {
    const errors: string[] = [];
    // A legacy when=/omitted clause wraps the body in {IF field} and could put a
    // look-alike bracket (with the right URL) in omitted="…". The affirmative
    // conditional proves the body is NOT unconditional.
    const spoof = [
      '{IF notice_confirmed}',
      'Employer advised Employee in writing of the right to seek counsel.',
      '{END-IF}',
      '{IF !notice_confirmed}',
      `[CONFIRM before signing: spoof; see ${FIELD.authority_url}]`,
      '{END-IF}',
    ].join('\n');
    checkStatutoryComplianceReps(spoof, [FIELD], errors);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/must use confirm= \(the recital body always renders\)/);
  });

  it.openspec('OA-TMP-064')('tolerates a literal "]" inside the confirm_note', () => {
    const errors: string[] = [];
    const withBracketNote = [
      'Body.',
      '{IF !notice_confirmed}',
      `[CONFIRM before signing: the advisal [memo] was given; see ${FIELD.authority_url}]`,
      '{END-IF}',
    ].join('\n');
    checkStatutoryComplianceReps(withBracketNote, [FIELD], errors);
    expect(errors).toEqual([]);
  });

  it.openspec('OA-TMP-064')('is a no-op when no field is a statutory_compliance_representation', () => {
    const errors: string[] = [];
    checkStatutoryComplianceReps('any text', [{ name: 'ordinary_flag' }], errors);
    expect(errors).toEqual([]);
  });
});
