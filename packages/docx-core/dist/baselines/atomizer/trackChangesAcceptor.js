/**
 * Track Changes Acceptor/Rejector
 *
 * Utilities to accept or reject all track changes in a document.
 * Used for round-trip testing to verify comparison correctness.
 */
/**
 * Accept all track changes in document XML.
 *
 * - Removes w:del elements entirely (deleted content disappears)
 * - Unwraps w:ins elements (inserted content becomes normal)
 * - Handles w:moveFrom (remove) and w:moveTo (unwrap)
 * - Converts w:delText back to w:t where needed
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes accepted
 */
export function acceptAllChanges(documentXml) {
    let result = documentXml;
    // Remove w:del elements entirely (including their content)
    // This regex handles nested content
    result = removeElements(result, 'w:del');
    // Remove w:moveFrom elements entirely
    result = removeElements(result, 'w:moveFrom');
    // Remove move range markers
    result = result.replace(/<w:moveFromRangeStart[^>]*\/>/g, '');
    result = result.replace(/<w:moveFromRangeEnd[^>]*\/>/g, '');
    result = result.replace(/<w:moveToRangeStart[^>]*\/>/g, '');
    result = result.replace(/<w:moveToRangeEnd[^>]*\/>/g, '');
    // Unwrap w:ins elements (keep content, remove wrapper)
    result = unwrapElements(result, 'w:ins');
    // Unwrap w:moveTo elements
    result = unwrapElements(result, 'w:moveTo');
    // Remove rPrChange elements (format change tracking)
    result = removeElements(result, 'w:rPrChange');
    // Remove pPrChange elements (paragraph property change tracking)
    result = removeElements(result, 'w:pPrChange');
    // Remove paragraphs that became empty after removing deleted content
    // These are paragraphs that have no w:t elements (no text content)
    result = removeEmptyParagraphs(result);
    return result;
}
/**
 * Reject all track changes in document XML.
 *
 * - Removes w:ins elements entirely (inserted content disappears)
 * - Unwraps w:del elements and converts w:delText to w:t
 * - Handles w:moveFrom (unwrap) and w:moveTo (remove)
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes rejected
 */
export function rejectAllChanges(documentXml) {
    let result = documentXml;
    // Remove w:ins elements entirely (including their content)
    result = removeElements(result, 'w:ins');
    // Remove w:moveTo elements entirely
    result = removeElements(result, 'w:moveTo');
    // Remove move range markers
    result = result.replace(/<w:moveFromRangeStart[^>]*\/>/g, '');
    result = result.replace(/<w:moveFromRangeEnd[^>]*\/>/g, '');
    result = result.replace(/<w:moveToRangeStart[^>]*\/>/g, '');
    result = result.replace(/<w:moveToRangeEnd[^>]*\/>/g, '');
    // Unwrap w:del elements (keep content, remove wrapper)
    result = unwrapElements(result, 'w:del');
    // Unwrap w:moveFrom elements
    result = unwrapElements(result, 'w:moveFrom');
    // Convert w:delText to w:t
    result = result.replace(/<w:delText([^>]*)>/g, '<w:t$1>');
    result = result.replace(/<\/w:delText>/g, '</w:t>');
    // Remove rPrChange elements but keep the current properties
    result = removeElements(result, 'w:rPrChange');
    // For pPrChange, we need to restore original properties
    // This is complex - for now just remove the change tracking
    result = removeElements(result, 'w:pPrChange');
    return result;
}
/**
 * Remove elements and their content from XML.
 * Uses regex for reliable matching.
 * Uses word boundary matching to avoid matching tags with similar prefixes.
 */
function removeElements(xml, tagName) {
    // Handle self-closing tags
    // Match <tagName followed by optional attributes, then />
    // Uses word boundary: tagName must be followed by \s, /, or >
    const selfClosingRegex = new RegExp(`<${tagName}(\\s[^>]*)?\\/\\s*>`, 'g');
    let result = xml.replace(selfClosingRegex, '');
    // Handle elements with content - use recursive approach for nesting
    // Match the opening tag (with word boundary), then non-greedy content, then closing tag
    // This may need multiple passes for nested elements
    const regex = new RegExp(`<${tagName}(\\s[^>]*)?>[\\s\\S]*?</${tagName}>`, 'g');
    let prevLength = 0;
    while (result.length !== prevLength) {
        prevLength = result.length;
        result = result.replace(regex, '');
    }
    return result;
}
/**
 * Unwrap elements - remove the wrapper but keep the content.
 * Uses word boundary matching to avoid matching tags with similar prefixes
 * (e.g., w:del should not match w:delText)
 */
function unwrapElements(xml, tagName) {
    let result = xml;
    // Remove opening tags with attributes
    // Match <tagName followed by whitespace, /, or > to avoid matching longer tag names
    // e.g., <w:del should not match <w:delText
    const openTagRegex = new RegExp(`<${tagName}(\\s[^>]*)?>`, 'g');
    result = result.replace(openTagRegex, '');
    // Remove closing tags (exact match)
    const closeTagRegex = new RegExp(`</${tagName}>`, 'g');
    result = result.replace(closeTagRegex, '');
    return result;
}
/**
 * Remove paragraphs that have no text content.
 * A paragraph is considered empty if it has no w:t elements.
 * This is used after accepting changes to clean up paragraphs
 * that only contained deleted content.
 */
function removeEmptyParagraphs(xml) {
    // Match each paragraph and check if it has any w:t elements
    const pRegex = /<w:p(\s[^>]*)?>[\s\S]*?<\/w:p>/g;
    return xml.replace(pRegex, (match) => {
        // Check if the paragraph has any w:t elements (text content)
        const hasText = /<w:t[^>]*>/.test(match);
        // Check if it has any tabs or breaks (these are content too)
        const hasTab = /<w:tab\/>/.test(match);
        const hasBreak = /<w:br[^>]*\/>/.test(match);
        // Check for symbols (special characters)
        const hasSymbol = /<w:sym\s/.test(match);
        // Check for drawings (images, shapes)
        const hasDrawing = /<w:drawing>/.test(match);
        // Keep the paragraph if it has any content
        if (hasText || hasTab || hasBreak || hasSymbol || hasDrawing) {
            return match;
        }
        // Remove empty paragraphs
        return '';
    });
}
/**
 * Extract plain text content from document XML.
 *
 * @param documentXml - The document.xml content
 * @returns Plain text content
 */
export function extractTextContent(documentXml) {
    const texts = [];
    // Extract text from w:t elements
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = tRegex.exec(documentXml)) !== null) {
        texts.push(match[1] ?? '');
    }
    // Also extract from w:delText (for rejected changes)
    const delTextRegex = /<w:delText[^>]*>([^<]*)<\/w:delText>/g;
    while ((match = delTextRegex.exec(documentXml)) !== null) {
        texts.push(match[1] ?? '');
    }
    return texts.join('');
}
/**
 * Extract text in document order, respecting paragraph breaks.
 */
export function extractTextWithParagraphs(documentXml) {
    const paragraphs = [];
    // Match each paragraph
    const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(documentXml)) !== null) {
        const pContent = pMatch[1] ?? '';
        const texts = [];
        // Extract text from w:t elements within this paragraph
        const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(pContent)) !== null) {
            texts.push(tMatch[1] ?? '');
        }
        // Also check w:delText
        const delTextRegex = /<w:delText[^>]*>([^<]*)<\/w:delText>/g;
        while ((tMatch = delTextRegex.exec(pContent)) !== null) {
            texts.push(tMatch[1] ?? '');
        }
        // Handle tabs and breaks
        const tabCount = (pContent.match(/<w:tab\/>/g) || []).length;
        const brCount = (pContent.match(/<w:br\/>/g) || []).length;
        let paraText = texts.join('');
        // Add tabs and breaks (simplified - in actual order would need more parsing)
        paraText += '\t'.repeat(tabCount);
        paraText += '\n'.repeat(brCount);
        paragraphs.push(paraText);
    }
    return paragraphs.join('\n');
}
/**
 * Normalize text for comparison (handles whitespace differences).
 *
 * Performs the following normalization:
 * - Convert CRLF and CR to LF
 * - Convert tabs to spaces
 * - Collapse multiple spaces to single space
 * - Strip trailing spaces from each line
 * - Collapse multiple newlines to single newline
 * - Trim leading/trailing whitespace
 */
export function normalizeText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/ +/g, ' ')
        .replace(/ \n/g, '\n') // Strip trailing spaces from lines
        .replace(/\n /g, '\n') // Strip leading spaces from lines
        .replace(/\n+/g, '\n')
        .trim();
}
/**
 * Compare two texts and return detailed differences.
 */
export function compareTexts(expected, actual) {
    const normalizedExpected = normalizeText(expected);
    const normalizedActual = normalizeText(actual);
    const differences = [];
    if (expected !== actual) {
        // Find first difference
        let firstDiff = 0;
        while (firstDiff < expected.length && firstDiff < actual.length) {
            if (expected[firstDiff] !== actual[firstDiff]) {
                break;
            }
            firstDiff++;
        }
        if (firstDiff < expected.length || firstDiff < actual.length) {
            const context = 50;
            const start = Math.max(0, firstDiff - context);
            const expectedSnippet = expected.slice(start, firstDiff + context);
            const actualSnippet = actual.slice(start, firstDiff + context);
            differences.push(`First difference at position ${firstDiff}:`);
            differences.push(`  Expected: "...${expectedSnippet}..."`);
            differences.push(`  Actual:   "...${actualSnippet}..."`);
        }
    }
    return {
        identical: expected === actual,
        normalizedIdentical: normalizedExpected === normalizedActual,
        expectedLength: expected.length,
        actualLength: actual.length,
        differences,
    };
}
//# sourceMappingURL=trackChangesAcceptor.js.map