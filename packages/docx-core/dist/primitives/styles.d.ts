export type StyleDef = {
    styleId: string;
    name: string;
    basedOn: string | null;
    pPr: Element | null;
    rPr: Element | null;
};
export type StylesModel = {
    byId: Map<string, StyleDef>;
};
export declare function parseStylesXml(stylesDoc: Document | null): StylesModel;
export type ParagraphAlignment = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY';
export type ParagraphFormatting = {
    styleId: string | null;
    styleName: string;
    alignment: ParagraphAlignment;
    leftIndentPt: number;
    firstLineIndentPt: number;
};
export declare function extractParagraphFormatting(pPr: Element | null, styles: StylesModel): ParagraphFormatting;
export type RunFormatting = {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    highlightVal: string | null;
    fontName: string;
    fontSizePt: number;
    colorHex: string | null;
};
export declare function extractEffectiveRunFormatting(params: {
    run: Element;
    paragraphPPr: Element | null;
    paragraphStyleId: string | null;
    styles: StylesModel;
}): RunFormatting;
//# sourceMappingURL=styles.d.ts.map