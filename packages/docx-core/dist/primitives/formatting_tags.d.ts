import type { RunFormatting } from './styles.js';
/**
 * Controls formatting tag emission behaviour.
 *
 * - `compact` — 60% threshold suppression (default, current behavior)
 * - `full`   — all formatting emitted, no suppression (benchmark mode)
 * - `plain_text` — no formatting tags at all (future: fast text-only views)
 */
export type FormattingMode = 'compact' | 'full' | 'plain_text';
export type AnnotatedRun = {
    text: string;
    formatting: RunFormatting;
    hyperlinkUrl: string | null;
    charCount: number;
    isHeaderRun: boolean;
};
export type FormattingBaseline = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    suppressed: boolean;
};
export type FontBaseline = {
    modalColor: string | null;
    colorSuppressed: boolean;
    modalFontSizePt: number;
    fontSizeSuppressed: boolean;
    modalFontName: string;
    fontNameSuppressed: boolean;
};
export declare function computeModalBaseline(runs: AnnotatedRun[], options?: {
    formattingMode?: FormattingMode;
}): FormattingBaseline;
export declare function computeParagraphFontBaseline(runs: AnnotatedRun[], options?: {
    formattingMode?: FormattingMode;
}): FontBaseline;
export declare function emitFormattingTags(params: {
    runs: AnnotatedRun[];
    baseline: FormattingBaseline;
    fontBaseline?: FontBaseline | null;
}): string;
export declare function mergeAdjacentTags(tagged: string): string;
//# sourceMappingURL=formatting_tags.d.ts.map