/**
 * Hierarchical LCS Comparison
 *
 * Implements two-level comparison like WmlComparer:
 * 1. First pass: LCS on paragraph GROUPS (coarse alignment)
 * 2. Second pass: LCS on atoms WITHIN matched groups (fine alignment)
 *
 * This prevents atoms from one paragraph matching random fragments
 * in other paragraphs.
 *
 * Additionally, large paragraphs (like definition sections) are split
 * on soft breaks (w:br) to prevent cross-definition contamination.
 */
import type { ComparisonUnitAtom } from '../../core-types.js';
import { type LcsResult } from './atomLcs.js';
/**
 * Default paragraph-level similarity threshold used for group matching.
 *
 * Lower values favor treating modified paragraphs as aligned pairs (so atom-level
 * comparison can run), while higher values favor whole-paragraph replacement.
 */
export declare const DEFAULT_PARAGRAPH_SIMILARITY_THRESHOLD = 0.25;
/**
 * A group of atoms belonging to the same paragraph.
 * Used for paragraph-level comparison.
 */
export interface ComparisonUnitGroup {
    /** Paragraph index from atom.paragraphIndex */
    paragraphIndex: number;
    /** Atoms in this paragraph */
    atoms: ComparisonUnitAtom[];
    /** Hash of concatenated text content for paragraph-level matching */
    textHash: string;
    /** Hash of normalized text used only for matching heuristics */
    normalizedTextHash: string;
    /** Concatenated text content for similarity calculation */
    textContent: string;
}
/**
 * Options for hierarchical comparison.
 */
export interface HierarchicalCompareOptions {
    /** Minimum similarity (0-1) to consider groups as matching. Default: 0.25 */
    similarityThreshold?: number;
}
/**
 * Result of paragraph-level LCS comparison.
 */
export interface GroupLcsResult {
    /** Matched paragraph pairs */
    matchedGroups: Array<{
        originalIndex: number;
        revisedIndex: number;
    }>;
    /** Indices of paragraphs only in original (deleted) */
    deletedGroupIndices: number[];
    /** Indices of paragraphs only in revised (inserted) */
    insertedGroupIndices: number[];
}
/**
 * Group atoms by paragraph index.
 *
 * @param atoms - Atoms with paragraphIndex set
 * @returns Array of paragraph groups in document order
 */
export declare function groupAtomsByParagraphIndex(atoms: ComparisonUnitAtom[]): ComparisonUnitGroup[];
/**
 * Group atoms by paragraph, then split large paragraphs on soft breaks (w:br).
 *
 * This handles mega-paragraphs like definition sections where many definitions
 * are in a single paragraph separated by soft breaks. Without this split,
 * the atom-level LCS can match fragments across definition boundaries.
 *
 * @param atoms - Atoms with paragraphIndex set
 * @returns Array of groups, potentially more than the number of paragraphs
 */
export declare function groupAtomsByParagraphAndBreaks(atoms: ComparisonUnitAtom[]): ComparisonUnitGroup[];
/**
 * Compute LCS on paragraph groups with similarity fallback.
 *
 * Two passes:
 * 1. LCS with exact text hash matching (fast path)
 * 2. Similarity matching for unmatched groups (fallback)
 *
 * @param originalGroups - Groups from original document
 * @param revisedGroups - Groups from revised document
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.25)
 */
export declare function computeGroupLcs(originalGroups: ComparisonUnitGroup[], revisedGroups: ComparisonUnitGroup[], similarityThreshold?: number): GroupLcsResult;
/**
 * Perform hierarchical LCS comparison.
 *
 * Pipeline:
 * 1. Group atoms by paragraph
 * 2. LCS on paragraph groups (coarse alignment) with similarity fallback
 * 3. For matched groups: LCS on atoms within them
 * 4. For unmatched groups: mark all atoms as deleted/inserted
 *
 * @param originalAtoms - Atoms from original document
 * @param revisedAtoms - Atoms from revised document
 * @param options - Comparison options including similarity threshold
 * @returns Combined atom-level LCS result
 */
export declare function hierarchicalCompare(originalAtoms: ComparisonUnitAtom[], revisedAtoms: ComparisonUnitAtom[], options?: HierarchicalCompareOptions): LcsResult;
/**
 * Mark correlation status using hierarchical comparison result.
 *
 * Same as regular markCorrelationStatus but uses hierarchical LCS result.
 */
export declare function markHierarchicalCorrelationStatus(original: ComparisonUnitAtom[], revised: ComparisonUnitAtom[], lcsResult: LcsResult): void;
//# sourceMappingURL=hierarchicalLcs.d.ts.map