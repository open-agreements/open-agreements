#!/usr/bin/env node

const sampleRows = [
  {
    id: '01',
    question: '**Code reuse**: Does this PR introduce duplicated helper logic?',
    status: 'WARN',
    justification: 'Mock warning for harness output.',
    attempts: 1,
    estimated_input_tokens: 1000,
    estimated_output_tokens: 20,
    estimated_usd: '0.0004',
    model: 'gemini-3.5-flash',
  },
];

const icon = (status) => status === 'PASS' ? '✅' : (status === 'WARN' ? '⚠️' : '❓');
const escapePipes = (s) => String(s || '').replaceAll('|', '\\|').replaceAll('\n', ' ');

function titleOf(question) {
  const m = String(question || '').match(/^\*\*([^*]+)\*\*/);
  if (m) return m[1].trim();
  const q = String(question || '').replace(/\s+/g, ' ').trim();
  return q.length > 60 ? `${q.slice(0, 57)}…` : q;
}

function buildAuditComment(rows, labels, model = 'gemini-3.5-flash') {
  const totalUsd = rows.reduce((acc, r) => acc + parseFloat(r.estimated_usd || '0'), 0);
  const totalIn = rows.reduce((acc, r) => acc + (r.estimated_input_tokens || 0), 0);
  const totalOut = rows.reduce((acc, r) => acc + (r.estimated_output_tokens || 0), 0);
  const totalAttempts = rows.reduce((acc, r) => acc + (r.attempts || 1), 0);
  const warns = rows.filter(r => r.status === 'WARN').length;
  const passes = rows.filter(r => r.status === 'PASS').length;
  const overall = warns > 0 ? '⚠️ WARN' : (passes > 0 ? '✅ PASS' : '❓ NO RESULTS');
  const overrideActive = labels.includes('llm-gate/override');

  const header = '## LLM-Based Quality Gate — Post-Merge Audit';
  const overrideBanner = overrideActive
    ? '\n\n> ⚠️ This PR was merged with `llm-gate/override`; post-merge audit findings are shown for informational purposes.\n'
    : '';
  const summary = `**Overall:** ${overall} (${passes} pass · ${warns} warn · ${rows.length} total)`;
  const table = [
    '| | Check | Verdict |',
    '|---|---|---|',
    ...rows.map(r => `| ${icon(r.status)} | **${escapePipes(titleOf(r.question))}** | ${escapePipes(r.justification)} |`),
  ].join('\n');
  const retryNote = totalAttempts > rows.length ? ` · ${totalAttempts - rows.length} retry attempts` : '';
  const costLine = `_Estimated cost (this run): **$${totalUsd.toFixed(4)}** — ${totalIn.toLocaleString()} input + ${totalOut.toLocaleString()} output tokens (≈4 chars/token) on \`${model}\`${retryNote}. Char-count estimate, not provider telemetry._`;

  return `${header}${overrideBanner}\n\n${summary}\n\n${table}\n\n${costLine}`;
}

function simulateLookup(pulls, sha) {
  if (pulls.length === 0) {
    return {
      skipped: true,
      log: `No pull request is associated with commit ${sha}; skipping post-merge LLM audit.`,
    };
  }

  const pr = pulls[0];
  const labels = pr.labels.map(label => label.name);
  return {
    skipped: false,
    prNumber: pr.number,
    comment: buildAuditComment(sampleRows, labels),
  };
}

const scenarios = [
  {
    name: 'override label',
    pulls: [{ number: 322, labels: [{ name: 'llm-gate/override' }] }],
  },
  {
    name: 'standard merged PR',
    pulls: [{ number: 322, labels: [{ name: 'area/ci' }] }],
  },
  {
    name: 'no associated PR',
    pulls: [],
  },
];

for (const scenario of scenarios) {
  const result = simulateLookup(scenario.pulls, '7df5dff');
  console.log(`\nSCENARIO: ${scenario.name}`);
  if (result.skipped) {
    console.log(result.log);
  } else {
    console.log(`Would post on PR #${result.prNumber}`);
    console.log(result.comment.split('\n').slice(0, 8).join('\n'));
  }
}
