/**
 * reject_changes — reject all tracked changes in a OOXML document body.
 *
 * Produces the document as it was before tracked changes were made by:
 * - Removing w:ins elements AND their content (insertions undone)
 * - Unwrapping w:del elements and converting w:delText → w:t (deletions restored)
 * - Unwrapping w:moveFrom (keep at original position), removing w:moveTo and content
 * - Restoring original properties from *PrChange records
 * - Preserving cross-paragraph bookmark boundaries when removing inserted paragraphs
 * - Stripping paragraph-level revision markers and rsidDel attributes
 *
 * Operates on the W3C DOM (`@xmldom/xmldom`).
 */
export type RejectChangesResult = {
    insertionsRemoved: number;
    deletionsRestored: number;
    movesReverted: number;
    propertyChangesReverted: number;
};
/**
 * Reject all tracked changes in the document body, restoring the
 * document to its pre-edit state.
 *
 * Mutates the Document in place (same convention as acceptChanges).
 */
export declare function rejectChanges(doc: Document): RejectChangesResult;
//# sourceMappingURL=reject_changes.d.ts.map