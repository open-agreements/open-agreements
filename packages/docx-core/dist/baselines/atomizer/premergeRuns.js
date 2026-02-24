/**
 * Pre-Compare Run Pre-Merge
 *
 * Optional normalization step to merge adjacent <w:r> siblings with identical
 * formatting before atomization.
 *
 * Motivation:
 * - Some documents are heavily fragmented into multiple runs even when the
 *   formatting is identical. This can cause overly-granular diffs.
 * - For `reconstructionMode: 'inplace'`, we intentionally disable atom-level
 *   cross-run text merging to keep atoms anchored to real runs. Pre-merging runs
 *   is a safer way to reduce fragmentation without creating atoms that span
 *   multiple runs.
 *
 * This step is intentionally conservative:
 * - Only merges immediately-adjacent <w:r> siblings under the same parent.
 * - Requires identical run attributes and identical <w:rPr> formatting subtree.
 * - Only merges runs that contain a small, "safe" subset of child elements.
 */
import { createHash } from 'crypto';
import { getLeafText, childElements } from '../../primitives/index.js';
const SAFE_RUN_CHILD_TAGS = new Set([
    'w:rPr',
    'w:t',
    'w:tab',
    'w:br',
    'w:cr',
    // Deleted text can appear if input already has revisions.
    'w:delText',
]);
function sha1(content) {
    return createHash('sha1').update(content, 'utf8').digest('hex');
}
function hashElementDeep(element) {
    const parts = [element.tagName];
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        parts.push(`${attr.name}=${attr.value}`);
    }
    // Sort for determinism
    parts.sort();
    // Re-add tagName at front after sort
    const tagName = parts.shift();
    const leafText = getLeafText(element);
    if (leafText !== undefined) {
        parts.push(leafText);
    }
    for (const child of childElements(element)) {
        parts.push(hashElementDeep(child));
    }
    return sha1([tagName, ...parts].join('|'));
}
function attrsEqual(a, b) {
    if (a.attributes.length !== b.attributes.length)
        return false;
    for (let i = 0; i < a.attributes.length; i++) {
        const aAttr = a.attributes[i];
        const bVal = b.getAttribute(aAttr.name);
        if (bVal !== aAttr.value)
            return false;
    }
    return true;
}
function findChild(parent, tagName) {
    for (const child of childElements(parent)) {
        if (child.tagName === tagName)
            return child;
    }
    return undefined;
}
function runPropertiesEqual(aRun, bRun) {
    const aRPr = findChild(aRun, 'w:rPr');
    const bRPr = findChild(bRun, 'w:rPr');
    if (!aRPr && !bRPr)
        return true;
    if (!aRPr || !bRPr)
        return false;
    return hashElementDeep(aRPr) === hashElementDeep(bRPr);
}
function runIsSafeToMerge(run) {
    if (run.tagName !== 'w:r')
        return false;
    if (getLeafText(run) !== undefined)
        return false;
    for (const child of childElements(run)) {
        if (!SAFE_RUN_CHILD_TAGS.has(child.tagName))
            return false;
        // Be conservative: disallow nested elements under non-rPr children.
        if (child.tagName !== 'w:rPr' && childElements(child).length > 0)
            return false;
    }
    return true;
}
function mergeRunInto(target, source) {
    for (const child of childElements(source)) {
        if (child.tagName === 'w:rPr')
            continue;
        target.appendChild(child);
    }
}
function canMergeRuns(a, b) {
    if (!runIsSafeToMerge(a) || !runIsSafeToMerge(b))
        return false;
    if (!attrsEqual(a, b))
        return false;
    if (!runPropertiesEqual(a, b))
        return false;
    return true;
}
function mergeAdjacentRunsInChildren(parent) {
    const children = childElements(parent);
    if (children.length < 2)
        return 0;
    let merges = 0;
    // Re-scan after each merge since DOM is live
    let keepGoing = true;
    while (keepGoing) {
        keepGoing = false;
        const kids = childElements(parent);
        for (let i = 0; i < kids.length - 1; i++) {
            const a = kids[i];
            const b = kids[i + 1];
            if (a.tagName === 'w:r' && b.tagName === 'w:r' && canMergeRuns(a, b)) {
                mergeRunInto(a, b);
                parent.removeChild(b);
                merges++;
                keepGoing = true;
                break; // restart scan
            }
        }
    }
    return merges;
}
/**
 * Merge adjacent runs throughout a DOM Element subtree.
 *
 * @returns The number of merges performed.
 */
export function premergeAdjacentRuns(root) {
    let merges = 0;
    function traverse(node) {
        merges += mergeAdjacentRunsInChildren(node);
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(root);
    return merges;
}
//# sourceMappingURL=premergeRuns.js.map