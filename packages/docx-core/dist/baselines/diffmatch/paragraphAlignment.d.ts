/**
 * Baseline B: Paragraph alignment using LCS (Longest Common Subsequence).
 *
 * Aligns paragraphs between original and revised documents to identify:
 * - Matched paragraphs (same or similar content)
 * - Inserted paragraphs (only in revised)
 * - Deleted paragraphs (only in original)
 * - Modified paragraphs (matched but with differences)
 */
import type { ParagraphInfo, AlignmentResult } from '../../shared/ooxml/types.js';
/**
 * Compute a hash for a paragraph's normalized text.
 *
 * Used for fast comparison during LCS.
 */
export declare function hashParagraph(text: string): string;
/**
 * Normalize paragraph text for comparison.
 *
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase for case-insensitive comparison
 */
export declare function normalizeParagraphText(text: string): string;
/**
 * Compute similarity between two strings using Jaccard index on words.
 *
 * @returns Value between 0 (completely different) and 1 (identical)
 */
export declare function computeSimilarity(a: string, b: string): number;
/**
 * Compute the Longest Common Subsequence of two arrays using dynamic programming.
 *
 * @param a - First array
 * @param b - Second array
 * @param keyFn - Function to extract comparison key from elements
 * @returns Array of [indexA, indexB] pairs representing the LCS
 */
export declare function lcs<T>(a: T[], b: T[], keyFn: (item: T) => string): Array<[number, number]>;
/**
 * Align paragraphs between original and revised documents.
 *
 * Uses hash-based LCS to find matching paragraphs, then classifies
 * unmatched paragraphs as inserted or deleted.
 *
 * @param original - Paragraphs from original document
 * @param revised - Paragraphs from revised document
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.5)
 */
export declare function alignParagraphs(original: ParagraphInfo[], revised: ParagraphInfo[], similarityThreshold?: number): AlignmentResult;
/**
 * Classify paragraph matches into categories.
 */
export interface ParagraphClassification {
    /** Identical paragraphs (similarity = 1.0) */
    identical: Array<{
        original: ParagraphInfo;
        revised: ParagraphInfo;
    }>;
    /** Modified paragraphs (0 < similarity < 1.0) */
    modified: Array<{
        original: ParagraphInfo;
        revised: ParagraphInfo;
        similarity: number;
    }>;
    /** Deleted paragraphs */
    deleted: ParagraphInfo[];
    /** Inserted paragraphs */
    inserted: ParagraphInfo[];
}
/**
 * Classify alignment result into more granular categories.
 */
export declare function classifyAlignment(alignment: AlignmentResult): ParagraphClassification;
//# sourceMappingURL=paragraphAlignment.d.ts.map