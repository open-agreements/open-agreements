/**
 * Baseline B: Paragraph alignment using LCS (Longest Common Subsequence).
 *
 * Aligns paragraphs between original and revised documents to identify:
 * - Matched paragraphs (same or similar content)
 * - Inserted paragraphs (only in revised)
 * - Deleted paragraphs (only in original)
 * - Modified paragraphs (matched but with differences)
 */
import { createHash } from 'crypto';
/**
 * Compute a hash for a paragraph's normalized text.
 *
 * Used for fast comparison during LCS.
 */
export function hashParagraph(text) {
    const normalized = normalizeParagraphText(text);
    return createHash('sha1').update(normalized).digest('hex');
}
/**
 * Normalize paragraph text for comparison.
 *
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase for case-insensitive comparison
 */
export function normalizeParagraphText(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
/**
 * Compute similarity between two strings using Jaccard index on words.
 *
 * @returns Value between 0 (completely different) and 1 (identical)
 */
export function computeSimilarity(a, b) {
    const wordsA = new Set(normalizeParagraphText(a).split(' ').filter(w => w.length > 0));
    const wordsB = new Set(normalizeParagraphText(b).split(' ').filter(w => w.length > 0));
    if (wordsA.size === 0 && wordsB.size === 0) {
        return 1; // Both empty
    }
    if (wordsA.size === 0 || wordsB.size === 0) {
        return 0; // One empty
    }
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size;
}
/**
 * Compute the Longest Common Subsequence of two arrays using dynamic programming.
 *
 * @param a - First array
 * @param b - Second array
 * @param keyFn - Function to extract comparison key from elements
 * @returns Array of [indexA, indexB] pairs representing the LCS
 */
export function lcs(a, b, keyFn) {
    const m = a.length;
    const n = b.length;
    // Build DP table
    const dp = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (keyFn(a[i - 1]) === keyFn(b[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack to find LCS
    const result = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (keyFn(a[i - 1]) === keyFn(b[j - 1])) {
            result.push([i - 1, j - 1]);
            i--;
            j--;
        }
        else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        }
        else {
            j--;
        }
    }
    return result.reverse();
}
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
export function alignParagraphs(original, revised, similarityThreshold = 0.5) {
    // Compute hashes for all paragraphs
    const originalHashes = original.map(p => ({
        para: p,
        hash: hashParagraph(p.text),
    }));
    const revisedHashes = revised.map(p => ({
        para: p,
        hash: hashParagraph(p.text),
    }));
    // Find LCS based on hashes
    const lcsResult = lcs(originalHashes, revisedHashes, item => item.hash);
    // Build sets of matched indices
    const matchedOriginal = new Set(lcsResult.map(([i]) => i));
    const matchedRevised = new Set(lcsResult.map(([, j]) => j));
    // Build alignment result
    const result = {
        matched: [],
        deleted: [],
        inserted: [],
    };
    // Add matched paragraphs
    for (const [origIdx, revIdx] of lcsResult) {
        const origPara = original[origIdx];
        const revPara = revised[revIdx];
        const similarity = computeSimilarity(origPara.text, revPara.text);
        result.matched.push({
            original: origPara,
            revised: revPara,
            similarity,
        });
    }
    // Add deleted paragraphs (in original but not matched)
    for (let i = 0; i < original.length; i++) {
        if (!matchedOriginal.has(i)) {
            result.deleted.push(original[i]);
        }
    }
    // Add inserted paragraphs (in revised but not matched)
    for (let j = 0; j < revised.length; j++) {
        if (!matchedRevised.has(j)) {
            result.inserted.push(revised[j]);
        }
    }
    // Try to find near-matches for unmatched paragraphs
    // This helps with paragraphs that were modified significantly
    const unmatchedOriginal = [...result.deleted];
    const unmatchedRevised = [...result.inserted];
    result.deleted = [];
    result.inserted = [];
    for (const origPara of unmatchedOriginal) {
        let bestMatch = null;
        for (const revPara of unmatchedRevised) {
            const similarity = computeSimilarity(origPara.text, revPara.text);
            if (similarity >= similarityThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { para: revPara, similarity };
                }
            }
        }
        if (bestMatch) {
            // Remove from unmatched revised
            const idx = unmatchedRevised.indexOf(bestMatch.para);
            if (idx !== -1) {
                unmatchedRevised.splice(idx, 1);
            }
            result.matched.push({
                original: origPara,
                revised: bestMatch.para,
                similarity: bestMatch.similarity,
            });
        }
        else {
            result.deleted.push(origPara);
        }
    }
    // Remaining unmatched revised are insertions
    result.inserted = unmatchedRevised;
    return result;
}
/**
 * Classify alignment result into more granular categories.
 */
export function classifyAlignment(alignment) {
    const result = {
        identical: [],
        modified: [],
        deleted: alignment.deleted,
        inserted: alignment.inserted,
    };
    for (const match of alignment.matched) {
        if (match.similarity >= 0.9999) {
            result.identical.push({
                original: match.original,
                revised: match.revised,
            });
        }
        else {
            result.modified.push(match);
        }
    }
    return result;
}
//# sourceMappingURL=paragraphAlignment.js.map