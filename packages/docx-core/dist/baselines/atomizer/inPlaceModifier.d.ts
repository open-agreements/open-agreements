/**
 * In-Place AST Modifier
 *
 * Modifies the revised document's AST in-place to add track changes markup.
 * This replaces the reconstruction-based approach with direct tree manipulation.
 *
 * Key operations:
 * - wrapAsInserted: Wrap run elements with <w:ins> for inserted content
 * - insertDeletedContent: Clone and insert deleted content with <w:del> wrapper
 * - wrapAsMoveFrom/wrapAsMoveTo: Add move tracking with range markers
 * - addFormatChange: Add <w:rPrChange> for formatting differences
 */
import type { ComparisonUnitAtom } from '../../core-types.js';
/**
 * Options for in-place modification.
 */
export interface InPlaceModifierOptions {
    /** Author name for track changes */
    author: string;
    /** Timestamp for track changes */
    date: Date;
}
/**
 * State for tracking revision IDs during modification.
 */
interface RevisionIdState {
    nextId: number;
    moveRangeIds: Map<string, {
        sourceRangeId: number;
        destRangeId: number;
    }>;
    /** Track which run elements have already been wrapped */
    wrappedRuns: Set<Element>;
    /**
     * Source bookmark markers cloned into inserted deleted/moveFrom content.
     * Prevents duplicate marker emission when a single source run is split into
     * multiple atoms (word-level atomization).
     */
    emittedSourceBookmarkMarkers: Set<Element>;
}
/**
 * Create initial revision ID state.
 */
declare function createRevisionIdState(): RevisionIdState;
interface BookmarkSurvivalContext {
    isParagraphRemovedOnReject?: (paragraph: Element) => boolean;
}
/**
 * Wrap a run element with <w:ins> to mark it as inserted.
 *
 * @param run - The w:r element to wrap
 * @param author - Author name for track changes
 * @param dateStr - Formatted date string
 * @param state - Revision ID state
 * @returns true if wrapped, false if run was already wrapped or has no parent
 */
export declare function wrapAsInserted(run: Element, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Wrap a run element with <w:del> to mark it as deleted.
 * Also converts w:t to w:delText within the run.
 *
 * @param run - The w:r element to wrap
 * @param author - Author name for track changes
 * @param dateStr - Formatted date string
 * @param state - Revision ID state
 * @returns true if wrapped, false if run was already wrapped or has no parent
 */
export declare function wrapAsDeleted(run: Element, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Clone a deleted run from the original document and insert it into the revised document.
 *
 * @param deletedAtom - Atom with the deleted content
 * @param insertAfterRun - The run to insert after (null to insert at beginning of paragraph)
 * @param targetParagraph - The paragraph to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted del element, or null if insertion failed
 */
export declare function insertDeletedRun(deletedAtom: ComparisonUnitAtom, insertAfterRun: Element | null, targetParagraph: Element, author: string, dateStr: string, state: RevisionIdState, context?: BookmarkSurvivalContext): Element | null;
/**
 * Clone a moved-from run from the original document and insert it into the revised document.
 *
 * MovedSource atoms have their sourceRunElement in the ORIGINAL tree, but we need to
 * insert the content into the REVISED tree. This function clones the run, wraps it with
 * <w:moveFrom> and range markers, and inserts at the correct position.
 *
 * @param atom - Atom with the moved-from content
 * @param moveName - Name for linking source and destination
 * @param insertAfterRun - The run to insert after (null to insert at beginning of paragraph)
 * @param targetParagraph - The paragraph to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted moveFrom element, or null if insertion failed
 */
export declare function insertMoveFromRun(atom: ComparisonUnitAtom, moveName: string, insertAfterRun: Element | null, targetParagraph: Element, author: string, dateStr: string, state: RevisionIdState, context?: BookmarkSurvivalContext): Element | null;
/**
 * Clone a deleted paragraph from the original document and insert it.
 *
 * @param deletedAtom - Atom representing the deleted paragraph
 * @param insertAfterParagraph - Paragraph to insert after (null to insert at body start)
 * @param targetBody - The body element to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted paragraph, or null if insertion failed
 */
export declare function insertDeletedParagraph(deletedAtom: ComparisonUnitAtom, insertAfterParagraph: Element | null, targetBody: Element, author: string, dateStr: string, state: RevisionIdState): Element | null;
/**
 * Wrap a run element with <w:moveFrom> for moved-from content.
 *
 * @param run - The w:r element to wrap
 * @param moveName - Name for linking source and destination
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns true if wrapped
 */
export declare function wrapAsMoveFrom(run: Element, moveName: string, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Wrap a run element with <w:moveTo> for moved-to content.
 *
 * @param run - The w:r element to wrap
 * @param moveName - Name for linking source and destination
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns true if wrapped
 */
export declare function wrapAsMoveTo(run: Element, moveName: string, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Add format change tracking to a run's properties.
 *
 * @param run - The w:r element with changed formatting
 * @param oldRunProperties - The original run properties (w:rPr)
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export declare function addFormatChange(run: Element, oldRunProperties: Element | null, author: string, dateStr: string, state: RevisionIdState): void;
/**
 * Add a paragraph property change element (w:pPrChange) to record the "before"
 * state of paragraph properties.  This is needed for Google Docs to display
 * inserted paragraphs as tracked changes.
 *
 * The child `<w:pPr>` inside `w:pPrChange` must conform to CT_PPrBase — it
 * MUST NOT contain w:rPr, w:sectPr, or w:pPrChange.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export declare function addParagraphPropertyChange(paragraph: Element, author: string, dateStr: string, state: RevisionIdState): void;
/**
 * Returns true if a w:r element contains at least one visible content child.
 * Empty runs (containing only w:rPr or nothing) return false.
 */
export declare function runHasVisibleContent(run: Element): boolean;
/**
 * Wrap an inserted empty paragraph with <w:ins>.
 *
 * For empty paragraphs (no content, only pPr), we wrap the entire paragraph.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export declare function wrapParagraphAsInserted(paragraph: Element, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Wrap a deleted empty paragraph with <w:del>.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export declare function wrapParagraphAsDeleted(paragraph: Element, author: string, dateStr: string, state: RevisionIdState): boolean;
/**
 * Pre-split revised-tree runs that contain atoms with mixed correlation statuses.
 *
 * Without this, `handleInserted` wraps the entire run with `<w:ins>`, destroying
 * Equal content in the same run. After splitting, each fragment is a separate
 * `<w:r>` and existing per-status handlers work without modification.
 *
 * Safety: wrapped in try/catch per run group. If any DOM operation fails, the
 * run is skipped and the existing fallback-to-rebuild architecture handles it.
 */
export declare function preSplitMixedStatusRuns(mergedAtoms: ComparisonUnitAtom[]): void;
/**
 * Pre-split revised-tree runs where word-split Equal atoms from the same run
 * are interleaved with Deleted/MovedSource atoms in the merged atom list.
 *
 * `preSplitMixedStatusRuns` handles the case where a single run contains atoms
 * with DIFFERENT statuses (e.g., some Equal and some Inserted). But it cannot
 * handle the case where ALL atoms from a run are Equal yet Deleted atoms (from
 * the original tree) are interspersed between them in the merged list.
 *
 * Without this split, `handleEqual` sees all Equal atoms pointing to the same
 * run and skips position advancement (the `lastRevisedRunAnchor` optimization).
 * Subsequent `handleDeleted` calls then insert deleted content at the wrong
 * position because the cursor never advanced past the shared run.
 *
 * This function detects interleaved sequences and splits the DOM run so each
 * contiguous group of Equal atoms gets its own run fragment. The handlers then
 * advance the cursor correctly across fragments.
 */
export declare function preSplitInterleavedWordRuns(mergedAtoms: ComparisonUnitAtom[]): void;
/**
 * Modify the revised document's AST in-place based on comparison results.
 *
 * @param revisedRoot - Root element of the revised document
 * @param mergedAtoms - Atoms with correlation status from comparison
 * @param options - Modification options
 * @returns The modified XML string
 */
export declare function modifyRevisedDocument(revisedRoot: Element, originalAtoms: ComparisonUnitAtom[], revisedAtoms: ComparisonUnitAtom[], mergedAtoms: ComparisonUnitAtom[], options: InPlaceModifierOptions): string;
/**
 * Reorder merged atoms so that within each contiguous block of non-equal atoms,
 * all deletion-like atoms come before all insertion-like atoms.
 *
 * This produces grouped tracked changes ("<del>old words</del><ins>new words</ins>")
 * instead of alternating word-by-word pairs ("<del>old1</del><ins>new1</ins><del>old2</del>...").
 */
export declare function groupDeletionsBeforeInsertions(atoms: ComparisonUnitAtom[]): ComparisonUnitAtom[];
/**
 * Check if an adjacent w:del + w:ins pair is a no-op (identical text and formatting).
 * Both wrappers must contain the same number of runs with matching rPr and content.
 */
export declare function isNoOpPair(del: Element, ins: Element): boolean;
/**
 * Suppress no-op del/ins pairs — adjacent w:del + w:ins wrappers where the
 * content and formatting are identical. These arise from field-adjacent atoms
 * that are false-positive changes.
 *
 * When a no-op is detected, both wrappers are unwrapped, leaving the ins-side
 * runs as plain (non-tracked) children. The del-side runs are removed.
 */
export declare function suppressNoOpChangePairs(root: Element): void;
/**
 * Merge track-change wrappers (w:del or w:ins) that are separated by a
 * whitespace-only run. This groups "word-by-word" tracked changes into
 * contiguous blocks for cleaner presentation.
 *
 * For w:del: clones the whitespace run, converts w:t→w:delText, and absorbs
 * both the whitespace and the second wrapper's children into the first wrapper.
 *
 * For w:ins: moves the whitespace run into the first wrapper, then absorbs
 * the second wrapper's children.
 *
 * Both projections (Accept All, Reject All) remain correct because each
 * wrapper independently contains the whitespace it needs.
 */
export declare function mergeWhitespaceBridgedTrackChanges(root: Element): void;
/**
 * Coalesce alternating del/ins pair chains separated by whitespace-only runs
 * into single grouped del + ins wrappers.
 *
 * Pattern: [w:del, w:ins, ws-segment..., w:del, w:ins, ws-segment..., w:del, w:ins]
 *
 * For each whitespace segment between consecutive [del, ins] pairs:
 * 1. Clone each ws-run → convert to delText → append to first del
 * 2. Clone each ws-run → keep as w:t → append to first ins
 * 3. Move nextDel's children into first del
 * 4. Move nextIns's children into first ins
 * 5. Remove original ws-runs, empty nextDel, empty nextIns from parent
 *
 * Safety invariants:
 * - Only bridges when both del AND ins absorb the whitespace (both projections correct)
 * - Incomplete tail [del, ins, ws, del] (no trailing ins) → stop chain, don't bridge
 * - All wrappers in chain must share same w:author and w:date
 */
export declare function coalesceDelInsPairChains(root: Element): void;
export { createRevisionIdState, type RevisionIdState };
//# sourceMappingURL=inPlaceModifier.d.ts.map