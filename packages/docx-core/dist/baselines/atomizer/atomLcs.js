/**
 * LCS Algorithm for Atoms
 *
 * Implements hash-based Longest Common Subsequence (LCS) algorithm
 * for comparing arrays of ComparisonUnitAtom.
 */
import { CorrelationStatus } from '../../core-types.js';
import { EMPTY_PARAGRAPH_TAG } from '../../atomizer.js';
import { debug } from './debug.js';
/**
 * Compute the Longest Common Subsequence of two atom arrays.
 *
 * Uses hash-based comparison for O(1) equality checks.
 * Time complexity: O(N * M) where N and M are array lengths.
 *
 * @param original - Atoms from the original document
 * @param revised - Atoms from the revised document
 * @returns LCS result with matches and differences
 */
export function computeAtomLcs(original, revised) {
    const n = original.length;
    const m = revised.length;
    // Build LCS length table
    // dp[i][j] = length of LCS of original[0..i-1] and revised[0..j-1]
    const dp = Array(n + 1)
        .fill(null)
        .map(() => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (atomsEqual(original[i - 1], revised[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack to find the actual LCS matches
    const matches = [];
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
        if (atomsEqual(original[i - 1], revised[j - 1])) {
            matches.unshift({ originalIndex: i - 1, revisedIndex: j - 1 });
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
    // Find deleted and inserted indices
    const matchedOriginal = new Set(matches.map((m) => m.originalIndex));
    const matchedRevised = new Set(matches.map((m) => m.revisedIndex));
    const deletedIndices = [];
    for (let idx = 0; idx < n; idx++) {
        if (!matchedOriginal.has(idx)) {
            deletedIndices.push(idx);
        }
    }
    const insertedIndices = [];
    for (let idx = 0; idx < m; idx++) {
        if (!matchedRevised.has(idx)) {
            insertedIndices.push(idx);
        }
    }
    return { matches, deletedIndices, insertedIndices };
}
/**
 * Check if two atoms are equal based on their hash.
 *
 * For more precise comparison, we also check the text content
 * and ancestor context to avoid false positives from hash collisions.
 */
function atomsEqual(a, b) {
    // First check hash for quick rejection
    if (a.sha1Hash !== b.sha1Hash) {
        return false;
    }
    // Same hash - verify content to avoid collisions
    const aText = a.contentElement.textContent ?? '';
    const bText = b.contentElement.textContent ?? '';
    if (aText !== bText) {
        return false;
    }
    // Check tag name
    if (a.contentElement.tagName !== b.contentElement.tagName) {
        return false;
    }
    return true;
}
/**
 * Mark correlation status on atoms based on LCS result.
 *
 * Sets atoms to Equal, Deleted, or Inserted status.
 * Also links matched atoms via comparisonUnitAtomBefore reference.
 *
 * @param original - Atoms from the original document
 * @param revised - Atoms from the revised document
 * @param lcsResult - Result from computeAtomLcs
 */
export function markCorrelationStatus(original, revised, lcsResult) {
    // Mark matched atoms as Equal and link them
    for (const match of lcsResult.matches) {
        const origAtom = original[match.originalIndex];
        const revAtom = revised[match.revisedIndex];
        origAtom.correlationStatus = CorrelationStatus.Equal;
        revAtom.correlationStatus = CorrelationStatus.Equal;
        // Link revised atom to original for format change detection
        revAtom.comparisonUnitAtomBefore = origAtom;
    }
    // Mark deleted atoms
    for (const idx of lcsResult.deletedIndices) {
        original[idx].correlationStatus = CorrelationStatus.Deleted;
    }
    // Mark inserted atoms
    for (const idx of lcsResult.insertedIndices) {
        revised[idx].correlationStatus = CorrelationStatus.Inserted;
    }
}
/**
 * Create a merged atom list for document reconstruction.
 *
 * Interleaves original and revised atoms in document order,
 * preserving the structure needed for track changes rendering.
 *
 * @param original - Atoms from the original document (with status marked)
 * @param revised - Atoms from the revised document (with status marked)
 * @param lcsResult - Result from computeAtomLcs
 * @returns Merged atom list in document order
 */
export function createMergedAtomList(original, revised, lcsResult) {
    const merged = [];
    // Build maps for quick lookup
    const originalToRevised = new Map();
    const revisedToOriginal = new Map();
    for (const match of lcsResult.matches) {
        originalToRevised.set(match.originalIndex, match.revisedIndex);
        revisedToOriginal.set(match.revisedIndex, match.originalIndex);
    }
    const deletedSet = new Set(lcsResult.deletedIndices);
    const insertedSet = new Set(lcsResult.insertedIndices);
    // We'll walk through the revised document order
    // and insert deleted atoms at appropriate positions
    let originalPtr = 0;
    let revisedPtr = 0;
    while (revisedPtr < revised.length || originalPtr < original.length) {
        // First, add any deleted atoms that come before the current revised position
        while (originalPtr < original.length && deletedSet.has(originalPtr)) {
            const atom = original[originalPtr];
            atom.sourceDocument = 'original';
            merged.push(atom);
            originalPtr++;
        }
        // Now handle the current revised atom
        if (revisedPtr < revised.length) {
            const revAtom = revised[revisedPtr];
            if (insertedSet.has(revisedPtr)) {
                // This is an inserted atom
                revAtom.sourceDocument = 'revised';
                merged.push(revAtom);
            }
            else {
                // This is an equal atom - advance original pointer past its match
                const matchedOrigIdx = revisedToOriginal.get(revisedPtr);
                if (matchedOrigIdx !== undefined) {
                    // Add any deleted atoms before this match
                    while (originalPtr < matchedOrigIdx) {
                        if (deletedSet.has(originalPtr)) {
                            const atom = original[originalPtr];
                            atom.sourceDocument = 'original';
                            merged.push(atom);
                        }
                        originalPtr++;
                    }
                    // For equal empty paragraphs, use the original version to preserve
                    // the original document's structure (important for reject all changes)
                    const origAtom = original[matchedOrigIdx];
                    if (origAtom.contentElement.tagName === EMPTY_PARAGRAPH_TAG) {
                        origAtom.sourceDocument = 'original';
                        merged.push(origAtom);
                    }
                    else {
                        // For non-empty content, use the revised version
                        revAtom.sourceDocument = 'revised';
                        merged.push(revAtom);
                    }
                    // Advance past the matched original atom
                    originalPtr = matchedOrigIdx + 1;
                }
                else {
                    merged.push(revAtom);
                }
            }
            revisedPtr++;
        }
        else {
            // No more revised atoms - add remaining deleted originals
            while (originalPtr < original.length) {
                if (deletedSet.has(originalPtr)) {
                    const atom = original[originalPtr];
                    atom.sourceDocument = 'original';
                    merged.push(atom);
                }
                originalPtr++;
            }
        }
    }
    return merged;
}
/**
 * Compute unified paragraph indices for merged atoms.
 *
 * Maps original and revised paragraph indices to a unified output paragraph index.
 * This ensures that:
 * 1. Atoms from corresponding paragraphs (Equal matches) share the same output index
 * 2. Deleted paragraphs get their own output indices interleaved with matched paragraphs
 * 3. Inserted paragraphs get their own output indices
 *
 * @param original - Original atoms with paragraphIndex set
 * @param revised - Revised atoms with paragraphIndex set
 * @param merged - Merged atom list
 * @param lcsResult - LCS result with matches
 */
export function assignUnifiedParagraphIndices(original, revised, merged, lcsResult) {
    // Build paragraph correspondence from matches
    const originalToRevisedPara = new Map();
    for (const match of lcsResult.matches) {
        const origAtom = original[match.originalIndex];
        const revAtom = revised[match.revisedIndex];
        if (origAtom.paragraphIndex !== undefined && revAtom.paragraphIndex !== undefined) {
            if (!originalToRevisedPara.has(origAtom.paragraphIndex)) {
                originalToRevisedPara.set(origAtom.paragraphIndex, revAtom.paragraphIndex);
            }
        }
    }
    // Collect all unique original paragraph indices
    const allOriginalParas = [...new Set(original.map(a => a.paragraphIndex).filter(p => p !== undefined))];
    allOriginalParas.sort((a, b) => a - b);
    // Collect all unique revised paragraph indices
    const allRevisedParas = [...new Set(revised.map(a => a.paragraphIndex).filter(p => p !== undefined))];
    allRevisedParas.sort((a, b) => a - b);
    // Build interleaved output index sequence
    // Walk through original paragraphs in order, interleaving with revised paragraphs
    const originalToOutputPara = new Map();
    const revisedToOutputPara = new Map();
    let nextOutputPara = 0;
    let revisedIdx = 0;
    for (const origPara of allOriginalParas) {
        const correspondingRevised = originalToRevisedPara.get(origPara);
        if (correspondingRevised !== undefined) {
            // This original paragraph has a correspondent in revised
            // First, assign output indices to any revised paragraphs before this correspondent
            while (revisedIdx < allRevisedParas.length && allRevisedParas[revisedIdx] < correspondingRevised) {
                const revPara = allRevisedParas[revisedIdx];
                if (!revisedToOutputPara.has(revPara)) {
                    revisedToOutputPara.set(revPara, nextOutputPara++);
                }
                revisedIdx++;
            }
            // Assign the same output index to both original and revised
            if (!revisedToOutputPara.has(correspondingRevised)) {
                revisedToOutputPara.set(correspondingRevised, nextOutputPara);
                originalToOutputPara.set(origPara, nextOutputPara);
                nextOutputPara++;
            }
            else {
                originalToOutputPara.set(origPara, revisedToOutputPara.get(correspondingRevised));
            }
            // Move past this revised paragraph
            if (revisedIdx < allRevisedParas.length && allRevisedParas[revisedIdx] === correspondingRevised) {
                revisedIdx++;
            }
        }
        else {
            // This original paragraph is deleted (no correspondent)
            // Give it its own output index
            originalToOutputPara.set(origPara, nextOutputPara++);
        }
    }
    // Assign output indices to any remaining revised paragraphs (inserted)
    while (revisedIdx < allRevisedParas.length) {
        const revPara = allRevisedParas[revisedIdx];
        if (!revisedToOutputPara.has(revPara)) {
            revisedToOutputPara.set(revPara, nextOutputPara++);
        }
        revisedIdx++;
    }
    // Assign unified paragraph indices to merged atoms
    let emptyParagraphsWithoutMapping = 0;
    for (const atom of merged) {
        if (atom.paragraphIndex === undefined)
            continue;
        const isEmptyPara = atom.contentElement.tagName === EMPTY_PARAGRAPH_TAG;
        if (atom.correlationStatus === CorrelationStatus.Deleted ||
            atom.correlationStatus === CorrelationStatus.MovedSource) {
            // Deleted and MovedSource atoms have paragraph indices from original
            const outputPara = originalToOutputPara.get(atom.paragraphIndex);
            if (outputPara !== undefined) {
                atom.paragraphIndex = outputPara;
            }
            else if (isEmptyPara) {
                emptyParagraphsWithoutMapping++;
            }
        }
        else if (atom.correlationStatus === CorrelationStatus.Equal && isEmptyPara) {
            // Equal empty paragraphs use the original atom (see createMergedAtomList),
            // so their paragraphIndex is from original, not revised
            const outputPara = originalToOutputPara.get(atom.paragraphIndex);
            if (outputPara !== undefined) {
                atom.paragraphIndex = outputPara;
            }
            else {
                emptyParagraphsWithoutMapping++;
            }
        }
        else {
            // Inserted and Equal (non-empty) atoms have paragraph indices from revised
            const outputPara = revisedToOutputPara.get(atom.paragraphIndex);
            if (outputPara !== undefined) {
                atom.paragraphIndex = outputPara;
            }
            else if (isEmptyPara) {
                emptyParagraphsWithoutMapping++;
            }
        }
    }
    if (emptyParagraphsWithoutMapping > 0) {
        debug('atomLcs', `Empty paragraphs without mapping: ${emptyParagraphsWithoutMapping}`);
    }
}
/**
 * Compute statistics from LCS result.
 */
export function computeLcsStats(original, revised, lcsResult) {
    return {
        equal: lcsResult.matches.length,
        deleted: lcsResult.deletedIndices.length,
        inserted: lcsResult.insertedIndices.length,
        originalCount: original.length,
        revisedCount: revised.length,
    };
}
//# sourceMappingURL=atomLcs.js.map