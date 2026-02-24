import type { RunFormatting } from './styles.js';
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
export declare function computeModalBaseline(runs: AnnotatedRun[]): FormattingBaseline;
export type DefinitionSpan = {
    /** Plain-text offset of the opening quote (inclusive). */
    start: number;
    /** Plain-text offset one past the closing quote (exclusive). */
    end: number;
    /** The defined term text (excluding quotes). */
    term: string;
};
export declare function emitFormattingTags(params: {
    runs: AnnotatedRun[];
    baseline: FormattingBaseline;
    definitionSpans?: DefinitionSpan[];
}): string;
export declare function mergeAdjacentTags(tagged: string): string;
//# sourceMappingURL=formatting_tags.d.ts.map