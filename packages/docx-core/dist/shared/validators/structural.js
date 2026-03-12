/**
 * Structural OOXML validators.
 *
 * General-purpose integrity checks for numbering, footnotes/endnotes,
 * and bookmarks. Used by both integration tests and the quality benchmark.
 */
import { parseXml } from '../../primitives/xml.js';
import { findAllByTagName, childElements } from '../../primitives/dom-helpers.js';
// ── Helpers ─────────────────────────────────────────────────────────
export function collectIds(root, tagName, attributeName) {
    const values = new Set();
    const duplicateValues = new Set();
    for (const node of findAllByTagName(root, tagName)) {
        const value = node.getAttribute(attributeName);
        if (!value) {
            continue;
        }
        if (values.has(value)) {
            duplicateValues.add(value);
        }
        else {
            values.add(value);
        }
    }
    return { values, duplicates: Array.from(duplicateValues).sort() };
}
// ── Validators ──────────────────────────────────────────────────────
export function validateNumberingIntegrity(documentXml, numberingXml) {
    const documentRoot = parseXml(documentXml).documentElement;
    const numRefIds = collectIds(documentRoot, 'w:numId', 'w:val').values;
    const ilvlNodes = findAllByTagName(documentRoot, 'w:ilvl');
    const invalidLevels = [];
    for (const node of ilvlNodes) {
        const rawLevel = node.getAttribute('w:val');
        if (!rawLevel) {
            continue;
        }
        const parsed = Number.parseInt(rawLevel, 10);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 8) {
            invalidLevels.push(rawLevel);
        }
    }
    if (!numberingXml) {
        return {
            missingNumIds: Array.from(numRefIds).sort(),
            missingAbstractNumIds: [],
            invalidLevels: invalidLevels.sort(),
        };
    }
    const numberingRoot = parseXml(numberingXml).documentElement;
    const numDefinitions = collectIds(numberingRoot, 'w:num', 'w:numId').values;
    const abstractDefinitions = collectIds(numberingRoot, 'w:abstractNum', 'w:abstractNumId').values;
    const abstractRefs = new Set();
    for (const numNode of findAllByTagName(numberingRoot, 'w:num')) {
        const abstractNode = childElements(numNode).find((child) => child.tagName === 'w:abstractNumId');
        const abstractId = abstractNode?.getAttribute('w:val');
        if (abstractId) {
            abstractRefs.add(abstractId);
        }
    }
    // In WordprocessingML, numId="0" is a sentinel that means "no numbering".
    const missingNumIds = Array.from(numRefIds)
        .filter((id) => id !== '0' && !numDefinitions.has(id))
        .sort();
    const missingAbstractNumIds = Array.from(abstractRefs)
        .filter((id) => !abstractDefinitions.has(id))
        .sort();
    return {
        missingNumIds,
        missingAbstractNumIds,
        invalidLevels: invalidLevels.sort(),
    };
}
export function validateNoteIntegrity(documentXml, footnotesXml, endnotesXml) {
    const documentRoot = parseXml(documentXml).documentElement;
    const footnoteRefs = collectIds(documentRoot, 'w:footnoteReference', 'w:id').values;
    const endnoteRefs = collectIds(documentRoot, 'w:endnoteReference', 'w:id').values;
    const footnoteIds = footnotesXml
        ? collectIds(parseXml(footnotesXml).documentElement, 'w:footnote', 'w:id')
        : { values: new Set(), duplicates: [] };
    const endnoteIds = endnotesXml
        ? collectIds(parseXml(endnotesXml).documentElement, 'w:endnote', 'w:id')
        : { values: new Set(), duplicates: [] };
    const missingFootnoteRefs = Array.from(footnoteRefs)
        .filter((id) => !footnoteIds.values.has(id))
        .sort();
    const missingEndnoteRefs = Array.from(endnoteRefs)
        .filter((id) => !endnoteIds.values.has(id))
        .sort();
    return {
        missingFootnoteRefs,
        missingEndnoteRefs,
        duplicateFootnoteIds: footnoteIds.duplicates,
        duplicateEndnoteIds: endnoteIds.duplicates,
    };
}
export function validateBookmarkIntegrity(documentXml) {
    const root = parseXml(documentXml).documentElement;
    const starts = collectIds(root, 'w:bookmarkStart', 'w:id');
    const ends = collectIds(root, 'w:bookmarkEnd', 'w:id');
    const unmatchedStartIds = Array.from(starts.values).filter((id) => !ends.values.has(id)).sort();
    const unmatchedEndIds = Array.from(ends.values).filter((id) => !starts.values.has(id)).sort();
    return {
        unmatchedStartIds,
        unmatchedEndIds,
        duplicateStartIds: starts.duplicates,
        duplicateEndIds: ends.duplicates,
    };
}
//# sourceMappingURL=structural.js.map