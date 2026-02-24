/**
 * comments — OOXML comment insertion, threaded replies, and part bootstrapping.
 *
 * Creates comment XML parts when missing, inserts comment range markers,
 * and supports threaded replies via commentsExtended.xml.
 */
import { OOXML, W } from './namespaces.js';
import { parseXml, serializeXml } from './xml.js';
import { getParagraphRuns } from './text.js';
import { getParagraphBookmarkId } from './bookmarks.js';
// ── Relationship types ──────────────────────────────────────────────────
const REL_TYPE_COMMENTS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const REL_TYPE_COMMENTS_EXTENDED = 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended';
const REL_TYPE_PEOPLE = 'http://schemas.microsoft.com/office/2011/relationships/people';
// ── Content types ───────────────────────────────────────────────────────
const CT_COMMENTS = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';
const CT_COMMENTS_EXTENDED = 'application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml';
const CT_PEOPLE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.people+xml';
// ── Minimal XML templates ───────────────────────────────────────────────
const COMMENTS_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"` +
    ` xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"` +
    ` xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"/>`;
const COMMENTS_EXTENDED_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"` +
    ` xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"/>`;
const PEOPLE_XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w15:people xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"/>`;
// ── Helpers ─────────────────────────────────────────────────────────────
function generateParaId() {
    // 8-hex-digit random ID used for w14:paraId / w15:paraId
    const val = Math.floor(Math.random() * 0xFFFFFFFF);
    return val.toString(16).toUpperCase().padStart(8, '0');
}
function isoNow() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/**
 * Create missing comment XML parts when a DOCX has no comment infrastructure.
 * Idempotent — skips parts that already exist.
 */
export async function bootstrapCommentParts(zip) {
    const created = [];
    // 1. Ensure comment parts exist
    if (!zip.hasFile('word/comments.xml')) {
        zip.writeText('word/comments.xml', COMMENTS_XML_TEMPLATE);
        created.push('word/comments.xml');
    }
    if (!zip.hasFile('word/commentsExtended.xml')) {
        zip.writeText('word/commentsExtended.xml', COMMENTS_EXTENDED_XML_TEMPLATE);
        created.push('word/commentsExtended.xml');
    }
    if (!zip.hasFile('word/people.xml')) {
        zip.writeText('word/people.xml', PEOPLE_XML_TEMPLATE);
        created.push('word/people.xml');
    }
    if (created.length === 0)
        return { partsCreated: [] };
    // 2. Update [Content_Types].xml
    await ensureContentTypes(zip, created);
    // 3. Update word/_rels/document.xml.rels
    await ensureRelationships(zip, created);
    return { partsCreated: created };
}
async function ensureContentTypes(zip, newParts) {
    const ctPath = '[Content_Types].xml';
    let ctXml;
    try {
        ctXml = await zip.readText(ctPath);
    }
    catch {
        // Minimal [Content_Types].xml if missing
        ctXml =
            `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
                `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;
    }
    const ctDoc = parseXml(ctXml);
    const typesEl = ctDoc.documentElement;
    const ctNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
    const partToCt = {
        'word/comments.xml': CT_COMMENTS,
        'word/commentsExtended.xml': CT_COMMENTS_EXTENDED,
        'word/people.xml': CT_PEOPLE,
    };
    // Check existing overrides
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
async function ensureRelationships(zip, newParts) {
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
        'word/comments.xml': REL_TYPE_COMMENTS,
        'word/commentsExtended.xml': REL_TYPE_COMMENTS_EXTENDED,
        'word/people.xml': REL_TYPE_PEOPLE,
    };
    // Check existing relationships
    const existingRels = Array.from(relsEl.getElementsByTagNameNS(relNs, 'Relationship'));
    const existingTypes = new Set(existingRels.map((r) => r.getAttribute('Type')));
    // Allocate next rId
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
        // Target is relative to word/
        rel.setAttribute('Target', part.replace('word/', ''));
        relsEl.appendChild(rel);
    }
    zip.writeText(relsPath, serializeXml(relsDoc));
}
/**
 * Insert a root comment anchored to a text range within a paragraph.
 *
 * - Allocates next comment ID from existing comments.xml
 * - Inserts commentRangeStart/commentRangeEnd markers in document body
 * - Inserts commentReference run after range end
 * - Adds comment entry to comments.xml
 * - Adds author to people.xml if not present
 */
export async function addComment(documentXml, zip, params) {
    const { paragraphEl, start, end, author, text, initials } = params;
    // Load comments.xml
    const commentsXml = await zip.readText('word/comments.xml');
    const commentsDoc = parseXml(commentsXml);
    // Allocate next comment ID
    const commentId = allocateNextCommentId(commentsDoc);
    // Insert range markers and reference in document body
    insertCommentMarkers(documentXml, paragraphEl, commentId, start, end);
    // Add comment element to comments.xml
    const paraId = generateParaId();
    addCommentElement(commentsDoc, {
        id: commentId,
        author,
        initials: initials ?? author.charAt(0).toUpperCase(),
        text,
        paraId,
    });
    zip.writeText('word/comments.xml', serializeXml(commentsDoc));
    // Add author to people.xml
    await ensureAuthorInPeople(zip, author);
    return { commentId };
}
/**
 * Add a threaded reply to an existing comment.
 *
 * Replies don't have range markers in the document body.
 * Thread linkage is stored in commentsExtended.xml via paraIdParent.
 */
export async function addCommentReply(_documentXml, zip, params) {
    const { parentCommentId, author, text, initials } = params;
    // Load comments.xml
    const commentsXml = await zip.readText('word/comments.xml');
    const commentsDoc = parseXml(commentsXml);
    // Find parent comment's paraId
    const parentParaId = findCommentParaId(commentsDoc, parentCommentId);
    if (!parentParaId) {
        throw new Error(`Parent comment ID ${parentCommentId} not found in comments.xml`);
    }
    // Allocate ID and add reply comment
    const commentId = allocateNextCommentId(commentsDoc);
    const replyParaId = generateParaId();
    addCommentElement(commentsDoc, {
        id: commentId,
        author,
        initials: initials ?? author.charAt(0).toUpperCase(),
        text,
        paraId: replyParaId,
    });
    zip.writeText('word/comments.xml', serializeXml(commentsDoc));
    // Link reply in commentsExtended.xml
    await linkReplyInCommentsExtended(zip, replyParaId, parentParaId);
    // Ensure parent also has an entry in commentsExtended.xml
    await ensureCommentExEntry(zip, parentParaId);
    // Add author to people.xml
    await ensureAuthorInPeople(zip, author);
    return { commentId, parentCommentId };
}
// ── Internal helpers ────────────────────────────────────────────────────
function allocateNextCommentId(commentsDoc) {
    const commentEls = commentsDoc.getElementsByTagNameNS(OOXML.W_NS, W.comment);
    let maxId = -1;
    for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (idStr) {
            const id = parseInt(idStr, 10);
            if (id > maxId)
                maxId = id;
        }
    }
    return maxId + 1;
}
function findCommentParaId(commentsDoc, commentId) {
    const commentEls = commentsDoc.getElementsByTagNameNS(OOXML.W_NS, W.comment);
    for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (idStr && parseInt(idStr, 10) === commentId) {
            // paraId is on the w:p child inside the comment
            const paras = el.getElementsByTagNameNS(OOXML.W_NS, W.p);
            if (paras.length > 0) {
                const p = paras.item(0);
                return p.getAttributeNS(OOXML.W14_NS, 'paraId') ?? p.getAttribute('w14:paraId') ?? null;
            }
        }
    }
    return null;
}
function addCommentElement(commentsDoc, params) {
    const root = commentsDoc.documentElement;
    const commentEl = commentsDoc.createElementNS(OOXML.W_NS, 'w:comment');
    commentEl.setAttribute('w:id', String(params.id));
    commentEl.setAttribute('w:author', params.author);
    commentEl.setAttribute('w:date', isoNow());
    commentEl.setAttribute('w:initials', params.initials);
    // Comment body: <w:p w14:paraId="..."><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:annotationRef/></w:r><w:r><w:t>text</w:t></w:r></w:p>
    const p = commentsDoc.createElementNS(OOXML.W_NS, 'w:p');
    p.setAttribute('w14:paraId', params.paraId);
    // Annotation reference run
    const refRun = commentsDoc.createElementNS(OOXML.W_NS, 'w:r');
    const annotRef = commentsDoc.createElementNS(OOXML.W_NS, 'w:annotationRef');
    refRun.appendChild(annotRef);
    p.appendChild(refRun);
    // Text run
    const textRun = commentsDoc.createElementNS(OOXML.W_NS, 'w:r');
    const t = commentsDoc.createElementNS(OOXML.W_NS, 'w:t');
    if (params.text.startsWith(' ') || params.text.endsWith(' ')) {
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    }
    t.appendChild(commentsDoc.createTextNode(params.text));
    textRun.appendChild(t);
    p.appendChild(textRun);
    commentEl.appendChild(p);
    root.appendChild(commentEl);
}
function insertCommentMarkers(documentXml, paragraphEl, commentId, start, end) {
    // Find the runs in the paragraph and map string offsets to DOM positions
    const runs = getParagraphRuns(paragraphEl);
    // Create marker elements
    const rangeStart = documentXml.createElementNS(OOXML.W_NS, 'w:commentRangeStart');
    rangeStart.setAttribute('w:id', String(commentId));
    const rangeEnd = documentXml.createElementNS(OOXML.W_NS, 'w:commentRangeEnd');
    rangeEnd.setAttribute('w:id', String(commentId));
    const refRun = documentXml.createElementNS(OOXML.W_NS, 'w:r');
    const rPr = documentXml.createElementNS(OOXML.W_NS, 'w:rPr');
    const rStyle = documentXml.createElementNS(OOXML.W_NS, 'w:rStyle');
    rStyle.setAttribute('w:val', 'CommentReference');
    rPr.appendChild(rStyle);
    refRun.appendChild(rPr);
    const commentRef = documentXml.createElementNS(OOXML.W_NS, 'w:commentReference');
    commentRef.setAttribute('w:id', String(commentId));
    refRun.appendChild(commentRef);
    // Map string offsets to run positions
    let pos = 0;
    let startRunIdx = -1;
    let endRunIdx = -1;
    for (let i = 0; i < runs.length; i++) {
        const runEnd = pos + runs[i].text.length;
        if (startRunIdx < 0 && start < runEnd)
            startRunIdx = i;
        if (endRunIdx < 0 && end <= runEnd)
            endRunIdx = i;
        pos = runEnd;
    }
    // Fallback: if offsets don't map cleanly, wrap the whole paragraph
    if (startRunIdx < 0)
        startRunIdx = 0;
    if (endRunIdx < 0)
        endRunIdx = runs.length - 1;
    // Insert commentRangeStart before the start run
    if (runs.length > 0 && startRunIdx < runs.length) {
        paragraphEl.insertBefore(rangeStart, runs[startRunIdx].r);
    }
    else {
        // No runs — insert at end of paragraph
        paragraphEl.appendChild(rangeStart);
    }
    // Insert commentRangeEnd and reference run after the end run
    if (runs.length > 0 && endRunIdx < runs.length) {
        const afterEndRun = runs[endRunIdx].r.nextSibling;
        paragraphEl.insertBefore(rangeEnd, afterEndRun);
        paragraphEl.insertBefore(refRun, afterEndRun);
    }
    else {
        paragraphEl.appendChild(rangeEnd);
        paragraphEl.appendChild(refRun);
    }
}
async function linkReplyInCommentsExtended(zip, replyParaId, parentParaId) {
    const extXml = await zip.readText('word/commentsExtended.xml');
    const extDoc = parseXml(extXml);
    const root = extDoc.documentElement;
    const exEl = extDoc.createElementNS(OOXML.W15_NS, 'w15:commentEx');
    exEl.setAttribute('w15:paraId', replyParaId);
    exEl.setAttribute('w15:paraIdParent', parentParaId);
    exEl.setAttribute('w15:done', '0');
    root.appendChild(exEl);
    zip.writeText('word/commentsExtended.xml', serializeXml(extDoc));
}
async function ensureCommentExEntry(zip, paraId) {
    const extXml = await zip.readText('word/commentsExtended.xml');
    const extDoc = parseXml(extXml);
    const root = extDoc.documentElement;
    // Check if entry already exists
    const existing = root.getElementsByTagNameNS(OOXML.W15_NS, 'commentEx');
    for (let i = 0; i < existing.length; i++) {
        const el = existing.item(i);
        const pid = el.getAttributeNS(OOXML.W15_NS, 'paraId') ?? el.getAttribute('w15:paraId');
        if (pid === paraId)
            return; // Already present
    }
    const exEl = extDoc.createElementNS(OOXML.W15_NS, 'w15:commentEx');
    exEl.setAttribute('w15:paraId', paraId);
    exEl.setAttribute('w15:done', '0');
    root.appendChild(exEl);
    zip.writeText('word/commentsExtended.xml', serializeXml(extDoc));
}
async function ensureAuthorInPeople(zip, author) {
    const peopleXml = await zip.readText('word/people.xml');
    const peopleDoc = parseXml(peopleXml);
    const root = peopleDoc.documentElement;
    // Check if author already exists
    const persons = root.getElementsByTagNameNS(OOXML.W15_NS, 'person');
    for (let i = 0; i < persons.length; i++) {
        const el = persons.item(i);
        const name = el.getAttributeNS(OOXML.W15_NS, 'author') ?? el.getAttribute('w15:author');
        if (name === author)
            return; // Already present
    }
    const personEl = peopleDoc.createElementNS(OOXML.W15_NS, 'w15:person');
    personEl.setAttribute('w15:author', author);
    // Add a presenceInfo child (required by Word)
    const presenceInfo = peopleDoc.createElementNS(OOXML.W15_NS, 'w15:presenceInfo');
    presenceInfo.setAttribute('w15:providerId', 'None');
    presenceInfo.setAttribute('w15:userId', author);
    personEl.appendChild(presenceInfo);
    root.appendChild(personEl);
    zip.writeText('word/people.xml', serializeXml(peopleDoc));
}
/**
 * Read all comments from a document, building a threaded tree.
 *
 * Root comments are returned at the top level; replies are nested under
 * their parent's `replies` array. Thread linkage is resolved via
 * commentsExtended.xml paraIdParent relationships.
 */
export async function getComments(zip, documentXml) {
    const commentsText = await zip.readTextOrNull('word/comments.xml');
    if (!commentsText)
        return [];
    const commentsDoc = parseXml(commentsText);
    const commentEls = commentsDoc.getElementsByTagNameNS(OOXML.W_NS, W.comment);
    if (commentEls.length === 0)
        return [];
    // Build a map of commentId → { paraId, Comment }
    const byParaId = new Map();
    const byId = new Map();
    for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        const id = idStr ? parseInt(idStr, 10) : -1;
        if (id < 0)
            continue;
        const author = el.getAttributeNS(OOXML.W_NS, 'author') ?? el.getAttribute('w:author') ?? '';
        const date = el.getAttributeNS(OOXML.W_NS, 'date') ?? el.getAttribute('w:date') ?? '';
        const initials = el.getAttributeNS(OOXML.W_NS, 'initials') ?? el.getAttribute('w:initials') ?? '';
        // Extract text from <w:t> elements, skipping annotationRef runs
        const text = extractCommentText(el);
        // Get paraId from first <w:p> child
        const paras = el.getElementsByTagNameNS(OOXML.W_NS, W.p);
        let paragraphId = null;
        if (paras.length > 0) {
            const p = paras.item(0);
            paragraphId = p.getAttributeNS(OOXML.W14_NS, 'paraId') ?? p.getAttribute('w14:paraId') ?? null;
        }
        const comment = {
            id,
            author,
            date,
            initials,
            text,
            paragraphId,
            anchoredParagraphId: null,
            replies: [],
        };
        byId.set(id, comment);
        if (paragraphId)
            byParaId.set(paragraphId, comment);
    }
    // Resolve anchoredParagraphId by scanning documentXml for commentRangeStart elements
    const rangeStarts = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.commentRangeStart);
    for (let i = 0; i < rangeStarts.length; i++) {
        const rs = rangeStarts.item(i);
        const cidStr = rs.getAttributeNS(OOXML.W_NS, 'id') ?? rs.getAttribute('w:id');
        if (!cidStr)
            continue;
        const cid = parseInt(cidStr, 10);
        const comment = byId.get(cid);
        if (!comment)
            continue;
        // Walk up to find enclosing <w:p>
        let parent = rs.parentNode;
        while (parent && parent.nodeType === 1) {
            const pel = parent;
            if (pel.localName === W.p && pel.namespaceURI === OOXML.W_NS) {
                comment.anchoredParagraphId = getParagraphBookmarkId(pel);
                break;
            }
            parent = parent.parentNode;
        }
    }
    // Build thread tree from commentsExtended.xml
    const extText = await zip.readTextOrNull('word/commentsExtended.xml');
    if (extText) {
        const extDoc = parseXml(extText);
        const exEls = extDoc.getElementsByTagNameNS(OOXML.W15_NS, 'commentEx');
        for (let i = 0; i < exEls.length; i++) {
            const ex = exEls.item(i);
            const childParaId = ex.getAttributeNS(OOXML.W15_NS, 'paraId') ?? ex.getAttribute('w15:paraId');
            const parentParaId = ex.getAttributeNS(OOXML.W15_NS, 'paraIdParent') ?? ex.getAttribute('w15:paraIdParent');
            if (!childParaId || !parentParaId)
                continue;
            const child = byParaId.get(childParaId);
            const parentComment = byParaId.get(parentParaId);
            if (child && parentComment) {
                parentComment.replies.push(child);
            }
        }
    }
    // Collect root-level comments (those not appearing as anyone's reply)
    const replyParaIds = new Set();
    if (extText) {
        const extDoc = parseXml(extText);
        const exEls = extDoc.getElementsByTagNameNS(OOXML.W15_NS, 'commentEx');
        for (let i = 0; i < exEls.length; i++) {
            const ex = exEls.item(i);
            const childParaId = ex.getAttributeNS(OOXML.W15_NS, 'paraId') ?? ex.getAttribute('w15:paraId');
            const parentParaId = ex.getAttributeNS(OOXML.W15_NS, 'paraIdParent') ?? ex.getAttribute('w15:paraIdParent');
            if (childParaId && parentParaId) {
                replyParaIds.add(childParaId);
            }
        }
    }
    const roots = [];
    for (const comment of byId.values()) {
        if (!comment.paragraphId || !replyParaIds.has(comment.paragraphId)) {
            roots.push(comment);
        }
    }
    return roots;
}
/**
 * Get a single comment by ID, searching the full tree including replies.
 */
export async function getComment(zip, documentXml, commentId) {
    const all = await getComments(zip, documentXml);
    return findCommentById(all, commentId);
}
function findCommentById(comments, id) {
    for (const c of comments) {
        if (c.id === id)
            return c;
        const found = findCommentById(c.replies, id);
        if (found)
            return found;
    }
    return null;
}
// ── Comment deletion ─────────────────────────────────────────────────
/**
 * Delete a comment and all its descendants from the document.
 *
 * - Removes comment elements from comments.xml
 * - Removes commentEx entries from commentsExtended.xml (if present)
 * - For root comments: removes commentRangeStart, commentRangeEnd, and
 *   commentReference from document.xml (element-level; run removed only if empty)
 * - Transitive cascade: deleting any node also deletes all descendants
 */
export async function deleteComment(documentXml, zip, params) {
    const { commentId } = params;
    const commentsText = await zip.readTextOrNull('word/comments.xml');
    if (!commentsText)
        throw new Error(`Comment ID ${commentId} not found`);
    const commentsDoc = parseXml(commentsText);
    // Find the target comment element and its paraId
    const targetEl = findCommentElementById(commentsDoc, commentId);
    if (!targetEl)
        throw new Error(`Comment ID ${commentId} not found`);
    const targetParaId = getCommentElParaId(targetEl);
    // Collect all IDs to delete: the target + all transitive descendants
    const idsToDelete = new Set([commentId]);
    const paraIdsToDelete = new Set();
    if (targetParaId)
        paraIdsToDelete.add(targetParaId);
    // Build paraId→commentId and paraId→commentEl maps for all comments
    const paraIdToId = new Map();
    const allCommentEls = commentsDoc.getElementsByTagNameNS(OOXML.W_NS, W.comment);
    for (let i = 0; i < allCommentEls.length; i++) {
        const el = allCommentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        const id = idStr ? parseInt(idStr, 10) : -1;
        if (id < 0)
            continue;
        const pid = getCommentElParaId(el);
        if (pid)
            paraIdToId.set(pid, id);
    }
    // Read commentsExtended.xml to find descendants via paraIdParent graph
    const extText = await zip.readTextOrNull('word/commentsExtended.xml');
    if (extText) {
        const extDoc = parseXml(extText);
        const exEls = extDoc.getElementsByTagNameNS(OOXML.W15_NS, 'commentEx');
        // Build parent→children map
        const childrenOf = new Map();
        for (let i = 0; i < exEls.length; i++) {
            const ex = exEls.item(i);
            const childPid = ex.getAttributeNS(OOXML.W15_NS, 'paraId') ?? ex.getAttribute('w15:paraId');
            const parentPid = ex.getAttributeNS(OOXML.W15_NS, 'paraIdParent') ?? ex.getAttribute('w15:paraIdParent');
            if (childPid && parentPid) {
                const arr = childrenOf.get(parentPid);
                if (arr)
                    arr.push(childPid);
                else
                    childrenOf.set(parentPid, [childPid]);
            }
        }
        // BFS from target paraId to collect all descendant paraIds
        const queue = targetParaId ? [targetParaId] : [];
        while (queue.length > 0) {
            const pid = queue.shift();
            const children = childrenOf.get(pid);
            if (!children)
                continue;
            for (const childPid of children) {
                if (!paraIdsToDelete.has(childPid)) {
                    paraIdsToDelete.add(childPid);
                    const childId = paraIdToId.get(childPid);
                    if (childId != null)
                        idsToDelete.add(childId);
                    queue.push(childPid);
                }
            }
        }
    }
    // 1. Remove comment elements from comments.xml
    const elsToRemove = [];
    for (let i = 0; i < allCommentEls.length; i++) {
        const el = allCommentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        const id = idStr ? parseInt(idStr, 10) : -1;
        if (idsToDelete.has(id))
            elsToRemove.push(el);
    }
    for (const el of elsToRemove) {
        el.parentNode?.removeChild(el);
    }
    zip.writeText('word/comments.xml', serializeXml(commentsDoc));
    // 2. Remove commentEx entries from commentsExtended.xml (if present)
    if (extText) {
        const extDoc = parseXml(extText);
        const exEls = extDoc.getElementsByTagNameNS(OOXML.W15_NS, 'commentEx');
        const exToRemove = [];
        for (let i = 0; i < exEls.length; i++) {
            const ex = exEls.item(i);
            const pid = ex.getAttributeNS(OOXML.W15_NS, 'paraId') ?? ex.getAttribute('w15:paraId');
            if (pid && paraIdsToDelete.has(pid))
                exToRemove.push(ex);
        }
        for (const ex of exToRemove) {
            ex.parentNode?.removeChild(ex);
        }
        zip.writeText('word/commentsExtended.xml', serializeXml(extDoc));
    }
    // 3. Remove range markers and commentReference from document.xml (for root comments)
    for (const cid of idsToDelete) {
        removeCommentMarkersFromDocument(documentXml, cid);
    }
}
function findCommentElementById(commentsDoc, commentId) {
    const commentEls = commentsDoc.getElementsByTagNameNS(OOXML.W_NS, W.comment);
    for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls.item(i);
        const idStr = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (idStr && parseInt(idStr, 10) === commentId)
            return el;
    }
    return null;
}
function getCommentElParaId(commentEl) {
    const paras = commentEl.getElementsByTagNameNS(OOXML.W_NS, W.p);
    if (paras.length === 0)
        return null;
    const p = paras.item(0);
    return p.getAttributeNS(OOXML.W14_NS, 'paraId') ?? p.getAttribute('w14:paraId') ?? null;
}
function removeCommentMarkersFromDocument(documentXml, commentId) {
    const cidStr = String(commentId);
    // Remove commentRangeStart elements
    const rangeStarts = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.commentRangeStart);
    const startsToRemove = [];
    for (let i = 0; i < rangeStarts.length; i++) {
        const el = rangeStarts.item(i);
        const id = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (id === cidStr)
            startsToRemove.push(el);
    }
    for (const el of startsToRemove)
        el.parentNode?.removeChild(el);
    // Remove commentRangeEnd elements
    const rangeEnds = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.commentRangeEnd);
    const endsToRemove = [];
    for (let i = 0; i < rangeEnds.length; i++) {
        const el = rangeEnds.item(i);
        const id = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (id === cidStr)
            endsToRemove.push(el);
    }
    for (const el of endsToRemove)
        el.parentNode?.removeChild(el);
    // Remove commentReference elements (safe: remove element, then run only if empty)
    const refs = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.commentReference);
    const refsToRemove = [];
    for (let i = 0; i < refs.length; i++) {
        const el = refs.item(i);
        const id = el.getAttributeNS(OOXML.W_NS, 'id') ?? el.getAttribute('w:id');
        if (id === cidStr)
            refsToRemove.push(el);
    }
    for (const ref of refsToRemove) {
        const run = ref.parentNode;
        if (!run)
            continue;
        run.removeChild(ref);
        // Remove run only if it has no visible content after removing the reference
        if (!hasVisibleRunContent(run)) {
            run.parentNode?.removeChild(run);
        }
    }
}
function hasVisibleRunContent(run) {
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
function extractCommentText(commentEl) {
    const parts = [];
    const runs = commentEl.getElementsByTagNameNS(OOXML.W_NS, W.r);
    for (let i = 0; i < runs.length; i++) {
        const run = runs.item(i);
        // Skip runs that contain annotationRef (they're metadata, not user text)
        const annotRefs = run.getElementsByTagNameNS(OOXML.W_NS, W.annotationRef);
        if (annotRefs.length > 0)
            continue;
        const ts = run.getElementsByTagNameNS(OOXML.W_NS, W.t);
        for (let j = 0; j < ts.length; j++) {
            const t = ts.item(j);
            parts.push(t.textContent ?? '');
        }
    }
    return parts.join('');
}
//# sourceMappingURL=comments.js.map