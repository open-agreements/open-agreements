import { createHash } from 'node:crypto';
import { OOXML, W } from './namespaces.js';
import { getParagraphText } from './text.js';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
function sha12(input) {
    return createHash('sha1').update(input).digest('hex').slice(0, 12);
}
function normalizeText(value) {
    return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function ancestorSignature(p) {
    const parts = [];
    let cur = p.parentElement;
    while (cur) {
        parts.push(cur.localName ?? cur.nodeName);
        // Body/document boundary is enough context.
        if (cur.namespaceURI === OOXML.W_NS && (cur.localName === W.body || cur.localName === W.document))
            break;
        cur = cur.parentElement;
    }
    return parts.join('/');
}
function getW14ParaId(p) {
    const namespaced = p.getAttributeNS(W14_NS, 'paraId');
    if (namespaced)
        return namespaced.toLowerCase();
    // Fallbacks for XML libraries that may not expose namespaced attributes consistently.
    const prefixed = p.getAttribute('w14:paraId');
    if (prefixed)
        return prefixed.toLowerCase();
    const plain = p.getAttribute('paraId');
    if (plain)
        return plain.toLowerCase();
    return null;
}
function buildParagraphSeed(params) {
    const { paragraph, prevText, nextText } = params;
    const intrinsic = getW14ParaId(paragraph);
    if (intrinsic)
        return `intrinsic:w14:${intrinsic}`;
    const text = normalizeText(getParagraphText(paragraph));
    const prev = normalizeText(prevText);
    const next = normalizeText(nextText);
    const ancestors = ancestorSignature(paragraph);
    return `fallback:text=${text}|prev=${prev}|next=${next}|ancestors=${ancestors}`;
}
function deriveDeterministicJrParaName(params) {
    const seed = buildParagraphSeed({
        paragraph: params.paragraph,
        prevText: params.prevText,
        nextText: params.nextText,
    });
    let attempt = 0;
    while (attempt < 10_000) {
        const salt = attempt === 0 ? '' : `|salt:${attempt}`;
        const candidate = `_bk_${sha12(`${seed}${salt}`)}`;
        if (!params.usedNames.has(candidate)) {
            params.usedNames.add(candidate);
            return candidate;
        }
        attempt += 1;
    }
    throw new Error('Unable to allocate deterministic _bk_ bookmark name');
}
function collectUsedJrParaNames(doc) {
    const used = new Set();
    const starts = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkStart));
    for (const s of starts) {
        const name = getAttr(s, 'name');
        if (name && name.startsWith('_bk_'))
            used.add(name);
    }
    return used;
}
function getAttr(el, localName) {
    return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`);
}
function prevElementSibling(node) {
    let cur = node?.previousSibling ?? null;
    while (cur) {
        if (cur.nodeType === 1)
            return cur;
        cur = cur.previousSibling;
    }
    return null;
}
function nextElementSibling(node) {
    let cur = node?.nextSibling ?? null;
    while (cur) {
        if (cur.nodeType === 1)
            return cur;
        cur = cur.nextSibling;
    }
    return null;
}
function isBookmarkStart(el) {
    return el.namespaceURI === OOXML.W_NS && el.localName === W.bookmarkStart;
}
function isBookmarkEnd(el) {
    return el.namespaceURI === OOXML.W_NS && el.localName === W.bookmarkEnd;
}
function isParagraph(el) {
    return el.namespaceURI === OOXML.W_NS && el.localName === W.p;
}
export function getParagraphBookmarkId(p) {
    // Supports:
    // 1) sibling style: <w:bookmarkStart/> <w:p/> <w:bookmarkEnd/>
    // 2) inside style: <w:p><w:bookmarkStart/> ... </w:p>
    // 1) Sibling style lookup.
    // Handle stacked bookmarks (e.g. _bk_* plus edit-*) around the same paragraph.
    // We scan backward across adjacent bookmark nodes until we hit another paragraph.
    const prev = prevElementSibling(p);
    const next = nextElementSibling(p);
    if (prev && next && isBookmarkEnd(next)) {
        let cur = prev;
        while (cur) {
            if (isParagraph(cur))
                break;
            if (isBookmarkStart(cur)) {
                const name = getAttr(cur, 'name');
                if (name && name.startsWith('_bk_'))
                    return name;
            }
            cur = prevElementSibling(cur);
        }
    }
    // 2) Inside paragraph lookup (best-effort).
    const starts = p.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkStart);
    for (let i = 0; i < starts.length; i++) {
        const el = starts.item(i);
        const name = el ? getAttr(el, 'name') : null;
        if (name && name.startsWith('_bk_'))
            return name;
    }
    return null;
}
export function cleanupInternalBookmarks(doc) {
    // Remove paragraph bookmarks (_bk_*) and edit span bookmarks (edit-*).
    const starts = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkStart));
    const ends = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkEnd));
    const idsToRemove = new Set();
    for (const s of starts) {
        const name = getAttr(s, 'name') ?? '';
        if (name.startsWith('_bk_') || name.startsWith('edit-')) {
            const id = getAttr(s, 'id') ?? '';
            if (id)
                idsToRemove.add(id);
            s.parentNode?.removeChild(s);
        }
    }
    for (const e of ends) {
        const id = getAttr(e, 'id') ?? '';
        if (id && idsToRemove.has(id)) {
            e.parentNode?.removeChild(e);
        }
    }
    return idsToRemove.size;
}
export function insertParagraphBookmarks(doc, _attachmentId) {
    // Insert _bk_* bookmarks around ALL paragraphs (including empty), using sibling style.
    // This avoids moving paragraphs out of tables by inserting into the paragraph's parent.
    const paragraphs = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.p));
    if (paragraphs.length === 0)
        return { indexedParagraphs: 0 };
    const usedNames = collectUsedJrParaNames(doc);
    let maxNumeric = 0;
    const existingStarts = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkStart));
    for (const s of existingStarts) {
        const n = getAttr(s, 'id');
        const val = n ? Number.parseInt(n, 10) : NaN;
        if (!Number.isNaN(val))
            maxNumeric = Math.max(maxNumeric, val);
    }
    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (!isParagraph(p))
            continue;
        const existingName = getParagraphBookmarkId(p);
        if (existingName) {
            usedNames.add(existingName);
            continue;
        }
        const parent = p.parentNode;
        if (!parent)
            continue;
        const numericId = ++maxNumeric;
        const prevText = i > 0 ? getParagraphText(paragraphs[i - 1]) : '';
        const nextText = i + 1 < paragraphs.length ? getParagraphText(paragraphs[i + 1]) : '';
        const name = deriveDeterministicJrParaName({
            paragraph: p,
            prevText,
            nextText,
            usedNames,
        });
        const start = doc.createElementNS(OOXML.W_NS, 'w:bookmarkStart');
        start.setAttributeNS(OOXML.W_NS, 'w:id', String(numericId));
        start.setAttributeNS(OOXML.W_NS, 'w:name', name);
        const end = doc.createElementNS(OOXML.W_NS, 'w:bookmarkEnd');
        end.setAttributeNS(OOXML.W_NS, 'w:id', String(numericId));
        parent.insertBefore(start, p);
        parent.insertBefore(end, p.nextSibling);
    }
    return { indexedParagraphs: paragraphs.length };
}
export function insertSingleParagraphBookmark(doc, p) {
    const parent = p.parentNode;
    if (!parent)
        throw new Error('Paragraph has no parent');
    const paragraphs = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.p));
    const idx = paragraphs.indexOf(p);
    const prevText = idx > 0 ? getParagraphText(paragraphs[idx - 1]) : '';
    const nextText = idx >= 0 && idx + 1 < paragraphs.length ? getParagraphText(paragraphs[idx + 1]) : '';
    const usedNames = collectUsedJrParaNames(doc);
    let maxNumeric = 0;
    const existingStarts = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.bookmarkStart));
    for (const s of existingStarts) {
        const n = getAttr(s, 'id');
        const val = n ? Number.parseInt(n, 10) : NaN;
        if (!Number.isNaN(val))
            maxNumeric = Math.max(maxNumeric, val);
    }
    const numericId = maxNumeric + 1;
    const name = deriveDeterministicJrParaName({
        paragraph: p,
        prevText,
        nextText,
        usedNames,
    });
    const start = doc.createElementNS(OOXML.W_NS, 'w:bookmarkStart');
    start.setAttributeNS(OOXML.W_NS, 'w:id', String(numericId));
    start.setAttributeNS(OOXML.W_NS, 'w:name', name);
    const end = doc.createElementNS(OOXML.W_NS, 'w:bookmarkEnd');
    end.setAttributeNS(OOXML.W_NS, 'w:id', String(numericId));
    parent.insertBefore(start, p);
    parent.insertBefore(end, p.nextSibling);
    return name;
}
export function findParagraphByBookmarkId(doc, bookmarkId) {
    const paragraphs = Array.from(doc.getElementsByTagNameNS(OOXML.W_NS, W.p));
    for (const p of paragraphs) {
        if (!isParagraph(p))
            continue;
        if (getParagraphBookmarkId(p) === bookmarkId)
            return p;
    }
    return null;
}
//# sourceMappingURL=bookmarks.js.map