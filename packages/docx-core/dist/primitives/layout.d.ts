export type SpacingLineRule = 'auto' | 'exact' | 'atLeast';
export type RowHeightRule = 'auto' | 'exact' | 'atLeast';
export type ParagraphSpacingMutation = {
    paragraphIds: string[];
    beforeTwips?: number;
    afterTwips?: number;
    lineTwips?: number;
    lineRule?: SpacingLineRule;
};
export type TableRowHeightMutation = {
    tableIndexes: number[];
    rowIndexes?: number[];
    valueTwips: number;
    rule: RowHeightRule;
};
export type TableCellPaddingMutation = {
    tableIndexes: number[];
    rowIndexes?: number[];
    cellIndexes?: number[];
    topDxa?: number;
    bottomDxa?: number;
    leftDxa?: number;
    rightDxa?: number;
};
export type ParagraphSpacingMutationResult = {
    affectedParagraphs: number;
    missingParagraphIds: string[];
};
export type TableRowHeightMutationResult = {
    affectedRows: number;
    missingTableIndexes: number[];
    missingRowIndexes: Array<{
        tableIndex: number;
        rowIndex: number;
    }>;
};
export type TableCellPaddingMutationResult = {
    affectedCells: number;
    missingTableIndexes: number[];
    missingRowIndexes: Array<{
        tableIndex: number;
        rowIndex: number;
    }>;
    missingCellIndexes: Array<{
        tableIndex: number;
        rowIndex: number;
        cellIndex: number;
    }>;
};
export declare function setParagraphSpacing(doc: Document, mutation: ParagraphSpacingMutation): ParagraphSpacingMutationResult;
export declare function setTableRowHeight(doc: Document, mutation: TableRowHeightMutation): TableRowHeightMutationResult;
export declare function setTableCellPadding(doc: Document, mutation: TableCellPaddingMutation): TableCellPaddingMutationResult;
//# sourceMappingURL=layout.d.ts.map