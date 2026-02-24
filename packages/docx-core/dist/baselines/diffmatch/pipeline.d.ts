/**
 * Baseline B: Pure TypeScript document comparison pipeline.
 *
 * Orchestrates the comparison flow:
 * 1. Load DOCX archives
 * 2. Extract paragraphs
 * 3. Align paragraphs (LCS + similarity)
 * 4. Diff runs within matched paragraphs
 * 5. Render track changes
 * 6. Build output document
 */
import type { CompareResult } from '../../index.js';
/**
 * Options for Baseline B comparison.
 */
export interface BaselineBOptions {
    /** Author name for track changes. Default: "Comparison" */
    author?: string;
    /** Timestamp for track changes. Default: current time */
    date?: Date;
    /** Minimum similarity to consider paragraphs matched. Default: 0.5 */
    similarityThreshold?: number;
}
/**
 * Compare two DOCX documents using the Baseline B (pure TypeScript) approach.
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - Comparison options
 * @returns Comparison result with track changes document
 */
export declare function compareDocumentsBaselineB(original: Buffer, revised: Buffer, options?: BaselineBOptions): Promise<CompareResult>;
//# sourceMappingURL=pipeline.d.ts.map