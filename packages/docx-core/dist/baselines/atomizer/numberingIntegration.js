/**
 * Numbering Integration
 *
 * Applies numbering resolution to atoms before comparison.
 * This allows detection of list renumbering changes.
 *
 * Note: Full implementation would parse numbering.xml and inject
 * computed list labels as virtual tokens. For v1, this is a stub
 * that can be extended later.
 */
import { createNumberingState, processNumberedParagraph, expandLevelTextWithLegal, parseLevelElement, } from '../../numbering.js';
import { findElement, parseDocumentXml } from './xmlToWmlElement.js';
import { childElements } from '../../primitives/index.js';
/**
 * Default options for numbering integration.
 */
export const DEFAULT_NUMBERING_OPTIONS = {
    enabled: true,
};
/**
 * Parse numbering.xml to extract numbering definitions.
 *
 * @param numberingXml - Raw numbering.xml content
 * @returns Parsed numbering definitions
 */
export function parseNumberingXml(numberingXml) {
    const definitions = {
        abstractNums: new Map(),
        numToAbstractNum: new Map(),
    };
    if (!numberingXml) {
        return definitions;
    }
    try {
        const root = parseDocumentXml(numberingXml);
        const numbering = findElement(root, 'w:numbering');
        if (!numbering) {
            return definitions;
        }
        // Parse abstract numbering definitions
        for (const child of childElements(numbering)) {
            if (child.tagName === 'w:abstractNum') {
                const abstractNumId = child.getAttribute('w:abstractNumId');
                if (abstractNumId) {
                    const levels = parseAbstractNumLevels(child);
                    definitions.abstractNums.set(abstractNumId, levels);
                }
            }
            else if (child.tagName === 'w:num') {
                const numId = child.getAttribute('w:numId');
                const abstractNumIdRef = findAbstractNumIdRef(child);
                if (numId && abstractNumIdRef) {
                    definitions.numToAbstractNum.set(numId, abstractNumIdRef);
                }
            }
        }
    }
    catch (error) {
        // If parsing fails, return empty definitions
        console.warn('Failed to parse numbering.xml:', error);
    }
    return definitions;
}
/**
 * Parse level definitions from an abstractNum element.
 */
function parseAbstractNumLevels(abstractNum) {
    const levels = [];
    for (const child of childElements(abstractNum)) {
        if (child.tagName === 'w:lvl') {
            levels.push(parseLevelElement(child));
        }
    }
    // Sort by ilvl
    levels.sort((a, b) => a.ilvl - b.ilvl);
    return levels;
}
/**
 * Find the abstractNumId reference in a num element.
 */
function findAbstractNumIdRef(numElement) {
    for (const child of childElements(numElement)) {
        if (child.tagName === 'w:abstractNumId') {
            return child.getAttribute('w:val') || null;
        }
    }
    return null;
}
/**
 * Get the numId from a paragraph's numbering properties.
 */
function getNumIdFromAtom(atom) {
    // Find w:p ancestor
    const pAncestor = atom.ancestorElements.find((a) => a.tagName === 'w:p');
    if (!pAncestor) {
        return null;
    }
    // Find w:pPr
    const pPr = childElements(pAncestor).find((c) => c.tagName === 'w:pPr');
    if (!pPr) {
        return null;
    }
    // Find w:numPr
    const numPr = childElements(pPr).find((c) => c.tagName === 'w:numPr');
    if (!numPr) {
        return null;
    }
    // Find w:numId
    const numId = childElements(numPr).find((c) => c.tagName === 'w:numId');
    return numId?.getAttribute('w:val') || null;
}
/**
 * Get the ilvl from a paragraph's numbering properties.
 */
function getIlvlFromAtom(atom) {
    // Find w:p ancestor
    const pAncestor = atom.ancestorElements.find((a) => a.tagName === 'w:p');
    if (!pAncestor) {
        return 0;
    }
    // Find w:pPr
    const pPr = childElements(pAncestor).find((c) => c.tagName === 'w:pPr');
    if (!pPr) {
        return 0;
    }
    // Find w:numPr
    const numPr = childElements(pPr).find((c) => c.tagName === 'w:numPr');
    if (!numPr) {
        return 0;
    }
    // Find w:ilvl
    const ilvl = childElements(numPr).find((c) => c.tagName === 'w:ilvl');
    const val = ilvl?.getAttribute('w:val');
    return val ? parseInt(val, 10) : 0;
}
/**
 * Apply numbering labels to atoms for comparison.
 *
 * This is a stub implementation. Full implementation would:
 * 1. Parse numbering.xml
 * 2. Walk through paragraphs tracking numbering state
 * 3. Compute the rendered list label for each numbered paragraph
 * 4. Inject the label as a virtual atom or modify the hash
 *
 * @param atoms - Atoms to process
 * @param numberingXml - Raw numbering.xml content (optional)
 * @param options - Numbering integration options
 */
export function virtualizeNumberingLabels(atoms, numberingXml, options = DEFAULT_NUMBERING_OPTIONS) {
    if (!options.enabled || !numberingXml) {
        return;
    }
    const definitions = parseNumberingXml(numberingXml);
    if (definitions.abstractNums.size === 0) {
        return;
    }
    const numberingState = createNumberingState();
    let lastParagraph = null;
    for (const atom of atoms) {
        // Find paragraph ancestor
        const pAncestor = atom.ancestorElements.find((a) => a.tagName === 'w:p');
        if (pAncestor && pAncestor !== lastParagraph) {
            lastParagraph = pAncestor;
            // Check if this paragraph has numbering
            const numId = getNumIdFromAtom(atom);
            const ilvl = getIlvlFromAtom(atom);
            if (numId) {
                const abstractNumId = definitions.numToAbstractNum.get(numId);
                if (abstractNumId) {
                    const levels = definitions.abstractNums.get(abstractNumId);
                    if (levels && levels[ilvl]) {
                        const levelInfo = levels[ilvl];
                        const counter = processNumberedParagraph(numberingState, parseInt(numId, 10), ilvl, levelInfo);
                        // Build counter array for level text expansion
                        const counters = [];
                        const storedCounters = numberingState.counters.get(numId);
                        for (let i = 0; i <= ilvl; i++) {
                            counters.push(storedCounters?.[i] ?? counter);
                        }
                        // Compute the rendered label
                        const label = expandLevelTextWithLegal(levelInfo.lvlText, counters, levels, ilvl);
                        // Store the computed label on the atom for hash modification
                        // This affects comparison by making atoms with different labels
                        // have different hashes even if the text is the same
                        if (label) {
                            // Modify the atom's hash to include the numbering label
                            // This is a simple approach - append label to hash input
                            const originalHash = atom.sha1Hash;
                            atom.sha1Hash = `${originalHash}:${numId}:${ilvl}:${label}`;
                        }
                    }
                }
            }
        }
    }
}
/**
 * Check if an atom is the first atom in its paragraph.
 * Used to determine when to process numbering.
 */
export function isFirstAtomInParagraph(atom, previousAtom) {
    if (!previousAtom) {
        return true;
    }
    const currentP = atom.ancestorElements.find((a) => a.tagName === 'w:p');
    const previousP = previousAtom.ancestorElements.find((a) => a.tagName === 'w:p');
    return currentP !== previousP;
}
//# sourceMappingURL=numberingIntegration.js.map