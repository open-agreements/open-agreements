/**
 * Apply resolved selector spans to a document and serialize.
 *
 * Each resolved occurrence is rewritten to a `{field_id}` template tag via the
 * `DocxDocument.replaceTextAtRange` method (raw offsets come from the locator's
 * clean_text→raw map), so downstream `docx-templates` fill substitutes the tag
 * unchanged. The injected `_bk_*` bookmarks are stripped on serialization
 * (`toBuffer({ cleanBookmarks: true })`) for parity with the legacy path.
 */
import { writeFileSync } from 'node:fs';
import type { DocxDocument } from '@usejunior/docx-core';
import type { FieldResolution } from './resolve.js';

export interface PatchOp {
  field_id: string;
  nodeId: string;
  start: number;
  end: number;
  replaceText: string;
}

/**
 * Build the patch ops for every RESOLVED occurrence. Unresolved occurrences are
 * skipped here (the caller decides block/warn/skip via `failure_behavior`).
 */
export function buildPatchOps(fields: FieldResolution[]): PatchOp[] {
  const ops: PatchOp[] = [];
  for (const field of fields) {
    for (const occ of field.occurrences) {
      const match = occ.resolution.match;
      if (!match) continue; // unresolved — not patched
      ops.push({
        field_id: field.field_id,
        nodeId: match.nodeId,
        start: match.start,
        end: match.end,
        replaceText: `{${field.field_id}}`,
      });
    }
  }
  return ops;
}

/**
 * Apply patch ops in place. Ops in the same paragraph are applied
 * highest-offset-first so earlier offsets stay valid as text length changes.
 * Overlapping spans within a paragraph are a programming/authoring error and
 * throw rather than corrupt the document.
 */
export function applySelectorPatches(doc: DocxDocument, ops: PatchOp[]): void {
  const byNode = new Map<string, PatchOp[]>();
  for (const op of ops) {
    const list = byNode.get(op.nodeId) ?? [];
    list.push(op);
    byNode.set(op.nodeId, list);
  }
  for (const [nodeId, list] of byNode) {
    list.sort((a, b) => b.start - a.start);
    let prevStart = Number.POSITIVE_INFINITY;
    for (const op of list) {
      if (op.end > prevStart) {
        throw new Error(`Overlapping selector spans in paragraph ${nodeId} (field ${op.field_id})`);
      }
      doc.replaceTextAtRange({
        targetParagraphId: op.nodeId,
        start: op.start,
        end: op.end,
        replaceText: op.replaceText,
      });
      prevStart = op.start;
    }
  }
}

/** Serialize the patched document, stripping injected `_bk_*` bookmarks. */
export async function serializeSelectorDoc(doc: DocxDocument, outputPath: string): Promise<void> {
  const { buffer } = await doc.toBuffer({ cleanBookmarks: true });
  writeFileSync(outputPath, buffer);
}
