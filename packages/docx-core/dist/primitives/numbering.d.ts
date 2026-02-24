export type NumberingLevel = {
    ilvl: number;
    start: number;
    numFmt: string;
    lvlText: string;
    suff: string;
};
export type AbstractNum = {
    abstractNumId: string;
    levels: Map<number, NumberingLevel>;
};
export type NumInstance = {
    numId: string;
    abstractNumId: string;
    startOverrideByLevel: Map<number, number>;
};
export type NumberingModel = {
    abstractNums: Map<string, AbstractNum>;
    nums: Map<string, NumInstance>;
};
export declare function parseNumberingXml(numberingDoc: Document | null): NumberingModel;
export type NumberingCounters = Map<string, number[]>;
export declare function computeListLabelForParagraph(model: NumberingModel, counters: NumberingCounters, params: {
    numId: string;
    ilvl: number;
}): string;
//# sourceMappingURL=numbering.d.ts.map