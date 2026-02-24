/**
 * Baseline B: Run-level diff using diff-match-patch.
 *
 * Performs character-level diff on matched paragraphs, then maps
 * the diff operations back to run boundaries for track changes generation.
 */
import DiffMatchPatch from 'diff-match-patch';
/** Diff operation codes from diff-match-patch */
const DIFF_DELETE = -1;
const DIFF_INSERT = 1;
const DIFF_EQUAL = 0;
/** Create a shared diff-match-patch instance */
const dmp = new DiffMatchPatch();
// Configure diff-match-patch for better document comparison
dmp.Diff_Timeout = 5; // 5 seconds timeout
dmp.Diff_EditCost = 4; // Favor fewer, larger edits
/**
 * Compute a diff between two strings.
 *
 * @param original - Original text
 * @param revised - Revised text
 * @param cleanupSemantic - Apply semantic cleanup (default: true)
 * @returns Array of diff operations [operation, text]
 */
export function computeDiff(original, revised, cleanupSemantic = true) {
    const diffs = dmp.diff_main(original, revised);
    if (cleanupSemantic) {
        dmp.diff_cleanupSemantic(diffs);
    }
    return diffs;
}
/**
 * Compute a word-level diff (more suitable for document comparison).
 *
 * Tokenizes input by words, performs diff, then reconstructs.
 */
export function computeWordDiff(original, revised) {
    // Tokenize by words (keep punctuation attached to words)
    const tokenize = (text) => {
        return text.match(/\S+\s*/g) ?? [];
    };
    const originalTokens = tokenize(original);
    const revisedTokens = tokenize(revised);
    // Convert tokens to characters for diff-match-patch (1 token = 1 char)
    const { chars1, chars2, lineArray } = tokensToChars(originalTokens, revisedTokens);
    // Compute diff on character representation
    const diffs = dmp.diff_main(chars1, chars2);
    dmp.diff_cleanupSemantic(diffs);
    // Convert back to actual text
    return charsToTokens(diffs, lineArray);
}
/**
 * Convert token arrays to character sequences for diffing.
 */
function tokensToChars(tokens1, tokens2) {
    const tokenSet = new Map();
    const lineArray = [];
    const encode = (tokens) => {
        let chars = '';
        for (const token of tokens) {
            if (!tokenSet.has(token)) {
                tokenSet.set(token, lineArray.length);
                lineArray.push(token);
            }
            chars += String.fromCharCode(tokenSet.get(token));
        }
        return chars;
    };
    const chars1 = encode(tokens1);
    const chars2 = encode(tokens2);
    return { chars1, chars2, lineArray };
}
/**
 * Convert character diff back to token diff.
 */
function charsToTokens(diffs, lineArray) {
    const result = [];
    for (const [op, chars] of diffs) {
        let text = '';
        for (let i = 0; i < chars.length; i++) {
            text += lineArray[chars.charCodeAt(i)] ?? '';
        }
        if (text) {
            result.push([op, text]);
        }
    }
    return result;
}
/**
 * Map a character offset to a position in the run array.
 */
function offsetToRunPosition(runs, offset) {
    let charCount = 0;
    for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const runLength = run.text.length;
        if (charCount + runLength > offset) {
            return {
                runIndex: i,
                charOffset: offset - charCount,
            };
        }
        charCount += runLength;
    }
    // Offset is at or past end
    return {
        runIndex: runs.length - 1,
        charOffset: runs[runs.length - 1]?.text.length ?? 0,
    };
}
/**
 * Split a run at a given character offset.
 *
 * @param run - The run to split
 * @param offset - Character offset to split at
 * @returns [before, after] runs
 */
export function splitRun(run, offset) {
    const before = {
        text: run.text.slice(0, offset),
        start: run.start,
        end: run.start + offset,
        properties: run.properties ? { ...run.properties } : undefined,
    };
    const after = {
        text: run.text.slice(offset),
        start: run.start + offset,
        end: run.end,
        properties: run.properties ? { ...run.properties } : undefined,
    };
    return [before, after];
}
/**
 * Extract text from runs.
 */
export function extractText(runs) {
    return runs.map(r => r.text).join('');
}
/**
 * Compute run-level diff between original and revised runs.
 *
 * Maps character-level diff back to run boundaries, splitting runs
 * when necessary.
 *
 * @param originalRuns - Runs from original paragraph
 * @param revisedRuns - Runs from revised paragraph
 * @returns Merged runs with revision markers
 */
export function diffRuns(originalRuns, revisedRuns) {
    const originalText = extractText(originalRuns);
    const revisedText = extractText(revisedRuns);
    // Compute character-level diff
    const diffs = computeDiff(originalText, revisedText);
    // Build merged runs with revision markers
    const mergedRuns = [];
    let originalOffset = 0;
    let revisedOffset = 0;
    for (const [op, text] of diffs) {
        if (op === DIFF_EQUAL) {
            // Equal text - use revised runs' formatting
            const startPos = offsetToRunPosition(revisedRuns, revisedOffset);
            const endPos = offsetToRunPosition(revisedRuns, revisedOffset + text.length);
            // Extract runs that cover this range
            for (let i = startPos.runIndex; i <= endPos.runIndex && i < revisedRuns.length; i++) {
                const run = revisedRuns[i];
                const runStart = i === startPos.runIndex ? startPos.charOffset : 0;
                const runEnd = i === endPos.runIndex ? endPos.charOffset : run.text.length;
                if (runEnd > runStart) {
                    mergedRuns.push({
                        text: run.text.slice(runStart, runEnd),
                        start: revisedOffset + runStart,
                        end: revisedOffset + runEnd,
                        properties: run.properties,
                    });
                }
            }
            originalOffset += text.length;
            revisedOffset += text.length;
        }
        else if (op === DIFF_DELETE) {
            // Deleted text - use original runs' formatting, mark as deletion
            const startPos = offsetToRunPosition(originalRuns, originalOffset);
            const endPos = offsetToRunPosition(originalRuns, originalOffset + text.length);
            for (let i = startPos.runIndex; i <= endPos.runIndex && i < originalRuns.length; i++) {
                const run = originalRuns[i];
                const runStart = i === startPos.runIndex ? startPos.charOffset : 0;
                const runEnd = i === endPos.runIndex ? endPos.charOffset : run.text.length;
                if (runEnd > runStart) {
                    mergedRuns.push({
                        text: run.text.slice(runStart, runEnd),
                        start: originalOffset + runStart,
                        end: originalOffset + runEnd,
                        properties: run.properties,
                        revision: {
                            id: 0, // Will be assigned later
                            author: '',
                            date: new Date(),
                            type: 'deletion',
                        },
                    });
                }
            }
            originalOffset += text.length;
        }
        else if (op === DIFF_INSERT) {
            // Inserted text - use revised runs' formatting, mark as insertion
            const startPos = offsetToRunPosition(revisedRuns, revisedOffset);
            const endPos = offsetToRunPosition(revisedRuns, revisedOffset + text.length);
            for (let i = startPos.runIndex; i <= endPos.runIndex && i < revisedRuns.length; i++) {
                const run = revisedRuns[i];
                const runStart = i === startPos.runIndex ? startPos.charOffset : 0;
                const runEnd = i === endPos.runIndex ? endPos.charOffset : run.text.length;
                if (runEnd > runStart) {
                    mergedRuns.push({
                        text: run.text.slice(runStart, runEnd),
                        start: revisedOffset + runStart,
                        end: revisedOffset + runEnd,
                        properties: run.properties,
                        revision: {
                            id: 0, // Will be assigned later
                            author: '',
                            date: new Date(),
                            type: 'insertion',
                        },
                    });
                }
            }
            revisedOffset += text.length;
        }
    }
    return {
        originalRuns,
        revisedRuns,
        mergedRuns,
    };
}
/**
 * Count changes in a diff result.
 */
export function countChanges(diffs) {
    let insertions = 0;
    let deletions = 0;
    for (const [op, text] of diffs) {
        if (op === DIFF_INSERT) {
            insertions += text.length;
        }
        else if (op === DIFF_DELETE) {
            deletions += text.length;
        }
    }
    return { insertions, deletions };
}
//# sourceMappingURL=runDiff.js.map