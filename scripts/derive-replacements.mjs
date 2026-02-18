#!/usr/bin/env node
/**
 * One-time script: derive replacements.json for each modified Common Paper template
 * by diffing the original (git HEAD) vs patched (working tree) DOCX text.
 *
 * For each modified template:
 * 1. Extract original DOCX from git HEAD to a temp file
 * 2. Extract paragraph text from both original and patched DOCXs
 * 3. Find [bracket] → {tag} replacements by comparing paragraph pairs
 * 4. Write replacements.json
 * 5. Validate: run patcher on original with derived replacements, compare to patched
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/**
 * Extract paragraph texts from a DOCX file.
 * Returns an array of paragraph text strings (concatenated <w:t> elements per paragraph).
 * Processes document.xml, headers, footers, and endnotes.
 */
function extractParagraphs(docxPath) {
  const zip = new AdmZip(docxPath);
  const entries = zip.getEntries().map(e => e.entryName);
  const parser = new DOMParser();

  const partNames = [];
  if (entries.includes('word/document.xml')) partNames.push('word/document.xml');
  partNames.push(...entries.filter(e => /^word\/header\d+\.xml$/.test(e)).sort());
  partNames.push(...entries.filter(e => /^word\/footer\d+\.xml$/.test(e)).sort());
  if (entries.includes('word/endnotes.xml')) partNames.push('word/endnotes.xml');

  const paragraphs = [];
  for (const partName of partNames) {
    const entry = zip.getEntry(partName);
    if (!entry) continue;
    const xml = entry.getData().toString('utf-8');
    const doc = parser.parseFromString(xml, 'text/xml');
    const paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (let i = 0; i < paras.length; i++) {
      const tElements = paras[i].getElementsByTagNameNS(W_NS, 't');
      const parts = [];
      for (let j = 0; j < tElements.length; j++) {
        parts.push(tElements[j].textContent ?? '');
      }
      paragraphs.push(parts.join(''));
    }
  }
  return paragraphs;
}

/**
 * Find all [...] substrings in a text.
 */
function findBrackets(text) {
  const results = [];
  const re = /\[[^\]]+\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({ text: m[0], index: m.index });
  }
  return results;
}

/**
 * Find all {...} substrings in a text.
 */
function findBraces(text) {
  const results = [];
  const re = /\{[^}]+\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    results.push({ text: m[0], index: m.index });
  }
  return results;
}

/**
 * Derive replacements from two paragraph arrays (original and patched).
 * For each paragraph pair that differs, find [bracket] → {brace} substitutions.
 */
function deriveReplacements(origParas, patchedParas) {
  const replacements = {};

  const len = Math.min(origParas.length, patchedParas.length);
  for (let i = 0; i < len; i++) {
    const orig = origParas[i];
    const patched = patchedParas[i];
    if (orig === patched) continue;

    // Find all brackets in original and braces in patched
    const brackets = findBrackets(orig);
    const braces = findBraces(patched);

    if (brackets.length === 0 || braces.length === 0) continue;

    // Strategy: for each bracket in the original, find the corresponding brace
    // in the patched version by position alignment.
    // Walk through brackets and braces, matching by position offsets.

    // Build a mapping: consume brackets and braces left to right.
    // The text before/after each bracket/brace should match (context alignment).
    let origPos = 0;
    let patchedPos = 0;
    let bIdx = 0;

    for (const bracket of brackets) {
      // Text from current position to start of this bracket in original
      const origBefore = orig.slice(origPos, bracket.index);

      // Find corresponding brace in patched that has the same preceding context
      if (bIdx >= braces.length) break;

      const brace = braces[bIdx];
      const patchedBefore = patched.slice(patchedPos, brace.index);

      // The context text before should be the same (or very similar).
      // If they match well, this bracket maps to this brace.
      if (origBefore === patchedBefore) {
        replacements[bracket.text] = brace.text;
        origPos = bracket.index + bracket.text.length;
        patchedPos = brace.index + brace.text.length;
        bIdx++;
      } else {
        // Context mismatch — skip this bracket or try to re-align.
        // This can happen if a bracket was NOT replaced (still present in patched).
        // Check if the bracket text still exists in the patched at this position.
        if (patched.slice(patchedPos).startsWith(origBefore + bracket.text)) {
          // The bracket was NOT replaced — skip it
          origPos = bracket.index + bracket.text.length;
          patchedPos = patchedPos + origBefore.length + bracket.text.length;
        }
      }
    }
  }

  // Handle paragraph count differences (shouldn't happen for in-place patching)
  if (origParas.length !== patchedParas.length) {
    console.warn(`  Warning: paragraph count mismatch (orig=${origParas.length}, patched=${patchedParas.length})`);
  }

  return replacements;
}

// --- Main ---

const modifiedTemplates = execSync(
  "git diff --name-only HEAD -- 'content/templates/common-paper-*/template.docx'",
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

console.log(`Found ${modifiedTemplates.length} modified templates\n`);

const tempBase = mkdtempSync(join(tmpdir(), 'derive-repl-'));
let allValid = true;

for (const relPath of modifiedTemplates) {
  const templateId = relPath.split('/')[2]; // e.g., "common-paper-pilot-agreement"
  const templateDir = join(process.cwd(), 'content', 'templates', templateId);
  const patchedPath = join(templateDir, 'template.docx');

  console.log(`Processing: ${templateId}`);

  // Extract original from git
  const origPath = join(tempBase, `${templateId}-orig.docx`);
  execSync(`git show HEAD:${relPath} > "${origPath}"`, { encoding: 'utf-8' });

  // Extract paragraphs
  const origParas = extractParagraphs(origPath);
  const patchedParas = extractParagraphs(patchedPath);

  // Derive replacements
  const replacements = deriveReplacements(origParas, patchedParas);
  const count = Object.keys(replacements).length;

  if (count === 0) {
    console.log(`  WARNING: No replacements derived!`);
    allValid = false;
    continue;
  }

  console.log(`  Found ${count} replacement(s):`);
  for (const [k, v] of Object.entries(replacements)) {
    console.log(`    ${k} → ${v}`);
  }

  // Write replacements.json
  const outputPath = join(templateDir, 'replacements.json');
  writeFileSync(outputPath, JSON.stringify(replacements, null, 2) + '\n');
  console.log(`  Wrote: ${outputPath}`);

  // Validate: import patcher, apply replacements to original, compare text
  try {
    // We can't easily import the TS patcher from an mjs script,
    // so we do a text-level comparison instead.
    // Copy original to a temp, manually apply replacements to text, compare.
    const validOrigParas = extractParagraphs(origPath);
    let validationPassed = true;

    // For each replacement, apply it to the original paragraphs
    const simParas = validOrigParas.map(p => {
      let result = p;
      // Sort keys longest-first for replacement
      const sorted = Object.keys(replacements).sort((a, b) => b.length - a.length);
      for (const key of sorted) {
        while (result.includes(key)) {
          result = result.replace(key, replacements[key]);
        }
      }
      return result;
    });

    // Compare with patched paragraphs
    const pLen = Math.min(simParas.length, patchedParas.length);
    let mismatches = 0;
    for (let i = 0; i < pLen; i++) {
      if (simParas[i] !== patchedParas[i]) {
        mismatches++;
        if (mismatches <= 3) {
          console.log(`  Mismatch at paragraph ${i}:`);
          console.log(`    Expected: ${patchedParas[i].slice(0, 120)}`);
          console.log(`    Got:      ${simParas[i].slice(0, 120)}`);
        }
      }
    }

    if (mismatches > 0) {
      console.log(`  VALIDATION: ${mismatches} paragraph mismatch(es)`);
      allValid = false;
    } else {
      console.log(`  VALIDATION: PASSED`);
    }
  } catch (err) {
    console.log(`  VALIDATION ERROR: ${err.message}`);
    allValid = false;
  }

  console.log('');
}

// Cleanup
rmSync(tempBase, { recursive: true, force: true });

if (allValid) {
  console.log('All templates validated successfully!');
} else {
  console.log('Some templates had issues — review output above.');
  process.exit(1);
}
