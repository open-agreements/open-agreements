/**
 * simplify_redlines — merge adjacent same-author tracked-change wrappers.
 *
 * Consolidates consecutive `w:ins`, `w:del`, `w:moveFrom`, or `w:moveTo`
 * wrappers that share the same `w:author` attribute and local name.
 * Does not merge across different change types or non-whitespace separators.
 */
export type SimplifyRedlinesResult = {
    wrappersConsolidated: number;
};
/**
 * Simplify tracked-change wrappers across all paragraphs in the document
 * body by merging adjacent same-type, same-author wrappers.
 *
 * This reduces visual clutter in redline documents without altering
 * semantics (every run's tracked-change attribution is preserved).
 */
export declare function simplifyRedlines(doc: Document): SimplifyRedlinesResult;
//# sourceMappingURL=simplify_redlines.d.ts.map