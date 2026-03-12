export type TextRun = {
    r: Element;
    text: string;
    isFieldResult: boolean;
};
export declare function getParagraphRuns(p: Element): TextRun[];
export declare function getParagraphText(p: Element): string;
export declare function visibleLengthForEl(el: Element): number;
export declare function getDirectContentElements(run: Element): Element[];
export declare function splitRunAtVisibleOffset(run: Element, offset: number): {
    left: Element;
    right: Element;
};
export type AddRunProps = {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    highlight?: boolean | string;
    fontSize?: number;
    fontName?: string;
    color?: string;
};
export type ReplacementPart = {
    text: string;
    templateRun?: Element | null;
    addRunProps?: AddRunProps;
    clearHighlight?: boolean;
};
export declare function replaceParagraphTextRange(p: Element, start: number, end: number, replacement: string | ReplacementPart[]): void;
//# sourceMappingURL=text.d.ts.map