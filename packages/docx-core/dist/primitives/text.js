import { OOXML, W } from './namespaces.js';
import { SafeDocxError } from './errors.js';
export function getParagraphRuns(p) {
    let FieldState;
    (function (FieldState) {
        FieldState[FieldState["OUTSIDE_FIELD"] = 0] = "OUTSIDE_FIELD";
        FieldState[FieldState["IN_FIELD_CODE"] = 1] = "IN_FIELD_CODE";
        FieldState[FieldState["IN_FIELD_RESULT"] = 2] = "IN_FIELD_RESULT";
    })(FieldState || (FieldState = {}));
    function getWAttr(el, localName) {
        return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? el.getAttribute(localName);
    }
    const runs = [];
    const rElems = Array.from(p.getElementsByTagNameNS(OOXML.W_NS, W.r));
    let state = FieldState.OUTSIDE_FIELD;
    for (const r of rElems) {
        let runText = '';
        let sawResult = state === FieldState.IN_FIELD_RESULT;
        // Walk children in order so we can handle rare cases where fldChar and result text
        // appear in the same run.
        for (const child of Array.from(r.childNodes)) {
            if (child.nodeType !== 1)
                continue;
            const el = child;
            if (el.namespaceURI !== OOXML.W_NS)
                continue;
            if (el.localName === W.fldChar) {
                const typ = getWAttr(el, 'fldCharType') ?? '';
                if (typ === 'begin')
                    state = FieldState.IN_FIELD_CODE;
                else if (typ === 'separate')
                    state = FieldState.IN_FIELD_RESULT;
                else if (typ === 'end')
                    state = FieldState.OUTSIDE_FIELD;
                continue;
            }
            if (state === FieldState.IN_FIELD_CODE) {
                // Skip field code/instruction text.
                continue;
            }
            if (state === FieldState.IN_FIELD_RESULT)
                sawResult = true;
            if (el.localName === W.t) {
                runText += el.textContent ?? '';
            }
            else if (el.localName === W.tab) {
                runText += '\t';
            }
            else if (el.localName === W.br) {
                runText += '\n';
            }
        }
        if (runText)
            runs.push({ r, text: runText, isFieldResult: sawResult });
    }
    return runs;
}
export function getParagraphText(p) {
    return getParagraphRuns(p)
        .map((tr) => tr.text)
        .join('');
}
function findOffsetInRuns(runs, start, end) {
    // Map [start, end) in concatenated string to run index + offset.
    let pos = 0;
    let startRunIdx = -1;
    let endRunIdx = -1;
    let startOffset = 0;
    let endOffset = 0;
    for (let i = 0; i < runs.length; i++) {
        const len = runs[i].text.length;
        if (startRunIdx === -1 && start >= pos && start <= pos + len) {
            startRunIdx = i;
            startOffset = start - pos;
        }
        if (endRunIdx === -1 && end >= pos && end <= pos + len) {
            endRunIdx = i;
            endOffset = end - pos;
            break;
        }
        pos += len;
    }
    if (startRunIdx === -1 || endRunIdx === -1) {
        throw new Error('Offset mapping failed');
    }
    return { startRunIdx, startOffset, endRunIdx, endOffset };
}
function isW(el, localName) {
    return !!el && el.namespaceURI === OOXML.W_NS && el.localName === localName;
}
function setXmlSpacePreserveIfNeeded(t, text) {
    // OOXML needs xml:space="preserve" when leading/trailing spaces exist.
    if (!text)
        return;
    if (text.startsWith(' ') || text.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
}
function cloneRunFormattingOnly(doc, sourceRun) {
    const r = doc.createElementNS(OOXML.W_NS, 'w:r');
    // Copy rPr if present (direct child).
    for (const child of Array.from(sourceRun.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, W.rPr)) {
            r.appendChild(el.cloneNode(true));
            break;
        }
    }
    return r;
}
function appendTextToRun(doc, run, text) {
    // Convert \t and \n to OOXML equivalents where possible.
    let buf = '';
    const flush = () => {
        if (!buf)
            return;
        const t = doc.createElementNS(OOXML.W_NS, 'w:t');
        setXmlSpacePreserveIfNeeded(t, buf);
        t.appendChild(doc.createTextNode(buf));
        run.appendChild(t);
        buf = '';
    };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\t') {
            flush();
            run.appendChild(doc.createElementNS(OOXML.W_NS, 'w:tab'));
            continue;
        }
        if (ch === '\n') {
            flush();
            run.appendChild(doc.createElementNS(OOXML.W_NS, 'w:br'));
            continue;
        }
        buf += ch;
    }
    flush();
}
function visibleLengthForEl(el) {
    if (el.namespaceURI !== OOXML.W_NS)
        return 0;
    if (el.localName === W.t)
        return (el.textContent ?? '').length;
    if (el.localName === W.tab)
        return 1;
    if (el.localName === W.br)
        return 1;
    return 0;
}
function getDirectContentElements(run) {
    // Direct children excluding rPr; preserves unknown nodes without duplicating them on splits.
    const out = [];
    for (const child of Array.from(run.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.namespaceURI !== OOXML.W_NS)
            continue;
        if (el.localName === W.rPr)
            continue;
        out.push(el);
    }
    return out;
}
function splitRunAtVisibleOffset(run, offset) {
    const doc = run.ownerDocument;
    if (!doc)
        throw new Error('Run has no ownerDocument');
    const parent = run.parentNode;
    if (!parent)
        throw new Error('Run has no parent');
    const right = run.cloneNode(true);
    parent.insertBefore(right, run.nextSibling);
    const leftContent = getDirectContentElements(run);
    const rightContent = getDirectContentElements(right);
    let pos = 0;
    for (let i = 0; i < leftContent.length; i++) {
        const lEl = leftContent[i];
        const rEl = rightContent[i];
        const len = visibleLengthForEl(lEl);
        if (len === 0) {
            // Zero-length nodes (proofing, field markers, etc.) should not be duplicated. Keep them on the side
            // determined by the current visible position.
            if (pos < offset)
                rEl.parentNode?.removeChild(rEl);
            else
                lEl.parentNode?.removeChild(lEl);
            continue;
        }
        const start = pos;
        const end = pos + len;
        if (offset <= start) {
            // Entire element is to the right.
            lEl.parentNode?.removeChild(lEl);
            pos += len;
            continue;
        }
        if (offset >= end) {
            // Entire element is to the left.
            rEl.parentNode?.removeChild(rEl);
            pos += len;
            continue;
        }
        // Split inside this element.
        if (isW(lEl, W.t) && isW(rEl, W.t)) {
            const full = lEl.textContent ?? '';
            const leftText = full.slice(0, offset - start);
            const rightText = full.slice(offset - start);
            lEl.textContent = leftText;
            rEl.textContent = rightText;
            setXmlSpacePreserveIfNeeded(lEl, leftText);
            setXmlSpacePreserveIfNeeded(rEl, rightText);
            if (!leftText)
                lEl.parentNode?.removeChild(lEl);
            if (!rightText)
                rEl.parentNode?.removeChild(rEl);
        }
        else {
            // tab/br are length 1 and should not be split; move to the right by default.
            lEl.parentNode?.removeChild(lEl);
        }
        pos += len;
    }
    return { left: run, right };
}
function cleanupEmptyRuns(parent) {
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (!isW(el, W.r))
            continue;
        // Keep run if it has any non-rPr element children.
        let hasContent = false;
        for (const c of Array.from(el.childNodes)) {
            if (c.nodeType !== 1)
                continue;
            const cEl = c;
            if (!isW(cEl, W.rPr)) {
                hasContent = true;
                break;
            }
        }
        if (!hasContent)
            el.parentNode?.removeChild(el);
    }
}
function getDirectChild(parent, localName) {
    for (const child of Array.from(parent.childNodes)) {
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, localName))
            return el;
    }
    return null;
}
function ensureRPr(doc, run) {
    const existing = getDirectChild(run, W.rPr);
    if (existing)
        return existing;
    const rPr = doc.createElementNS(OOXML.W_NS, `w:${W.rPr}`);
    run.insertBefore(rPr, run.firstChild);
    return rPr;
}
function ensureBoolProp(doc, rPr, localName) {
    let el = rPr.getElementsByTagNameNS(OOXML.W_NS, localName).item(0);
    if (!el) {
        el = doc.createElementNS(OOXML.W_NS, `w:${localName}`);
        rPr.appendChild(el);
    }
    // Ensure truthy by removing any explicit false.
    el.removeAttributeNS(OOXML.W_NS, 'val');
    el.removeAttribute('w:val');
    el.removeAttribute('val');
}
function ensureUnderline(doc, rPr, val) {
    let el = rPr.getElementsByTagNameNS(OOXML.W_NS, W.u).item(0);
    if (!el) {
        el = doc.createElementNS(OOXML.W_NS, `w:${W.u}`);
        rPr.appendChild(el);
    }
    const v = val ?? 'single';
    el.setAttribute('w:val', v);
}
function clearHighlightProp(rPr) {
    const hs = Array.from(rPr.getElementsByTagNameNS(OOXML.W_NS, W.highlight));
    for (const h of hs)
        h.parentNode?.removeChild(h);
}
function ensureHighlight(doc, rPr, val) {
    let el = rPr.getElementsByTagNameNS(OOXML.W_NS, W.highlight).item(0);
    if (!el) {
        el = doc.createElementNS(OOXML.W_NS, `w:${W.highlight}`);
        rPr.appendChild(el);
    }
    el.setAttribute('w:val', val ?? 'yellow');
}
function applyRunProps(doc, run, add, clearHighlight) {
    if (!add && !clearHighlight)
        return;
    const rPr = ensureRPr(doc, run);
    if (clearHighlight)
        clearHighlightProp(rPr);
    if (!add)
        return;
    if (add.bold)
        ensureBoolProp(doc, rPr, W.b);
    if (add.italic)
        ensureBoolProp(doc, rPr, W.i);
    if (add.underline)
        ensureUnderline(doc, rPr, typeof add.underline === 'string' ? add.underline : null);
    if (add.highlight)
        ensureHighlight(doc, rPr, typeof add.highlight === 'string' ? add.highlight : null);
}
export function replaceParagraphTextRange(p, start, end, replacement) {
    // Replace visible text in [start, end) in paragraph by operating on w:t nodes.
    // Strategy:
    // 1. Build concatenated visible text from visible runs (field-code aware).
    // 2. Map offsets to run index + offset.
    // 3. Split boundary runs so the replace range aligns to run boundaries.
    // 4. Remove the runs in range and insert new run(s) that clone formatting from the
    //    predominant run in the replaced span.
    const doc = p.ownerDocument;
    if (!doc)
        throw new Error('Paragraph has no ownerDocument');
    const runs = getParagraphRuns(p);
    const fullText = runs.map((r) => r.text).join('');
    if (start < 0 || end < start || end > fullText.length) {
        throw new Error(`Invalid range [${start}, ${end}) for paragraph length ${fullText.length}`);
    }
    const { startRunIdx, startOffset, endRunIdx, endOffset } = findOffsetInRuns(runs, start, end);
    const startRun = runs[startRunIdx];
    const endRun = runs[endRunIdx];
    // For now we only support field edits that stay within a single visible run.
    if (startRunIdx !== endRunIdx) {
        for (let i = startRunIdx; i <= endRunIdx; i++) {
            if (runs[i]?.isFieldResult) {
                throw new SafeDocxError('UNSUPPORTED_EDIT', 'Edit spans multiple runs and intersects a field result. This is currently unsupported in Safe-Docx TS.', 'Narrow old_string so the edit does not cross a field, or edit the field result text in a smaller span.');
            }
        }
    }
    // Pick a template run from the span: the run with the largest overlap by visible character count.
    let templateRun = startRun.r;
    let best = -1;
    for (let i = startRunIdx; i <= endRunIdx; i++) {
        const r = runs[i];
        const runStart = i === startRunIdx ? startOffset : 0;
        const runEnd = i === endRunIdx ? endOffset : r.text.length;
        const overlap = Math.max(0, runEnd - runStart);
        if (overlap > best) {
            best = overlap;
            templateRun = r.r;
        }
    }
    const parts = typeof replacement === 'string' ? [{ text: replacement }] : replacement;
    // Split boundary runs so we can remove whole runs cleanly.
    let rangeStartRunEl = startRun.r;
    let rangeEndRunEl = endRun.r;
    if (startRunIdx === endRunIdx) {
        // Single-run replacement: split end first, then start.
        const runLen = startRun.text.length;
        if (endOffset < runLen) {
            const { left } = splitRunAtVisibleOffset(rangeStartRunEl, endOffset);
            rangeStartRunEl = left;
            rangeEndRunEl = left;
        }
        if (startOffset > 0) {
            const { right } = splitRunAtVisibleOffset(rangeStartRunEl, startOffset);
            rangeStartRunEl = right;
            rangeEndRunEl = right;
        }
    }
    else {
        // Multi-run replacement: split start then end.
        if (startOffset > 0) {
            const { right } = splitRunAtVisibleOffset(rangeStartRunEl, startOffset);
            rangeStartRunEl = right;
        }
        const endLen = endRun.text.length;
        if (endOffset < endLen) {
            const { left } = splitRunAtVisibleOffset(rangeEndRunEl, endOffset);
            rangeEndRunEl = left;
        }
    }
    const parent = rangeStartRunEl.parentNode;
    if (!parent)
        throw new Error('Run has no parent');
    if (rangeEndRunEl.parentNode !== parent) {
        throw new SafeDocxError('UNSAFE_CONTAINER_BOUNDARY', 'Edit crosses container boundaries (e.g. hyperlinks/SDTs).', 'Narrow old_string so the match is contained within a single container, or avoid editing inside hyperlinks.');
    }
    const insertBeforeNode = rangeEndRunEl.nextSibling;
    // Remove runs in [rangeStartRunEl, rangeEndRunEl] inclusive (only w:r elements).
    let cur = rangeStartRunEl;
    while (cur) {
        const nextNode = cur.nextSibling;
        if (cur.nodeType === 1 && isW(cur, W.r)) {
            cur.parentNode?.removeChild(cur);
        }
        if (cur === rangeEndRunEl)
            break;
        cur = nextNode;
    }
    // Insert replacement runs.
    for (const part of parts) {
        const tmpl = part.templateRun ?? templateRun;
        const newRun = cloneRunFormattingOnly(doc, tmpl);
        applyRunProps(doc, newRun, part.addRunProps, part.clearHighlight);
        appendTextToRun(doc, newRun, part.text);
        parent.insertBefore(newRun, insertBeforeNode);
    }
    cleanupEmptyRuns(parent);
}
//# sourceMappingURL=text.js.map