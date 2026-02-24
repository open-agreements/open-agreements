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
 * Modify the revised document's AST in-place based on comparison results.
 *
 * @param revisedRoot - Root element of the revised document
 * @param mergedAtoms - Atoms with correlation status from comparison
 * @param options - Modification options
 * @returns The modified XML string
 */
export declare function modifyRevisedDocument(revisedRoot: Element, originalAtoms: ComparisonUnitAtom[], revisedAtoms: ComparisonUnitAtom[], mergedAtoms: ComparisonUnitAtom[], options: InPlaceModifierOptions): string;
export { createRevisionIdState, type RevisionIdState };
//# sourceMappingURL=inPlaceModifier.d.ts.map