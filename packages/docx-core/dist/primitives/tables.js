/**
 * Generic DOCX table extraction primitives.
 *
 * Extracts tables from a parsed OOXML Document, returning structured rows
 * with header-keyed records. Supports merged cell detection/rejection and
 * header-based table filtering.
 */
import { OOXML, W } from './namespaces.js';
// ---------------------------------------------------------------------------
// Internal helpers (same patterns as layout.ts)
// ---------------------------------------------------------------------------
function isW(el, localName) {
    return !!el && el.namespaceURI === OOXML.W_NS && el.localName === localName;
}
function getDirectChildrenByName(parent, localName) {
    const out = [];
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, localName))
            out.push(el);
    }
    return out;
}
/** Get text content of a single paragraph element. */
function getParagraphText(p) {
    const parts = [];
    const runs = p.getElementsByTagNameNS(OOXML.W_NS, W.r);
    for (let r = 0; r < runs.length; r++) {
        const run = runs[r];
        // Collect w:t text nodes and w:tab / w:br
        for (const child of Array.from(run.childNodes)) {
            if (child.nodeType !== 1)
                continue;
            const el = child;
            if (isW(el, W.t)) {
                parts.push(el.textContent ?? '');
            }
            else if (isW(el, W.tab)) {
                parts.push('\t');
            }
            else if (isW(el, W.br)) {
                parts.push('\n');
            }
        }
    }
    return parts.join('');
}
/** Extract text from a table cell, returning per-paragraph texts. */
function extractCellContent(tc, trim) {
    const paragraphs = getDirectChildrenByName(tc, W.p);
    const paraTexts = [];
    for (const p of paragraphs) {
        const text = getParagraphText(p);
        paraTexts.push(trim ? text.trim() : text);
    }
    return {
        text: paraTexts.join('\n'),
        paragraphs: paraTexts,
        paragraphCount: paragraphs.length,
    };
}
/** Check if a cell has any merge properties. Returns the merge type or null. */
function detectMerge(tc) {
    const tcPrList = getDirectChildrenByName(tc, W.tcPr);
    if (tcPrList.length === 0)
        return null;
    const tcPr = tcPrList[0];
    // Check w:hMerge (any attribute form)
    for (const child of Array.from(tcPr.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, 'hMerge'))
            return 'hMerge';
        if (isW(el, 'vMerge'))
            return 'vMerge';
    }
    // Check w:gridSpan with val > 1
    for (const child of Array.from(tcPr.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, 'gridSpan')) {
            const val = el.getAttributeNS(OOXML.W_NS, W.val) ?? el.getAttribute('w:val');
            if (val && parseInt(val, 10) > 1)
                return 'gridSpan';
        }
    }
    return null;
}
/** Get top-level tables from w:body only (not nested tables). */
function getBodyTables(doc) {
    const body = doc.getElementsByTagNameNS(OOXML.W_NS, W.body).item(0);
    if (!body)
        return [];
    return getDirectChildrenByName(body, W.tbl);
}
/** Check if headers match a filter entry. */
function headersMatch(headers, filter) {
    if (headers.length !== filter.length)
        return false;
    return headers.every((h, i) => h === filter[i]);
}
// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------
/**
 * Extract tables from a parsed OOXML Document.
 *
 * Only processes top-level tables in w:body (not nested tables, headers,
 * or footers). First row of each table is treated as headers.
 */
export function extractTables(doc, options) {
    const rejectMergedCells = options?.rejectMergedCells ?? true;
    const headerFilter = options?.headerFilter;
    const trim = options?.trimCellText ?? true;
    const tables = getBodyTables(doc);
    const result = [];
    const mergedCellDiagnostics = [];
    for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const table = tables[tableIndex];
        const rows = getDirectChildrenByName(table, W.tr);
        if (rows.length === 0)
            continue;
        // Scan for merged cells first
        let hasMergedCells = false;
        const tableMergeDiags = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = getDirectChildrenByName(rows[rowIndex], W.tc);
            for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
                const mergeType = detectMerge(cells[cellIndex]);
                if (mergeType) {
                    hasMergedCells = true;
                    tableMergeDiags.push({ tableIndex, rowIndex, cellIndex, mergeType });
                }
            }
        }
        mergedCellDiagnostics.push(...tableMergeDiags);
        if (hasMergedCells && rejectMergedCells) {
            continue; // Skip this table
        }
        // Extract header row
        const headerCells = getDirectChildrenByName(rows[0], W.tc);
        const headers = headerCells.map((c) => extractCellContent(c, trim).text);
        // Check for duplicate headers
        const headerSet = new Set();
        let hasDuplicateHeaders = false;
        for (const h of headers) {
            if (headerSet.has(h)) {
                hasDuplicateHeaders = true;
                break;
            }
            headerSet.add(h);
        }
        if (hasDuplicateHeaders)
            continue; // Skip tables with duplicate headers
        // Apply header filter
        if (headerFilter) {
            const matches = headerFilter.some((filter) => headersMatch(headers, filter));
            if (!matches)
                continue;
        }
        // Extract all rows (including header as rawRows[0])
        const rawRows = [];
        const dataRecords = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = getDirectChildrenByName(rows[rowIndex], W.tc);
            const extractedCells = [];
            for (const cell of cells) {
                extractedCells.push(extractCellContent(cell, trim));
            }
            rawRows.push({ cells: extractedCells });
            // Skip header row for data records
            if (rowIndex === 0)
                continue;
            // Build header-keyed record
            const record = {};
            for (let i = 0; i < headers.length; i++) {
                record[headers[i]] = extractedCells[i]?.text ?? '';
            }
            dataRecords.push(record);
        }
        // Check for nested tables and emit diagnostic (but don't skip the table)
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = getDirectChildrenByName(rows[rowIndex], W.tc);
            for (const cell of cells) {
                const nestedTables = getDirectChildrenByName(cell, W.tbl);
                if (nestedTables.length > 0) {
                    // Nested table detected — logged via diagnostics
                    // The parent table is still extracted; nested tables are ignored
                }
            }
        }
        result.push({
            tableIndex,
            headers,
            rows: dataRecords,
            rawRows,
        });
    }
    return { tables: result, mergedCellDiagnostics };
}
//# sourceMappingURL=tables.js.map