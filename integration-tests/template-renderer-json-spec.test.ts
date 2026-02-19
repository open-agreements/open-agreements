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

const it = itAllure.epic('Filling & Rendering');

const stylePath = join(import.meta.dirname, '..', 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');
const specPaths = [
  join(import.meta.dirname, '..', 'scripts', 'template-specs', 'openagreements-employment-offer-letter.json'),
  join(import.meta.dirname, '..', 'scripts', 'template-specs', 'openagreements-employee-ip-inventions-assignment.json'),
  join(import.meta.dirname, '..', 'scripts', 'template-specs', 'openagreements-employment-confidentiality-acknowledgement.json'),
];

describe('json template renderer', () => {
  it('supports multiple templates sharing the same layout id', () => {
    const style = loadStyleProfile(stylePath);
    const specs = specPaths.map((specPath) => loadContractSpec(specPath));

    const layoutIds = new Set(specs.map((spec) => spec.layout_id));
    expect(layoutIds.size).toBe(1);
    expect(layoutIds.has('cover-standard-signature-v1')).toBe(true);

    const outputs = specs.map((spec) => renderFromValidatedSpec(spec, style));
    expect(outputs).toHaveLength(3);
    expect(outputs[0].markdown).toContain('## Standard Terms');
    expect(outputs[1].markdown).toContain('## Signatures');
    expect(outputs[2].markdown).toContain('## Acknowledgement Signature');
  });

  it('rejects unknown layout ids with actionable error', () => {
    const style = loadStyleProfile(stylePath);
    const spec = loadContractSpec(specPaths[0]);
    const badSpec = { ...spec, layout_id: 'nonexistent-layout-v1' };

    expect(() => renderFromValidatedSpec(badSpec, style)).toThrow(/Unknown layout id/);
    expect(listRegisteredLayouts()).toContain('cover-standard-signature-v1');
  });

  it('rejects style mismatch between spec and style profile', () => {
    const style = loadStyleProfile(stylePath);
    const spec = loadContractSpec(specPaths[0]);
    const badSpec = { ...spec, style_id: 'different-style-v2' };

    expect(() => renderFromValidatedSpec(badSpec, style)).toThrow(/Style mismatch/);
  });

  it('validates style token spacing types before rendering', () => {
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
