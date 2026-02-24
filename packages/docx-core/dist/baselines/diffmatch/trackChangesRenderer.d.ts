/**
 * Baseline B: Track changes OOXML renderer.
 *
 * Generates OOXML track changes markup (w:ins, w:del) from diff results.
 */
import type { RunInfo } from '../../shared/ooxml/types.js';
/**
 * Reset the revision ID counter.
 */
export declare function resetRevisionIds(): void;
/**
 * Allocate a new revision ID.
 */
export declare function allocateRevisionId(): number;
/**
 * Format a date for OOXML (ISO 8601 format).
 */
export declare function formatOoxmlDate(date: Date): string;
/**
 * Escape XML special characters.
 */
export declare function escapeXml(text: string): string;
/**
 * Generate insertion markup.
 */
export declare function generateInsertion(runs: RunInfo[], author: string, date: Date): string;
/**
 * Generate deletion markup.
 */
export declare function generateDeletion(runs: RunInfo[], author: string, date: Date): string;
/**
 * Generate unchanged run markup.
 */
export declare function generateUnchangedRun(run: RunInfo): string;
/**
 * Options for rendering track changes.
 */
export interface RenderOptions {
    /** Author name for revisions */
    author: string;
    /** Timestamp for revisions */
    date: Date;
}
/**
 * Render merged runs with track changes to OOXML.
 *
 * @param mergedRuns - Runs with revision markers from diffRuns()
 * @param options - Rendering options
 * @returns OOXML paragraph content with track changes
 */
export declare function renderTrackChanges(mergedRuns: RunInfo[], options: RenderOptions): string;
/**
 * Wrap content in a paragraph element.
 */
export declare function wrapInParagraph(content: string, pPr?: string): string;
/**
 * Generate a complete deleted paragraph.
 */
export declare function generateDeletedParagraph(runs: RunInfo[], author: string, date: Date, pPr?: string): string;
/**
 * Generate a complete inserted paragraph.
 */
export declare function generateInsertedParagraph(runs: RunInfo[], author: string, date: Date, pPr?: string): string;
//# sourceMappingURL=trackChangesRenderer.d.ts.map