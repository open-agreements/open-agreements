export declare const DEFINITION_TAG = "definition";
export declare const HIGHLIGHT_TAG = "highlighting";
export declare function hasDefinitionTags(text: string): boolean;
export declare function hasHighlightTags(text: string): boolean;
export declare function emitDefinitionTagsFromString(text: string): string;
export declare function findInlineDefinitionSpan(text: string): {
    term: string;
    term_start: number;
    term_end: number;
} | null;
export declare function stripDefinitionTags(text: string): string;
export declare function stripHighlightTags(text: string): string;
export declare function hasFormattingTags(text: string): boolean;
export declare function stripFormattingTags(text: string): string;
export declare function hasHyperlinkTags(text: string): boolean;
export declare function stripHyperlinkTags(text: string): string;
/**
 * Detect definition spans on plain text, returning character offset ranges
 * and the defined term. Used by the formatting tag emitter to interleave
 * <definition> tags with formatting tags in a single consistent pass.
 *
 * Returns spans where:
 * - `start` = index of the opening quote character
 * - `end` = index one past the closing quote character
 * - `term` = the defined term text (excluding quotes)
 */
export declare function detectDefinitionSpans(text: string): Array<{
    start: number;
    end: number;
    term: string;
}>;
//# sourceMappingURL=semantic_tags.d.ts.map