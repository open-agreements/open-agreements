export const OOXML = {
    // Main WordprocessingML namespace.
    W_NS: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    // Relationships, package, etc. kept for future parts.
    REL_NS: 'http://schemas.openxmlformats.org/package/2006/relationships',
    // Relationship namespace used inside .rels parts (document relationships).
    R_NS: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    // Hyperlink relationship type URI.
    HYPERLINK_REL_TYPE: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
    // Word 2010 extensions (paraId attributes).
    W14_NS: 'http://schemas.microsoft.com/office/word/2010/wordml',
    // Word 2012 extensions (commentsExtended, threaded replies).
    W15_NS: 'http://schemas.microsoft.com/office/word/2012/wordml',
    // People part namespace.
    WPC_NS: 'http://schemas.microsoft.com/office/word/2012/wordml',
    // Content-types part namespace.
    CT_NS: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
export const W = {
    document: 'document',
    body: 'body',
    p: 'p',
    r: 'r',
    t: 't',
    pPr: 'pPr',
    rPr: 'rPr',
    bookmarkStart: 'bookmarkStart',
    bookmarkEnd: 'bookmarkEnd',
    // Paragraph formatting
    pStyle: 'pStyle',
    jc: 'jc',
    ind: 'ind',
    spacing: 'spacing',
    before: 'before',
    after: 'after',
    line: 'line',
    lineRule: 'lineRule',
    // Run formatting
    rFonts: 'rFonts',
    b: 'b',
    i: 'i',
    u: 'u',
    highlight: 'highlight',
    sz: 'sz',
    color: 'color',
    vertAlign: 'vertAlign',
    position: 'position',
    // Styles part
    style: 'style',
    name: 'name',
    basedOn: 'basedOn',
    // Numbering
    numPr: 'numPr',
    numId: 'numId',
    ilvl: 'ilvl',
    numbering: 'numbering',
    abstractNum: 'abstractNum',
    lvl: 'lvl',
    start: 'start',
    numFmt: 'numFmt',
    lvlText: 'lvlText',
    suff: 'suff',
    num: 'num',
    abstractNumId: 'abstractNumId',
    lvlOverride: 'lvlOverride',
    startOverride: 'startOverride',
    // Tables + layout
    tbl: 'tbl',
    tr: 'tr',
    tc: 'tc',
    trPr: 'trPr',
    tcPr: 'tcPr',
    trHeight: 'trHeight',
    tcMar: 'tcMar',
    top: 'top',
    bottom: 'bottom',
    left: 'left',
    right: 'right',
    val: 'val',
    hRule: 'hRule',
    w: 'w',
    type: 'type',
    // Fields + special runs
    fldChar: 'fldChar',
    instrText: 'instrText',
    fldSimple: 'fldSimple',
    tab: 'tab',
    br: 'br',
    // Hyperlinks + character styles
    hyperlink: 'hyperlink',
    rStyle: 'rStyle',
    // Comments
    comment: 'comment',
    comments: 'comments',
    commentRangeStart: 'commentRangeStart',
    commentRangeEnd: 'commentRangeEnd',
    commentReference: 'commentReference',
    annotationRef: 'annotationRef',
    // Footnotes
    footnote: 'footnote',
    footnotes: 'footnotes',
    footnoteReference: 'footnoteReference',
    footnoteRef: 'footnoteRef',
    separator: 'separator',
    continuationSeparator: 'continuationSeparator',
};
//# sourceMappingURL=namespaces.js.map