/**
 * OOXML namespace constants for Word document manipulation.
 *
 * Ported from: app/shared/document_primitives/ooxml/namespaces.py
 *
 * Central definitions for all WordprocessingML namespaces and qualified element names.
 * This ensures consistent namespace handling across all XML operations.
 *
 * Reference: ECMA-376 Office Open XML File Formats
 */
/** Main WordprocessingML namespace */
export declare const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
/** Relationship namespace (for hyperlinks, etc.) */
export declare const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/** Extended properties namespace */
export declare const WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
/** Drawing namespace */
export declare const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
/** VML namespace (legacy drawing) */
export declare const V_NS = "urn:schemas-microsoft-com:vml";
/** Math namespace */
export declare const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
export declare const NSMAP: Record<string, string>;
/** Reverse map for looking up prefixes */
export declare const PREFIX_MAP: Record<string, string>;
export declare const W_BODY = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body";
export declare const W_DOCUMENT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}document";
export declare const W_SECTPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sectPr";
export declare const W_P = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p";
export declare const W_PPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr";
export declare const W_PSTYLE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pStyle";
export declare const W_JC = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}jc";
export declare const W_R = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r";
export declare const W_RPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr";
export declare const W_T = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t";
export declare const W_BR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}br";
export declare const W_TAB = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tab";
export declare const W_B = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}b";
export declare const W_B_CS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bCs";
export declare const W_I = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}i";
export declare const W_I_CS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}iCs";
export declare const W_U = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}u";
export declare const W_STRIKE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}strike";
export declare const W_DSTRIKE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}dstrike";
export declare const W_CAPS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}caps";
export declare const W_SMALLCAPS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}smallCaps";
export declare const W_VANISH = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vanish";
export declare const W_RFONTS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts";
export declare const W_SZ = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz";
export declare const W_SZ_CS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}szCs";
export declare const W_COLOR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}color";
export declare const W_HIGHLIGHT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}highlight";
export declare const W_SHD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}shd";
export declare const W_RSTYLE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rStyle";
export declare const W_BOOKMARK_START = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bookmarkStart";
export declare const W_BOOKMARK_END = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bookmarkEnd";
export declare const W_FLDCHAR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fldChar";
export declare const W_FLDCHARTYPE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fldCharType";
export declare const W_INSTRTEXT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}instrText";
export declare const W_FLDSIMPLE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fldSimple";
export declare const W_DIRTY = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}dirty";
export declare const W_HYPERLINK = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hyperlink";
export declare const W_NUMPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numPr";
export declare const W_ILVL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ilvl";
export declare const W_NUMID = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numId";
export declare const W_TBL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl";
export declare const W_TR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr";
export declare const W_TC = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc";
export declare const W_TBLPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tblPr";
export declare const W_TCPR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tcPr";
export declare const W_SECTTYPE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type";
export declare const W_HEADERREFERENCE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}headerReference";
export declare const W_FOOTERREFERENCE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}footerReference";
export declare const W_COMMENT_RANGE_START = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}commentRangeStart";
export declare const W_COMMENT_RANGE_END = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}commentRangeEnd";
export declare const W_INS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ins";
export declare const W_DEL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}del";
export declare const W_DELTEXT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}delText";
export declare const W_MOVEFROM = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}moveFrom";
export declare const W_MOVETO = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}moveTo";
export declare const W_RPRCHANGE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPrChange";
export declare const W_PPRCHANGE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPrChange";
export declare const R_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id";
export declare const W_ID = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}id";
export declare const W_NAME = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}name";
export declare const W_AUTHOR = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}author";
export declare const W_DATE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}date";
export declare const W_VAL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val";
export declare const UNDERLINE_NONE = "none";
export declare const UNDERLINE_SINGLE = "single";
export declare const UNDERLINE_DOUBLE = "double";
export declare const UNDERLINE_DOTTED = "dotted";
export declare const UNDERLINE_DASHED = "dash";
export declare const UNDERLINE_WAVY = "wave";
export declare const UNDERLINE_WORDS = "words";
export declare const ALIGN_LEFT = "left";
export declare const ALIGN_CENTER = "center";
export declare const ALIGN_RIGHT = "right";
export declare const ALIGN_JUSTIFY = "both";
export declare const FLDCHAR_BEGIN = "begin";
export declare const FLDCHAR_SEPARATE = "separate";
export declare const FLDCHAR_END = "end";
export declare const HIGHLIGHT_YELLOW = "yellow";
export declare const HIGHLIGHT_GREEN = "green";
export declare const HIGHLIGHT_CYAN = "cyan";
export declare const HIGHLIGHT_MAGENTA = "magenta";
export declare const HIGHLIGHT_BLUE = "blue";
export declare const HIGHLIGHT_RED = "red";
export declare const HIGHLIGHT_DARK_BLUE = "darkBlue";
export declare const HIGHLIGHT_DARK_CYAN = "darkCyan";
export declare const HIGHLIGHT_DARK_GREEN = "darkGreen";
export declare const HIGHLIGHT_DARK_MAGENTA = "darkMagenta";
export declare const HIGHLIGHT_DARK_RED = "darkRed";
export declare const HIGHLIGHT_DARK_YELLOW = "darkYellow";
export declare const HIGHLIGHT_DARK_GRAY = "darkGray";
export declare const HIGHLIGHT_LIGHT_GRAY = "lightGray";
export declare const HIGHLIGHT_BLACK = "black";
export declare const HIGHLIGHT_NONE = "none";
/**
 * Convert Clark notation to prefixed notation.
 *
 * @param clarkName - Element name in Clark notation, e.g., '{http://...}p'
 * @returns Prefixed name, e.g., 'w:p'
 *
 * @example
 * clarkToPrefixed(W_P) // => 'w:p'
 */
export declare function clarkToPrefixed(clarkName: string): string;
/**
 * Convert prefixed notation to Clark notation.
 *
 * @param prefixedName - Element name with prefix, e.g., 'w:p'
 * @returns Clark notation name, e.g., '{http://...}p'
 *
 * @example
 * prefixedToClark('w:p') // => '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'
 */
export declare function prefixedToClark(prefixedName: string): string;
/**
 * Extract local name from Clark notation.
 *
 * @param clarkName - Element name in Clark notation
 * @returns Local name without namespace
 *
 * @example
 * localName(W_P) // => 'p'
 */
export declare function localName(clarkName: string): string;
//# sourceMappingURL=namespaces.d.ts.map