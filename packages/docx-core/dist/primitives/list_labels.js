// Port of Python workflows/shared/list_label_utils.py (subset) for Safe-Docx TS.
//
// Used to extract/strip text-formatted list labels (non-auto-numbered) and to
// classify computed labels for style inference.
export var LabelType;
(function (LabelType) {
    LabelType["LETTER"] = "letter";
    LabelType["ROMAN"] = "roman";
    LabelType["NUMBER"] = "number";
    LabelType["SECTION"] = "section";
    LabelType["ARTICLE"] = "article";
    LabelType["NUMBERED_HEADING"] = "numbered_heading";
})(LabelType || (LabelType = {}));
const LETTER_LABEL_RE = /^\(([a-zA-Z]+)\)\s*/;
const ROMAN_LABEL_RE = /^\(([ivxlcdm]+)\)\s*/i;
const NUMBER_LABEL_RE = /^\((\d+)\)\s*/;
const SECTION_LABEL_RE = /^(Section)\s+[\d.]+(?:\([a-z]\))?/i;
const ARTICLE_LABEL_RE = /^(Article)\s+[\dIVXLCDM.]+/i;
const NUMBERED_HEADING_RE = /^(\d+(?:\.\d+)*)[.)]\s*/;
function isRomanNumeralCandidate(s) {
    if (!/^[ivxlcdm]+$/i.test(s))
        return false;
    // Single char should be treated as letter in legal docs: (i), (v), (x)
    return s.length > 1;
}
export function extractListLabel(text) {
    if (!text)
        return { label: null, label_type: null, match_end: 0 };
    let m = SECTION_LABEL_RE.exec(text);
    if (m)
        return { label: m[0].trim(), label_type: LabelType.SECTION, match_end: m[0].length };
    m = ARTICLE_LABEL_RE.exec(text);
    if (m)
        return { label: m[0].trim(), label_type: LabelType.ARTICLE, match_end: m[0].length };
    m = NUMBERED_HEADING_RE.exec(text);
    if (m)
        return { label: m[0].trim(), label_type: LabelType.NUMBERED_HEADING, match_end: m[0].length };
    m = NUMBER_LABEL_RE.exec(text);
    if (m)
        return { label: `(${m[1]})`, label_type: LabelType.NUMBER, match_end: m[0].length };
    m = ROMAN_LABEL_RE.exec(text);
    if (m && isRomanNumeralCandidate(m[1])) {
        return { label: `(${m[1]})`, label_type: LabelType.ROMAN, match_end: m[0].length };
    }
    m = LETTER_LABEL_RE.exec(text);
    if (m)
        return { label: `(${m[1]})`, label_type: LabelType.LETTER, match_end: m[0].length };
    return { label: null, label_type: null, match_end: 0 };
}
export function stripListLabel(text) {
    const result = extractListLabel(text);
    if (result.label) {
        return { stripped_text: text.slice(result.match_end).trimStart(), result };
    }
    return { stripped_text: text, result };
}
//# sourceMappingURL=list_labels.js.map