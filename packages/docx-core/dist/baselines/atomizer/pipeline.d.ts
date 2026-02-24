/**
 * Atomizer Pipeline
 *
 * Main orchestration for the atomizer-based document comparison.
 * Integrates atomization, LCS comparison, move detection, format detection,
 * and document reconstruction.
 */
import type { CompareResult, ReconstructionMode } from '../../index.js';
import type { MoveDetectionSettings, FormatDetectionSettings } from '../../core-types.js';
import { type NumberingIntegrationOptions } from './numberingIntegration.js';
/**
 * Options for the atomizer pipeline.
 */
export interface AtomizerOptions {
    /** Author name for track changes. Default: "Comparison" */
    author?: string;
    /** Timestamp for track changes. Default: current time */
    date?: Date;
    /** Move detection settings */
    moveDetection?: Partial<MoveDetectionSettings>;
    /** Format detection settings */
    formatDetection?: Partial<FormatDetectionSettings>;
    /** Numbering integration settings */
    numbering?: Partial<NumberingIntegrationOptions>;
    /**
     * Pre-compare normalization: merge adjacent <w:r> siblings with identical formatting.
     *
     * This reduces overly-fragmented diffs without relying on atom-level cross-run text merging,
     * and can improve revision grouping in Word.
     *
     * Default: false.
     */
    premergeRuns?: boolean;
    /**
     * How to reconstruct the output:
     * - 'rebuild': rebuild document.xml from atoms (best reject/accept idempotency)
     * - 'inplace': modify the revised document AST in place (experimental)
     *
     * Default: 'rebuild'
     */
    reconstructionMode?: ReconstructionMode;
}
/**
 * Compare two DOCX documents using the atomizer-based approach.
 *
 * Pipeline steps:
 * 1. Load DOCX archives
 * 2. Extract document.xml
 * 3. Parse to WmlElement trees
 * 4. Atomize both documents
 * 5. (Optional) Apply numbering virtualization
 * 6. Run LCS on atom hashes
 * 7. Mark correlation status
 * 8. Run move detection
 * 9. Run format detection
 * 10. Reconstruct document with track changes
 * 11. Save and return result
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - Pipeline options
 * @returns Comparison result with track changes document
 */
export declare function compareDocumentsAtomizer(original: Buffer, revised: Buffer, options?: AtomizerOptions): Promise<CompareResult>;
//# sourceMappingURL=pipeline.d.ts.map