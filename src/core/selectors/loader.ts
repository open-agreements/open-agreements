/**
 * Discover and validate selector-contract manifests for a fieldSelector.
 *
 * A fieldSelector opts a field into the selector engine by adding
 * `field-selectors/<id>/fields/<field_id>.json`. The cutover from the legacy
 * `replacements.json` path is declared in `field-selectors/<id>/template-manifest.json`
 * via `migrated_keys`. FieldSelectors with no `fields/` directory load nothing here and
 * keep today's behavior exactly.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  FieldSelectorManifestSchema,
  TemplateManifestSchema,
  type FieldSelectorManifest,
  type TemplateManifest,
} from './manifest-schema.js';

export interface SelectorContracts {
  manifests: FieldSelectorManifest[];
  templateManifest: TemplateManifest | null;
}

/**
 * Load every `fields/*.json` selector manifest for a fieldSelector plus its optional
 * `template-manifest.json`. Returns empty manifests (and null template manifest)
 * when the fieldSelector has no `fields/` directory.
 *
 * @param fieldSelectorDir absolute path to the fieldSelector directory
 * @param metadataFieldNames the field names declared in the fieldSelector `metadata.yaml`
 *   — every manifest `field_id` MUST appear here (the cross-repo join key).
 */
export function loadSelectorContracts(fieldSelectorDir: string, metadataFieldNames: Iterable<string>): SelectorContracts {
  const fieldsDir = join(fieldSelectorDir, 'fields');
  if (!existsSync(fieldsDir)) {
    return { manifests: [], templateManifest: null };
  }

  const fieldNameSet = new Set(metadataFieldNames);
  const manifests: FieldSelectorManifest[] = [];
  const seenFieldIds = new Set<string>();

  const files = readdirSync(fieldsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const file of files) {
    const path = join(fieldsDir, file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf-8'));
    } catch (err) {
      throw new Error(`Invalid JSON in selector manifest ${path}: ${(err as Error).message}`);
    }

    const result = FieldSelectorManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Selector manifest ${path} failed validation: ${result.error.message}`);
    }
    const manifest = result.data;

    // The filename stem should equal the field_id for predictability.
    const stem = basename(file, '.json');
    if (stem !== manifest.field_id) {
      throw new Error(`Selector manifest ${path}: filename stem '${stem}' must equal field_id '${manifest.field_id}'`);
    }
    if (seenFieldIds.has(manifest.field_id)) {
      throw new Error(`Duplicate selector manifest for field_id '${manifest.field_id}' in ${fieldsDir}`);
    }
    if (!fieldNameSet.has(manifest.field_id)) {
      throw new Error(
        `Selector manifest ${path}: field_id '${manifest.field_id}' is not a field in metadata.yaml ` +
          `(field_id is the cross-repo join key and must match a declared field).`,
      );
    }
    seenFieldIds.add(manifest.field_id);
    manifests.push(manifest);
  }

  const templateManifestPath = join(fieldSelectorDir, 'template-manifest.json');
  let templateManifest: TemplateManifest | null = null;
  if (existsSync(templateManifestPath)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(templateManifestPath, 'utf-8'));
    } catch (err) {
      throw new Error(`Invalid JSON in ${templateManifestPath}: ${(err as Error).message}`);
    }
    const result = TemplateManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Template manifest ${templateManifestPath} failed validation: ${result.error.message}`);
    }
    templateManifest = result.data;
  }

  return { manifests, templateManifest };
}
