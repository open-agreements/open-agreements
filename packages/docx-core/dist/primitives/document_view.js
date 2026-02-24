import { OOXML, W } from './namespaces.js';
import { getParagraphText, getParagraphRuns } from './text.js';
import { extractListLabel, stripListLabel, LabelType } from './list_labels.js';
import { parseNumberingXml, computeListLabelForParagraph } from './numbering.js';
import { parseStylesXml, extractParagraphFormatting, extractEffectiveRunFormatting } from './styles.js';
import { emitDefinitionTagsFromString, detectDefinitionSpans, HIGHLIGHT_TAG } from './semantic_tags.js';
import { computeModalBaseline, emitFormattingTags, mergeAdjacentTags } from './formatting_tags.js';
import { isReservedFootnote } from './footnotes.js';
const SHORT_HEADER_MAX_LENGTH = 50;
const MAX_HEADER_TEXT_LENGTH = 60;
const STYLE_EXAMPLE_TEXT_PREVIEW_LENGTH = 50;
function getWAttr(el, localName) {
    return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? el.getAttribute(localName);
}
function runHighlightVal(run) {
    const rPr = run.getElementsByTagNameNS(OOXML.W_NS, W.rPr).item(0);
    if (!rPr)
        return null;
    const h = rPr.getElementsByTagNameNS(OOXML.W_NS, W.highlight).item(0);
    if (!h)
        return null;
    const v = getWAttr(h, 'val');
    if (!v || v === 'none')
        return null;
    return v;
}
function emitHighlightTagsFromParagraph(p) {
    const runs = getParagraphRuns(p);
    if (runs.length === 0)
        return '';
    const out = [];
    let inHighlight = false;
    for (const tr of runs) {
        const isHighlighted = !!runHighlightVal(tr.r);
        if (isHighlighted && !inHighlight) {
            out.push(`<${HIGHLIGHT_TAG}>`);
            inHighlight = true;
        }
        else if (!isHighlighted && inHighlight) {
            out.push(`</${HIGHLIGHT_TAG}>`);
            inHighlight = false;
        }
        out.push(tr.text);
    }
    if (inHighlight)
        out.push(`</${HIGHLIGHT_TAG}>`);
    return out.join('');
}
function fingerprintKey(fp) {
    // Stable JSON-ish key used for Map lookups.
    return `${fp.list_level}|${fp.left_indent_pt.toFixed(1)}|${fp.first_line_indent_pt.toFixed(1)}|${fp.style_name}|${fp.alignment}`;
}
// Pattern-based header detection fallback (ported from Python ingestor._extract_header_info).
const HEADER_PATTERN = /^([A-Z][^.!?:]*(?:\s+[A-Z][^.!?:]*)*)([.:]?)(?:\s|$)/;
function extractHeaderInfo(cleanText) {
    if (!cleanText || cleanText.length < 2)
        return { header_text: null, header_style: null };
    if (!/^[A-Z]/.test(cleanText))
        return { header_text: null, header_style: null };
    const stripped = cleanText.trim();
    if (stripped.length <= SHORT_HEADER_MAX_LENGTH) {
        if (stripped.endsWith('.'))
            return { header_text: stripped.slice(0, -1), header_style: 'title_with_period' };
        if (stripped.endsWith(':'))
            return { header_text: stripped.slice(0, -1), header_style: 'title_with_colon' };
        const words = stripped.split(/\s+/);
        if (words.length <= 5)
            return { header_text: stripped, header_style: 'title_bare' };
        return { header_text: null, header_style: null };
    }
    const m = HEADER_PATTERN.exec(stripped);
    if (!m)
        return { header_text: null, header_style: null };
    const headerText = (m[1] ?? '').trim();
    const terminator = m[2] ?? '';
    const remaining = stripped.slice(m[0].length);
    if (!remaining || headerText.length > MAX_HEADER_TEXT_LENGTH)
        return { header_text: null, header_style: null };
    if (terminator === '.')
        return { header_text: headerText, header_style: 'title_with_period' };
    if (terminator === ':')
        return { header_text: headerText, header_style: 'title_with_colon' };
    return { header_text: headerText, header_style: 'title_bare' };
}
function detectRunInHeader(params) {
    const { paragraph, paragraphPPr, paragraphStyleId, styles } = params;
    const punct = new Set(['.', ':', '-']);
    // Use visible runs only (field code text stripped in getParagraphRuns()).
    const runs = getParagraphRuns(paragraph);
    if (runs.length === 0)
        return null;
    // Group by run element, preserving order.
    const orderedUniqueRuns = [];
    const seen = new Set();
    for (const tr of runs) {
        if (!seen.has(tr.r)) {
            seen.add(tr.r);
            orderedUniqueRuns.push(tr.r);
        }
    }
    let headerText = '';
    let formatting = null;
    let headerCharCount = 0;
    for (const r of orderedUniqueRuns) {
        const fmt = extractEffectiveRunFormatting({ run: r, paragraphPPr, paragraphStyleId, styles });
        const isHeaderStyle = fmt.bold || fmt.underline;
        if (!isHeaderStyle)
            break;
        // Accumulate run text.
        const ts = Array.from(r.getElementsByTagNameNS(OOXML.W_NS, W.t));
        for (const t of ts) {
            const tc = t.textContent ?? '';
            headerText += tc;
            headerCharCount += tc.length;
        }
        if (!formatting)
            formatting = { bold: fmt.bold, italic: fmt.italic, underline: fmt.underline };
    }
    const trimmed = headerText.trim();
    if (!trimmed)
        return null;
    if (!punct.has(trimmed[trimmed.length - 1]))
        return null;
    if (!formatting)
        return null;
    return { raw_text: trimmed, formatting, headerCharCount };
}
function inferSemanticName(params) {
    const { fp, nodes } = params;
    // Find first label_type if present.
    let labelType = null;
    for (const n of nodes) {
        if (n.list_metadata.label_type) {
            labelType = n.list_metadata.label_type;
            break;
        }
    }
    const listLevel = fp.list_level;
    if (listLevel >= 0) {
        if (listLevel === 0) {
            if (labelType === LabelType.ARTICLE)
                return { base_id: 'article', display_name: 'Article Heading' };
            if (labelType === LabelType.SECTION)
                return { base_id: 'section', display_name: 'Section Heading' };
            if (labelType === LabelType.ROMAN)
                return { base_id: 'roman_section', display_name: 'Roman Numeral Section' };
            return { base_id: 'top_level', display_name: 'Top-Level List Item' };
        }
        if (listLevel === 1) {
            if (labelType === LabelType.LETTER)
                return { base_id: 'subsection', display_name: 'Subsection (a)/(A)' };
            if (labelType === LabelType.NUMBER)
                return { base_id: 'subsection_number', display_name: 'Numbered Subsection' };
            if (labelType === LabelType.ROMAN)
                return { base_id: 'subsection_roman', display_name: 'Roman Subsection' };
            return { base_id: 'level_1', display_name: `Level ${listLevel} List Item` };
        }
        if (labelType === LabelType.ROMAN)
            return { base_id: `level_${listLevel}_roman`, display_name: `Level ${listLevel} Roman` };
        if (labelType === LabelType.LETTER)
            return { base_id: `level_${listLevel}_letter`, display_name: `Level ${listLevel} Letter` };
        return { base_id: `level_${listLevel}`, display_name: `Level ${listLevel} List Item` };
    }
    // Non-list.
    const styleName = fp.style_name.toLowerCase().replace(/\s+/g, '_');
    if (fp.left_indent_pt > 0)
        return { base_id: 'indent_block', display_name: 'Indented Block' };
    if (styleName.includes('heading') || styleName.includes('title'))
        return { base_id: 'heading', display_name: 'Heading' };
    if (styleName.includes('quote') || styleName.includes('block'))
        return { base_id: 'block_quote', display_name: 'Block Quote' };
    return { base_id: 'body', display_name: 'Body Text' };
}
export function discoverStyles(nodes) {
    const groups = new Map();
    for (const n of nodes) {
        const key = fingerprintKey(n.style_fingerprint);
        const g = groups.get(key);
        if (g)
            g.nodes.push(n);
        else
            groups.set(key, { fp: n.style_fingerprint, nodes: [n] });
    }
    const used = {};
    const styles = new Map();
    const fpToStyle = new Map();
    for (const [fpKey, g] of groups.entries()) {
        const { base_id, display_name } = inferSemanticName({ fp: g.fp, nodes: g.nodes });
        let styleId = base_id;
        if (used[base_id] !== undefined) {
            used[base_id] += 1;
            styleId = `${base_id}_${used[base_id]}`;
        }
        else {
            used[base_id] = 0;
        }
        const median = g.nodes[Math.floor(g.nodes.length / 2)];
        const info = {
            style_id: styleId,
            display_name,
            fingerprint: g.fp,
            example_node_id: median.id,
            example_text: median.clean_text.slice(0, STYLE_EXAMPLE_TEXT_PREVIEW_LENGTH),
            count: g.nodes.length,
            dominant_alignment: g.fp.alignment,
        };
        styles.set(styleId, info);
        fpToStyle.set(fpKey, styleId);
    }
    return { styles, fingerprint_to_style: fpToStyle };
}
function headerStripFromText(params) {
    // Mirrors Python TOONRenderer header stripping.
    const { header } = params;
    let { text } = params;
    if (!header)
        return text;
    const headerNorm = header.trim().toLowerCase();
    const textLower = text.toLowerCase();
    for (const punct of [':', '.', '-', ';', '']) {
        const testPrefix = `${headerNorm}${punct}`;
        if (textLower.startsWith(testPrefix)) {
            text = text.slice(testPrefix.length).trimStart();
            return text;
        }
    }
    if (text.startsWith(header)) {
        text = text.slice(header.length).replace(/^[.:\-;]+/, '').trimStart();
    }
    return text;
}
export function renderToon(nodes) {
    const lines = ['#SCHEMA id | list_label | header | style | text'];
    for (const n of nodes) {
        let text = n.tagged_text;
        if (n.header)
            text = headerStripFromText({ header: n.header, text });
        let header = n.header;
        if (header && !text) {
            text = header;
            header = '';
        }
        lines.push(`${n.id} | ${n.list_label} | ${header} | ${n.style} | ${text}`);
    }
    return lines.join('\n');
}
export function buildDocumentView(params) {
    const { documentXml, stylesXml, numberingXml, opts } = params;
    const includeSemantic = opts?.include_semantic_tags ?? true;
    void includeSemantic;
    const stylesModel = parseStylesXml(stylesXml);
    void stylesModel;
    const numberingModel = parseNumberingXml(numberingXml);
    void numberingModel;
    const counters = new Map();
    void counters;
    const body = documentXml.getElementsByTagNameNS(OOXML.W_NS, W.body).item(0);
    if (!body)
        return { nodes: [], styles: { styles: new Map(), fingerprint_to_style: new Map() } };
    const paragraphs = Array.from(body.getElementsByTagNameNS(OOXML.W_NS, W.p));
    const nodes = [];
    for (const p of paragraphs) {
        const prev = p.previousSibling;
        void prev;
    }
    return { nodes, styles: { styles: new Map(), fingerprint_to_style: new Map() } };
}
// ── Helpers for building AnnotatedRun arrays ─────────────────────────
/**
 * Resolve the hyperlink URL for a run element by checking if its parent is a
 * `w:hyperlink` element with an `r:id` attribute pointing into the rels map.
 */
function resolveRunHyperlinkUrl(runEl, relsMap) {
    if (!relsMap || relsMap.size === 0)
        return null;
    const parent = runEl.parentNode;
    if (!parent || parent.localName !== W.hyperlink)
        return null;
    // r:id attribute can be namespaced or prefixed.
    const rId = parent.getAttributeNS(OOXML.R_NS, 'id') ??
        parent.getAttribute('r:id') ??
        null;
    if (!rId)
        return null;
    return relsMap.get(rId) ?? null;
}
/**
 * Build AnnotatedRun[] for a single paragraph. All runs are included;
 * `isHeaderRun` is set to false initially (caller marks header runs separately).
 */
function buildAnnotatedRuns(params) {
    const { p, paragraphPPr, paragraphStyleId, stylesModel, relsMap } = params;
    const textRuns = getParagraphRuns(p);
    const annotated = [];
    // Track unique run elements to avoid double-counting when getParagraphRuns
    // returns multiple TextRun entries for the same w:r element.
    const seenRunEls = new Set();
    for (const tr of textRuns) {
        if (seenRunEls.has(tr.r)) {
            // Append text to existing entry for this run element.
            const existing = annotated[annotated.length - 1];
            existing.text += tr.text;
            existing.charCount += tr.text.length;
            continue;
        }
        seenRunEls.add(tr.r);
        const formatting = extractEffectiveRunFormatting({
            run: tr.r,
            paragraphPPr,
            paragraphStyleId,
            styles: stylesModel,
        });
        const hyperlinkUrl = resolveRunHyperlinkUrl(tr.r, relsMap);
        annotated.push({
            text: tr.text,
            formatting,
            hyperlinkUrl,
            charCount: tr.text.length,
            isHeaderRun: false,
        });
    }
    return annotated;
}
// ── Footnote marker helpers (view-only) ─────────────────────────────
/**
 * Build a map from footnote ID → display number by scanning documentXml
 * for w:footnoteReference elements in DOM order (skipping reserved IDs).
 */
function buildFootnoteDisplayMap(documentXml, footnotesXml) {
    const reservedIds = new Set();
    if (footnotesXml) {
        const fnEls = footnotesXml.getElementsByTagNameNS(OOXML.W_NS, W.footnotes);
        const container = fnEls.length > 0 ? fnEls.item(0) : footnotesXml.documentElement;
        const footnoteEls = container.getElementsByTagNameNS(OOXML.W_NS, W.footnote);
        for (let i = 0; i < footnoteEls.length; i++) {
            const el = footnoteEls.item(i);
            if (isReservedFootnote(el)) {
                const idStr = getWAttr(el, 'id');
                if (idStr)
                    reservedIds.add(parseInt(idStr, 10));
            }
        }
    }
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
/**
 * Compute footnote marker insertion points for a paragraph.
 * Returns an array of { offset, marker } sorted by offset descending
 * for safe right-to-left insertion into the text string.
 *
 * Self-contained: only inspects the paragraph DOM for w:footnoteReference
 * elements. Does NOT modify getParagraphRuns or getParagraphText.
 */
function getFootnoteMarkersForParagraph(p, displayMap) {
    if (displayMap.size === 0)
        return [];
    // Walk through direct children (and hyperlink children) to find w:r elements
    // and their visible text, tracking position. When we find a footnoteReference,
    // record its position.
    const markers = [];
    let visibleOffset = 0;
    // We need to iterate runs in paragraph order. Use the same approach as getParagraphRuns
    // but also detect footnoteReference elements.
    const rElems = Array.from(p.getElementsByTagNameNS(OOXML.W_NS, W.r));
    // Track field state to skip field codes (same as getParagraphRuns)
    let fieldState = 0; // 0=outside, 1=in_code, 2=in_result
    for (const r of rElems) {
        let runVisibleLen = 0;
        let hasFootnoteRef = false;
        let footnoteId = -1;
        for (const child of Array.from(r.childNodes)) {
            if (child.nodeType !== 1)
                continue;
            const el = child;
            if (el.namespaceURI !== OOXML.W_NS)
                continue;
            if (el.localName === W.fldChar) {
                const typ = getWAttr(el, 'fldCharType') ?? '';
                if (typ === 'begin')
                    fieldState = 1;
                else if (typ === 'separate')
                    fieldState = 2;
                else if (typ === 'end')
                    fieldState = 0;
                continue;
            }
            if (fieldState === 1)
                continue; // skip field code
            if (el.localName === W.t) {
                runVisibleLen += (el.textContent ?? '').length;
            }
            else if (el.localName === W.tab || el.localName === W.br) {
                runVisibleLen += 1;
            }
            else if (el.localName === W.footnoteReference) {
                hasFootnoteRef = true;
                const idStr = getWAttr(el, 'id');
                if (idStr)
                    footnoteId = parseInt(idStr, 10);
            }
        }
        // The footnote reference position is at the end of this run's visible text
        if (hasFootnoteRef && footnoteId >= 0) {
            const displayNum = displayMap.get(footnoteId);
            if (displayNum != null) {
                markers.push({
                    offset: visibleOffset + runVisibleLen,
                    marker: `[^${displayNum}]`,
                });
            }
        }
        visibleOffset += runVisibleLen;
    }
    // Sort descending by offset for safe right-to-left insertion
    markers.sort((a, b) => b.offset - a.offset);
    return markers;
}
/**
 * Inject footnote markers into a text string at the given offsets.
 * Markers must be sorted descending by offset.
 */
function injectFootnoteMarkers(text, markers) {
    if (markers.length === 0)
        return text;
    let result = text;
    for (const { offset, marker } of markers) {
        // Clamp offset to text length
        const pos = Math.min(offset, result.length);
        result = result.slice(0, pos) + marker + result.slice(pos);
    }
    return result;
}
export function buildNodesForDocumentView(params) {
    const { paragraphs, stylesXml, numberingXml, relsMap } = params;
    const includeSemantic = params.include_semantic_tags ?? true;
    const showFormatting = params.show_formatting ?? false;
    // Build footnote display number map if documentXml is provided
    const footnoteDisplayMap = params.documentXml
        ? buildFootnoteDisplayMap(params.documentXml, params.footnotesXml ?? null)
        : new Map();
    const stylesModel = parseStylesXml(stylesXml);
    const numberingModel = parseNumberingXml(numberingXml);
    const counters = new Map();
    // ── Pass 1 (formatting mode): pre-compute annotated runs per paragraph ──
    // We also collect all non-header, non-heading-style body runs for a
    // document-wide FormattingBaseline.
    const paraAnnotatedRuns = new Map();
    const allBodyRuns = [];
    if (showFormatting) {
        for (const { p } of paragraphs) {
            const paraPPr = p.getElementsByTagNameNS(OOXML.W_NS, W.pPr).item(0);
            const paraFmt = extractParagraphFormatting(paraPPr ?? null, stylesModel);
            const runs = buildAnnotatedRuns({
                p,
                paragraphPPr: paraPPr ?? null,
                paragraphStyleId: paraFmt.styleId,
                stylesModel,
                relsMap,
            });
            // Mark run-in header prefix runs so baseline suppression ignores them.
            try {
                const hdr = detectRunInHeader({
                    paragraph: p,
                    paragraphPPr: paraPPr ?? null,
                    paragraphStyleId: paraFmt.styleId,
                    styles: stylesModel,
                });
                if (hdr && hdr.headerCharCount > 0) {
                    let seen = 0;
                    for (const r of runs) {
                        if (seen >= hdr.headerCharCount)
                            break;
                        r.isHeaderRun = true;
                        seen += r.charCount;
                    }
                }
            }
            catch {
                // Ignore header-detection errors for baseline precomputation.
            }
            paraAnnotatedRuns.set(p, runs);
            // Skip heading-style paragraphs from baseline computation.
            const styleName = (paraFmt.styleName ?? '').toLowerCase();
            const isHeadingStyle = styleName.includes('heading') || styleName.includes('title');
            if (!isHeadingStyle) {
                for (const r of runs) {
                    if (r.charCount > 0)
                        allBodyRuns.push(r);
                }
            }
        }
    }
    const docBaseline = showFormatting
        ? computeModalBaseline(allBodyRuns)
        : { bold: false, italic: false, underline: false, suppressed: false };
    // ── Pass 2: main loop ──
    const nodes = [];
    for (let idx = 0; idx < paragraphs.length; idx++) {
        const { id, p } = paragraphs[idx];
        const paraPPr = p.getElementsByTagNameNS(OOXML.W_NS, W.pPr).item(0);
        const paraFmt = extractParagraphFormatting(paraPPr ?? null, stylesModel);
        // Visible clean text (field codes stripped).
        const fullText = getParagraphText(p).replace(/\r/g, '').replace(/\n/g, '').trim();
        if (!fullText)
            continue;
        // Numbering (auto-numbered) info from numPr.
        let numId = null;
        let ilvl = null;
        const numPr = paraPPr ? paraPPr.getElementsByTagNameNS(OOXML.W_NS, W.numPr).item(0) : null;
        if (numPr) {
            const numIdEl = numPr.getElementsByTagNameNS(OOXML.W_NS, W.numId).item(0);
            const ilvlEl = numPr.getElementsByTagNameNS(OOXML.W_NS, W.ilvl).item(0);
            const numIdVal = numIdEl ? getWAttr(numIdEl, 'val') : null;
            const ilvlVal = ilvlEl ? getWAttr(ilvlEl, 'val') : null;
            if (numIdVal)
                numId = numIdVal;
            if (ilvlVal != null) {
                const v = Number.parseInt(ilvlVal, 10);
                if (!Number.isNaN(v))
                    ilvl = v;
            }
        }
        let labelString = '';
        let labelType = null;
        let cleanTextNoLabel = fullText;
        let isAutoNumbered = false;
        let listLevel = -1;
        let manualLabelMatchEnd = 0;
        if (numId && ilvl != null) {
            isAutoNumbered = true;
            listLevel = ilvl;
            labelString = computeListLabelForParagraph(numberingModel, counters, { numId, ilvl }) || '';
            if (labelString) {
                const cls = extractListLabel(labelString);
                labelType = cls.label_type;
            }
        }
        else {
            // Manual label detection from visible text.
            const stripped = stripListLabel(fullText);
            cleanTextNoLabel = stripped.stripped_text;
            if (stripped.result.label) {
                labelString = stripped.result.label;
                labelType = stripped.result.label_type;
                listLevel = 0;
                manualLabelMatchEnd = stripped.result.match_end;
            }
        }
        // Run-in header detection (formatting-based) first.
        let headerText = null;
        let headerStyle = null;
        let headerFormatting = null;
        let headerCharCount = 0;
        try {
            const hdr = detectRunInHeader({ paragraph: p, paragraphPPr: paraPPr ?? null, paragraphStyleId: paraFmt.styleId, styles: stylesModel });
            if (hdr) {
                headerText = hdr.raw_text.replace(/[.:\-]+$/g, '');
                headerStyle = 'run_in_header';
                headerFormatting = hdr.formatting;
                headerCharCount = hdr.headerCharCount;
            }
        }
        catch {
            // ignore
        }
        if (!headerText) {
            const fallback = extractHeaderInfo(cleanTextNoLabel);
            headerText = fallback.header_text;
            headerStyle = fallback.header_style;
        }
        // ── Tag emission ──
        let tagged = cleanTextNoLabel;
        if (showFormatting) {
            // Formatting tags mode: emit inline <b>/<i>/<u>/<highlighting>/<a> tags.
            const annotatedRuns = paraAnnotatedRuns.get(p) ?? [];
            // Mark header-prefix runs as isHeaderRun.
            if (headerCharCount > 0) {
                let charsSeen = 0;
                for (const ar of annotatedRuns) {
                    if (charsSeen >= headerCharCount)
                        break;
                    ar.isHeaderRun = true;
                    charsSeen += ar.charCount;
                }
            }
            // Handle manual label: skip runs whose text falls within the label portion.
            let bodyRuns;
            if (manualLabelMatchEnd > 0) {
                // Skip characters in the label portion.
                bodyRuns = [];
                let charsSeen = 0;
                for (const ar of annotatedRuns) {
                    const runEnd = charsSeen + ar.charCount;
                    if (runEnd <= manualLabelMatchEnd) {
                        // Entire run is within the label — skip it.
                        charsSeen = runEnd;
                        continue;
                    }
                    if (charsSeen < manualLabelMatchEnd) {
                        // Run spans the label boundary — take only the body portion.
                        const bodyStart = manualLabelMatchEnd - charsSeen;
                        bodyRuns.push({
                            ...ar,
                            text: ar.text.slice(bodyStart),
                            charCount: ar.charCount - bodyStart,
                        });
                        charsSeen = runEnd;
                        continue;
                    }
                    bodyRuns.push(ar);
                    charsSeen = runEnd;
                }
                // Also trim leading whitespace from the first body run (matching stripListLabel behavior).
                if (bodyRuns.length > 0) {
                    const first = bodyRuns[0];
                    const trimmed = first.text.replace(/^\s+/, '');
                    if (trimmed.length < first.text.length) {
                        bodyRuns[0] = { ...first, text: trimmed, charCount: trimmed.length };
                    }
                }
            }
            else {
                bodyRuns = annotatedRuns;
            }
            // Emit formatting tags from run-level metadata.
            // Detect definition spans from the exact body run text used for emission so
            // span offsets stay aligned after list-label stripping/slicing.
            const bodyPlainText = bodyRuns.map((r) => r.text).join('');
            const defSpans = includeSemantic ? detectDefinitionSpans(bodyPlainText) : undefined;
            tagged = emitFormattingTags({ runs: bodyRuns, baseline: docBaseline, definitionSpans: defSpans });
            tagged = mergeAdjacentTags(tagged);
        }
        else if (includeSemantic) {
            // Legacy path: emit only highlight + definition tags (no formatting tags).
            const highlightTagged = emitHighlightTagsFromParagraph(p).replace(/\r/g, '').replace(/\n/g, '').trim();
            const semanticBase = cleanTextNoLabel === fullText ? highlightTagged : cleanTextNoLabel;
            tagged = emitDefinitionTagsFromString(semanticBase);
        }
        const fp = {
            list_level: listLevel,
            left_indent_pt: Math.round(paraFmt.leftIndentPt * 10) / 10,
            first_line_indent_pt: Math.round(paraFmt.firstLineIndentPt * 10) / 10,
            style_name: paraFmt.styleName,
            alignment: paraFmt.alignment,
        };
        // Body run formatting: pick the first visible run after any header prefix.
        let bodyFmt = null;
        try {
            const trs = getParagraphRuns(p);
            const seenRun = new Set();
            for (const tr of trs) {
                if (seenRun.has(tr.r))
                    continue;
                seenRun.add(tr.r);
                const fmt = extractEffectiveRunFormatting({ run: tr.r, paragraphPPr: paraPPr ?? null, paragraphStyleId: paraFmt.styleId, styles: stylesModel });
                // Skip header-style runs (bold/underline) at the very beginning; we want body.
                const isHeaderStyle = fmt.bold || fmt.underline;
                if (isHeaderStyle && (headerText || '').length > 0)
                    continue;
                bodyFmt = fmt;
                break;
            }
        }
        catch {
            bodyFmt = null;
        }
        // Inject footnote [^N] markers into view text (view-only, not shared text primitives)
        const fnMarkers = getFootnoteMarkersForParagraph(p, footnoteDisplayMap);
        if (fnMarkers.length > 0) {
            tagged = injectFootnoteMarkers(tagged, fnMarkers);
        }
        nodes.push({
            id,
            list_label: labelString,
            header: headerText ?? '',
            style: '', // filled after style discovery
            text: tagged, // filled after header stripping at render time
            clean_text: cleanTextNoLabel,
            tagged_text: tagged,
            list_metadata: {
                list_level: listLevel,
                label_type: labelType,
                label_string: labelString,
                header_text: headerText,
                header_style: headerStyle,
                header_formatting: headerFormatting,
                is_auto_numbered: isAutoNumbered,
            },
            style_fingerprint: fp,
            paragraph_style_id: paraFmt.styleId,
            paragraph_style_name: paraFmt.styleName,
            paragraph_alignment: paraFmt.alignment,
            paragraph_indents_pt: { left: fp.left_indent_pt, first_line: fp.first_line_indent_pt },
            numbering: { num_id: numId, ilvl, is_auto_numbered: isAutoNumbered },
            header_formatting: headerFormatting,
            body_run_formatting: bodyFmt,
        });
    }
    const styles = discoverStyles(nodes);
    for (const n of nodes) {
        const sid = styles.fingerprint_to_style.get(fingerprintKey(n.style_fingerprint));
        n.style = sid ?? (n.style_fingerprint.list_level >= 0 ? `level_${n.style_fingerprint.list_level}` : 'body');
        n.text = n.tagged_text;
    }
    return { nodes, styles };
}
//# sourceMappingURL=document_view.js.map