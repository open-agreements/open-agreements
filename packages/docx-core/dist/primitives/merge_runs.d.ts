/**
 * merge_runs — merge adjacent format-identical runs within paragraphs.
 *
 * Safety barriers: never merge across fldChar/instrText, comment range,
 * bookmark, or tracked-change wrapper boundaries.
 */
export type MergeRunsResult = {
    runsMerged: number;
    proofErrRemoved: number;
};
/**
 * Merge adjacent format-identical runs across all paragraphs in the
 * document body. Removes `<w:proofErr>` elements and strips `rsid`
 * attributes from runs before comparison.
 *
 * Safety barriers prevent merges across:
 * - Field boundaries (fldChar, instrText)
 * - Comment range boundaries (commentRangeStart, commentRangeEnd)
 * - Bookmark boundaries (bookmarkStart, bookmarkEnd)
 * - Tracked-change wrapper boundaries (ins, del, moveFrom, moveTo)
 */
export declare function mergeRuns(doc: Document): MergeRunsResult;
//# sourceMappingURL=merge_runs.d.ts.map