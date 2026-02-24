/**
 * Footnote Numbering Module
 *
 * Handles sequential footnote/endnote numbering by document order.
 *
 * Per ECMA-376, w:id on footnoteReference is a reference identifier, NOT the
 * display number. Display numbers are sequential based on document order.
 *
 * @example
 * Document has 91 footnotes with XML IDs 2-92 (IDs 0, 1 are reserved):
 * - Incorrect: Display as 2, 3, 4, ..., 92
 * - Correct: Display as 1, 2, 3, ..., 91
 */
import { FootnoteReference, WmlElement } from './core-types.js';
/**
 * Find all footnote or endnote references in document order.
 *
 * Recursively traverses the document tree to find references in reading order.
 *
 * @param element - The root element to search from
 * @param tagName - The reference tag to find ('w:footnoteReference' or 'w:endnoteReference')
 * @returns Array of reference elements in document order
 */
export declare function findReferencesInOrder(element: WmlElement, tagName: 'w:footnoteReference' | 'w:endnoteReference'): WmlElement[];
/**
 * Check if a footnote/endnote ID is reserved.
 *
 * IDs 0 and 1 are reserved for separator types per ECMA-376.
 *
 * @param xmlId - The XML ID to check
 * @returns True if this is a reserved ID
 */
export declare function isReservedId(xmlId: string): boolean;
/**
 * Tracks sequential footnote/endnote numbering by document order.
 *
 * Scans the document for footnote/endnote references and builds a mapping
 * from XML IDs to display numbers.
 *
 * @example
 * const tracker = new FootnoteNumberingTracker(documentRoot);
 * const displayNum = tracker.getDisplayNumber('42'); // Returns 1 if '42' is the first footnote
 */
export declare class FootnoteNumberingTracker {
    private footnoteIdToDisplayNumber;
    private endnoteIdToDisplayNumber;
    private footnoteCustomMarks;
    private endnoteCustomMarks;
    /**
     * Create a new tracker by scanning the document.
     *
     * @param documentRoot - The root element of the main document (w:document or w:body)
     */
    constructor(documentRoot: WmlElement);
    /**
     * Scan the document for footnote and endnote references.
     */
    private scanDocument;
    /**
     * Build the ID to display number mapping.
     */
    private buildNumbering;
    /**
     * Get the display number for a footnote by its XML ID.
     *
     * @param xmlId - The XML ID (w:id attribute)
     * @returns The display number, or undefined if not found or uses custom mark
     */
    getFootnoteDisplayNumber(xmlId: string): number | undefined;
    /**
     * Get the display number for an endnote by its XML ID.
     *
     * @param xmlId - The XML ID (w:id attribute)
     * @returns The display number, or undefined if not found or uses custom mark
     */
    getEndnoteDisplayNumber(xmlId: string): number | undefined;
    /**
     * Get the display number for a footnote or endnote by its XML ID.
     *
     * Convenience method that checks both footnotes and endnotes.
     *
     * @param xmlId - The XML ID
     * @returns The display number, or undefined if not found
     */
    getDisplayNumber(xmlId: string): number | undefined;
    /**
     * Check if a footnote uses a custom mark.
     *
     * @param xmlId - The XML ID
     * @returns True if this footnote has w:customMarkFollows
     */
    hasFootnoteCustomMark(xmlId: string): boolean;
    /**
     * Check if an endnote uses a custom mark.
     *
     * @param xmlId - The XML ID
     * @returns True if this endnote has w:customMarkFollows
     */
    hasEndnoteCustomMark(xmlId: string): boolean;
    /**
     * Get the total number of footnotes (excluding custom marks).
     */
    getFootnoteCount(): number;
    /**
     * Get the total number of endnotes (excluding custom marks).
     */
    getEndnoteCount(): number;
    /**
     * Get all footnote references as structured data.
     *
     * @returns Array of FootnoteReference objects
     */
    getFootnoteReferences(): FootnoteReference[];
    /**
     * Get all endnote references as structured data.
     *
     * @returns Array of FootnoteReference objects
     */
    getEndnoteReferences(): FootnoteReference[];
}
/**
 * Find a footnote element by its ID in the footnotes.xml part.
 *
 * @param footnotesRoot - The root of the footnotes.xml document
 * @param xmlId - The XML ID to find
 * @returns The w:footnote element, or undefined if not found
 */
export declare function findFootnoteById(footnotesRoot: WmlElement, xmlId: string): WmlElement | undefined;
/**
 * Find an endnote element by its ID in the endnotes.xml part.
 *
 * @param endnotesRoot - The root of the endnotes.xml document
 * @param xmlId - The XML ID to find
 * @returns The w:endnote element, or undefined if not found
 */
export declare function findEndnoteById(endnotesRoot: WmlElement, xmlId: string): WmlElement | undefined;
/**
 * Extract plain text content from a footnote/endnote element.
 *
 * @param noteElement - The w:footnote or w:endnote element
 * @returns Plain text content
 */
export declare function extractNoteText(noteElement: WmlElement): string;
//# sourceMappingURL=footnotes.d.ts.map