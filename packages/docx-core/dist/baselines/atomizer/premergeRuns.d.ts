/**
 * Pre-Compare Run Pre-Merge
 *
 * Optional normalization step to merge adjacent <w:r> siblings with identical
 * formatting before atomization.
 *
 * Motivation:
 * - Some documents are heavily fragmented into multiple runs even when the
 *   formatting is identical. This can cause overly-granular diffs.
 * - For `reconstructionMode: 'inplace'`, we intentionally disable atom-level
 *   cross-run text merging to keep atoms anchored to real runs. Pre-merging runs
 *   is a safer way to reduce fragmentation without creating atoms that span
 *   multiple runs.
 *
 * This step is intentionally conservative:
 * - Only merges immediately-adjacent <w:r> siblings under the same parent.
 * - Requires identical run attributes and identical <w:rPr> formatting subtree.
 * - Only merges runs that contain a small, "safe" subset of child elements.
 */
/**
 * Merge adjacent runs throughout a DOM Element subtree.
 *
 * @returns The number of merges performed.
 */
export declare function premergeAdjacentRuns(root: Element): number;
//# sourceMappingURL=premergeRuns.d.ts.map