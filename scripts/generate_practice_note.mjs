/**
 * Generate a practice note for a state-specific restrictive covenant template.
 *
 * Reads wiki-export.json from the legal-context repo and outputs a deterministic
 * markdown practice note with YAML frontmatter. No LLM calls — every sentence
 * traces to a cited source.
 *
 * Usage:
 *   node scripts/generate_practice_note.mjs --topic non_compete --state WY
 *   LEGAL_CONTEXT_PATH=../legal-context node scripts/generate_practice_note.mjs --topic non_compete --state WY
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const UTM_PARAM = 'utm_source=usejunior.com';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let topic = '';
  let state = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) topic = args[++i];
    if (args[i] === '--state' && args[i + 1]) state = args[++i].toUpperCase();
  }
  if (!topic || !state) {
    console.error('Usage: node scripts/generate_practice_note.mjs --topic non_compete --state WY');
    process.exit(1);
  }
  return { topic, state };
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function loadWikiExport(topic, state) {
  const defaultPath = resolve(ROOT, '..', 'legal-context', 'data', 'wiki-export.json');
  const wikiPath = process.env.LEGAL_CONTEXT_PATH
    ? resolve(process.env.LEGAL_CONTEXT_PATH, 'data', 'wiki-export.json')
    : defaultPath;

  if (!existsSync(wikiPath)) {
    console.error(`Wiki export not found at ${wikiPath}`);
    console.error('Set LEGAL_CONTEXT_PATH env var or ensure ../legal-context/data/wiki-export.json exists.');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(wikiPath, 'utf-8'));
  const pages = data.pages || [];
  const page = pages.find((p) => p.topic === topic && p.state === state);
  if (!page) {
    console.error(`No wiki page found for topic=${topic} state=${state}`);
    console.error(`Available: ${[...new Set(pages.map((p) => `${p.topic}/${p.state}`))].sort().join(', ')}`);
    process.exit(1);
  }
  return page;
}

// ---------------------------------------------------------------------------
// Quality filters — exclude non-state-specific content
// ---------------------------------------------------------------------------

function stateFullName(stateCode) {
  return STATE_NAMES[stateCode]?.replace(/-/g, ' ') || stateCode;
}

function isStateSpecificArticle(firmAnalysis, stateCode) {
  const title = (firmAnalysis.title || '').toLowerCase();
  const fullName = stateFullName(stateCode).toLowerCase();
  if (title.includes(fullName)) return true;
  // Also check key_analysis for state mentions
  const analysis = (firmAnalysis.key_analysis || '').toLowerCase();
  if (analysis.includes(fullName) && !title.includes('ftc')) return true;
  return false;
}

function isStateSpecificStatute(statute, stateCode) {
  const citation = (statute.citation || '').toLowerCase();
  const fullName = stateFullName(stateCode).toLowerCase();
  const abbrevs = { WY: 'wyo', CA: 'cal', TX: 'tex', NY: 'n.y', CO: 'colo', FL: 'fla' };
  const abbr = (abbrevs[stateCode] || '').toLowerCase();
  if (abbr && citation.includes(abbr)) return true;
  if (citation.includes(fullName)) return true;
  // Exclude federal
  if (citation.includes('cfr') || citation.includes('u.s.c')) return false;
  return false;
}

function isStateSpecificFine(fine, stateCode) {
  const fineLower = (fine || '').toLowerCase();
  const fullName = stateFullName(stateCode).toLowerCase();
  return fineLower.includes(fullName);
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function appendUtm(url) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${UTM_PARAM}`;
}

// ---------------------------------------------------------------------------
// Markdown generation
// ---------------------------------------------------------------------------

function generatePracticeNote(page) {
  const stateCode = page.state;
  const stateDisplay = stateFullName(stateCode).replace(/\b\w/g, (c) => c.toUpperCase());
  const topicDisplay = (page.topic_display || page.topic.replace(/_/g, ' ')).replace(/\b\w/g, (c) => c.toUpperCase());

  // Filter to state-specific content only
  const firmAnalyses = (page.firm_analyses || []).filter((fa) =>
    isStateSpecificArticle(fa, stateCode)
  );
  const statutes = (page.key_statutes || []).filter((s) =>
    isStateSpecificStatute(s, stateCode)
  );
  const fines = (page.fines_summary || []).filter((f) =>
    isStateSpecificFine(f, stateCode)
  );
  // Recommendations are kept as-is since they were already generated from state context,
  // but we rename the heading to be more source-bound
  const recommendations = page.actionable_recommendations || [];

  const firmCount = firmAnalyses.length;
  const now = new Date().toISOString().slice(0, 10);

  const lines = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`title: "${stateDisplay} ${topicDisplay} Practice Note"`);
  lines.push('generated_from: legal-context wiki-export');
  lines.push(`topic: ${page.topic}`);
  lines.push(`state: ${page.state}`);
  lines.push(`firm_count: ${firmCount}`);
  lines.push(`last_updated: ${now}`);
  lines.push('disclaimer: >-');
  lines.push('  This practice note is provided for informational purposes only and does not');
  lines.push('  constitute legal advice. We encourage you to consult with qualified counsel');
  lines.push('  before relying on any provision. The firms whose analysis informed this note');
  lines.push('  are listed below and may be a good starting point for finding counsel');
  lines.push(`  experienced in ${stateDisplay} restrictive covenant law.`);
  lines.push('---');
  lines.push('');

  // Header
  lines.push(`# ${stateDisplay} ${topicDisplay} Practice Note`);
  lines.push('');
  lines.push(`**Based on analysis from ${firmCount} Am Law firms** | Last updated: ${now}`);
  lines.push('');
  lines.push('> This practice note is provided for informational purposes only and does not');
  lines.push('> constitute legal advice. We encourage you to consult with qualified counsel');
  lines.push('> before relying on any provision. The firms whose analysis informed this note');
  lines.push('> are listed below and may be a good starting point for finding counsel');
  lines.push(`> experienced in ${stateDisplay} restrictive covenant law.`);
  lines.push('');

  // Key Statutes
  if (statutes.length > 0) {
    lines.push('## Key Statutes');
    lines.push('');
    lines.push('| Citation | Type | Firms Citing |');
    lines.push('|----------|------|-------------|');
    for (const s of statutes) {
      lines.push(`| ${s.citation} | ${s.authority_type} | ${s.firm_count ?? 0} |`);
    }
    lines.push('');
  }

  // Per-Firm Analysis
  if (firmAnalyses.length > 0) {
    lines.push('## Firm Analysis');
    lines.push('');
    for (const fa of firmAnalyses) {
      const firmLine = fa.date ? `### ${fa.firm} (${fa.date})` : `### ${fa.firm}`;
      lines.push(firmLine);
      lines.push('');
      if (fa.title) {
        const url = appendUtm(fa.url);
        lines.push(url ? `**[${fa.title}](${url})**` : `**${fa.title}**`);
        lines.push('');
      }
      if (fa.quote) {
        lines.push(`> "${fa.quote}"`);
        lines.push('');
      }
      if (fa.key_analysis) {
        lines.push(fa.key_analysis);
        lines.push('');
      }
      if (fa.enforcement_intensity && fa.enforcement_intensity !== 'none') {
        lines.push(`Enforcement intensity: ${fa.enforcement_intensity}`);
        lines.push('');
      }
    }
  }

  // Enforcement Assessment
  const enforcementIntensity = page.enforcement_intensity || 'none';
  const agencies = page.enforcement_agencies || [];
  if (enforcementIntensity !== 'none' || fines.length > 0 || agencies.length > 0) {
    lines.push('## Enforcement Assessment');
    lines.push('');
    lines.push(`- **Intensity:** ${enforcementIntensity}`);
    if (agencies.length > 0) {
      lines.push(`- **Agencies:** ${agencies.join(', ')}`);
    }
    if (fines.length > 0) {
      lines.push(`- **Fines mentioned (${stateDisplay}-specific):** ${fines.join(', ')}`);
    } else {
      lines.push(`- **Fines mentioned (${stateDisplay}-specific):** None identified`);
    }
    lines.push('');
  }

  // Issues Flagged in Published Sources (renamed from Practical Guidance)
  if (recommendations.length > 0) {
    lines.push('## Issues Flagged in Published Sources');
    lines.push('');
    for (let i = 0; i < recommendations.length; i++) {
      lines.push(`${i + 1}. ${recommendations[i]}`);
    }
    lines.push('');
  }

  // Non-solicitation uncertainty notice
  lines.push('## Non-Solicitation Uncertainty');
  lines.push('');
  lines.push(`Practitioner sources flag uncertainty about whether Wyo. Stat. \u00a7 1-23-108`);
  lines.push('could reach certain non-solicitation provisions depending on how they function.');
  lines.push(`No separate ${stateDisplay} non-solicitation statute was identified in this review.`);
  lines.push('');

  // Forfeiture-for-competition discussion
  lines.push('## Forfeiture-for-Competition as Alternative');
  lines.push('');
  lines.push('Given Wyoming\'s near-ban on traditional non-competes, forfeiture-for-competition');
  lines.push('clauses (conditioning deferred compensation on non-competition) may serve as an');
  lines.push('alternative enforcement mechanism. The 7th Circuit (*LKQ Corp. v. Rutledge*, Jan. 2025)');
  lines.push('and Delaware Supreme Court (2024) have upheld such provisions without applying');
  lines.push('the reasonableness test used for traditional non-competes. However, no Wyoming');
  lines.push('authority was identified on this issue. Consult qualified counsel before using');
  lines.push('forfeiture-for-competition in a Wyoming context.');
  lines.push('');

  // Firm Attribution Table
  if (firmAnalyses.length > 0) {
    lines.push('## Firm Attribution');
    lines.push('');
    lines.push(`The following firms published ${stateDisplay}-specific analysis relied upon in this note.`);
    lines.push('These firms may be a good starting point for finding counsel experienced in');
    lines.push(`${stateDisplay} restrictive covenant law.`);
    lines.push('');
    lines.push('| Firm | Article | Date |');
    lines.push('|------|---------|------|');
    for (const fa of firmAnalyses) {
      const url = appendUtm(fa.url);
      const titleLink = url ? `[${fa.title || 'Article'}](${url})` : (fa.title || 'Article');
      lines.push(`| ${fa.firm} | ${titleLink} | ${fa.date || 'undated'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Output path
// ---------------------------------------------------------------------------

const STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa',
  KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland',
  MA: 'massachusetts', MI: 'michigan', MN: 'minnesota', MS: 'mississippi',
  MO: 'missouri', MT: 'montana', NE: 'nebraska', NV: 'nevada', NH: 'new-hampshire',
  NJ: 'new-jersey', NM: 'new-mexico', NY: 'new-york', NC: 'north-carolina',
  ND: 'north-dakota', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', PA: 'pennsylvania',
  RI: 'rhode-island', SC: 'south-carolina', SD: 'south-dakota', TN: 'tennessee',
  TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington',
  WV: 'west-virginia', WI: 'wisconsin', WY: 'wyoming', DC: 'district-of-columbia',
};

function outputPath(topic, state) {
  const stateName = STATE_NAMES[state] || state.toLowerCase();
  return resolve(
    ROOT,
    'content',
    'templates',
    `openagreements-restrictive-covenant-${stateName}`,
    'practice-note.md'
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const { topic, state } = parseArgs();
const page = loadWikiExport(topic, state);
const markdown = generatePracticeNote(page);
const outPath = outputPath(topic, state);

writeFileSync(outPath, markdown, 'utf-8');

const filteredCount = (page.firm_analyses || []).filter((fa) =>
  isStateSpecificArticle(fa, state)
).length;
const totalCount = (page.firm_analyses || []).length;
const fullName = stateFullName(state).replace(/\b\w/g, (c) => c.toUpperCase());

console.log(`Generated practice note: ${outPath}`);
console.log(`  ${filteredCount} of ${totalCount} firm analyses included (${totalCount - filteredCount} non-${fullName}-specific excluded)`);
console.log(`  ${(page.key_statutes || []).filter((s) => isStateSpecificStatute(s, state)).length} statutes included`);
