/**
 * Document Reconstructor
 *
 * Rebuilds document.xml from marked atoms with track changes.
 * Generates w:ins, w:del, w:moveFrom, w:moveTo elements as appropriate.
 */
import type { ComparisonUnitAtom } from '../../core-types.js';
/**
 * Options for document reconstruction.
 */
export interface ReconstructorOptions {
    /** Author name for track changes */
    author: string;
    /** Timestamp for track changes */
    date: Date;
}
/**
 * Reconstruct document.xml from merged atoms with track changes.
 *
 * @param mergedAtoms - Atoms with correlation status set
 * @param originalXml - Original document.xml for structure preservation
 * @param options - Reconstruction options
 * @returns New document.xml with track changes
 */
export declare function reconstructDocument(mergedAtoms: ComparisonUnitAtom[], originalXml: string, options: ReconstructorOptions): string;
/**
 * Reset empty paragraph debug counters.
 */
export declare function resetEmptyParagraphCounters(): void;
/**
 * Get empty paragraph debug counters.
 */
export declare function getEmptyParagraphCounters(): {
    inserted: number;
    deleted: number;
    equal: number;
    other: number;
};
/**
 * Reset debug counters (for testing).
 */
export declare function resetDebugCounters(): void;
/**
 * Get debug counters (for testing).
 */
export declare function getDebugCounters(): {
    atoms: number;
    wt: number;
};
/**
 * Statistics from reconstruction.
 */
export interface ReconstructionStats {
    paragraphs: number;
    insertions: number;
    deletions: number;
    moves: number;
    formatChanges: number;
}
/**
 * Count statistics from merged atoms.
 */
export declare function computeReconstructionStats(mergedAtoms: ComparisonUnitAtom[]): ReconstructionStats;
//# sourceMappingURL=documentReconstructor.d.ts.map