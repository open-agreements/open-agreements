export declare const HIGHLIGHT_TAG = "highlight";
export declare function hasFormattingTags(text: string): boolean;
export declare function stripFormattingTags(text: string): string;
export declare function hasHyperlinkTags(text: string): boolean;
export declare function stripHyperlinkTags(text: string): string;
export declare function hasHighlightTags(text: string): boolean;
export declare function stripHighlightTags(text: string): string;
export declare function hasFontTags(text: string): boolean;
export declare function stripFontTags(text: string): string;
/**
 * Strip ALL known inline tags from text. Handles `<b>`, `<i>`, `<u>`,
 * `<highlight>`, `<highlighting>`, `<a href="...">`, `</a>`, `<font ...>`,
 * `</font>`, `<header>`, `</header>`, `<RunInHeader>`, `</RunInHeader>`,
 * `<definition>`, `</definition>`.
 */
export declare function stripAllInlineTags(text: string): string;
//# sourceMappingURL=semantic_tags.d.ts.map