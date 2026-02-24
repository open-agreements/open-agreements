/**
 * LCS Algorithm for Atoms
 *
 * Implements hash-based Longest Common Subsequence (LCS) algorithm
 * for comparing arrays of ComparisonUnitAtom.
 */
import type { ComparisonUnitAtom } from '../../core-types.js';
/**
 * Represents a match between atoms in original and revised documents.
 */
export interface AtomMatch {
    /** Index in the original atom array */
    originalIndex: number;
    /** Index in the revised atom array */
    revisedIndex: number;
}
/**
 * Result of the LCS comparison.
 */
export interface LcsResult {
    /** Matched atom pairs (in LCS) */
    matches: AtomMatch[];
    /** Indices of atoms only in original (deleted) */
    deletedIndices: number[];
    /** Indices of atoms only in revised (inserted) */
    insertedIndices: number[];
}
/**
 * Compute the Longest Common Subsequence of two atom arrays.
 *
 * Uses hash-based comparison for O(1) equality checks.
 * Time complexity: O(N * M) where N and M are array lengths.
 *
 * @param original - Atoms from the original document
 * @param revised - Atoms from the revised document
 * @returns LCS result with matches and differences
 */
export declare function computeAtomLcs(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[]): LcsResult;
/**
 * Mark correlation status on atoms based on LCS result.
 *
 * Sets atoms to Equal, Deleted, or Inserted status.
 * Also links matched atoms via comparisonUnitAtomBefore reference.
 *
 * @param original - Atoms from the original document
 * @param revised - Atoms from the revised document
 * @param lcsResult - Result from computeAtomLcs
 */
export declare function markCorrelationStatus(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[], lcsResult: LcsResult): void;
/**
 * Create a merged atom list for document reconstruction.
 *
 * Interleaves original and revised atoms in document order,
 * preserving the structure needed for track changes rendering.
 *
 * @param original - Atoms from the original document (with status marked)
 * @param revised - Atoms from the revised document (with status marked)
 * @param lcsResult - Result from computeAtomLcs
 * @returns Merged atom list in document order
 */
export declare function createMergedAtomList(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[], lcsResult: LcsResult): ComparisonUnitAtom[];
/**
 * Compute unified paragraph indices for merged atoms.
 *
 * Maps original and revised paragraph indices to a unified output paragraph index.
 * This ensures that:
 * 1. Atoms from corresponding paragraphs (Equal matches) share the same output index
 * 2. Deleted paragraphs get their own output indices interleaved with matched paragraphs
 * 3. Inserted paragraphs get their own output indices
 *
 * @param original - Original atoms with paragraphIndex set
 * @param revised - Revised atoms with paragraphIndex set
 * @param merged - Merged atom list
 * @param lcsResult - LCS result with matches
 */
export declare function assignUnifiedParagraphIndices(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[], merged: ComparisonUnitAtom[], lcsResult: LcsResult): void;
/**
 * Statistics from the LCS comparison.
 */
export interface LcsStats {
    /** Number of atoms that are equal */
    equal: number;
    /** Number of atoms deleted from original */
    deleted: number;
    /** Number of atoms inserted in revised */
    inserted: number;
    /** Total atoms in original */
    originalCount: number;
    /** Total atoms in revised */
    revisedCount: number;
}
/**
 * Compute statistics from LCS result.
 */
export declare function computeLcsStats(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[], lcsResult: LcsResult): LcsStats;
//# sourceMappingURL=atomLcs.d.ts.map