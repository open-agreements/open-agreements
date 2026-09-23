import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {reviewDue} from '../scripts/quality_card_review_due.mjs';

const repoRoot = resolve(import.meta.dirname, '..');
const workflow = readFileSync(resolve(repoRoot, '.github/workflows/quality-card-review-due.yml'), 'utf8');
const shell = workflow.split('        run: |\n')[1]
  ?.split('\n')
  .map((line) => line.startsWith('          ') ? line.slice(10) : line)
  .join('\n');

function runWorkflow(mock: string) {
  if (!shell) throw new Error('quality-card workflow run block missing');
  return spawnSync('bash', ['-c', `${mock}\n${shell}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {...process.env, GH_TOKEN: 'fixture', GITHUB_STEP_SUMMARY: '/dev/null'},
  });
}

describe('quality card review due', () => {
  it('uses UTC calendar days across time zones and opens the window on day 30', () => {
    const card = {next_review_due: '2026-10-11'};
    expect(reviewDue(card, new Date('2026-09-11T23:59:59-07:00'))?.days_remaining).toBe(29);
    expect(reviewDue(card, new Date('2026-09-11T00:00:00Z'))?.days_remaining).toBe(30);
    expect(reviewDue(card, new Date('2026-10-12T00:00:00Z'))?.days_remaining).toBe(-1);
  });

  it('does not invent a due date and rejects impossible dates', () => {
    expect(reviewDue({next_review_due: null})).toBeNull();
    expect(() => reviewDue({next_review_due: '2026-02-30'})).toThrow('invalid next_review_due');
  });

  it('routes a missing date to the assigned issue', () => {
    const run = runWorkflow(`
      node() {
        if [ "$1" = scripts/quality_card_review_due.mjs ]; then
          printf '%s\\n' '{"skill":"non-compete-contract-explainer","due":null,"days_remaining":null}'
          return 2
        fi
        command node "$@"
      }
      gh() {
        if [ "$1 $2" = 'issue view' ]; then
          printf '%s\\n' '{"state":"OPEN","body":"<!-- oa-quality-card-review-due:non-compete-contract-explainer -->"}'
        elif [ "$1 $2" = 'issue edit' ]; then
          printf 'EDIT:%s\\n' "$*"
        else
          printf 'unexpected gh call\\n' >&2
          return 1
        fi
      }
    `);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('EDIT:issue edit 874');
    expect(run.stdout).toContain('review date missing');
    expect(run.stdout).toContain('--add-assignee stevenobiajulu');
  });

  it('does not edit or create when the issue lookup fails', () => {
    const run = runWorkflow(`
      gh() {
        if [ "$1 $2" = 'issue view' ]; then
          printf 'lookup failed\\n' >&2
          return 1
        fi
        printf 'UNEXPECTED_ISSUE_WRITE\\n' >&2
        return 1
      }
    `);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('lookup failed');
    expect(run.stderr).not.toContain('UNEXPECTED_ISSUE_WRITE');
  });
});
