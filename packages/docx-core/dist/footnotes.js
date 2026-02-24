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
import { RESERVED_FOOTNOTE_IDS, } from './core-types.js';
import { childElements, getLeafText } from './primitives/index.js';
// =============================================================================
// Footnote Reference Finding
// =============================================================================
/**
 * Find all footnote or endnote references in document order.
 *
 * Recursively traverses the document tree to find references in reading order.
 *
 * @param element - The root element to search from
 * @param tagName - The reference tag to find ('w:footnoteReference' or 'w:endnoteReference')
 * @returns Array of reference elements in document order
 */
export function findReferencesInOrder(element, tagName) {
    const refs = [];
    function traverse(node) {
        if (node.tagName === tagName) {
            refs.push(node);
        }
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(element);
    return refs;
}
/**
 * Check if a footnote/endnote ID is reserved.
 *
 * IDs 0 and 1 are reserved for separator types per ECMA-376.
 *
 * @param xmlId - The XML ID to check
 * @returns True if this is a reserved ID
 */
export function isReservedId(xmlId) {
    return (xmlId === RESERVED_FOOTNOTE_IDS.SEPARATOR ||
        xmlId === RESERVED_FOOTNOTE_IDS.CONTINUATION_SEPARATOR);
}
// =============================================================================
// FootnoteNumberingTracker Class
// =============================================================================
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
export class FootnoteNumberingTracker {
    footnoteIdToDisplayNumber = new Map();
    endnoteIdToDisplayNumber = new Map();
    footnoteCustomMarks = new Set();
    endnoteCustomMarks = new Set();
    /**
     * Create a new tracker by scanning the document.
     *
     * @param documentRoot - The root element of the main document (w:document or w:body)
     */
    constructor(documentRoot) {
        this.scanDocument(documentRoot);
    }
    /**
     * Scan the document for footnote and endnote references.
     */
    scanDocument(documentRoot) {
        // Scan for footnote references
        const footnoteRefs = findReferencesInOrder(documentRoot, 'w:footnoteReference');
        this.buildNumbering(footnoteRefs, this.footnoteIdToDisplayNumber, this.footnoteCustomMarks);
        // Scan for endnote references
        const endnoteRefs = findReferencesInOrder(documentRoot, 'w:endnoteReference');
        this.buildNumbering(endnoteRefs, this.endnoteIdToDisplayNumber, this.endnoteCustomMarks);
    }
    /**
     * Build the ID to display number mapping.
     */
    buildNumbering(refs, idToNumber, customMarks) {
        let displayNum = 1;
        for (const ref of refs) {
            const xmlId = ref.getAttribute('w:id');
            if (!xmlId)
                continue;
            // Skip reserved IDs
            if (isReservedId(xmlId))
                continue;
            // Check for custom mark
            const hasCustomMark = ref.getAttribute('w:customMarkFollows') === '1' ||
                ref.getAttribute('w:customMarkFollows') === 'true';
            if (hasCustomMark) {
                customMarks.add(xmlId);
                // Custom marks don't get automatic numbers but still reserve a slot
                // Some implementations skip numbering, others don't - we follow Word behavior
            }
            // Only assign number if not already seen (handles duplicate references)
            if (!idToNumber.has(xmlId)) {
                if (!hasCustomMark) {
                    idToNumber.set(xmlId, displayNum);
                    displayNum++;
                }
            }
        }
    }
    /**
     * Get the display number for a footnote by its XML ID.
     *
     * @param xmlId - The XML ID (w:id attribute)
     * @returns The display number, or undefined if not found or uses custom mark
     */
    getFootnoteDisplayNumber(xmlId) {
        return this.footnoteIdToDisplayNumber.get(xmlId);
    }
    /**
     * Get the display number for an endnote by its XML ID.
     *
     * @param xmlId - The XML ID (w:id attribute)
     * @returns The display number, or undefined if not found or uses custom mark
     */
    getEndnoteDisplayNumber(xmlId) {
        return this.endnoteIdToDisplayNumber.get(xmlId);
    }
    /**
     * Get the display number for a footnote or endnote by its XML ID.
     *
     * Convenience method that checks both footnotes and endnotes.
     *
     * @param xmlId - The XML ID
     * @returns The display number, or undefined if not found
     */
    getDisplayNumber(xmlId) {
        return (this.footnoteIdToDisplayNumber.get(xmlId) ??
            this.endnoteIdToDisplayNumber.get(xmlId));
    }
    /**
     * Check if a footnote uses a custom mark.
     *
     * @param xmlId - The XML ID
     * @returns True if this footnote has w:customMarkFollows
     */
    hasFootnoteCustomMark(xmlId) {
        return this.footnoteCustomMarks.has(xmlId);
    }
    /**
     * Check if an endnote uses a custom mark.
     *
     * @param xmlId - The XML ID
     * @returns True if this endnote has w:customMarkFollows
     */
    hasEndnoteCustomMark(xmlId) {
        return this.endnoteCustomMarks.has(xmlId);
    }
    /**
     * Get the total number of footnotes (excluding custom marks).
     */
    getFootnoteCount() {
        return this.footnoteIdToDisplayNumber.size;
    }
    /**
     * Get the total number of endnotes (excluding custom marks).
     */
    getEndnoteCount() {
        return this.endnoteIdToDisplayNumber.size;
    }
    /**
     * Get all footnote references as structured data.
     *
     * @returns Array of FootnoteReference objects
     */
    getFootnoteReferences() {
        const refs = [];
        for (const [xmlId, displayNumber] of this.footnoteIdToDisplayNumber) {
            refs.push({
                xmlId,
                displayNumber,
                customMarkFollows: this.footnoteCustomMarks.has(xmlId),
            });
        }
        // Add custom mark footnotes (no display number)
        for (const xmlId of this.footnoteCustomMarks) {
            if (!this.footnoteIdToDisplayNumber.has(xmlId)) {
                refs.push({
                    xmlId,
                    customMarkFollows: true,
                });
            }
        }
        return refs;
    }
    /**
     * Get all endnote references as structured data.
     *
     * @returns Array of FootnoteReference objects
     */
    getEndnoteReferences() {
        const refs = [];
        for (const [xmlId, displayNumber] of this.endnoteIdToDisplayNumber) {
            refs.push({
                xmlId,
                displayNumber,
                customMarkFollows: this.endnoteCustomMarks.has(xmlId),
            });
        }
        // Add custom mark endnotes (no display number)
        for (const xmlId of this.endnoteCustomMarks) {
            if (!this.endnoteIdToDisplayNumber.has(xmlId)) {
                refs.push({
                    xmlId,
                    customMarkFollows: true,
                });
            }
        }
        return refs;
    }
}
// =============================================================================
// Footnote Content Extraction
// =============================================================================
/**
 * Find a footnote element by its ID in the footnotes.xml part.
 *
 * @param footnotesRoot - The root of the footnotes.xml document
 * @param xmlId - The XML ID to find
 * @returns The w:footnote element, or undefined if not found
 */
export function findFootnoteById(footnotesRoot, xmlId) {
    if (footnotesRoot.tagName !== 'w:footnotes') {
        return undefined;
    }
    for (const child of childElements(footnotesRoot)) {
        if (child.tagName === 'w:footnote' && child.getAttribute('w:id') === xmlId) {
            return child;
        }
    }
    return undefined;
}
/**
 * Find an endnote element by its ID in the endnotes.xml part.
 *
 * @param endnotesRoot - The root of the endnotes.xml document
 * @param xmlId - The XML ID to find
 * @returns The w:endnote element, or undefined if not found
 */
export function findEndnoteById(endnotesRoot, xmlId) {
    if (endnotesRoot.tagName !== 'w:endnotes') {
        return undefined;
    }
    for (const child of childElements(endnotesRoot)) {
        if (child.tagName === 'w:endnote' && child.getAttribute('w:id') === xmlId) {
            return child;
        }
    }
    return undefined;
}
/**
 * Extract plain text content from a footnote/endnote element.
 *
 * @param noteElement - The w:footnote or w:endnote element
 * @returns Plain text content
 */
export function extractNoteText(noteElement) {
    const texts = [];
    function traverse(node) {
        if (node.tagName === 'w:t') {
            const text = getLeafText(node) ?? '';
            if (text) {
                texts.push(text);
            }
        }
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(noteElement);
    return texts.join('');
}
//# sourceMappingURL=footnotes.js.map