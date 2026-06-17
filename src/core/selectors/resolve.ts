/**
 * Resolve selector-contract occurrence locators against a cleaned DOCX.
 *
 * Flow (per the engine spec): load the cleaned DOCX → `insertParagraphBookmarks`
 * (required: `buildDocumentView` only includes paragraphs carrying a `_bk_*` id
 * and `load()` does not insert them) → `buildDocumentView` → `resolveLocator`
 * for every occurrence of every field. Resolution is fully deterministic — the
 * determinism guarantee lives in the docx-core primitive.
 */
import { readFileSync } from 'node:fs';
import {
  DocxDocument,
  resolveLocator,
  type DocumentViewNode,
  type LocatorResolution,
} from '@usejunior/docx-core';
import type { FieldSelectorManifest } from './manifest-schema.js';

export interface OccurrenceResolution {
  index: number;
  resolution: LocatorResolution;
}

export interface FieldResolution {
  field_id: string;
  occurrences: OccurrenceResolution[];
  /** True when any occurrence locator resolved to zero or more than one span. */
  unresolved: boolean;
  /** Assertion failures across all occurrences (each a drift signal). */
  assertionFailures: Array<{ occurrenceIndex: number; kind: string; detail?: string }>;
}

export interface ResolveResult {
  /** The loaded, bookmarked document — the caller patches and serializes it. */
  doc: DocxDocument;
  view: DocumentViewNode[];
  fields: FieldResolution[];
}

export function resolveFieldAgainstView(view: DocumentViewNode[], manifest: FieldSelectorManifest): FieldResolution {
  const occurrences: OccurrenceResolution[] = manifest.occurrences.map((locator, index) => ({
    index,
    resolution: resolveLocator(view, locator),
  }));
  const unresolved = occurrences.some((o) => o.resolution.unresolved);
  const assertionFailures = occurrences.flatMap((o) =>
    o.resolution.assertionResults
      .filter((a) => !a.ok)
      .map((a) => ({ occurrenceIndex: o.index, kind: a.kind, detail: a.detail })),
  );
  return { field_id: manifest.field_id, occurrences, unresolved, assertionFailures };
}

/**
 * Load `cleanedDocxPath`, bookmark its paragraphs, build the view, and resolve
 * every occurrence locator. Returns the loaded document so the caller can patch
 * the resolved spans and serialize once.
 */
export async function resolveSelectorContracts(
  cleanedDocxPath: string,
  manifests: FieldSelectorManifest[],
): Promise<ResolveResult> {
  const buffer = readFileSync(cleanedDocxPath);
  const doc = await DocxDocument.load(buffer);
  doc.insertParagraphBookmarks('selector_contract');
  const { nodes } = doc.buildDocumentView();
  const fields = manifests.map((manifest) => resolveFieldAgainstView(nodes, manifest));
  return { doc, view: nodes, fields };
}
