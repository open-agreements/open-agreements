/**
 * Move Detection Module
 *
 * Detects relocated content after LCS comparison by matching deleted blocks
 * with inserted blocks using Jaccard word similarity.
 *
 * Pipeline position:
 * LCS() → MarkRowsAsDeletedOrInserted() → FlattenToAtomList() → detectMovesInAtomList() → CoalesceRecurse()
 *
 * @see WmlComparer.cs DetectMovesInAtomList() line 3811
 */
import { AtomBlock, ComparisonUnitAtom, CorrelationStatus, MoveDetectionSettings } from './core-types.js';
/**
 * Extract text content from an atom.
 *
 * @param atom - The atom to extract text from
 * @returns The text content, or empty string for non-text atoms
 */
export declare function getAtomText(atom: ComparisonUnitAtom): string;
/**
 * Extract text from a sequence of atoms.
 *
 * @param atoms - The atoms to extract text from
 * @returns Combined text content
 */
export declare function getAtomsText(atoms: ComparisonUnitAtom[]): string;
/**
 * Count words in text.
 *
 * @param text - The text to count words in
 * @returns Number of words
 */
export declare function countWords(text: string): number;
/**
 * Calculate Jaccard similarity between two texts based on word sets.
 *
 * Jaccard index = |intersection| / |union|
 *
 * Benefits:
 * - Order-independent: "fox quick brown" matches "brown quick fox"
 * - Handles insertions/deletions well: adding one word to a 10-word block only slightly reduces similarity
 * - O(n) complexity where n = total words
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @param caseInsensitive - Whether to ignore case (default: true)
 * @returns Similarity score between 0 and 1
 *
 * @example
 * jaccardWordSimilarity("The quick brown fox", "The quick brown dog")
 * // Returns 0.6 (3 common words / 5 total unique words)
 */
export declare function jaccardWordSimilarity(text1: string, text2: string, caseInsensitive?: boolean): number;
/**
 * Group consecutive atoms by correlation status.
 *
 * Creates blocks of atoms with the same status (Deleted or Inserted).
 *
 * @param atoms - The atoms to group
 * @returns Array of atom blocks
 */
export declare function groupIntoBlocks(atoms: ComparisonUnitAtom[]): AtomBlock[];
/**
 * Result of finding the best match for a deleted block.
 */
interface MatchResult {
    /** The matching inserted block */
    block: AtomBlock;
    /** Similarity score between 0 and 1 */
    similarity: number;
    /** Index in the insertedBlocks array */
    index: number;
}
/**
 * Find the best matching inserted block for a deleted block.
 *
 * @param deleted - The deleted block to match
 * @param insertedBlocks - Available inserted blocks
 * @param settings - Move detection settings
 * @returns The best match, or undefined if no match meets threshold
 */
export declare function findBestMatch(deleted: AtomBlock, insertedBlocks: AtomBlock[], settings: MoveDetectionSettings): MatchResult | undefined;
/**
 * Mark atoms as part of a move operation.
 *
 * @param atoms - Atoms to mark
 * @param status - New correlation status (MovedSource or MovedDestination)
 * @param moveGroupId - ID linking source and destination
 * @param moveName - Name for move tracking (e.g., "move1")
 */
export declare function markAsMove(atoms: ComparisonUnitAtom[], status: CorrelationStatus.MovedSource | CorrelationStatus.MovedDestination, moveGroupId: number, moveName: string): void;
/**
 * Detect moves in a flat list of atoms.
 *
 * Runs after LCS comparison to identify deleted blocks that were actually
 * moved to a new location. Updates atoms in place with move status.
 *
 * @param atoms - The atom list to process (modified in place)
 * @param settings - Move detection settings (optional, uses defaults)
 *
 * @see WmlComparer.cs DetectMovesInAtomList() line 3811
 *
 * @example
 * const atoms = atomizeTree(document, [], part);
 * runLCSComparison(atoms);
 * detectMovesInAtomList(atoms); // Updates atoms in place
 */
export declare function detectMovesInAtomList(atoms: ComparisonUnitAtom[], settings?: MoveDetectionSettings): void;
/**
 * Options for generating move markup.
 */
export interface MoveMarkupOptions {
    /** Author name for revision tracking */
    author: string;
    /** Timestamp for revisions */
    dateTime: Date;
    /** Starting ID for range markers */
    startId: number;
}
/**
 * Generated move markup for a block.
 */
export interface MoveMarkup {
    /** Range start element */
    rangeStart: Element;
    /** Move content wrapper element */
    moveWrapper: Element;
    /** Range end element */
    rangeEnd: Element;
    /** Next available ID after these elements */
    nextId: number;
}
/**
 * Generate move source markup (w:moveFrom with range markers).
 *
 * @param moveName - Name linking source and destination (e.g., "move1")
 * @param content - Child elements to wrap
 * @param options - Markup generation options
 * @returns Move markup elements
 *
 * @example
 * Output structure:
 * <w:moveFromRangeStart w:id="1" w:name="move1" w:author="..." w:date="..."/>
 * <w:moveFrom w:id="2" w:author="..." w:date="...">
 *   <!-- content -->
 * </w:moveFrom>
 * <w:moveFromRangeEnd w:id="1"/>
 */
export declare function generateMoveSourceMarkup(moveName: string, content: Element[], options: MoveMarkupOptions): MoveMarkup;
/**
 * Generate move destination markup (w:moveTo with range markers).
 *
 * @param moveName - Name linking source and destination (e.g., "move1")
 * @param content - Child elements to wrap
 * @param options - Markup generation options
 * @returns Move markup elements
 *
 * @example
 * Output structure:
 * <w:moveToRangeStart w:id="3" w:name="move1" w:author="..." w:date="..."/>
 * <w:moveTo w:id="4" w:author="..." w:date="...">
 *   <!-- content -->
 * </w:moveTo>
 * <w:moveToRangeEnd w:id="3"/>
 */
export declare function generateMoveDestinationMarkup(moveName: string, content: Element[], options: MoveMarkupOptions): MoveMarkup;
/**
 * State for tracking revision IDs during markup generation.
 */
export interface RevisionIdState {
    /** Next available ID */
    nextId: number;
    /** Move name to range start ID mapping */
    moveRangeIds: Map<string, {
        sourceRangeId: number;
        destRangeId: number;
    }>;
}
/**
 * Create initial revision ID state.
 *
 * @param startId - Starting ID (default: 1)
 * @returns Initial state
 */
export declare function createRevisionIdState(startId?: number): RevisionIdState;
/**
 * Allocate IDs for a move operation.
 *
 * Ensures source and destination use consistent IDs for proper linking.
 *
 * @param state - Revision ID state (modified in place)
 * @param moveName - Move name (e.g., "move1")
 * @returns IDs for source and destination markup
 */
export declare function allocateMoveIds(state: RevisionIdState, moveName: string): {
    sourceRangeId: number;
    sourceMoveId: number;
    destRangeId: number;
    destMoveId: number;
};
/**
 * Fix up revision IDs after all moves have been processed.
 *
 * Ensures proper ID pairing between source and destination elements.
 * This is a post-processing step after markup generation.
 *
 * @param state - The revision ID state
 */
export declare function fixUpRevisionIds(_state: RevisionIdState): void;
export {};
//# sourceMappingURL=move-detection.d.ts.map