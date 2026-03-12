/**
 * Generic DOCX table extraction primitives.
 *
 * Extracts tables from a parsed OOXML Document, returning structured rows
 * with header-keyed records. Supports merged cell detection/rejection and
 * header-based table filtering.
 */
export interface ExtractedTableCell {
    /** All paragraph texts joined with '\n'. */
    text: string;
    /** Individual paragraph texts (avoids irreversible normalization). */
    paragraphs: string[];
    /** Number of paragraphs in the cell. */
    paragraphCount: number;
}
export interface ExtractedTableRow {
    cells: ExtractedTableCell[];
}
export interface MergedCellDiagnostic {
    tableIndex: number;
    rowIndex: number;
    cellIndex: number;
    mergeType: 'hMerge' | 'vMerge' | 'gridSpan';
}
export interface ExtractedTable {
    /** Index of this table among all top-level w:tbl elements in w:body. */
    tableIndex: number;
    /** Header texts from the first row. */
    headers: string[];
    /** Data rows as header-keyed records (excludes header row). */
    rows: Record<string, string>[];
    /** Raw row data including header row. */
    rawRows: ExtractedTableRow[];
}
export interface ExtractTablesResult {
    tables: ExtractedTable[];
    mergedCellDiagnostics: MergedCellDiagnostic[];
}
export interface ExtractTablesOptions {
    /** Reject tables containing merged cells. Default: true. */
    rejectMergedCells?: boolean;
    /** Only return tables whose headers exactly match one of these arrays. */
    headerFilter?: string[][];
    /** Trim whitespace from cell text. Default: true. */
    trimCellText?: boolean;
}
/**
 * Extract tables from a parsed OOXML Document.
 *
 * Only processes top-level tables in w:body (not nested tables, headers,
 * or footers). First row of each table is treated as headers.
 */
export declare function extractTables(doc: Document, options?: ExtractTablesOptions): ExtractTablesResult;
//# sourceMappingURL=tables.d.ts.map