/** Regenerate this locally authored clause through the shared Markdoc renderer. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMetadata } from '../dist/core/metadata.js';
import { renderOriginalMarkdoc } from '../dist/core/original-contract-renderer/index.js';
import { fillTemplate } from '../dist/core/engine.js';
import { postProcessGeneratedDocx } from './lib/docx-post-process.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'templates/openagreements-cc-by-4.0/openagreements-peoples-court-arbitration-clause');
const source = readFileSync(resolve(dir, 'template.mdoc'), 'utf8');
const metadata = loadMetadata(dir);
const rendered = await renderOriginalMarkdoc(source, metadata.fields);
const fillDocx = await postProcessGeneratedDocx(rendered.buffer);
writeFileSync(resolve(dir, 'template.fill.docx'), fillDocx);
// Render the visible AI-only default through the same fill path users invoke.
// The default is a draft election for review, not a record of party consent.
await fillTemplate({ templateDir: dir, values: {}, outputPath: resolve(dir, 'template.docx') });

// This clause uses only plain paragraphs, headings and exact field directives.
// Preserve prose while projecting bounded Markdoc field syntax into fill tokens.
const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trimStart();
writeFileSync(resolve(dir, 'template.md'), body.replace(/\{% field name="([a-z_]+)" \/%\}/g, '{$1}'));
console.log('Generated People’s Court model clause DOCX and Markdown projections.');
