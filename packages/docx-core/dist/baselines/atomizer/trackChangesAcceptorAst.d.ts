/**
 * Track Changes Acceptor/Rejector (AST-based)
 *
 * AST-based utilities to accept or reject all track changes in a document.
 * Replaces the regex-based implementation for better reliability with nested structures.
 */
/**
 * Accept all track changes in document XML (AST-based).
 *
 * - Removes w:del elements entirely (deleted content disappears)
 * - Unwraps w:ins elements (inserted content becomes normal)
 * - Handles w:moveFrom (remove) and w:moveTo (unwrap)
 * - Removes format change tracking elements
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes accepted
 */
export declare function acceptAllChanges(documentXml: string): string;
/**
 * Reject all track changes in document XML (AST-based).
 *
 * - Removes w:ins elements entirely (inserted content disappears)
 * - Unwraps w:del elements and converts w:delText to w:t
 * - Handles w:moveFrom (unwrap) and w:moveTo (remove)
 * - Removes format change tracking elements
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes rejected
 */
export declare function rejectAllChanges(documentXml: string): string;
/**
 * Extract plain text content from document XML (AST-based).
 *
 * @param documentXml - The document.xml content
 * @returns Plain text content
 */
export declare function extractTextContent(documentXml: string): string;
/**
 * Extract text in document order, respecting paragraph breaks (AST-based).
 */
export declare function extractTextWithParagraphs(documentXml: string): string;
/**
 * Normalize text for comparison (handles whitespace differences).
 *
 * Performs the following normalization:
 * - Convert CRLF and CR to LF
 * - Convert tabs to spaces
 * - Collapse multiple spaces to single space
 * - Strip trailing spaces from each line
 * - Collapse multiple newlines to single newline
 * - Trim leading/trailing whitespace
 */
export declare function normalizeText(text: string): string;
/**
 * Compare two texts and return detailed differences.
 */
export declare function compareTexts(expected: string, actual: string): {
    identical: boolean;
    normalizedIdentical: boolean;
    expectedLength: number;
    actualLength: number;
    differences: string[];
};
//# sourceMappingURL=trackChangesAcceptorAst.d.ts.map