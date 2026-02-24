/**
 * footnotes — OOXML footnote bootstrapping, CRUD, and display numbering.
 *
 * Creates footnote XML parts when missing, inserts footnote reference runs,
 * and supports reading, updating, and deleting footnotes.
 */
import { OOXML, W } from './namespaces.js';
import { parseXml, serializeXml } from './xml.js';
import { getParagraphRuns } from './text.js';
import { getParagraphBookmarkId } from './bookmarks.js';
import { findUniqueSubstringMatch } from './matching.js';
// ── Relationship & content types ────────────────────────────────────────
const REL_TYPE_FOOTNOTES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes';
const CT_FOOTNOTES = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml';
// ── Minimal XML template ────────────────────────────────────────────────
const FOOTNOTES_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"` +
    ` xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">` +
    `<w:footnote w:type="separator" w:id="-1">` +
    `<w:p><w:r><w:separator/></w:r></w:p>` +
    `</w:footnote>` +
    `<w:footnote w:type="continuationSeparator" w:id="0">` +
    `<w:p><w:r><w:continuationSeparator/></w:r></w:p>` +
    `</w:footnote>` +
    `</w:footnotes>`;
// ── Reserved entry detection ────────────────────────────────────────────
function getWAttr(el, localName) {
    return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? el.getAttribute(localName);
}
export function isReservedFootnote(footnoteEl) {
    const typ = getWAttr(footnoteEl, 'type');
    return typ === 'separator' || typ === 'continuationSeparator';
}
// ── Part bootstrapping ──────────────────────────────────────────────────
export async function bootstrapFootnoteParts(zip) {
    const created = [];
    if (!zip.hasFile('word/footnotes.xml')) {
        zip.writeText('word/footnotes.xml', FOOTNOTES_XML_TEMPLATE);
        created.push('word/footnotes.xml');
    }
    if (created.length === 0)
        return { partsCreated: [] };
    // Update [Content_Types].xml
    await ensureFootnoteContentTypes(zip, created);
    // Update word/_rels/document.xml.rels
    await ensureFootnoteRelationships(zip, created);
    return { partsCreated: created };
}
async function ensureFootnoteContentTypes(zip, newParts) {
    const ctPath = '[Content_Types].xml';
    let ctXml;
    try {
        ctXml = await zip.readText(ctPath);
    }
    catch {
        ctXml =
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
                `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;
    }
    const ctDoc = parseXml(ctXml);
    const typesEl = ctDoc.documentElement;
    const ctNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
    const partToCt = {
        'word/footnotes.xml': CT_FOOTNOTES,
    };
    const overrides = Array.from(typesEl.getElementsByTagNameNS(ctNs, 'Override'));
    const existingPartNames = new Set(overrides.map((o) => o.getAttribute('PartName')));
    for (const part of newParts) {
        const partName = `/${part}`;
        const contentType = partToCt[part];
        if (!contentType || existingPartNames.has(partName))
            continue;
        const override = ctDoc.createElementNS(ctNs, 'Override');
        override.setAttribute('PartName', partName);
        override.setAttribute('ContentType', contentType);
        typesEl.appendChild(override);
    }
    zip.writeText(ctPath, serializeXml(ctDoc));
}
async function ensureFootnoteRelationships(zip, newParts) {
    const relsPath = 'word/_rels/document.xml.rels';
    let relsXml;
    try {
        relsXml = await zip.readText(relsPath);
    }
    catch {
        relsXml =
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
                `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
    }
    const relsDoc = parseXml(relsXml);
    const relsEl = relsDoc.documentElement;
    const relNs = OOXML.REL_NS;
    const partToRelType = {
        'word/footnotes.xml': REL_TYPE_FOOTNOTES,
    };
    const existingRels = Array.from(relsEl.getElementsByTagNameNS(relNs, 'Relationship'));
    const existingTypes = new Set(existingRels.map((r) => r.getAttribute('Type')));
    let maxId = 0;
    for (const rel of existingRels) {
        const id = rel.getAttribute('Id') ?? '';
        const match = /^rId(\d+)$/.exec(id);
        if (match)
            maxId = Math.max(maxId, parseInt(match[1], 10));
    }
    for (const part of newParts) {
        const relType = partToRelType[part];
        if (!relType || existingTypes.has(relType))
            continue;
        maxId++;
        const rel = relsDoc.createElementNS(relNs, 'Relationship');
        rel.setAttribute('Id', `rId${maxId}`);
        rel.setAttribute('Type', relType);
        rel.setAttribute('Target', part.replace('word/', ''));
        relsEl.appendChild(rel);
    }
    zip.writeText(relsPath, serializeXml(relsDoc));
}
// ── ID allocation ───────────────────────────────────────────────────────
function allocateNextFootnoteId(footnotesDoc) {
    const fnEls = footnotesDoc.getElementsByTagNameNS(OOXML.W_NS, W.footnote);
    let maxId = 0;
    for (let i = 0; i < fnEls.length; i++) {
        const el = fnEls.item(i);
        const idStr = getWAttr(el, 'id');
        if (idStr) {
            const id = parseInt(idStr, 10);
            if (id > maxId)
                maxId = id;
        }
    }
    return maxId + 1;
}
// ── Display number computation ──────────────────────────────────────────
function buildDisplayNumberMap(documentXml, footnotesDoc) {
    // Build set of reserved IDs (by type)
    const reservedIds = new Set();
    const fnEls = footnotesDoc.getElementsByTagNameNS(OOXML.W_NS, W.footnote);
    for (let i = 0; i < fnEls.length; i++) {
        const el = fnEls.item(i);
        if (isReservedFootnote(el)) {
            const idStr = getWAttr(el, 'id');
            if (idStr)
                reservedIds.add(parseInt(idStr, 10));
        }
    }
    // Scan document.xml for w:footnoteReference in DOM order
    const refs = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.footnoteReference);
    const map = new Map();
    let displayNum = 1;
    for (let i = 0; i < refs.length; i++) {
        const ref = refs.item(i);
        const idStr = getWAttr(ref, 'id');
        if (!idStr)
            continue;
        const id = parseInt(idStr, 10);
        if (reservedIds.has(id))
            continue;
        if (!map.has(id)) {
            map.set(id, displayNum++);
        }
    }
    return map;
}
// ── Reading ─────────────────────────────────────────────────────────────
export async function getFootnotes(zip, documentXml) {
    const footnotesText = await zip.readTextOrNull('word/footnotes.xml');
    if (!footnotesText)
        return [];
    const footnotesDoc = parseXml(footnotesText);
    const fnEls = footnotesDoc.getElementsByTagNameNS(OOXML.W_NS, W.footnote);
    if (fnEls.length === 0)
        return [];
    const displayMap = buildDisplayNumberMap(documentXml, footnotesDoc);
    // Build map of footnoteReference id → anchored paragraph bookmark id
    const anchorMap = new Map();
    const refs = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.footnoteReference);
    for (let i = 0; i < refs.length; i++) {
        const ref = refs.item(i);
        const idStr = getWAttr(ref, 'id');
        if (!idStr)
            continue;
        const id = parseInt(idStr, 10);
        if (anchorMap.has(id))
            continue;
        // Walk up to enclosing <w:p>
        let parent = ref.parentNode;
        while (parent && parent.nodeType === 1) {
            const pel = parent;
            if (pel.localName === W.p && pel.namespaceURI === OOXML.W_NS) {
                anchorMap.set(id, getParagraphBookmarkId(pel));
                break;
            }
            parent = parent.parentNode;
        }
    }
    const footnotes = [];
    for (let i = 0; i < fnEls.length; i++) {
        const el = fnEls.item(i);
        if (isReservedFootnote(el))
            continue;
        const idStr = getWAttr(el, 'id');
        if (!idStr)
            continue;
        const id = parseInt(idStr, 10);
        const text = extractFootnoteText(el);
        const displayNumber = displayMap.get(id) ?? 0;
        const anchoredParagraphId = anchorMap.get(id) ?? null;
        footnotes.push({ id, displayNumber, text, anchoredParagraphId });
    }
    // Sort by display number (document order)
    footnotes.sort((a, b) => a.displayNumber - b.displayNumber);
    return footnotes;
}
export async function getFootnote(zip, documentXml, noteId) {
    const all = await getFootnotes(zip, documentXml);
    return all.find((f) => f.id === noteId) ?? null;
}
function extractFootnoteText(footnoteEl) {
    const paragraphs = footnoteEl.getElementsByTagNameNS(OOXML.W_NS, W.p);
    const paraTexts = [];
    for (let pi = 0; pi < paragraphs.length; pi++) {
        const p = paragraphs.item(pi);
        const runs = p.getElementsByTagNameNS(OOXML.W_NS, W.r);
        const parts = [];
        for (let ri = 0; ri < runs.length; ri++) {
            const run = runs.item(ri);
            // Skip runs that contain footnoteRef (metadata, not user text)
            const fnRefs = run.getElementsByTagNameNS(OOXML.W_NS, W.footnoteRef);
            if (fnRefs.length > 0)
                continue;
            const ts = run.getElementsByTagNameNS(OOXML.W_NS, W.t);
            for (let ti = 0; ti < ts.length; ti++) {
                const t = ts.item(ti);
                parts.push(t.textContent ?? '');
            }
        }
        paraTexts.push(parts.join(''));
    }
    return paraTexts.join('\n');
}
// ── Insertion ───────────────────────────────────────────────────────────
export async function addFootnote(documentXml, zip, params) {
    const { paragraphEl, afterText, text } = params;
    // Load or bootstrap footnotes.xml
    const footnotesXml = await zip.readText('word/footnotes.xml');
    const footnotesDoc = parseXml(footnotesXml);
    // Allocate next ID
    const noteId = allocateNextFootnoteId(footnotesDoc);
    // Insert footnoteReference run in document body
    insertFootnoteReference(documentXml, paragraphEl, noteId, afterText);
    // Add footnote body to footnotes.xml
    addFootnoteElement(footnotesDoc, noteId, text);
    zip.writeText('word/footnotes.xml', serializeXml(footnotesDoc));
    return { noteId };
}
function insertFootnoteReference(documentXml, paragraphEl, noteId, afterText) {
    // Create the reference run
    const refRun = documentXml.createElementNS(OOXML.W_NS, 'w:r');
    const rPr = documentXml.createElementNS(OOXML.W_NS, 'w:rPr');
    const rStyle = documentXml.createElementNS(OOXML.W_NS, 'w:rStyle');
    rStyle.setAttributeNS(OOXML.W_NS, 'w:val', 'FootnoteReference');
    rPr.appendChild(rStyle);
    refRun.appendChild(rPr);
    const fnRef = documentXml.createElementNS(OOXML.W_NS, 'w:footnoteReference');
    fnRef.setAttributeNS(OOXML.W_NS, 'w:id', String(noteId));
    refRun.appendChild(fnRef);
    if (!afterText) {
        // Default: append at end of paragraph
        paragraphEl.appendChild(refRun);
        return;
    }
    // Find the text boundary using unique substring matching
    const runs = getParagraphRuns(paragraphEl);
    const fullText = runs.map((r) => r.text).join('');
    const match = findUniqueSubstringMatch(fullText, afterText);
    if (match.status === 'not_found') {
        throw new Error(`after_text '${afterText}' not found in paragraph`);
    }
    if (match.status === 'multiple') {
        throw new Error(`after_text '${afterText}' found ${match.matchCount} times in paragraph`);
    }
    // We need to insert after the end of the matched text
    const insertOffset = match.end;
    // Map offset to run position
    let pos = 0;
    for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        const runEnd = pos + run.text.length;
        if (insertOffset <= pos) {
            // Insert before this run
            const parent = run.r.parentNode;
            parent.insertBefore(refRun, run.r);
            return;
        }
        if (insertOffset > pos && insertOffset < runEnd) {
            // Need to split this run at the offset
            const splitOffset = insertOffset - pos;
            splitRunAndInsertReference(run.r, splitOffset, refRun);
            return;
        }
        if (insertOffset === runEnd) {
            // Insert after this run
            const parent = run.r.parentNode;
            parent.insertBefore(refRun, run.r.nextSibling);
            return;
        }
        pos = runEnd;
    }
    // Fallback: append at end
    paragraphEl.appendChild(refRun);
}
function splitRunAndInsertReference(run, visibleOffset, refRun) {
    const doc = run.ownerDocument;
    if (!doc)
        throw new Error('Run has no ownerDocument');
    const parent = run.parentNode;
    if (!parent)
        throw new Error('Run has no parent');
    // Clone the run for the right portion
    const rightRun = run.cloneNode(true);
    parent.insertBefore(rightRun, run.nextSibling);
    // Split text content in the runs
    const leftContent = getDirectContentElements(run);
    const rightContent = getDirectContentElements(rightRun);
    let pos = 0;
    for (let i = 0; i < leftContent.length; i++) {
        const lEl = leftContent[i];
        const rEl = rightContent[i];
        if (lEl.namespaceURI !== OOXML.W_NS)
            continue;
        if (lEl.localName === W.t) {
            const full = lEl.textContent ?? '';
            const len = full.length;
            const start = pos;
            const end = pos + len;
            if (visibleOffset <= start) {
                // Entire element belongs to right
                lEl.parentNode?.removeChild(lEl);
                pos += len;
                continue;
            }
            if (visibleOffset >= end) {
                // Entire element belongs to left
                rEl.parentNode?.removeChild(rEl);
                pos += len;
                continue;
            }
            // Split inside this element
            const leftText = full.slice(0, visibleOffset - start);
            const rightText = full.slice(visibleOffset - start);
            lEl.textContent = leftText;
            rEl.textContent = rightText;
            setXmlSpacePreserve(lEl, leftText);
            setXmlSpacePreserve(rEl, rightText);
            if (!leftText)
                lEl.parentNode?.removeChild(lEl);
            if (!rightText)
                rEl.parentNode?.removeChild(rEl);
            pos += len;
        }
        else if (lEl.localName === W.tab || lEl.localName === W.br) {
            if (visibleOffset <= pos) {
                lEl.parentNode?.removeChild(lEl);
            }
            else {
                rEl.parentNode?.removeChild(rEl);
            }
            pos += 1;
        }
        else {
            // Non-visible elements (rPr is already handled by cloneNode)
            if (lEl.localName !== W.rPr) {
                if (pos < visibleOffset)
                    rEl.parentNode?.removeChild(rEl);
                else
                    lEl.parentNode?.removeChild(lEl);
            }
        }
    }
    // Insert the reference run between left and right
    parent.insertBefore(refRun, rightRun);
    // Clean up empty runs
    if (!hasVisibleContent(run))
        run.parentNode?.removeChild(run);
    if (!hasVisibleContent(rightRun))
        rightRun.parentNode?.removeChild(rightRun);
}
function getDirectContentElements(run) {
    const out = [];
    for (const child of Array.from(run.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        out.push(child);
    }
    return out;
}
function hasVisibleContent(run) {
    for (const child of Array.from(run.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.namespaceURI !== OOXML.W_NS)
            continue;
        if (el.localName === W.rPr)
            continue;
        return true;
    }
    return false;
}
function setXmlSpacePreserve(t, text) {
    if (!text)
        return;
    if (text.startsWith(' ') || text.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
}
function addFootnoteElement(footnotesDoc, noteId, text) {
    const root = footnotesDoc.documentElement;
    const footnoteEl = footnotesDoc.createElementNS(OOXML.W_NS, 'w:footnote');
    footnoteEl.setAttributeNS(OOXML.W_NS, 'w:id', String(noteId));
    // Word-compatible body skeleton
    const p = footnotesDoc.createElementNS(OOXML.W_NS, 'w:p');
    // Paragraph properties with FootnoteText style
    const pPr = footnotesDoc.createElementNS(OOXML.W_NS, 'w:pPr');
    const pStyle = footnotesDoc.createElementNS(OOXML.W_NS, 'w:pStyle');
    pStyle.setAttributeNS(OOXML.W_NS, 'w:val', 'FootnoteText');
    pPr.appendChild(pStyle);
    p.appendChild(pPr);
    // footnoteRef run (required by Word to display the footnote number)
    const refRun = footnotesDoc.createElementNS(OOXML.W_NS, 'w:r');
    const refRPr = footnotesDoc.createElementNS(OOXML.W_NS, 'w:rPr');
    const refRStyle = footnotesDoc.createElementNS(OOXML.W_NS, 'w:rStyle');
    refRStyle.setAttributeNS(OOXML.W_NS, 'w:val', 'FootnoteReference');
    refRPr.appendChild(refRStyle);
    refRun.appendChild(refRPr);
    const fnRefEl = footnotesDoc.createElementNS(OOXML.W_NS, 'w:footnoteRef');
    refRun.appendChild(fnRefEl);
    p.appendChild(refRun);
    // Space separator run
    const spaceRun = footnotesDoc.createElementNS(OOXML.W_NS, 'w:r');
    const spaceT = footnotesDoc.createElementNS(OOXML.W_NS, 'w:t');
    spaceT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    spaceT.appendChild(footnotesDoc.createTextNode(' '));
    spaceRun.appendChild(spaceT);
    p.appendChild(spaceRun);
    // User text run
    const textRun = footnotesDoc.createElementNS(OOXML.W_NS, 'w:r');
    const t = footnotesDoc.createElementNS(OOXML.W_NS, 'w:t');
    if (text.startsWith(' ') || text.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    t.appendChild(footnotesDoc.createTextNode(text));
    textRun.appendChild(t);
    p.appendChild(textRun);
    footnoteEl.appendChild(p);
    root.appendChild(footnoteEl);
}
// ── Update ──────────────────────────────────────────────────────────────
export async function updateFootnoteText(zip, params) {
    const { noteId, newText } = params;
    const footnotesXml = await zip.readText('word/footnotes.xml');
    const footnotesDoc = parseXml(footnotesXml);
    const fnEl = findFootnoteById(footnotesDoc, noteId);
    if (!fnEl)
        throw new Error(`Footnote ID ${noteId} not found`);
    if (isReservedFootnote(fnEl))
        throw new Error(`Cannot update reserved footnote ID ${noteId}`);
    // Find first paragraph
    const paragraphs = fnEl.getElementsByTagNameNS(OOXML.W_NS, W.p);
    if (paragraphs.length === 0)
        throw new Error(`Footnote ID ${noteId} has no paragraphs`);
    const firstP = paragraphs.item(0);
    // Replace text runs in first paragraph (preserve footnoteRef run)
    const runs = firstP.getElementsByTagNameNS(OOXML.W_NS, W.r);
    const runsToRemove = [];
    for (let i = 0; i < runs.length; i++) {
        const run = runs.item(i);
        // Keep runs that contain footnoteRef
        const fnRefs = run.getElementsByTagNameNS(OOXML.W_NS, W.footnoteRef);
        if (fnRefs.length > 0)
            continue;
        runsToRemove.push(run);
    }
    for (const run of runsToRemove) {
        run.parentNode?.removeChild(run);
    }
    // Add space separator run after footnoteRef
    const spaceRun = footnotesDoc.createElementNS(OOXML.W_NS, 'w:r');
    const spaceT = footnotesDoc.createElementNS(OOXML.W_NS, 'w:t');
    spaceT.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    spaceT.appendChild(footnotesDoc.createTextNode(' '));
    spaceRun.appendChild(spaceT);
    firstP.appendChild(spaceRun);
    // Add new text run
    const textRun = footnotesDoc.createElementNS(OOXML.W_NS, 'w:r');
    const t = footnotesDoc.createElementNS(OOXML.W_NS, 'w:t');
    if (newText.startsWith(' ') || newText.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    t.appendChild(footnotesDoc.createTextNode(newText));
    textRun.appendChild(t);
    firstP.appendChild(textRun);
    zip.writeText('word/footnotes.xml', serializeXml(footnotesDoc));
}
// ── Deletion ────────────────────────────────────────────────────────────
export async function deleteFootnote(documentXml, zip, params) {
    const { noteId } = params;
    const footnotesXml = await zip.readText('word/footnotes.xml');
    const footnotesDoc = parseXml(footnotesXml);
    const fnEl = findFootnoteById(footnotesDoc, noteId);
    if (!fnEl)
        throw new Error(`Footnote ID ${noteId} not found`);
    if (isReservedFootnote(fnEl))
        throw new Error(`Cannot delete reserved footnote ID ${noteId}`);
    // Remove from footnotes.xml
    fnEl.parentNode?.removeChild(fnEl);
    zip.writeText('word/footnotes.xml', serializeXml(footnotesDoc));
    // Remove footnoteReference elements from document.xml
    const refs = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.footnoteReference);
    const refsToRemove = [];
    for (let i = 0; i < refs.length; i++) {
        const ref = refs.item(i);
        const idStr = getWAttr(ref, 'id');
        if (idStr && parseInt(idStr, 10) === noteId) {
            refsToRemove.push(ref);
        }
    }
    for (const ref of refsToRemove) {
        const run = ref.parentNode;
        if (!run)
            continue;
        // Remove only the footnoteReference element, not the entire run
        run.removeChild(ref);
        // If the run is now empty (no visible content), remove it
        if (!hasVisibleContent(run)) {
            run.parentNode?.removeChild(run);
        }
    }
}
// ── Helpers ─────────────────────────────────────────────────────────────
function findFootnoteById(footnotesDoc, noteId) {
    const fnEls = footnotesDoc.getElementsByTagNameNS(OOXML.W_NS, W.footnote);
    for (let i = 0; i < fnEls.length; i++) {
        const el = fnEls.item(i);
        const idStr = getWAttr(el, 'id');
        if (idStr && parseInt(idStr, 10) === noteId)
            return el;
    }
    return null;
}
//# sourceMappingURL=footnotes.js.map