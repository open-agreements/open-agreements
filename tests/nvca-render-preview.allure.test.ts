import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { loadRecipeMetadata } from '../src/core/metadata.js';
import { runRecipe } from '../src/core/recipe/index.js';
import { resolveRecipeDir } from '../src/utils/paths.js';
import {
  allureImageAttachment,
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface MetadataField {
  name: string;
  type: 'string' | 'date' | 'number' | 'boolean' | 'enum';
  default?: unknown;
  options?: string[];
}

interface RecipeMetadataDocument {
  fields: MetadataField[];
}

interface RenderSummary {
  input_docx: string;
  output_dir: string;
  prefix: string;
  dpi: number;
  first_page: number;
  last_page: number | null;
  page_count: number;
  pages: string[];
  intermediate_pdf: string | null;
  renderer: {
    docx_to_pdf: string;
    pdf_to_png: string;
  };
}

const RECIPE_ID = 'nvca-stock-purchase-agreement';
const RECIPE_DIR = resolveRecipeDir(RECIPE_ID);
const SOURCE_CACHE_PATH = join(homedir(), '.open-agreements', 'cache', RECIPE_ID, 'source.docx');

// This test requires a cached NVCA source DOCX and LibreOffice — skip in CI
const hasPrereqs = existsSync(SOURCE_CACHE_PATH) &&
  spawnSync('which', ['soffice'], { encoding: 'utf-8' }).status === 0;

const it = itAllure.withLabels({
  epic: 'NVCA SPA Template',
  feature: 'NVCA SPA Legal QA',
  suite: 'Visual Review',
  subSuite: 'Rendered Page Evidence',
});

describe.skipIf(!hasPrereqs)('NVCA rendered preview evidence', () => {
  it('attaches rendered NVCA pages as PNG evidence for human review', async () => {
    await allureParameter('recipe_id', RECIPE_ID);
    await allureParameter('evidence_renderer', 'libreoffice+pdftoppm');

    const metadata = await allureStep('Load NVCA recipe metadata', () =>
      loadRecipeMetadata(RECIPE_DIR) as RecipeMetadataDocument,
    );

    await allureStep('Assert cached NVCA source exists for deterministic visual run', () => {
      // Guarded by describe.skipIf(!hasPrereqs) — this is a documentation assertion
      expect(existsSync(SOURCE_CACHE_PATH)).toBe(true);
    });

    const values: Record<string, string> = {};
    for (const field of metadata.fields ?? []) {
      if (field.default !== undefined && field.default !== null) {
        values[field.name] = String(field.default);
        continue;
      }
      if (field.type === 'enum') {
        values[field.name] = field.options?.[0] ?? 'option_1';
        continue;
      }
      if (field.type === 'date') {
        values[field.name] = '2026-02-17';
        continue;
      }
      if (field.type === 'number') {
        values[field.name] = '1000000';
        continue;
      }
      if (field.type === 'boolean') {
        values[field.name] = 'true';
        continue;
      }
      values[field.name] = `sample_${field.name}`;
    }

    Object.assign(values, {
      company_name: 'Allure Visual Labs, Inc.',
      investor_name: 'North Star Ventures LLC',
      state_lower: 'california',
      dispute_resolution_mode: 'courts',
      balance_sheet_date: '2026-01-31',
    });

    const tempDir = mkdtempSync(join(tmpdir(), 'oa-nvca-render-preview-'));
    const outputDocxPath = join(tempDir, 'nvca-rendered.docx');

    try {
      await allureStep('Render NVCA stock purchase agreement using cached source', async () => {
        await runRecipe({
          recipeId: RECIPE_ID,
          inputPath: SOURCE_CACHE_PATH,
          outputPath: outputDocxPath,
          values,
        });
      });

      const renderScript = join(import.meta.dirname, '..', 'scripts', 'render_docx_pages.mjs');
      const renderRun = await allureStep('Convert rendered DOCX to page PNGs', () =>
        spawnSync(
          process.execPath,
          [
            renderScript,
            '--input',
            outputDocxPath,
            '--output-dir',
            tempDir,
            '--prefix',
            'nvca-page',
            '--dpi',
            '170',
            '--first-page',
            '1',
            '--last-page',
            '3',
            '--json',
          ],
          {
            encoding: 'utf-8',
            env: {
              ...process.env,
              // Prevent macOS GUI plugin initialization in headless runs.
              SAL_USE_VCLPLUGIN: process.env.SAL_USE_VCLPLUGIN ?? 'svp',
            },
          },
        ),
      );

      expect(renderRun.status).toBe(0);
      const summary = JSON.parse(renderRun.stdout) as RenderSummary;
      expect(summary.page_count).toBeGreaterThan(0);

      await allureJsonAttachment('nvca-render-summary.json', summary);
      await allureJsonAttachment('nvca-render-values.json', values);

      for (const pagePath of summary.pages) {
        const pageFileName = pagePath.split('/').pop() ?? pagePath;
        await allureImageAttachment(`Rendered NVCA page: ${pageFileName}`, pagePath);
      }

      await allureStep('Assert page PNG attachments were generated', () => {
        expect(summary.pages.length).toBeGreaterThanOrEqual(1);
      });

      const renderStderr = renderRun.stderr?.trim();
      if (renderStderr) {
        await allureJsonAttachment('nvca-render-stderr.json', { stderr: renderStderr });
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
