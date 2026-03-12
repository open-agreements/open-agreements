export type MatchMode = 'exact' | 'quote_normalized' | 'flexible_whitespace' | 'quote_optional' | 'clean';
export type UniqueSubstringMatchResult = {
    status: 'not_found';
} | {
    status: 'multiple';
    mode: MatchMode;
    matchCount: number;
} | {
    status: 'unique';
    mode: MatchMode;
    matchCount: 1;
    start: number;
    end: number;
    matchedText: string;
};
/**
 * Transfer the document's smart-quote style to a target string.
 *
 * Scans `documentText` for the first left/right double and single smart-quote
 * variants, then replaces straight quotes in `targetText` with those variants.
 * Uses positional context (after whitespace/punctuation/start → opening, else closing)
 * to choose the correct direction.
 *
 * Returns `targetText` unchanged when `documentText` contains no smart quotes.
 * Angle quotes (« » ‹ ›) are explicitly non-goal for v1.
 */
export declare function applyDocumentQuoteStyle(documentText: string, targetText: string): string;
export declare function findUniqueSubstringMatch(haystack: string, needle: string, options?: {
    mode?: MatchMode | 'default';
}): UniqueSubstringMatchResult;
//# sourceMappingURL=matching.d.ts.map