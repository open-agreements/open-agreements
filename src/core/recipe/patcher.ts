import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// Use xmldom's own types via ReturnType inference
type XmlDoc = ReturnType<DOMParser['parseFromString']>;

interface CharMapEntry {
  runIndex: number;
  charOffset: number;
}

/**
 * Patch a DOCX document by replacing bracketed placeholders with template tags.
 * Uses a char_map algorithm to handle cross-run replacements where Word splits
 * placeholder text across multiple XML run elements.
 */
export async function patchDocument(
  inputPath: string,
  outputPath: string,
  replacements: Record<string, string>
): Promise<string> {
  const zip = new AdmZip(inputPath);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) {
    throw new Error('word/document.xml not found in DOCX');
  }

  const xml = docEntry.getData().toString('utf-8');
  const doc = parser.parseFromString(xml, 'text/xml');

  // Sort keys longest-first to prevent partial matches
  const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);

  // Process all paragraphs (body + tables)
  const allParagraphs = doc.getElementsByTagNameNS(W_NS, 'p');
  for (let i = 0; i < allParagraphs.length; i++) {
    replaceInParagraph(allParagraphs[i] as any, replacements, sortedKeys);
  }

  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf-8'));
  zip.writeZip(outputPath);
  return outputPath;
}

function buildCharMap(runs: any[]): { fullText: string; charMap: CharMapEntry[] } {
  const charMap: CharMapEntry[] = [];
  let fullText = '';

  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const text = getRunText(runs[runIndex]);
    for (let offset = 0; offset < text.length; offset++) {
      charMap.push({ runIndex, charOffset: offset });
    }
    fullText += text;
  }

  return { fullText, charMap };
}

function getRunText(run: any): string {
  const tElements = run.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent ?? '';
  }
  return text;
}

function setRunText(run: any, text: string): void {
  const tElements = run.getElementsByTagNameNS(W_NS, 't');
  if (tElements.length === 0) {
    const doc = run.ownerDocument;
    const t = doc.createElementNS(W_NS, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = text;
    run.appendChild(t);
    return;
  }

  tElements[0].textContent = text;
  if (text.startsWith(' ') || text.endsWith(' ')) {
    tElements[0].setAttribute('xml:space', 'preserve');
  }
  for (let i = 1; i < tElements.length; i++) {
    tElements[i].textContent = '';
  }
}

function getRunElements(para: any): any[] {
  const runs: any[] = [];
  const children = para.childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === 1 && child.localName === 'r' && child.namespaceURI === W_NS) {
      runs.push(child);
    }
  }
  return runs;
}

function replaceInParagraph(
  para: any,
  replacements: Record<string, string>,
  sortedKeys: string[]
): void {
  const runs = getRunElements(para);
  if (runs.length === 0) return;

  const { fullText } = buildCharMap(runs);
  if (!sortedKeys.some((key) => fullText.includes(key))) return;

  for (const key of sortedKeys) {
    let rebuilt = buildCharMap(runs);
    while (rebuilt.fullText.includes(key)) {
      const start = rebuilt.fullText.indexOf(key);
      const end = start + key.length;
      const firstEntry = rebuilt.charMap[start];
      const lastEntry = rebuilt.charMap[end - 1];
      const replacement = replacements[key];

      if (firstEntry.runIndex === lastEntry.runIndex) {
        const runText = getRunText(runs[firstEntry.runIndex]);
        setRunText(
          runs[firstEntry.runIndex],
          runText.slice(0, firstEntry.charOffset) + replacement + runText.slice(lastEntry.charOffset + 1)
        );
      } else {
        const firstRunText = getRunText(runs[firstEntry.runIndex]);
        setRunText(runs[firstEntry.runIndex], firstRunText.slice(0, firstEntry.charOffset) + replacement);
        const lastRunText = getRunText(runs[lastEntry.runIndex]);
        setRunText(runs[lastEntry.runIndex], lastRunText.slice(lastEntry.charOffset + 1));
        for (let mid = firstEntry.runIndex + 1; mid < lastEntry.runIndex; mid++) {
          setRunText(runs[mid], '');
        }
      }

      rebuilt = buildCharMap(runs);
    }
  }
}
