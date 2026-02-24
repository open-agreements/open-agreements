/**
 * Baseline B: Track changes OOXML renderer.
 *
 * Generates OOXML track changes markup (w:ins, w:del) from diff results.
 */
/** ID allocator for revision IDs */
let nextRevisionId = 1;
/**
 * Reset the revision ID counter.
 */
export function resetRevisionIds() {
    nextRevisionId = 1;
}
/**
 * Allocate a new revision ID.
 */
export function allocateRevisionId() {
    return nextRevisionId++;
}
/**
 * Format a date for OOXML (ISO 8601 format).
 */
export function formatOoxmlDate(date) {
    return date.toISOString().replace('Z', 'Z');
}
/**
 * Escape XML special characters.
 */
export function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
/**
 * Generate run properties XML.
 */
function generateRunProperties(run) {
    if (!run.properties) {
        return '';
    }
    const props = [];
    const p = run.properties;
    if (p.bold) {
        props.push('<w:b/>');
    }
    if (p.italic) {
        props.push('<w:i/>');
    }
    if (p.underline) {
        props.push(`<w:u w:val="${escapeXml(p.underline)}"/>`);
    }
    if (p.strikethrough) {
        props.push('<w:strike/>');
    }
    if (p.highlight) {
        props.push(`<w:highlight w:val="${escapeXml(p.highlight)}"/>`);
    }
    if (p.color) {
        props.push(`<w:color w:val="${escapeXml(p.color)}"/>`);
    }
    if (p.fontSize !== undefined) {
        props.push(`<w:sz w:val="${p.fontSize}"/>`);
    }
    if (p.fontFamily) {
        props.push(`<w:rFonts w:ascii="${escapeXml(p.fontFamily)}" w:hAnsi="${escapeXml(p.fontFamily)}"/>`);
    }
    if (props.length === 0) {
        return '';
    }
    return `<w:rPr>${props.join('')}</w:rPr>`;
}
/**
 * Generate a single run's XML.
 */
function generateRunXml(text, run, useDelText = false) {
    const rPr = generateRunProperties(run);
    const textElement = useDelText ? 'w:delText' : 'w:t';
    // Handle whitespace preservation
    const needsSpace = text.startsWith(' ') || text.endsWith(' ') || text.includes('  ');
    const spaceAttr = needsSpace ? ' xml:space="preserve"' : '';
    return `<w:r>${rPr}<${textElement}${spaceAttr}>${escapeXml(text)}</${textElement}></w:r>`;
}
/**
 * Generate insertion markup.
 */
export function generateInsertion(runs, author, date) {
    const id = allocateRevisionId();
    const dateStr = formatOoxmlDate(date);
    const runXml = runs.map(run => generateRunXml(run.text, run, false)).join('');
    return `<w:ins w:id="${id}" w:author="${escapeXml(author)}" w:date="${dateStr}">${runXml}</w:ins>`;
}
/**
 * Generate deletion markup.
 */
export function generateDeletion(runs, author, date) {
    const id = allocateRevisionId();
    const dateStr = formatOoxmlDate(date);
    // Deletions use w:delText instead of w:t
    const runXml = runs.map(run => generateRunXml(run.text, run, true)).join('');
    return `<w:del w:id="${id}" w:author="${escapeXml(author)}" w:date="${dateStr}">${runXml}</w:del>`;
}
/**
 * Generate unchanged run markup.
 */
export function generateUnchangedRun(run) {
    return generateRunXml(run.text, run, false);
}
/**
 * Render merged runs with track changes to OOXML.
 *
 * @param mergedRuns - Runs with revision markers from diffRuns()
 * @param options - Rendering options
 * @returns OOXML paragraph content with track changes
 */
export function renderTrackChanges(mergedRuns, options) {
    const { author, date } = options;
    const parts = [];
    // Group consecutive runs by revision type for cleaner output
    let i = 0;
    while (i < mergedRuns.length) {
        const run = mergedRuns[i];
        const revType = run.revision?.type;
        if (!revType) {
            // Unchanged run
            parts.push(generateUnchangedRun(run));
            i++;
        }
        else if (revType === 'insertion') {
            // Collect consecutive insertions
            const insertionRuns = [];
            while (i < mergedRuns.length && mergedRuns[i]?.revision?.type === 'insertion') {
                insertionRuns.push(mergedRuns[i]);
                i++;
            }
            parts.push(generateInsertion(insertionRuns, author, date));
        }
        else if (revType === 'deletion') {
            // Collect consecutive deletions
            const deletionRuns = [];
            while (i < mergedRuns.length && mergedRuns[i]?.revision?.type === 'deletion') {
                deletionRuns.push(mergedRuns[i]);
                i++;
            }
            parts.push(generateDeletion(deletionRuns, author, date));
        }
        else {
            // Unknown revision type, treat as unchanged
            parts.push(generateUnchangedRun(run));
            i++;
        }
    }
    return parts.join('');
}
/**
 * Wrap content in a paragraph element.
 */
export function wrapInParagraph(content, pPr) {
    const pPrXml = pPr ? `<w:pPr>${pPr}</w:pPr>` : '';
    return `<w:p>${pPrXml}${content}</w:p>`;
}
/**
 * Generate a complete deleted paragraph.
 */
export function generateDeletedParagraph(runs, author, date, pPr) {
    const content = generateDeletion(runs, author, date);
    return wrapInParagraph(content, pPr);
}
/**
 * Generate a complete inserted paragraph.
 */
export function generateInsertedParagraph(runs, author, date, pPr) {
    const content = generateInsertion(runs, author, date);
    return wrapInParagraph(content, pPr);
}
//# sourceMappingURL=trackChangesRenderer.js.map