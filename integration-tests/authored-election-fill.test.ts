import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect } from 'vitest';
import { fillTemplate } from '../src/core/engine.js';
import { itAllure } from './helpers/allure-test.js';

const it = itAllure.epic('Template Filling').withLabels({ feature: 'Authored Template Elections' });
const root = resolve(import.meta.dirname, '../templates/openagreements-cc-by-4.0');

async function filledText(slug: string, values: Record<string, unknown>): Promise<string> {
  const outputPath = join(mkdtempSync(join(tmpdir(), 'oa-election-')), 'filled.docx');
  await fillTemplate({ templateDir: join(root, slug), values, outputPath });
  return new AdmZip(outputPath).readAsText('word/document.xml').replace(/<[^>]+>/g, '');
}

describe('canonical authored template elections', () => {
  it('renders only the selected share disposition and board vacancy resolution', async () => {
    const text = await filledText('openagreements-founder-separation-board-consent', {
      share_disposition: 'held-as-treasury',
      disposition_cancels_and_retires: false,
      disposition_holds_as_treasury: true,
      vacancy_action: 'appoint-replacement',
      vacancy_reduces_board_size: false,
      vacancy_appoints_replacement: true,
      vacancy_left_open: false,
      replacement_director_name: 'Jordan Example',
      director_signatories: [],
    });
    expect(text).toContain('Treasury Holding of the Repurchased Shares');
    expect(text).toContain('Appointment of a Replacement Director');
    expect(text).toContain('Jordan Example');
    expect(text).not.toContain('Retirement of the Repurchased Shares');
    expect(text).not.toContain('Reduction of the Authorized Number of Directors');
    expect(text).not.toContain('Vacancy Left Open');
  });

  it('renders the retirement instruction without the treasury alternative', async () => {
    const text = await filledText('openagreements-founder-separation-cap-table-update-instructions', {
      share_disposition: 'cancelled-retired',
      disposition_cancels_and_retires: true,
      disposition_holds_as_treasury: false,
    });
    expect(text).toContain('Record the Shares as Cancelled and Retired');
    expect(text).not.toContain('Record the Shares as Held in Treasury');
  });

  it('omits both Nevada post-employment clauses while retaining assignment and statutory protections', async () => {
    const text = await filledText('openagreements-confidentiality-invention-assignment-agreement-nevada', {
      personnel_nonsolicit_included: false,
      future_employer_notice_included: false,
    });
    expect(text).not.toContain('No Solicitation of Company Personnel');
    expect(text).not.toContain('Notice to Future Employers');
    expect(text).toContain('Employee hereby assigns');
    expect(text).toContain('Defend Trade Secrets Act');
  });
});
