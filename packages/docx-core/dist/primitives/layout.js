import { findParagraphByBookmarkId } from './bookmarks.js';
import { OOXML, W } from './namespaces.js';
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
function ensureFirstChild(parent, localName) {
    const existing = getDirectChildrenByName(parent, localName)[0];
    if (existing)
        return existing;
    const doc = parent.ownerDocument;
    if (!doc)
        throw new Error(`Element ${parent.localName} has no ownerDocument`);
    const created = doc.createElementNS(OOXML.W_NS, `w:${localName}`);
    const firstNode = parent.firstChild;
    if (firstNode)
        parent.insertBefore(created, firstNode);
    else
        parent.appendChild(created);
    return created;
}
function ensureChild(parent, localName) {
    const existing = getDirectChildrenByName(parent, localName)[0];
    if (existing)
        return existing;
    const doc = parent.ownerDocument;
    if (!doc)
        throw new Error(`Element ${parent.localName} has no ownerDocument`);
    const created = doc.createElementNS(OOXML.W_NS, `w:${localName}`);
    parent.appendChild(created);
    return created;
}
function setWAttr(el, localName, value) {
    el.setAttributeNS(OOXML.W_NS, `w:${localName}`, value);
}
function dedupeSorted(values) {
    return [...new Set(values)].sort((a, b) => a - b);
}
function toRowIndexes(rowsCount, requested) {
    if (!requested || requested.length === 0) {
        return { indexes: [...Array(rowsCount).keys()], missing: [] };
    }
    const indexes = dedupeSorted(requested).filter((idx) => idx >= 0 && idx < rowsCount);
    const missing = dedupeSorted(requested).filter((idx) => idx < 0 || idx >= rowsCount);
    return { indexes, missing };
}
function toCellIndexes(cellsCount, requested) {
    if (!requested || requested.length === 0) {
        return { indexes: [...Array(cellsCount).keys()], missing: [] };
    }
    const indexes = dedupeSorted(requested).filter((idx) => idx >= 0 && idx < cellsCount);
    const missing = dedupeSorted(requested).filter((idx) => idx < 0 || idx >= cellsCount);
    return { indexes, missing };
}
function getTables(doc) {
    return Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.tbl));
}
export function setParagraphSpacing(doc, mutation) {
    const paragraphIds = [...new Set(mutation.paragraphIds)];
    const missingParagraphIds = [];
    let affectedParagraphs = 0;
    for (const paragraphId of paragraphIds) {
        const paragraph = findParagraphByBookmarkId(doc, paragraphId);
        if (!paragraph) {
            missingParagraphIds.push(paragraphId);
            continue;
        }
        const pPr = ensureFirstChild(paragraph, W.pPr);
        const spacing = ensureChild(pPr, W.spacing);
        if (typeof mutation.beforeTwips === 'number')
            setWAttr(spacing, W.before, String(mutation.beforeTwips));
        if (typeof mutation.afterTwips === 'number')
            setWAttr(spacing, W.after, String(mutation.afterTwips));
        if (typeof mutation.lineTwips === 'number')
            setWAttr(spacing, W.line, String(mutation.lineTwips));
        if (typeof mutation.lineRule === 'string')
            setWAttr(spacing, W.lineRule, mutation.lineRule);
        affectedParagraphs += 1;
    }
    return { affectedParagraphs, missingParagraphIds };
}
export function setTableRowHeight(doc, mutation) {
    const tables = getTables(doc);
    const missingTableIndexes = [];
    const missingRowIndexes = [];
    let affectedRows = 0;
    for (const tableIndex of dedupeSorted(mutation.tableIndexes)) {
        const table = tables[tableIndex];
        if (!table) {
            missingTableIndexes.push(tableIndex);
            continue;
        }
        const rows = getDirectChildrenByName(table, W.tr);
        const rowSelection = toRowIndexes(rows.length, mutation.rowIndexes);
        for (const missingRowIdx of rowSelection.missing) {
            missingRowIndexes.push({ tableIndex, rowIndex: missingRowIdx });
        }
        for (const rowIndex of rowSelection.indexes) {
            const row = rows[rowIndex];
            const trPr = ensureFirstChild(row, W.trPr);
            const trHeight = ensureChild(trPr, W.trHeight);
            setWAttr(trHeight, W.val, String(mutation.valueTwips));
            setWAttr(trHeight, W.hRule, mutation.rule);
            affectedRows += 1;
        }
    }
    return { affectedRows, missingTableIndexes, missingRowIndexes };
}
export function setTableCellPadding(doc, mutation) {
    const tables = getTables(doc);
    const missingTableIndexes = [];
    const missingRowIndexes = [];
    const missingCellIndexes = [];
    let affectedCells = 0;
    for (const tableIndex of dedupeSorted(mutation.tableIndexes)) {
        const table = tables[tableIndex];
        if (!table) {
            missingTableIndexes.push(tableIndex);
            continue;
        }
        const rows = getDirectChildrenByName(table, W.tr);
        const rowSelection = toRowIndexes(rows.length, mutation.rowIndexes);
        for (const missingRowIdx of rowSelection.missing) {
            missingRowIndexes.push({ tableIndex, rowIndex: missingRowIdx });
        }
        for (const rowIndex of rowSelection.indexes) {
            const row = rows[rowIndex];
            const cells = getDirectChildrenByName(row, W.tc);
            const cellSelection = toCellIndexes(cells.length, mutation.cellIndexes);
            for (const missingCellIdx of cellSelection.missing) {
                missingCellIndexes.push({ tableIndex, rowIndex, cellIndex: missingCellIdx });
            }
            for (const cellIndex of cellSelection.indexes) {
                const cell = cells[cellIndex];
                const tcPr = ensureFirstChild(cell, W.tcPr);
                const tcMar = ensureChild(tcPr, W.tcMar);
                if (typeof mutation.topDxa === 'number') {
                    const top = ensureChild(tcMar, W.top);
                    setWAttr(top, W.w, String(mutation.topDxa));
                    setWAttr(top, W.type, 'dxa');
                }
                if (typeof mutation.bottomDxa === 'number') {
                    const bottom = ensureChild(tcMar, W.bottom);
                    setWAttr(bottom, W.w, String(mutation.bottomDxa));
                    setWAttr(bottom, W.type, 'dxa');
                }
                if (typeof mutation.leftDxa === 'number') {
                    const left = ensureChild(tcMar, W.left);
                    setWAttr(left, W.w, String(mutation.leftDxa));
                    setWAttr(left, W.type, 'dxa');
                }
                if (typeof mutation.rightDxa === 'number') {
                    const right = ensureChild(tcMar, W.right);
                    setWAttr(right, W.w, String(mutation.rightDxa));
                    setWAttr(right, W.type, 'dxa');
                }
                affectedCells += 1;
            }
        }
    }
    return {
        affectedCells,
        missingTableIndexes,
        missingRowIndexes,
        missingCellIndexes,
    };
}
//# sourceMappingURL=layout.js.map