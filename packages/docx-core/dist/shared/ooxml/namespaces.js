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
// =============================================================================
// Namespace URIs
// =============================================================================
/** Main WordprocessingML namespace */
export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
/** Relationship namespace (for hyperlinks, etc.) */
export const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Extended properties namespace */
export const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
/** Drawing namespace */
export const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
/** VML namespace (legacy drawing) */
export const V_NS = 'urn:schemas-microsoft-com:vml';
/** Math namespace */
export const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
// =============================================================================
// Namespace Map
// =============================================================================
export const NSMAP = {
    w: W_NS,
    r: R_NS,
    wp: WP_NS,
    a: A_NS,
    v: V_NS,
    m: M_NS,
};
/** Reverse map for looking up prefixes */
export const PREFIX_MAP = Object.fromEntries(Object.entries(NSMAP).map(([k, v]) => [v, k]));
// =============================================================================
// Qualified Element Names (Clark notation)
// =============================================================================
// Document structure
export const W_BODY = `{${W_NS}}body`;
export const W_DOCUMENT = `{${W_NS}}document`;
export const W_SECTPR = `{${W_NS}}sectPr`; // Section properties
// Paragraph elements
export const W_P = `{${W_NS}}p`; // Paragraph
export const W_PPR = `{${W_NS}}pPr`; // Paragraph properties
export const W_PSTYLE = `{${W_NS}}pStyle`; // Paragraph style reference
export const W_JC = `{${W_NS}}jc`; // Paragraph justification/alignment
// Run elements
export const W_R = `{${W_NS}}r`; // Run
export const W_RPR = `{${W_NS}}rPr`; // Run properties
export const W_T = `{${W_NS}}t`; // Text
export const W_BR = `{${W_NS}}br`; // Break
export const W_TAB = `{${W_NS}}tab`; // Tab character
// Run formatting
export const W_B = `{${W_NS}}b`; // Bold
export const W_B_CS = `{${W_NS}}bCs`; // Bold (complex script)
export const W_I = `{${W_NS}}i`; // Italic
export const W_I_CS = `{${W_NS}}iCs`; // Italic (complex script)
export const W_U = `{${W_NS}}u`; // Underline
export const W_STRIKE = `{${W_NS}}strike`; // Strikethrough
export const W_DSTRIKE = `{${W_NS}}dstrike`; // Double strikethrough
export const W_CAPS = `{${W_NS}}caps`; // All caps
export const W_SMALLCAPS = `{${W_NS}}smallCaps`; // Small caps
export const W_VANISH = `{${W_NS}}vanish`; // Hidden text
// Font properties
export const W_RFONTS = `{${W_NS}}rFonts`; // Font family
export const W_SZ = `{${W_NS}}sz`; // Font size (half-points)
export const W_SZ_CS = `{${W_NS}}szCs`; // Font size complex script
export const W_COLOR = `{${W_NS}}color`; // Text color
export const W_HIGHLIGHT = `{${W_NS}}highlight`; // Highlight color
export const W_SHD = `{${W_NS}}shd`; // Shading (background)
export const W_RSTYLE = `{${W_NS}}rStyle`; // Character style reference
// Bookmarks
export const W_BOOKMARK_START = `{${W_NS}}bookmarkStart`;
export const W_BOOKMARK_END = `{${W_NS}}bookmarkEnd`;
// Fields
export const W_FLDCHAR = `{${W_NS}}fldChar`; // Field character
export const W_FLDCHARTYPE = `{${W_NS}}fldCharType`; // Field char type attr
export const W_INSTRTEXT = `{${W_NS}}instrText`; // Instruction text
export const W_FLDSIMPLE = `{${W_NS}}fldSimple`; // Simple field
export const W_DIRTY = `{${W_NS}}dirty`; // Field needs update
// Hyperlinks
export const W_HYPERLINK = `{${W_NS}}hyperlink`;
// Lists
export const W_NUMPR = `{${W_NS}}numPr`; // Numbering properties
export const W_ILVL = `{${W_NS}}ilvl`; // Indentation level
export const W_NUMID = `{${W_NS}}numId`; // Numbering ID
// Tables
export const W_TBL = `{${W_NS}}tbl`; // Table
export const W_TR = `{${W_NS}}tr`; // Table row
export const W_TC = `{${W_NS}}tc`; // Table cell
export const W_TBLPR = `{${W_NS}}tblPr`; // Table properties
export const W_TCPR = `{${W_NS}}tcPr`; // Cell properties
// Headers/Footers
export const W_SECTTYPE = `{${W_NS}}type`;
export const W_HEADERREFERENCE = `{${W_NS}}headerReference`;
export const W_FOOTERREFERENCE = `{${W_NS}}footerReference`;
// Comments
export const W_COMMENT_RANGE_START = `{${W_NS}}commentRangeStart`;
export const W_COMMENT_RANGE_END = `{${W_NS}}commentRangeEnd`;
// =============================================================================
// Track Changes Elements (NEW - not in Python original)
// =============================================================================
export const W_INS = `{${W_NS}}ins`; // Insertion
export const W_DEL = `{${W_NS}}del`; // Deletion
export const W_DELTEXT = `{${W_NS}}delText`; // Deleted text content
export const W_MOVEFROM = `{${W_NS}}moveFrom`; // Move source
export const W_MOVETO = `{${W_NS}}moveTo`; // Move destination
export const W_RPRCHANGE = `{${W_NS}}rPrChange`; // Run properties change
export const W_PPRCHANGE = `{${W_NS}}pPrChange`; // Paragraph properties change
// Relationship attributes
export const R_ID = `{${R_NS}}id`;
// =============================================================================
// Common Attribute Names
// =============================================================================
// Bookmark attributes
export const W_ID = `{${W_NS}}id`;
export const W_NAME = `{${W_NS}}name`;
// Track changes attributes
export const W_AUTHOR = `{${W_NS}}author`;
export const W_DATE = `{${W_NS}}date`;
// General attributes
export const W_VAL = `{${W_NS}}val`;
// Underline types (for w:u/@w:val)
export const UNDERLINE_NONE = 'none';
export const UNDERLINE_SINGLE = 'single';
export const UNDERLINE_DOUBLE = 'double';
export const UNDERLINE_DOTTED = 'dotted';
export const UNDERLINE_DASHED = 'dash';
export const UNDERLINE_WAVY = 'wave';
export const UNDERLINE_WORDS = 'words';
// Alignment values (for w:jc/@w:val)
export const ALIGN_LEFT = 'left';
export const ALIGN_CENTER = 'center';
export const ALIGN_RIGHT = 'right';
export const ALIGN_JUSTIFY = 'both';
// Field character types (for w:fldChar/@w:fldCharType)
export const FLDCHAR_BEGIN = 'begin';
export const FLDCHAR_SEPARATE = 'separate';
export const FLDCHAR_END = 'end';
// Highlight color names (for w:highlight/@w:val)
export const HIGHLIGHT_YELLOW = 'yellow';
export const HIGHLIGHT_GREEN = 'green';
export const HIGHLIGHT_CYAN = 'cyan';
export const HIGHLIGHT_MAGENTA = 'magenta';
export const HIGHLIGHT_BLUE = 'blue';
export const HIGHLIGHT_RED = 'red';
export const HIGHLIGHT_DARK_BLUE = 'darkBlue';
export const HIGHLIGHT_DARK_CYAN = 'darkCyan';
export const HIGHLIGHT_DARK_GREEN = 'darkGreen';
export const HIGHLIGHT_DARK_MAGENTA = 'darkMagenta';
export const HIGHLIGHT_DARK_RED = 'darkRed';
export const HIGHLIGHT_DARK_YELLOW = 'darkYellow';
export const HIGHLIGHT_DARK_GRAY = 'darkGray';
export const HIGHLIGHT_LIGHT_GRAY = 'lightGray';
export const HIGHLIGHT_BLACK = 'black';
export const HIGHLIGHT_NONE = 'none';
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Convert Clark notation to prefixed notation.
 *
 * @param clarkName - Element name in Clark notation, e.g., '{http://...}p'
 * @returns Prefixed name, e.g., 'w:p'
 *
 * @example
 * clarkToPrefixed(W_P) // => 'w:p'
 */
export function clarkToPrefixed(clarkName) {
    if (clarkName.startsWith('{')) {
        const nsEnd = clarkName.indexOf('}');
        if (nsEnd !== -1) {
            const ns = clarkName.slice(1, nsEnd);
            const local = clarkName.slice(nsEnd + 1);
            const prefix = PREFIX_MAP[ns];
            if (prefix) {
                return `${prefix}:${local}`;
            }
        }
    }
    return clarkName;
}
/**
 * Convert prefixed notation to Clark notation.
 *
 * @param prefixedName - Element name with prefix, e.g., 'w:p'
 * @returns Clark notation name, e.g., '{http://...}p'
 *
 * @example
 * prefixedToClark('w:p') // => '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'
 */
export function prefixedToClark(prefixedName) {
    if (prefixedName.includes(':')) {
        const [prefix, local] = prefixedName.split(':', 2);
        const ns = NSMAP[prefix];
        if (ns) {
            return `{${ns}}${local}`;
        }
    }
    return prefixedName;
}
/**
 * Extract local name from Clark notation.
 *
 * @param clarkName - Element name in Clark notation
 * @returns Local name without namespace
 *
 * @example
 * localName(W_P) // => 'p'
 */
export function localName(clarkName) {
    if (clarkName.startsWith('{')) {
        const nsEnd = clarkName.indexOf('}');
        if (nsEnd !== -1) {
            return clarkName.slice(nsEnd + 1);
        }
    }
    return clarkName;
}
//# sourceMappingURL=namespaces.js.map