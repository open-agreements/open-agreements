import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateContractSpec, validateStyleProfile } from './schema.mjs';
import { renderCoverStandardSignatureV1 } from './layouts/cover-standard-signature-v1.mjs';

const LAYOUTS = {
  'cover-standard-signature-v1': renderCoverStandardSignatureV1,
};

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf-8'));
}

export function loadContractSpec(path) {
  return validateContractSpec(readJson(path), path);
}

export function loadStyleProfile(path) {
  return validateStyleProfile(readJson(path), path);
}

export function listRegisteredLayouts() {
  return Object.keys(LAYOUTS).sort();
}

export function renderFromValidatedSpec(spec, style) {
  if (spec.style_id !== style.id) {
    throw new Error(
      `Style mismatch for template ${spec.template_id}: spec style_id=${spec.style_id} does not match style id=${style.id}`
    );
  }

  const renderLayout = LAYOUTS[spec.layout_id];
  if (!renderLayout) {
    throw new Error(
      `Unknown layout id '${spec.layout_id}' for template ${spec.template_id}. Registered layouts: ${listRegisteredLayouts().join(', ')}`
    );
  }

  return renderLayout(spec, style);
}

export function renderFromPaths(specPath, stylePath) {
  const spec = loadContractSpec(specPath);
  const style = loadStyleProfile(stylePath);
  return {
    spec,
    style,
    ...renderFromValidatedSpec(spec, style),
  };
}
