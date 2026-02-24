/**
 * Format Change Detection Module
 *
 * Detects formatting changes (bold, italic, font size, etc.) between
 * documents after LCS comparison. Runs on atoms marked as Equal to
 * identify text that matches but has different formatting.
 *
 * Pipeline position:
 * LCS() → FlattenToAtomList() → detectMovesInAtomList() → detectFormatChangesInAtomList() → CoalesceRecurse()
 *
 * @see design.md Decision 10: Format Change Detection as Post-LCS Phase
 */
import { CorrelationStatus, DEFAULT_FORMAT_DETECTION_SETTINGS, RUN_PROPERTY_FRIENDLY_NAMES, } from './core-types.js';
import { getLeafText, childElements } from './primitives/index.js';
// =============================================================================
// Run Property Extraction
// =============================================================================
/**
 * Extract run properties (w:rPr) from an atom's ancestor elements.
 *
 * Finds the w:r (run) element in ancestors and extracts its w:rPr child.
 *
 * @param atom - The atom to extract properties from
 * @returns The w:rPr element, or null if not found
 *
 * @example
 * // For an atom inside <w:r><w:rPr><w:b/></w:rPr><w:t>text</w:t></w:r>
 * // Returns the <w:rPr><w:b/></w:rPr> element
 */
export function getRunPropertiesFromAtom(atom) {
    // Find the w:r ancestor element
    const runElement = atom.ancestorElements?.find((a) => a.tagName === 'w:r');
    if (!runElement) {
        return null;
    }
    // Get the rPr child element
    for (const child of childElements(runElement)) {
        if (child.tagName === 'w:rPr')
            return child;
    }
    return null;
}
function extractNormalizedProperties(rPr) {
    if (!rPr) {
        return { children: [] };
    }
    const normalizedChildren = childElements(rPr)
        // Remove revision tracking elements
        .filter((e) => e.tagName !== 'w:rPrChange')
        // Sort by tag name for deterministic comparison
        .sort((a, b) => a.tagName.localeCompare(b.tagName))
        // Normalize each child
        .map((e) => {
        const attrs = [];
        for (let i = 0; i < e.attributes.length; i++) {
            const attr = e.attributes[i];
            attrs.push([attr.name, attr.value]);
        }
        attrs.sort(([a], [b]) => a.localeCompare(b));
        const text = getLeafText(e);
        const prop = { tagName: e.tagName, attrs };
        if (text !== undefined)
            prop.text = text;
        return prop;
    });
    return { children: normalizedChildren };
}
// =============================================================================
// Run Property Comparison
// =============================================================================
/**
 * Serialize normalized properties to a string for comparison.
 */
function serializeNormalizedProperties(rPr) {
    const parts = [];
    for (const child of rPr.children) {
        const attrs = child.attrs
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
        const textPart = child.text ? `|${child.text}` : '';
        parts.push(`<${child.tagName} ${attrs}${textPart}/>`);
    }
    return parts.join('');
}
/**
 * Check if two run properties are equal after normalization.
 */
export function areRunPropertiesEqual(rPr1, rPr2) {
    const norm1 = extractNormalizedProperties(rPr1);
    const norm2 = extractNormalizedProperties(rPr2);
    return serializeNormalizedProperties(norm1) === serializeNormalizedProperties(norm2);
}
// Keep legacy overload for callers that pass WmlElement (= Element)
export { areRunPropertiesEqual as areNormalizedRunPropertiesEqual };
// =============================================================================
// Changed Property Detection
// =============================================================================
/**
 * Get the set of property tag names from a normalized rPr.
 */
function getPropertyTagNames(rPr) {
    return new Set(rPr.children.map((c) => c.tagName));
}
/**
 * Find a property element by tag name in a normalized rPr.
 */
function findPropertyByTag(rPr, tagName) {
    return rPr.children.find((c) => c.tagName === tagName);
}
/**
 * Check if two property elements have the same value.
 */
function arePropertiesValueEqual(prop1, prop2) {
    if (!prop1 && !prop2)
        return true;
    if (!prop1 || !prop2)
        return false;
    const str1 = serializeNormalizedProperties({ children: [prop1] });
    const str2 = serializeNormalizedProperties({ children: [prop2] });
    return str1 === str2;
}
/**
 * Get the list of property names that changed between two run properties.
 *
 * Returns friendly names (e.g., "bold", "italic") when available,
 * otherwise returns the OOXML tag name.
 *
 * @param oldRPr - Old run properties element (or null)
 * @param newRPr - New run properties element (or null)
 * @returns Array of changed property names
 */
export function getChangedPropertyNames(oldRPr, newRPr) {
    const changed = [];
    const normalizedOld = extractNormalizedProperties(oldRPr);
    const normalizedNew = extractNormalizedProperties(newRPr);
    const oldTags = getPropertyTagNames(normalizedOld);
    const newTags = getPropertyTagNames(normalizedNew);
    // All unique tags from both
    const allTags = new Set([...oldTags, ...newTags]);
    for (const tag of allTags) {
        const oldProp = findPropertyByTag(normalizedOld, tag);
        const newProp = findPropertyByTag(normalizedNew, tag);
        if (!arePropertiesValueEqual(oldProp, newProp)) {
            // Use friendly name if available
            const friendlyName = RUN_PROPERTY_FRIENDLY_NAMES[tag] ?? tag;
            changed.push(friendlyName);
        }
    }
    return changed.sort();
}
/**
 * Categorize changed properties into added, removed, and modified.
 *
 * @param oldRPr - Old run properties element (or null)
 * @param newRPr - New run properties element (or null)
 * @returns Object with added, removed, and changed arrays
 */
export function categorizePropertyChanges(oldRPr, newRPr) {
    const added = [];
    const removed = [];
    const changed = [];
    const normalizedOld = extractNormalizedProperties(oldRPr);
    const normalizedNew = extractNormalizedProperties(newRPr);
    const oldTags = getPropertyTagNames(normalizedOld);
    const newTags = getPropertyTagNames(normalizedNew);
    // Check for added properties (in new but not old)
    for (const tag of newTags) {
        if (!oldTags.has(tag)) {
            const friendlyName = RUN_PROPERTY_FRIENDLY_NAMES[tag] ?? tag;
            added.push(friendlyName);
        }
    }
    // Check for removed properties (in old but not new)
    for (const tag of oldTags) {
        if (!newTags.has(tag)) {
            const friendlyName = RUN_PROPERTY_FRIENDLY_NAMES[tag] ?? tag;
            removed.push(friendlyName);
        }
    }
    // Check for changed properties (in both but different value)
    for (const tag of oldTags) {
        if (newTags.has(tag)) {
            const oldProp = findPropertyByTag(normalizedOld, tag);
            const newProp = findPropertyByTag(normalizedNew, tag);
            if (!arePropertiesValueEqual(oldProp, newProp)) {
                const friendlyName = RUN_PROPERTY_FRIENDLY_NAMES[tag] ?? tag;
                changed.push(friendlyName);
            }
        }
    }
    return {
        added: added.sort(),
        removed: removed.sort(),
        changed: changed.sort(),
    };
}
// =============================================================================
// Main Algorithm
// =============================================================================
/**
 * Detect format changes in a flat list of atoms.
 *
 * Runs after LCS and move detection to identify Equal atoms where the text
 * matches but formatting differs. Updates atoms in place with format change status.
 *
 * @param atoms - The atom list to process (modified in place)
 * @param settings - Format detection settings (optional, uses defaults)
 */
export function detectFormatChangesInAtomList(atoms, settings = DEFAULT_FORMAT_DETECTION_SETTINGS) {
    if (!settings.detectFormatChanges) {
        return;
    }
    for (const atom of atoms) {
        // Only check Equal atoms that have a "before" reference
        if (atom.correlationStatus !== CorrelationStatus.Equal) {
            continue;
        }
        if (!atom.comparisonUnitAtomBefore) {
            continue;
        }
        // Extract rPr from both documents
        const oldRPr = getRunPropertiesFromAtom(atom.comparisonUnitAtomBefore);
        const newRPr = getRunPropertiesFromAtom(atom);
        // Compare run properties
        if (!areRunPropertiesEqual(oldRPr, newRPr)) {
            atom.correlationStatus = CorrelationStatus.FormatChanged;
            atom.formatChange = {
                oldRunProperties: oldRPr,
                newRunProperties: newRPr,
                changedProperties: getChangedPropertyNames(oldRPr, newRPr),
            };
        }
    }
}
/**
 * Merge format change markup into a run's existing rPr element.
 *
 * Adds the w:rPrChange element as the last child of w:rPr.
 *
 * @param runElement - The w:r element to modify
 * @param rPrChange - The w:rPrChange element to insert
 */
export function mergeFormatChangeIntoRun(runElement, rPrChange) {
    if (runElement.tagName !== 'w:r') {
        return;
    }
    // Find existing rPr
    let rPr = null;
    for (const child of childElements(runElement)) {
        if (child.tagName === 'w:rPr') {
            rPr = child;
            break;
        }
    }
    if (!rPr) {
        // Create rPr as first child
        const doc = runElement.ownerDocument;
        rPr = doc.createElementNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'w:rPr');
        runElement.insertBefore(rPr, runElement.firstChild);
    }
    // Add rPrChange as last child of rPr
    rPr.appendChild(rPrChange);
}
// =============================================================================
// Paragraph Property Change Support (Future Enhancement)
// =============================================================================
/**
 * Extract paragraph properties (w:pPr) from an element.
 *
 * @param paragraphElement - The w:p element
 * @returns The w:pPr element, or null if not found
 */
export function getParagraphProperties(paragraphElement) {
    if (paragraphElement.tagName !== 'w:p') {
        return null;
    }
    for (const child of childElements(paragraphElement)) {
        if (child.tagName === 'w:pPr')
            return child;
    }
    return null;
}
/**
 * Paragraph property friendly names.
 */
export const PARAGRAPH_PROPERTY_FRIENDLY_NAMES = {
    'w:jc': 'alignment',
    'w:ind': 'indentation',
    'w:spacing': 'spacing',
    'w:pStyle': 'style',
    'w:numPr': 'numbering',
    'w:pBdr': 'borders',
    'w:shd': 'shading',
    'w:tabs': 'tabs',
    'w:keepNext': 'keepWithNext',
    'w:keepLines': 'keepLinesTogether',
    'w:pageBreakBefore': 'pageBreakBefore',
    'w:widowControl': 'widowControl',
    'w:outlineLvl': 'outlineLevel',
};
// =============================================================================
// Legacy API — kept for backward compatibility during migration
// =============================================================================
/**
 * @deprecated Use areRunPropertiesEqual directly with Element params
 */
export function normalizeRunProperties(rPr) {
    return extractNormalizedProperties(rPr);
}
/**
 * @deprecated Use getParagraphProperties directly
 */
export function normalizeParagraphProperties(pPr) {
    return extractNormalizedProperties(pPr);
}
/**
 * @deprecated Removed — use generateFormatChangeMarkup with DOM approach
 */
export function generateFormatChangeMarkup(formatChange, options) {
    const doc = new (require('@xmldom/xmldom').DOMParser)().parseFromString('<root/>', 'application/xml');
    const dateStr = options.dateTime.toISOString();
    const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const rPrChange = doc.createElementNS(W_NS, 'w:rPrChange');
    rPrChange.setAttribute('w:id', options.id.toString());
    rPrChange.setAttribute('w:author', options.author);
    rPrChange.setAttribute('w:date', dateStr);
    const rPr = doc.createElementNS(W_NS, 'w:rPr');
    rPrChange.appendChild(rPr);
    if (formatChange.oldRunProperties) {
        for (const child of childElements(formatChange.oldRunProperties)) {
            if (child.tagName === 'w:rPrChange')
                continue;
            rPr.appendChild(child.cloneNode(true));
        }
    }
    return rPrChange;
}
//# sourceMappingURL=format-detection.js.map