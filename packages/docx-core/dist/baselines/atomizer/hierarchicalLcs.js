/**
 * Hierarchical LCS Comparison
 *
 * Implements two-level comparison like WmlComparer:
 * 1. First pass: LCS on paragraph GROUPS (coarse alignment)
 * 2. Second pass: LCS on atoms WITHIN matched groups (fine alignment)
 *
 * This prevents atoms from one paragraph matching random fragments
 * in other paragraphs.
 *
 * Additionally, large paragraphs (like definition sections) are split
 * on soft breaks (w:br) to prevent cross-definition contamination.
 */
import { CorrelationStatus } from '../../core-types.js';
import { sha1, EMPTY_PARAGRAPH_TAG } from '../../atomizer.js';
import { computeAtomLcs } from './atomLcs.js';
import { debug } from './debug.js';
/**
 * Maximum atoms in a group before we split on w:br boundaries.
 * This handles mega-paragraphs like definition sections.
 */
const MAX_ATOMS_BEFORE_SPLIT = 50;
/**
 * Default paragraph-level similarity threshold used for group matching.
 *
 * Lower values favor treating modified paragraphs as aligned pairs (so atom-level
 * comparison can run), while higher values favor whole-paragraph replacement.
 */
export const DEFAULT_PARAGRAPH_SIMILARITY_THRESHOLD = 0.25;
/**
 * Group atoms by paragraph index.
 *
 * @param atoms - Atoms with paragraphIndex set
 * @returns Array of paragraph groups in document order
 */
export function groupAtomsByParagraphIndex(atoms) {
    const groups = new Map();
    for (const atom of atoms) {
        const idx = atom.paragraphIndex ?? -1;
        if (!groups.has(idx)) {
            groups.set(idx, []);
        }
        groups.get(idx).push(atom);
    }
    // Convert to array sorted by paragraph index
    const result = [];
    const sortedIndices = [...groups.keys()].sort((a, b) => a - b);
    for (const idx of sortedIndices) {
        const atoms = groups.get(idx);
        const textContent = extractGroupTextContent(atoms);
        // For empty paragraph groups, use the atom's sha1Hash (which has context)
        // instead of the empty text hash. This prevents all empty paragraphs from
        // matching each other regardless of position.
        const isEmptyParagraphGroup = atoms.length === 1 &&
            atoms[0].contentElement.tagName === EMPTY_PARAGRAPH_TAG;
        const textHash = isEmptyParagraphGroup
            ? atoms[0].sha1Hash // Use context-aware atom hash
            : sha1(textContent);
        const normalizedTextHash = isEmptyParagraphGroup
            ? textHash
            : sha1(normalizeText(textContent));
        result.push({
            paragraphIndex: idx,
            atoms,
            textHash,
            normalizedTextHash,
            textContent,
        });
    }
    return result;
}
/**
 * Create a ComparisonUnitGroup from a list of atoms.
 */
function createGroup(atoms, groupIndex) {
    const textContent = extractGroupTextContent(atoms);
    // For empty paragraph groups, use the atom's sha1Hash (which has context)
    const isEmptyGroup = atoms.length === 1 &&
        atoms[0].contentElement.tagName === EMPTY_PARAGRAPH_TAG;
    const textHash = isEmptyGroup
        ? atoms[0].sha1Hash
        : sha1(textContent);
    const normalizedTextHash = isEmptyGroup
        ? textHash
        : sha1(normalizeText(textContent));
    return {
        paragraphIndex: groupIndex,
        atoms,
        textHash,
        normalizedTextHash,
        textContent,
    };
}
/**
 * Group atoms by paragraph, then split large paragraphs on soft breaks (w:br).
 *
 * This handles mega-paragraphs like definition sections where many definitions
 * are in a single paragraph separated by soft breaks. Without this split,
 * the atom-level LCS can match fragments across definition boundaries.
 *
 * @param atoms - Atoms with paragraphIndex set
 * @returns Array of groups, potentially more than the number of paragraphs
 */
export function groupAtomsByParagraphAndBreaks(atoms) {
    // First, group by paragraph index
    const paragraphMap = new Map();
    for (const atom of atoms) {
        const idx = atom.paragraphIndex ?? -1;
        if (!paragraphMap.has(idx)) {
            paragraphMap.set(idx, []);
        }
        paragraphMap.get(idx).push(atom);
    }
    // Convert to array sorted by paragraph index
    const sortedIndices = [...paragraphMap.keys()].sort((a, b) => a - b);
    // Now process each paragraph, splitting large ones on w:br
    const result = [];
    let groupIndex = 0;
    for (const paraIdx of sortedIndices) {
        const paraAtoms = paragraphMap.get(paraIdx);
        // Small paragraph - keep as-is
        if (paraAtoms.length <= MAX_ATOMS_BEFORE_SPLIT) {
            result.push(createGroup(paraAtoms, groupIndex++));
            continue;
        }
        // Large paragraph - split on w:br boundaries
        let currentAtoms = [];
        for (const atom of paraAtoms) {
            currentAtoms.push(atom);
            // Split AFTER w:br (keep the break with the preceding content)
            if (atom.contentElement.tagName === 'w:br') {
                if (currentAtoms.length > 0) {
                    result.push(createGroup(currentAtoms, groupIndex++));
                    currentAtoms = [];
                }
            }
        }
        // Don't forget trailing atoms after last break
        if (currentAtoms.length > 0) {
            result.push(createGroup(currentAtoms, groupIndex++));
        }
    }
    return result;
}
/**
 * Extract concatenated text content from a group of atoms.
 * Used for paragraph-level comparison and similarity calculation.
 */
function extractGroupTextContent(atoms) {
    const textParts = [];
    for (const atom of atoms) {
        // Treat run separators as visible token boundaries for similarity purposes.
        if (atom.contentElement.tagName === 'w:br' ||
            atom.contentElement.tagName === 'w:cr' ||
            atom.contentElement.tagName === 'w:tab') {
            textParts.push(' ');
            continue;
        }
        const text = atom.contentElement.textContent;
        if (text) {
            textParts.push(text);
        }
    }
    return textParts.join('');
}
/**
 * Normalize text for similarity comparison.
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase for case-insensitive comparison
 */
function normalizeText(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}
/**
 * Check if a group contains only empty paragraph atoms.
 */
function isEmptyParagraphGroup(group) {
    return group.atoms.length === 1 &&
        group.atoms[0].contentElement.tagName === EMPTY_PARAGRAPH_TAG;
}
/**
 * Paragraph groups are considered coarse-equal if:
 * 1) Their raw text hash matches exactly, or
 * 2) Their normalized-text hash matches (heuristic assist only).
 *
 * Empty paragraphs intentionally require strict hash equality.
 */
function groupsCoarselyEqual(a, b) {
    if (a.textHash === b.textHash) {
        return true;
    }
    if (isEmptyParagraphGroup(a) || isEmptyParagraphGroup(b)) {
        return false;
    }
    return a.normalizedTextHash === b.normalizedTextHash;
}
/**
 * Compute similarity between two groups using Jaccard index on words.
 *
 * @returns Value between 0 (completely different) and 1 (identical)
 */
function computeGroupSimilarity(a, b) {
    // For empty paragraph groups, only consider them similar if their
    // context-aware hashes match. This prevents empty paragraphs from
    // matching each other regardless of position.
    if (isEmptyParagraphGroup(a) || isEmptyParagraphGroup(b)) {
        // If one is empty and the other isn't, they're not similar
        if (isEmptyParagraphGroup(a) !== isEmptyParagraphGroup(b)) {
            return 0;
        }
        // Both are empty paragraph groups - compare their context-aware hashes
        // They must match exactly (return 1) or not at all (return 0)
        return a.textHash === b.textHash ? 1 : 0;
    }
    const textA = normalizeText(a.textContent);
    const textB = normalizeText(b.textContent);
    const wordsA = new Set(textA.split(' ').filter(w => w.length > 0));
    const wordsB = new Set(textB.split(' ').filter(w => w.length > 0));
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
 * Compute LCS on paragraph groups with similarity fallback.
 *
 * Two passes:
 * 1. LCS with exact text hash matching (fast path)
 * 2. Similarity matching for unmatched groups (fallback)
 *
 * @param originalGroups - Groups from original document
 * @param revisedGroups - Groups from revised document
 * @param similarityThreshold - Minimum similarity to consider a match (default: 0.25)
 */
export function computeGroupLcs(originalGroups, revisedGroups, similarityThreshold = DEFAULT_PARAGRAPH_SIMILARITY_THRESHOLD) {
    const n = originalGroups.length;
    const m = revisedGroups.length;
    // === Pass 1: LCS with exact hash and normalized-hash matching ===
    const dp = Array(n + 1)
        .fill(null)
        .map(() => Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (groupsCoarselyEqual(originalGroups[i - 1], revisedGroups[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    // Backtrack to find matched groups
    const matchedGroups = [];
    let i = n;
    let j = m;
    while (i > 0 && j > 0) {
        if (groupsCoarselyEqual(originalGroups[i - 1], revisedGroups[j - 1])) {
            matchedGroups.unshift({ originalIndex: i - 1, revisedIndex: j - 1 });
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
    // Find initially unmatched indices
    const matchedOriginal = new Set(matchedGroups.map((m) => m.originalIndex));
    const matchedRevised = new Set(matchedGroups.map((m) => m.revisedIndex));
    let unmatchedOriginal = [];
    for (let idx = 0; idx < n; idx++) {
        if (!matchedOriginal.has(idx)) {
            unmatchedOriginal.push(idx);
        }
    }
    let unmatchedRevised = [];
    for (let idx = 0; idx < m; idx++) {
        if (!matchedRevised.has(idx)) {
            unmatchedRevised.push(idx);
        }
    }
    // === Pass 2: Similarity matching for unmatched groups ===
    // Try to find near-matches for paragraphs that were modified significantly
    const similarityMatches = [];
    for (const origIdx of unmatchedOriginal) {
        const origGroup = originalGroups[origIdx];
        let bestMatch = null;
        for (const revIdx of unmatchedRevised) {
            const revGroup = revisedGroups[revIdx];
            const similarity = computeGroupSimilarity(origGroup, revGroup);
            if (similarity >= similarityThreshold) {
                if (!bestMatch || similarity > bestMatch.similarity) {
                    bestMatch = { revisedIndex: revIdx, similarity };
                }
            }
        }
        if (bestMatch) {
            similarityMatches.push({ originalIndex: origIdx, revisedIndex: bestMatch.revisedIndex });
            // Remove from unmatched revised
            unmatchedRevised = unmatchedRevised.filter(idx => idx !== bestMatch.revisedIndex);
        }
    }
    // Combine exact matches and similarity matches
    const allMatches = [...matchedGroups, ...similarityMatches];
    // Update matched sets
    for (const match of similarityMatches) {
        matchedOriginal.add(match.originalIndex);
        matchedRevised.add(match.revisedIndex);
    }
    // Final deleted and inserted indices
    const deletedGroupIndices = [];
    for (let idx = 0; idx < n; idx++) {
        if (!matchedOriginal.has(idx)) {
            deletedGroupIndices.push(idx);
        }
    }
    const insertedGroupIndices = [];
    for (let idx = 0; idx < m; idx++) {
        if (!matchedRevised.has(idx)) {
            insertedGroupIndices.push(idx);
        }
    }
    return { matchedGroups: allMatches, deletedGroupIndices, insertedGroupIndices };
}
/**
 * Perform hierarchical LCS comparison.
 *
 * Pipeline:
 * 1. Group atoms by paragraph
 * 2. LCS on paragraph groups (coarse alignment) with similarity fallback
 * 3. For matched groups: LCS on atoms within them
 * 4. For unmatched groups: mark all atoms as deleted/inserted
 *
 * @param originalAtoms - Atoms from original document
 * @param revisedAtoms - Atoms from revised document
 * @param options - Comparison options including similarity threshold
 * @returns Combined atom-level LCS result
 */
export function hierarchicalCompare(originalAtoms, revisedAtoms, options = {}) {
    const { similarityThreshold = DEFAULT_PARAGRAPH_SIMILARITY_THRESHOLD } = options;
    // Step 1: Group atoms by paragraph, splitting large paragraphs on w:br
    const originalGroups = groupAtomsByParagraphAndBreaks(originalAtoms);
    const revisedGroups = groupAtomsByParagraphAndBreaks(revisedAtoms);
    // Count empty paragraph groups
    const origEmptyGroups = originalGroups.filter(g => isEmptyParagraphGroup(g));
    const revEmptyGroups = revisedGroups.filter(g => isEmptyParagraphGroup(g));
    debug('hierarchicalLcs', `${originalGroups.length} original groups (${origEmptyGroups.length} empty), ${revisedGroups.length} revised groups (${revEmptyGroups.length} empty)`);
    // Step 2: LCS on paragraph groups with similarity fallback
    const groupLcs = computeGroupLcs(originalGroups, revisedGroups, similarityThreshold);
    // Count empty paragraphs in each category
    const matchedEmptyCount = groupLcs.matchedGroups.filter(m => isEmptyParagraphGroup(originalGroups[m.originalIndex])).length;
    const deletedEmptyCount = groupLcs.deletedGroupIndices.filter(i => isEmptyParagraphGroup(originalGroups[i])).length;
    const insertedEmptyCount = groupLcs.insertedGroupIndices.filter(i => isEmptyParagraphGroup(revisedGroups[i])).length;
    debug('hierarchicalLcs', `Group LCS: ${groupLcs.matchedGroups.length} matched (${matchedEmptyCount} empty), ${groupLcs.deletedGroupIndices.length} deleted (${deletedEmptyCount} empty), ${groupLcs.insertedGroupIndices.length} inserted (${insertedEmptyCount} empty)`);
    // Step 3: Build combined atom-level result
    const allMatches = [];
    const deletedIndices = [];
    const insertedIndices = [];
    // Build atom index maps for quick lookup
    const origAtomToIndex = new Map();
    for (let i = 0; i < originalAtoms.length; i++) {
        origAtomToIndex.set(originalAtoms[i], i);
    }
    const revAtomToIndex = new Map();
    for (let i = 0; i < revisedAtoms.length; i++) {
        revAtomToIndex.set(revisedAtoms[i], i);
    }
    // For matched groups: do atom-level LCS within them
    for (const match of groupLcs.matchedGroups) {
        const origGroup = originalGroups[match.originalIndex];
        const revGroup = revisedGroups[match.revisedIndex];
        // Check if this was an exact match (hash) or similarity match
        const isExactMatch = origGroup.textHash === revGroup.textHash;
        // For LOW similarity matches (< threshold), skip atom LCS to avoid spurious
        // matches on common fragments. Use the same threshold as paragraph matching.
        const similarity = isExactMatch ? 1.0 : computeGroupSimilarity(origGroup, revGroup);
        const useAtomLcs = similarity >= similarityThreshold;
        if (!isExactMatch && !useAtomLcs) {
            debug('hierarchicalLcs', `Low similarity match (${similarity.toFixed(2)}): origGroup[${match.originalIndex}] "${origGroup.textContent.slice(0, 50)}..." vs revGroup[${match.revisedIndex}] "${revGroup.textContent.slice(0, 50)}..."`);
        }
        if (isExactMatch || useAtomLcs) {
            // High-similarity match: do atom-level LCS for fine-grained changes
            const withinLcs = computeAtomLcs(origGroup.atoms, revGroup.atoms);
            // Translate local indices to global indices
            for (const atomMatch of withinLcs.matches) {
                const origAtom = origGroup.atoms[atomMatch.originalIndex];
                const revAtom = revGroup.atoms[atomMatch.revisedIndex];
                allMatches.push({
                    originalIndex: origAtomToIndex.get(origAtom),
                    revisedIndex: revAtomToIndex.get(revAtom),
                });
            }
            for (const localIdx of withinLcs.deletedIndices) {
                const origAtom = origGroup.atoms[localIdx];
                deletedIndices.push(origAtomToIndex.get(origAtom));
            }
            for (const localIdx of withinLcs.insertedIndices) {
                const revAtom = revGroup.atoms[localIdx];
                insertedIndices.push(revAtomToIndex.get(revAtom));
            }
        }
        else {
            // Low similarity match: treat entire paragraph as replaced
            // This prevents spurious atom matches on common fragments
            for (const atom of origGroup.atoms) {
                deletedIndices.push(origAtomToIndex.get(atom));
            }
            for (const atom of revGroup.atoms) {
                insertedIndices.push(revAtomToIndex.get(atom));
            }
        }
    }
    // For deleted groups: mark all atoms as deleted
    for (const groupIdx of groupLcs.deletedGroupIndices) {
        const group = originalGroups[groupIdx];
        for (const atom of group.atoms) {
            deletedIndices.push(origAtomToIndex.get(atom));
        }
    }
    // For inserted groups: mark all atoms as inserted
    for (const groupIdx of groupLcs.insertedGroupIndices) {
        const group = revisedGroups[groupIdx];
        for (const atom of group.atoms) {
            insertedIndices.push(revAtomToIndex.get(atom));
        }
    }
    debug('hierarchicalLcs', `Hierarchical result: ${allMatches.length} matches, ${deletedIndices.length} deleted, ${insertedIndices.length} inserted`);
    return {
        matches: allMatches,
        deletedIndices,
        insertedIndices,
    };
}
/**
 * Mark correlation status using hierarchical comparison result.
 *
 * Same as regular markCorrelationStatus but uses hierarchical LCS result.
 */
export function markHierarchicalCorrelationStatus(original, revised, lcsResult) {
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
//# sourceMappingURL=hierarchicalLcs.js.map