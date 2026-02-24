/**
 * Move Detection Module
 *
 * Detects relocated content after LCS comparison by matching deleted blocks
 * with inserted blocks using Jaccard word similarity.
 *
 * Pipeline position:
 * LCS() → MarkRowsAsDeletedOrInserted() → FlattenToAtomList() → detectMovesInAtomList() → CoalesceRecurse()
 *
 * @see WmlComparer.cs DetectMovesInAtomList() line 3811
 */
import { CorrelationStatus, DEFAULT_MOVE_DETECTION_SETTINGS, } from './core-types.js';
import { getLeafText } from './primitives/index.js';
// =============================================================================
// Text Extraction
// =============================================================================
/**
 * Extract text content from an atom.
 *
 * @param atom - The atom to extract text from
 * @returns The text content, or empty string for non-text atoms
 */
export function getAtomText(atom) {
    const element = atom.contentElement;
    // Handle text elements
    if (element.tagName === 'w:t' || element.tagName === 'w:delText') {
        return getLeafText(element) ?? '';
    }
    // Handle break elements
    if (element.tagName === 'w:br' || element.tagName === 'w:cr') {
        return '\n';
    }
    // Handle tab
    if (element.tagName === 'w:tab') {
        return '\t';
    }
    return '';
}
/**
 * Extract text from a sequence of atoms.
 *
 * @param atoms - The atoms to extract text from
 * @returns Combined text content
 */
export function getAtomsText(atoms) {
    return atoms.map(getAtomText).join('');
}
/**
 * Count words in text.
 *
 * @param text - The text to count words in
 * @returns Number of words
 */
export function countWords(text) {
    const words = text.split(/\s+/).filter(Boolean);
    return words.length;
}
// =============================================================================
// Jaccard Similarity
// =============================================================================
/**
 * Calculate Jaccard similarity between two texts based on word sets.
 *
 * Jaccard index = |intersection| / |union|
 *
 * Benefits:
 * - Order-independent: "fox quick brown" matches "brown quick fox"
 * - Handles insertions/deletions well: adding one word to a 10-word block only slightly reduces similarity
 * - O(n) complexity where n = total words
 *
 * @param text1 - First text
 * @param text2 - Second text
 * @param caseInsensitive - Whether to ignore case (default: true)
 * @returns Similarity score between 0 and 1
 *
 * @example
 * jaccardWordSimilarity("The quick brown fox", "The quick brown dog")
 * // Returns 0.6 (3 common words / 5 total unique words)
 */
export function jaccardWordSimilarity(text1, text2, caseInsensitive = true) {
    const normalize = caseInsensitive
        ? (s) => s.toLowerCase()
        : (s) => s;
    const words1 = new Set(normalize(text1)
        .split(/\s+/)
        .filter(Boolean));
    const words2 = new Set(normalize(text2)
        .split(/\s+/)
        .filter(Boolean));
    if (words1.size === 0 && words2.size === 0) {
        return 1; // Both empty = identical
    }
    if (words1.size === 0 || words2.size === 0) {
        return 0; // One empty = completely different
    }
    // Calculate intersection
    let intersectionSize = 0;
    for (const word of words1) {
        if (words2.has(word)) {
            intersectionSize++;
        }
    }
    // Calculate union (|A| + |B| - |A ∩ B|)
    const unionSize = words1.size + words2.size - intersectionSize;
    return intersectionSize / unionSize;
}
// =============================================================================
// Block Grouping
// =============================================================================
/**
 * Group consecutive atoms by correlation status.
 *
 * Creates blocks of atoms with the same status (Deleted or Inserted).
 *
 * @param atoms - The atoms to group
 * @returns Array of atom blocks
 */
export function groupIntoBlocks(atoms) {
    const blocks = [];
    let currentBlock = null;
    for (const atom of atoms) {
        const status = atom.correlationStatus;
        // Only group Deleted and Inserted atoms for move detection
        if (status !== CorrelationStatus.Deleted && status !== CorrelationStatus.Inserted) {
            // End current block
            if (currentBlock) {
                blocks.push(currentBlock);
                currentBlock = null;
            }
            continue;
        }
        // Start new block or continue existing
        if (!currentBlock || currentBlock.status !== status) {
            if (currentBlock) {
                blocks.push(currentBlock);
            }
            currentBlock = {
                status,
                atoms: [atom],
                text: getAtomText(atom),
                wordCount: 0, // Calculated at end
            };
        }
        else {
            currentBlock.atoms.push(atom);
            currentBlock.text += getAtomText(atom);
        }
    }
    // Don't forget the last block
    if (currentBlock) {
        blocks.push(currentBlock);
    }
    // Calculate word counts
    for (const block of blocks) {
        block.wordCount = countWords(block.text);
    }
    return blocks;
}
/**
 * Find the best matching inserted block for a deleted block.
 *
 * @param deleted - The deleted block to match
 * @param insertedBlocks - Available inserted blocks
 * @param settings - Move detection settings
 * @returns The best match, or undefined if no match meets threshold
 */
export function findBestMatch(deleted, insertedBlocks, settings) {
    let bestMatch;
    for (let i = 0; i < insertedBlocks.length; i++) {
        const inserted = insertedBlocks[i];
        if (!inserted)
            continue;
        // Skip already matched blocks (marked as MovedDestination)
        if (inserted.atoms.length > 0 &&
            inserted.atoms[0]?.correlationStatus === CorrelationStatus.MovedDestination) {
            continue;
        }
        const similarity = jaccardWordSimilarity(deleted.text, inserted.text, settings.caseInsensitiveMove);
        if (similarity >= settings.moveSimilarityThreshold) {
            if (!bestMatch || similarity > bestMatch.similarity) {
                bestMatch = { block: inserted, similarity, index: i };
            }
        }
    }
    return bestMatch;
}
// =============================================================================
// Move Marking
// =============================================================================
/**
 * Mark atoms as part of a move operation.
 *
 * @param atoms - Atoms to mark
 * @param status - New correlation status (MovedSource or MovedDestination)
 * @param moveGroupId - ID linking source and destination
 * @param moveName - Name for move tracking (e.g., "move1")
 */
export function markAsMove(atoms, status, moveGroupId, moveName) {
    for (const atom of atoms) {
        atom.correlationStatus = status;
        atom.moveGroupId = moveGroupId;
        atom.moveName = moveName;
    }
}
// =============================================================================
// Main Algorithm
// =============================================================================
/**
 * Detect moves in a flat list of atoms.
 *
 * Runs after LCS comparison to identify deleted blocks that were actually
 * moved to a new location. Updates atoms in place with move status.
 *
 * @param atoms - The atom list to process (modified in place)
 * @param settings - Move detection settings (optional, uses defaults)
 *
 * @see WmlComparer.cs DetectMovesInAtomList() line 3811
 *
 * @example
 * const atoms = atomizeTree(document, [], part);
 * runLCSComparison(atoms);
 * detectMovesInAtomList(atoms); // Updates atoms in place
 */
export function detectMovesInAtomList(atoms, settings = DEFAULT_MOVE_DETECTION_SETTINGS) {
    if (!settings.detectMoves) {
        return;
    }
    // 1. Group consecutive atoms by status
    const blocks = groupIntoBlocks(atoms);
    // 2. Filter by minimum word count
    const deletedBlocks = blocks.filter((b) => b.status === CorrelationStatus.Deleted &&
        b.wordCount >= settings.moveMinimumWordCount);
    const insertedBlocks = blocks.filter((b) => b.status === CorrelationStatus.Inserted &&
        b.wordCount >= settings.moveMinimumWordCount);
    // 3. Find best matches using Jaccard similarity
    let moveGroupId = 1;
    for (const deleted of deletedBlocks) {
        const bestMatch = findBestMatch(deleted, insertedBlocks, settings);
        if (bestMatch) {
            // 4. Convert to moves
            const moveName = `move${moveGroupId}`;
            markAsMove(deleted.atoms, CorrelationStatus.MovedSource, moveGroupId, moveName);
            markAsMove(bestMatch.block.atoms, CorrelationStatus.MovedDestination, moveGroupId, moveName);
            moveGroupId++;
        }
    }
}
/**
 * Format a date as ISO string for w:date attribute.
 */
function formatDateTime(date) {
    return date.toISOString();
}
/**
 * Generate move source markup (w:moveFrom with range markers).
 *
 * @param moveName - Name linking source and destination (e.g., "move1")
 * @param content - Child elements to wrap
 * @param options - Markup generation options
 * @returns Move markup elements
 *
 * @example
 * Output structure:
 * <w:moveFromRangeStart w:id="1" w:name="move1" w:author="..." w:date="..."/>
 * <w:moveFrom w:id="2" w:author="..." w:date="...">
 *   <!-- content -->
 * </w:moveFrom>
 * <w:moveFromRangeEnd w:id="1"/>
 */
export function generateMoveSourceMarkup(moveName, content, options) {
    const { DOMParser } = require('@xmldom/xmldom');
    const doc = new DOMParser().parseFromString('<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>', 'application/xml');
    const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const dateStr = formatDateTime(options.dateTime);
    const rangeId = options.startId.toString();
    const moveId = (options.startId + 1).toString();
    const rangeStart = doc.createElementNS(W_NS, 'w:moveFromRangeStart');
    rangeStart.setAttribute('w:id', rangeId);
    rangeStart.setAttribute('w:name', moveName);
    rangeStart.setAttribute('w:author', options.author);
    rangeStart.setAttribute('w:date', dateStr);
    const moveWrapper = doc.createElementNS(W_NS, 'w:moveFrom');
    moveWrapper.setAttribute('w:id', moveId);
    moveWrapper.setAttribute('w:author', options.author);
    moveWrapper.setAttribute('w:date', dateStr);
    for (const child of content)
        moveWrapper.appendChild(child);
    const rangeEnd = doc.createElementNS(W_NS, 'w:moveFromRangeEnd');
    rangeEnd.setAttribute('w:id', rangeId);
    return {
        rangeStart,
        moveWrapper,
        rangeEnd,
        nextId: options.startId + 2,
    };
}
/**
 * Generate move destination markup (w:moveTo with range markers).
 *
 * @param moveName - Name linking source and destination (e.g., "move1")
 * @param content - Child elements to wrap
 * @param options - Markup generation options
 * @returns Move markup elements
 *
 * @example
 * Output structure:
 * <w:moveToRangeStart w:id="3" w:name="move1" w:author="..." w:date="..."/>
 * <w:moveTo w:id="4" w:author="..." w:date="...">
 *   <!-- content -->
 * </w:moveTo>
 * <w:moveToRangeEnd w:id="3"/>
 */
export function generateMoveDestinationMarkup(moveName, content, options) {
    const { DOMParser } = require('@xmldom/xmldom');
    const doc = new DOMParser().parseFromString('<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>', 'application/xml');
    const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const dateStr = formatDateTime(options.dateTime);
    const rangeId = options.startId.toString();
    const moveId = (options.startId + 1).toString();
    const rangeStart = doc.createElementNS(W_NS, 'w:moveToRangeStart');
    rangeStart.setAttribute('w:id', rangeId);
    rangeStart.setAttribute('w:name', moveName);
    rangeStart.setAttribute('w:author', options.author);
    rangeStart.setAttribute('w:date', dateStr);
    const moveWrapper = doc.createElementNS(W_NS, 'w:moveTo');
    moveWrapper.setAttribute('w:id', moveId);
    moveWrapper.setAttribute('w:author', options.author);
    moveWrapper.setAttribute('w:date', dateStr);
    for (const child of content)
        moveWrapper.appendChild(child);
    const rangeEnd = doc.createElementNS(W_NS, 'w:moveToRangeEnd');
    rangeEnd.setAttribute('w:id', rangeId);
    return {
        rangeStart,
        moveWrapper,
        rangeEnd,
        nextId: options.startId + 2,
    };
}
/**
 * Create initial revision ID state.
 *
 * @param startId - Starting ID (default: 1)
 * @returns Initial state
 */
export function createRevisionIdState(startId = 1) {
    return {
        nextId: startId,
        moveRangeIds: new Map(),
    };
}
/**
 * Allocate IDs for a move operation.
 *
 * Ensures source and destination use consistent IDs for proper linking.
 *
 * @param state - Revision ID state (modified in place)
 * @param moveName - Move name (e.g., "move1")
 * @returns IDs for source and destination markup
 */
export function allocateMoveIds(state, moveName) {
    let ids = state.moveRangeIds.get(moveName);
    if (!ids) {
        // Allocate new IDs: source range, source move, dest range, dest move
        ids = {
            sourceRangeId: state.nextId,
            destRangeId: state.nextId + 2,
        };
        state.moveRangeIds.set(moveName, ids);
        state.nextId += 4;
    }
    return {
        sourceRangeId: ids.sourceRangeId,
        sourceMoveId: ids.sourceRangeId + 1,
        destRangeId: ids.destRangeId,
        destMoveId: ids.destRangeId + 1,
    };
}
/**
 * Fix up revision IDs after all moves have been processed.
 *
 * Ensures proper ID pairing between source and destination elements.
 * This is a post-processing step after markup generation.
 *
 * @param state - The revision ID state
 */
export function fixUpRevisionIds(_state) {
    // No-op for now - IDs are allocated consistently during generation
    // This function exists for future use if ID renumbering is needed
}
//# sourceMappingURL=move-detection.js.map