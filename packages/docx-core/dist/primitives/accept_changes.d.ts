/**
 * accept_changes — accept all tracked changes in a OOXML document body.
 *
 * Produces a clean document with no revision markup by:
 * - Removing w:del elements and their content
 * - Unwrapping w:ins elements (promoting children)
 * - Removing w:moveFrom (source), unwrapping w:moveTo (destination)
 * - Removing all *PrChange property change records
 * - Stripping paragraph-level revision markers
 * - Cleaning up move range markers and rsidDel attributes
 *
 * Operates on the W3C DOM (`@xmldom/xmldom`) — the same API used
 * throughout docx-primitives-ts (contrast with docx-comparison's
 * custom WmlElement AST).
 */
export type AcceptChangesResult = {
    insertionsAccepted: number;
    deletionsAccepted: number;
    movesResolved: number;
    propertyChangesResolved: number;
};
/**
 * Accept all tracked changes in the document body, producing a clean
 * document with no revision markup.
 *
 * Mutates the Document in place (same convention as simplifyRedlines
 * and mergeRuns).
 */
export declare function acceptChanges(doc: Document): AcceptChangesResult;
//# sourceMappingURL=accept_changes.d.ts.map