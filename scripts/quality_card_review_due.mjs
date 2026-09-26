import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardPath = path.join(root, 'skills/legal-explainers/non-compete-contract-explainer/quality-card.json');

export function reviewDue(card, today = new Date()) {
  if (card.next_review_due === null) return null;
  const due = card.next_review_due;
  if (typeof due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    throw new Error(`invalid next_review_due: ${JSON.stringify(due)}`);
  }
  const dueMs = Date.parse(`${due}T00:00:00Z`);
  if (!Number.isFinite(dueMs) || new Date(dueMs).toISOString().slice(0, 10) !== due) {
    throw new Error(`invalid next_review_due: ${JSON.stringify(due)}`);
  }
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return {due, days_remaining: Math.round((dueMs - todayUtc) / 86_400_000)};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const result = reviewDue(card);
  if (result === null) {
    console.log(JSON.stringify({skill: card.skill, due: null, days_remaining: null}));
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify({skill: card.skill, ...result}));
    if (result.days_remaining <= 30) process.exitCode = 2;
  }
}
