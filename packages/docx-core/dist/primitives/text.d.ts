export type TextRun = {
    r: Element;
    text: string;
    isFieldResult: boolean;
};
export declare function getParagraphRuns(p: Element): TextRun[];
export declare function getParagraphText(p: Element): string;
export type AddRunProps = {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    highlight?: boolean | string;
};
export type ReplacementPart = {
    text: string;
    templateRun?: Element | null;
    addRunProps?: AddRunProps;
    clearHighlight?: boolean;
};
export declare function replaceParagraphTextRange(p: Element, start: number, end: number, replacement: string | ReplacementPart[]): void;
//# sourceMappingURL=text.d.ts.map