import { OOXML, W } from './namespaces.js';
function getWAttr(el, localName) {
    return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? el.getAttribute(localName);
}
export function parseStylesXml(stylesDoc) {
    const byId = new Map();
    if (!stylesDoc)
        return { byId };
    const styles = Array.from(stylesDoc.getElementsByTagNameNS(OOXML.W_NS, W.style));
    for (const st of styles) {
        const id = getWAttr(st, 'styleId');
        if (!id)
            continue;
        const nameEl = st.getElementsByTagNameNS(OOXML.W_NS, W.name).item(0);
        const basedOnEl = st.getElementsByTagNameNS(OOXML.W_NS, W.basedOn).item(0);
        const pPr = st.getElementsByTagNameNS(OOXML.W_NS, W.pPr).item(0);
        const rPr = st.getElementsByTagNameNS(OOXML.W_NS, W.rPr).item(0);
        const name = nameEl ? (getWAttr(nameEl, 'val') ?? id) : id;
        const basedOn = basedOnEl ? (getWAttr(basedOnEl, 'val') ?? null) : null;
        byId.set(id, {
            styleId: id,
            name,
            basedOn,
            pPr: pPr ?? null,
            rPr: rPr ?? null,
        });
    }
    return { byId };
}
function resolveStyleChain(model, styleId) {
    const chain = [];
    let cur = styleId;
    const seen = new Set();
    while (cur) {
        if (seen.has(cur))
            break;
        seen.add(cur);
        const st = model.byId.get(cur);
        if (!st)
            break;
        chain.push(st);
        cur = st.basedOn;
    }
    return chain;
}
function twipsToPt(v) {
    return v / 20.0;
}
function parseIndentPt(indEl) {
    if (!indEl)
        return { leftIndentPt: 0, firstLineIndentPt: 0 };
    const left = Number.parseInt(getWAttr(indEl, 'left') ?? '0', 10);
    const firstLine = getWAttr(indEl, 'firstLine');
    const hanging = getWAttr(indEl, 'hanging');
    let first = 0;
    if (firstLine != null)
        first = Number.parseInt(firstLine, 10) || 0;
    else if (hanging != null)
        first = -(Number.parseInt(hanging, 10) || 0);
    return { leftIndentPt: twipsToPt(left), firstLineIndentPt: twipsToPt(first) };
}
function parseAlignment(jcEl) {
    const val = jcEl ? (getWAttr(jcEl, 'val') ?? '') : '';
    switch (val) {
        case 'center':
            return 'CENTER';
        case 'right':
            return 'RIGHT';
        case 'both':
        case 'justify':
            return 'JUSTIFY';
        case 'left':
        default:
            return 'LEFT';
    }
}
function firstNonNull(vals) {
    for (const v of vals) {
        if (v !== null && v !== undefined)
            return v;
    }
    return null;
}
export function extractParagraphFormatting(pPr, styles) {
    const pStyleEl = pPr ? pPr.getElementsByTagNameNS(OOXML.W_NS, W.pStyle).item(0) : null;
    const styleId = pStyleEl ? (getWAttr(pStyleEl, 'val') ?? null) : null;
    const chain = resolveStyleChain(styles, styleId);
    const styleName = (styleId && styles.byId.get(styleId)?.name) || styleId || '';
    // Resolve alignment and indents: direct pPr overrides style chain.
    const directJc = pPr ? pPr.getElementsByTagNameNS(OOXML.W_NS, W.jc).item(0) : null;
    const directInd = pPr ? pPr.getElementsByTagNameNS(OOXML.W_NS, W.ind).item(0) : null;
    const styleJc = firstNonNull(chain.map((s) => (s.pPr ? s.pPr.getElementsByTagNameNS(OOXML.W_NS, W.jc).item(0) : null)));
    const styleInd = firstNonNull(chain.map((s) => (s.pPr ? s.pPr.getElementsByTagNameNS(OOXML.W_NS, W.ind).item(0) : null)));
    const alignment = parseAlignment(directJc ?? styleJc);
    const ind = parseIndentPt(directInd ?? styleInd);
    return {
        styleId,
        styleName,
        alignment,
        leftIndentPt: ind.leftIndentPt,
        firstLineIndentPt: ind.firstLineIndentPt,
    };
}
function parseBoolProp(parent, tagLocal) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, tagLocal).item(0);
    if (!el)
        return null;
    // <w:b/> implies true. <w:b w:val="0"/> implies false.
    const v = getWAttr(el, 'val');
    if (v === '0' || v === 'false')
        return false;
    return true;
}
function parseUnderline(parent) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, W.u).item(0);
    if (!el)
        return null;
    const v = getWAttr(el, 'val');
    if (!v)
        return true;
    return v !== 'none';
}
function parseFontName(parent) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, W.rFonts).item(0);
    if (!el)
        return null;
    return getWAttr(el, 'ascii') ?? getWAttr(el, 'hAnsi') ?? getWAttr(el, 'cs') ?? null;
}
function parseFontSizePt(parent) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, W.sz).item(0);
    if (!el)
        return null;
    const v = Number.parseInt(getWAttr(el, 'val') ?? '', 10);
    if (Number.isNaN(v))
        return null;
    // OOXML stores half-points.
    return v / 2.0;
}
function parseColorHex(parent) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, W.color).item(0);
    if (!el)
        return null;
    const v = getWAttr(el, 'val');
    if (!v || v === 'auto')
        return null;
    return v;
}
function parseHighlightVal(parent) {
    if (!parent)
        return null;
    const el = parent.getElementsByTagNameNS(OOXML.W_NS, W.highlight).item(0);
    if (!el)
        return null;
    const v = getWAttr(el, 'val');
    if (!v || v === 'none')
        return null;
    return v;
}
export function extractEffectiveRunFormatting(params) {
    const { run, paragraphPPr, paragraphStyleId, styles } = params;
    const rPr = run.getElementsByTagNameNS(OOXML.W_NS, W.rPr).item(0);
    const pRPr = paragraphPPr ? paragraphPPr.getElementsByTagNameNS(OOXML.W_NS, W.rPr).item(0) : null;
    // Resolve w:rStyle character style chain (e.g. "Strong" → bold via style definition).
    const rStyleEl = rPr?.getElementsByTagNameNS(OOXML.W_NS, W.rStyle).item(0);
    const rStyleId = rStyleEl ? (getWAttr(rStyleEl, 'val') ?? null) : null;
    const rStyleChain = resolveStyleChain(styles, rStyleId);
    const rStyleRPr = firstNonNull(rStyleChain.map((s) => s.rPr));
    const paraChain = resolveStyleChain(styles, paragraphStyleId);
    const styleRPr = firstNonNull(paraChain.map((s) => s.rPr));
    // Priority: direct rPr → rStyle chain rPr → paragraph rPr → paragraph style chain rPr
    const bold = firstNonNull([parseBoolProp(rPr, W.b), parseBoolProp(rStyleRPr, W.b), parseBoolProp(pRPr, W.b), parseBoolProp(styleRPr, W.b)]) ?? false;
    const italic = firstNonNull([parseBoolProp(rPr, W.i), parseBoolProp(rStyleRPr, W.i), parseBoolProp(pRPr, W.i), parseBoolProp(styleRPr, W.i)]) ?? false;
    const underline = firstNonNull([parseUnderline(rPr), parseUnderline(rStyleRPr), parseUnderline(pRPr), parseUnderline(styleRPr)]) ?? false;
    const highlightVal = firstNonNull([parseHighlightVal(rPr), parseHighlightVal(rStyleRPr), parseHighlightVal(pRPr), parseHighlightVal(styleRPr)]);
    const fontName = firstNonNull([parseFontName(rPr), parseFontName(rStyleRPr), parseFontName(pRPr), parseFontName(styleRPr)]) ?? '';
    const fontSizePt = firstNonNull([parseFontSizePt(rPr), parseFontSizePt(rStyleRPr), parseFontSizePt(pRPr), parseFontSizePt(styleRPr)]) ?? 0;
    const colorHex = firstNonNull([parseColorHex(rPr), parseColorHex(rStyleRPr), parseColorHex(pRPr), parseColorHex(styleRPr)]);
    return { bold, italic, underline, highlightVal: highlightVal ?? null, fontName, fontSizePt, colorHex: colorHex ?? null };
}
//# sourceMappingURL=styles.js.map