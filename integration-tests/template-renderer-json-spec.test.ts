import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  listRegisteredLayouts,
  loadContractSpec,
  loadStyleProfile,
  renderFromValidatedSpec,
} from '../scripts/template_renderer/index.mjs';
import { validateStyleProfile } from '../scripts/template_renderer/schema.mjs';
import { discoverTemplateSources } from '../scripts/template_renderer/canonical-sources.mjs';

const it = itAllure.epic('Filling & Rendering');

const repoRoot = join(import.meta.dirname, '..');
const stylePath = join(repoRoot, 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');
const sources = discoverTemplateSources(repoRoot);
const specPaths = sources.map((source) => join(repoRoot, source.jsonPath));

describe('json template renderer', () => {
  it.openspec('OA-TMP-017')('supports multiple templates sharing the same layout id', () => {
    const style = loadStyleProfile(stylePath);
    const specs = specPaths.map((specPath) => loadContractSpec(specPath));

    expect(specs.length).toBeGreaterThanOrEqual(2);
    const layoutIds = new Set(specs.map((spec) => spec.layout_id));
    expect(layoutIds.size).toBe(1);
    expect(layoutIds.has('cover-standard-signature-v1')).toBe(true);

    const outputs = specs.map((spec) => renderFromValidatedSpec(spec, style));
    expect(outputs.length).toBe(specs.length);
    for (const output of outputs) {
      expect(output.markdown.length).toBeGreaterThan(0);
    }
  });

  it.openspec('OA-TMP-017')('rejects unknown layout ids with actionable error', () => {
    const style = loadStyleProfile(stylePath);
    const spec = loadContractSpec(specPaths[0]);
    const badSpec = { ...spec, layout_id: 'nonexistent-layout-v1' };

    expect(() => renderFromValidatedSpec(badSpec, style)).toThrow(/Unknown layout id/);
    expect(listRegisteredLayouts()).toContain('cover-standard-signature-v1');
  });

  it.openspec('OA-TMP-017')('rejects style mismatch between spec and style profile', () => {
    const style = loadStyleProfile(stylePath);
    const spec = loadContractSpec(specPaths[0]);
    const badSpec = { ...spec, style_id: 'different-style-v2' };

    expect(() => renderFromValidatedSpec(badSpec, style)).toThrow(/Style mismatch/);
  });

  it.openspec('OA-TMP-017')('validates style token spacing types before rendering', () => {
    const rawStyle = JSON.parse(readFileSync(stylePath, 'utf-8')) as Record<string, unknown>;
    const badStyle = {
      ...rawStyle,
      spacing: {
        ...(rawStyle.spacing as Record<string, unknown>),
        body_after: '120'
      }
    };

    expect(() => validateStyleProfile(badStyle, stylePath)).toThrow(/spacing.body_after/);
  });
});
