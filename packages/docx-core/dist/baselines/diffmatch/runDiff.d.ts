/**
 * Baseline B: Run-level diff using diff-match-patch.
 *
 * Performs character-level diff on matched paragraphs, then maps
 * the diff operations back to run boundaries for track changes generation.
 */
import type { RunInfo, RunDiffResult, DiffOp } from '../../shared/ooxml/types.js';
/**
 * Compute a diff between two strings.
 *
 * @param original - Original text
 * @param revised - Revised text
 * @param cleanupSemantic - Apply semantic cleanup (default: true)
 * @returns Array of diff operations [operation, text]
 */
export declare function computeDiff(original: string, revised: string, cleanupSemantic?: boolean): DiffOp[];
/**
 * Compute a word-level diff (more suitable for document comparison).
 *
 * Tokenizes input by words, performs diff, then reconstructs.
 */
export declare function computeWordDiff(original: string, revised: string): DiffOp[];
/**
 * Split a run at a given character offset.
 *
 * @param run - The run to split
 * @param offset - Character offset to split at
 * @returns [before, after] runs
 */
export declare function splitRun(run: RunInfo, offset: number): [RunInfo, RunInfo];
/**
 * Extract text from runs.
 */
export declare function extractText(runs: RunInfo[]): string;
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
export declare function diffRuns(originalRuns: RunInfo[], revisedRuns: RunInfo[]): RunDiffResult;
/**
 * Count changes in a diff result.
 */
export declare function countChanges(diffs: DiffOp[]): {
    insertions: number;
    deletions: number;
};
//# sourceMappingURL=runDiff.d.ts.map