#!/usr/bin/env node

/**
 * Migration script for namespaced OpenSpec IDs.
 *
 * Phase A: --plan   Parse canonical specs, generate old→new ID mapping.
 * Phase B: --apply  Apply the mapping to spec files, test files, and traceability matrix.
 *
 * Usage:
 *   node scripts/migrate-openspec-ids.mjs --plan     # Generate openspec/id-mapping.json
 *   node scripts/migrate-openspec-ids.mjs --apply    # Apply mapping from openspec/id-mapping.json
 *   node scripts/migrate-openspec-ids.mjs --dry-run  # Show what --apply would change without writing
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SPEC_ROOT = path.join(REPO_ROOT, 'openspec', 'specs');
const MAPPING_PATH = path.join(REPO_ROOT, 'openspec', 'id-mapping.json');
const TRACEABILITY_PATH = path.join(REPO_ROOT, 'integration-tests', 'OPENSPEC_TRACEABILITY.md');

// Directories to scan for test files containing .openspec() calls
const SCAN_ROOTS = ['integration-tests', 'src', 'packages'].map((d) => path.join(REPO_ROOT, d));
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx']);

// ── Requirement → Namespace mapping ──────────────────────────────────────────

const REQUIREMENT_TO_NAMESPACE = {
  // Engine & DOCX Primitives
  'Template Engine Sandboxing': 'ENG',
  'DOCX Text Extraction': 'ENG',
  'DOCX Cleaner': 'ENG',
  'OOXML Part Enumeration': 'ENG',
  'Bracket Artifact Normalization': 'ENG',
  'Declarative Paragraph Pruning': 'ENG',
  'Clean Configuration Schema': 'ENG',

  // Recipe Pipeline & Internals
  'Recipe Pipeline': 'RCP',
  'Recipe CLI Subcommands': 'RCP',
  'Cross-Run Patcher': 'RCP',
  'Post-Fill Verifier': 'RCP',
  'Recipe Metadata Schema': 'RCP',
  'Recipe Directory Validation': 'RCP',
  'Output Validation': 'RCP',
  'Recipe Computed Interaction Profiles': 'RCP',
  'Computed Artifact Export': 'RCP',
  'Computed Profile Validation': 'RCP',
  'Recipe Validation for Bundled Recipes': 'RCP',
  'Recipe Negative Validation': 'RCP',
  'Source Drift Detection': 'RCP',
  'Recipe Patcher Operations': 'RCP',
  'Recipe Patcher Extensions': 'RCP',
  'Replacement Key Parsing': 'RCP',
  'Recipe Verifier Edge Cases': 'RCP',
  'Recipe Metadata Defaults': 'RCP',
  'Guidance Output Schema': 'RCP',

  // Template Rendering, Metadata & Discovery
  'Template Validation Severity': 'TMP',
  'Metadata Schema Constraints': 'TMP',
  'DOCX Template Rendering': 'TMP',
  'Mutual NDA Selection Semantics': 'TMP',
  'Template Metadata Schema': 'TMP',
  'External Template Support': 'TMP',
  'Template Validation for All Templates': 'TMP',
  'JSON Template Renderer': 'TMP',
  'NVCA Template Assumption Validation': 'TMP',
  'Metadata Completeness Assessment': 'TMP',
  'Metadata Field Schema Validation': 'TMP',
  'Template Metadata Required Fields': 'TMP',

  // CLI, Skills & Scan
  'Scan Command': 'CLI',
  'CLI Interface': 'CLI',
  'Claude Code Skill': 'CLI',
  'Agent-Agnostic Skill Architecture': 'CLI',
  'Agent Skills Specification Compliance': 'CLI',
  'Machine-Readable Template Discovery': 'CLI',
  'Optional Content Root Overrides': 'CLI',
  'Content Root Precedence and Dedupe': 'CLI',
  'Unified Root-Aware Command Resolution': 'CLI',
  'CLI Fill for All Template Types': 'CLI',
  'List Command Envelope Structure': 'CLI',

  // Fill Pipeline & Specialized Rendering
  'Fill Value Validation': 'FIL',
  'NVCA SPA Interaction Audit Coverage': 'FIL',
  'Currency Field Detection and Sanitization': 'FIL',
  'Post-Fill Verification Checks': 'FIL',
  'Fill Data Preparation': 'FIL',
  'Fill Pipeline DOCX Rendering': 'FIL',
  'Fill Pipeline Behavioral Consistency': 'FIL',
  'Employment Memo Generation': 'FIL',
  'NVCA Option Vesting Policy Computation': 'FIL',
  'Employment Template Formatting Integrity': 'FIL',
  'Formatting Diff Boundary Conditions': 'FIL',
  'NVCA SPA Preview Rendering': 'FIL',

  // Distribution & API
  'CI License Compliance': 'DST',
  'License Compliance Validation': 'DST',
  'npm Package Integrity': 'DST',
  'Public Trust Signal Surfaces': 'DST',
  'CI-Published Coverage and Test Results': 'DST',
  'Repository-Defined Coverage Gate Policy': 'DST',
  'Spec-Backed Allure Coverage Expansion': 'DST',
  'Canonical Evidence Story': 'DST',
  'Opaque Download Links for Hosted Fill': 'DST',
  'Download Endpoint Supports HEAD Probing': 'DST',
  'Download Errors Are Machine-Actionable': 'DST',
  'API Endpoint Protocol Compliance': 'DST',
  'OpenSpec Coverage Validation Script': 'DST',
  'npm Package Distribution Integrity': 'DST',
  'Download Token Lifecycle': 'DST',
  'MCP Protocol Envelope Contract': 'DST',

  // Checklist
  'Document-First Closing Checklist Data Model': 'CKL',
  'Stage-First Nested Lawyer Rendering': 'CKL',
  'Stable Sort Key and Computed Display Numbering': 'CKL',
  'Optional Document Labels': 'CKL',
  'Named Signatory Tracking with Signature Artifacts': 'CKL',
  'Minimal Citation Support': 'CKL',
  'Document-Linked and Document-Less Checklist Entries': 'CKL',
  'Simplified Issue Lifecycle': 'CKL',
  'Standalone Working Group Document': 'CKL',
  'Legacy Checklist Payload Rejection': 'CKL',
  'Atomic Checklist JSON Patch Transactions': 'CKL',
  'Optimistic Concurrency for Patch Apply': 'CKL',
  'Dry-Run Patch Validation': 'CKL',
  'Apply Requires Prior Successful Validation': 'CKL',
  'Strict Target Resolution Without Guessing': 'CKL',
  'Patch-Level Idempotency': 'CKL',
  'Flexible Evidence Citations in Patch Updates': 'CKL',
  'Optional Proposed Patch Mode': 'CKL',
  'Closing Checklist Stage-First Rendering': 'CKL',
  'Working Group List Rendering': 'CKL',
  'Checklist Schema Structural Rules': 'CKL',
  'Patch Schema Validation Rules': 'CKL',
  'Patch Validator Artifact Expiry': 'CKL',

  // Workspace
  'Workspace Initialization Command': 'WKS',
  'Topic Scaffold Planning': 'WKS',
  'Shared Agent Guidance File': 'WKS',
  'Claude and Gemini Integration Guidance': 'WKS',
  'Forms Catalog With URL and Checksum': 'WKS',
  'Catalog Download and Verification': 'WKS',
  'Pointer-Only Catalog Handling': 'WKS',
  'Filename-Driven Execution Status': 'WKS',
  'YAML Status Index Generation': 'WKS',
  'Workspace Linting': 'WKS',
  'Filesystem-Only Operation in v1': 'WKS',
  'Independent Package Boundary': 'WKS',
  'Workspace Convention Configuration': 'WKS',
  'Convention Scanner Detection': 'WKS',
  'Convention-Aware Linting': 'WKS',
  'Workspace Initialization Artifacts': 'WKS',
  'Partially Executed Document Status': 'WKS',
  'Duplicate File Detection': 'WKS',
  'Root Orphan Detection': 'WKS',
  'Cross-Contamination Detection': 'WKS',
  'Workspace Init Backward Compatibility': 'WKS',
  'Provider Filesystem Semantics': 'WKS',
  'JSON Schema Snapshot Consistency': 'WKS',
  'MCP Tool Descriptors': 'WKS',
};

// ── Spec parsing ─────────────────────────────────────────────────────────────

const REQUIREMENT_HEADER_RE = /^###\s+Requirement:\s*(.+?)\s*$/;
const SCENARIO_HEADER_RE = /^\s*####\s+Scenario:\s*\[([^\]]+)\]\s+(.+?)\s*$/;

/**
 * Parse a canonical spec file and return an ordered list of
 * { requirementTitle, scenarioId, scenarioTitle } entries.
 */
function parseSpec(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries = [];
  let currentRequirement = null;

  for (const line of lines) {
    const reqMatch = line.match(REQUIREMENT_HEADER_RE);
    if (reqMatch) {
      currentRequirement = reqMatch[1].trim();
      continue;
    }
    const scenarioMatch = line.match(SCENARIO_HEADER_RE);
    if (scenarioMatch && currentRequirement) {
      entries.push({
        requirementTitle: currentRequirement,
        scenarioId: scenarioMatch[1].trim(),
        scenarioTitle: scenarioMatch[2].trim(),
      });
    }
  }

  return entries;
}

/**
 * Discover all canonical spec files under openspec/specs/.
 */
function findCanonicalSpecs() {
  const specs = [];
  const queue = [SPEC_ROOT];
  while (queue.length > 0) {
    const dir = queue.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile() && entry.name === 'spec.md') {
        specs.push(fullPath);
      }
    }
  }
  return specs.sort();
}

// ── Plan phase ───────────────────────────────────────────────────────────────

function generateMapping() {
  const specFiles = findCanonicalSpecs();
  const allEntries = [];

  for (const specFile of specFiles) {
    const entries = parseSpec(specFile);
    const relPath = path.relative(REPO_ROOT, specFile);
    for (const entry of entries) {
      allEntries.push({ ...entry, specFile: relPath });
    }
  }

  // Group by namespace, preserving original appearance order
  const namespaceGroups = new Map();
  const unmapped = [];

  for (const entry of allEntries) {
    const ns = REQUIREMENT_TO_NAMESPACE[entry.requirementTitle];
    if (!ns) {
      unmapped.push(entry);
      continue;
    }
    if (!namespaceGroups.has(ns)) {
      namespaceGroups.set(ns, []);
    }
    namespaceGroups.get(ns).push(entry);
  }

  if (unmapped.length > 0) {
    console.error('\nUnmapped requirements (add to REQUIREMENT_TO_NAMESPACE):');
    for (const entry of unmapped) {
      console.error(`  - "${entry.requirementTitle}" (${entry.scenarioId})`);
    }
    process.exit(1);
  }

  // Assign sequential IDs per namespace
  const mapping = {};
  const summary = {};

  for (const [ns, entries] of namespaceGroups) {
    summary[ns] = { count: entries.length, range: '' };
    for (let i = 0; i < entries.length; i++) {
      const newId = `OA-${ns}-${String(i + 1).padStart(3, '0')}`;
      mapping[entries[i].scenarioId] = {
        newId,
        namespace: ns,
        title: entries[i].scenarioTitle,
        requirement: entries[i].requirementTitle,
        specFile: entries[i].specFile,
      };
    }
    summary[ns].range = `OA-${ns}-001 to OA-${ns}-${String(entries.length).padStart(3, '0')}`;
  }

  return { mapping, summary };
}

function runPlan() {
  console.log('Parsing canonical specs...\n');
  const { mapping, summary } = generateMapping();

  // Write mapping file
  const output = {
    _comment: 'Auto-generated by scripts/migrate-openspec-ids.mjs --plan. Maps old OA-NNN IDs to namespaced OA-XXX-NNN IDs.',
    generated: new Date().toISOString(),
    namespaces: summary,
    mapping,
  };

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`Wrote mapping to ${path.relative(REPO_ROOT, MAPPING_PATH)}\n`);

  // Print summary table
  console.log('Namespace Summary:');
  console.log('──────────────────────────────────────────────────');
  console.log(`${'Namespace'.padEnd(10)} ${'Count'.padEnd(8)} Range`);
  console.log('──────────────────────────────────────────────────');
  let total = 0;
  for (const [ns, info] of Object.entries(summary)) {
    console.log(`${ns.padEnd(10)} ${String(info.count).padEnd(8)} ${info.range}`);
    total += info.count;
  }
  console.log('──────────────────────────────────────────────────');
  console.log(`${'Total'.padEnd(10)} ${total}\n`);

  // Print sample mappings
  const entries = Object.entries(mapping);
  console.log('Sample mappings (first 5):');
  for (const [oldId, meta] of entries.slice(0, 5)) {
    console.log(`  ${oldId} → ${meta.newId}  (${meta.title})`);
  }
  if (entries.length > 5) {
    console.log(`  ... and ${entries.length - 5} more\n`);
  }

  console.log('Review the mapping, then run: node scripts/migrate-openspec-ids.mjs --apply');
}

// ── Apply phase ──────────────────────────────────────────────────────────────

/**
 * Recursively find files matching extensions under the given roots.
 */
function findFiles(roots, extensions) {
  const results = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const queue = [root];
    while (queue.length > 0) {
      const dir = queue.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
        } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    }
  }
  return results.sort();
}

/**
 * Replace all old IDs with new IDs in file content.
 * Uses word-boundary matching to avoid partial matches.
 * Returns { content, replacementCount } or null if no changes.
 */
function applyMappingToContent(content, mapping) {
  let result = content;
  let totalReplacements = 0;

  // Sort old IDs by length descending to avoid partial matches
  // (e.g., OA-10 should not partially match inside OA-100)
  const sortedOldIds = Object.keys(mapping).sort((a, b) => b.length - a.length);

  for (const oldId of sortedOldIds) {
    const newId = mapping[oldId].newId;
    // Word-boundary regex to match exact IDs
    const regex = new RegExp(`\\b${escapeRegex(oldId)}\\b`, 'g');
    const before = result;
    result = result.replace(regex, newId);
    if (result !== before) {
      const matches = before.match(regex);
      totalReplacements += matches ? matches.length : 0;
    }
  }

  if (totalReplacements === 0) return null;
  return { content: result, replacementCount: totalReplacements };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runApply(dryRun) {
  if (!fs.existsSync(MAPPING_PATH)) {
    console.error(`Mapping file not found: ${path.relative(REPO_ROOT, MAPPING_PATH)}`);
    console.error('Run --plan first to generate it.');
    process.exit(1);
  }

  const mappingData = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf-8'));
  const mapping = mappingData.mapping;
  const oldIds = Object.keys(mapping);
  console.log(`Loaded mapping with ${oldIds.length} IDs.\n`);

  // Collect all files to update
  const specFiles = findCanonicalSpecs();
  const testFiles = findFiles(SCAN_ROOTS, SCANNABLE_EXTENSIONS);
  // Also include the traceability matrix and any markdown in openspec/
  const markdownFiles = findFiles([path.join(REPO_ROOT, 'openspec')], new Set(['.md']));

  const allFiles = [...new Set([...specFiles, ...testFiles, ...markdownFiles])].sort();

  let filesChanged = 0;
  let totalReplacements = 0;
  const changedFiles = [];

  for (const filePath of allFiles) {
    // Skip non-canonical spec files (archive, private, active changes)
    // These keep old OA-NNN IDs — they won't collide with new OA-XXX-NNN format
    const relPath = path.relative(REPO_ROOT, filePath);
    if (
      relPath.startsWith(`openspec${path.sep}changes${path.sep}`) ||
      relPath.includes(`private${path.sep}`)
    ) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const result = applyMappingToContent(content, mapping);
    if (!result) continue;

    changedFiles.push({ path: relPath, replacements: result.replacementCount });
    filesChanged++;
    totalReplacements += result.replacementCount;

    if (!dryRun) {
      fs.writeFileSync(filePath, result.content, 'utf-8');
    }
  }

  // Also update the traceability matrix if it exists
  if (fs.existsSync(TRACEABILITY_PATH)) {
    const relPath = path.relative(REPO_ROOT, TRACEABILITY_PATH);
    const content = fs.readFileSync(TRACEABILITY_PATH, 'utf-8');
    const result = applyMappingToContent(content, mapping);
    if (result && !changedFiles.some((f) => f.path === relPath)) {
      changedFiles.push({ path: relPath, replacements: result.replacementCount });
      filesChanged++;
      totalReplacements += result.replacementCount;
      if (!dryRun) {
        fs.writeFileSync(TRACEABILITY_PATH, result.content, 'utf-8');
      }
    }
  }

  // Print results
  const prefix = dryRun ? '[DRY RUN] ' : '';
  console.log(`${prefix}Changed files:`);
  for (const file of changedFiles) {
    console.log(`  ${file.path} (${file.replacements} replacements)`);
  }
  console.log(`\n${prefix}Summary: ${totalReplacements} replacements across ${filesChanged} files.`);

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  } else {
    console.log('\nDone. Next steps:');
    console.log('  1. Run tests: npx vitest run --reporter=verbose');
    console.log('  2. Regenerate traceability: node scripts/validate_openspec_coverage.mjs --matrix');
    console.log('  3. Review changes: git diff');
  }
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--plan')) {
  runPlan();
} else if (args.includes('--apply')) {
  runApply(false);
} else if (args.includes('--dry-run')) {
  runApply(true);
} else {
  console.log('Usage:');
  console.log('  node scripts/migrate-openspec-ids.mjs --plan      Generate ID mapping');
  console.log('  node scripts/migrate-openspec-ids.mjs --dry-run   Preview changes');
  console.log('  node scripts/migrate-openspec-ids.mjs --apply     Apply mapping');
  process.exit(1);
}
