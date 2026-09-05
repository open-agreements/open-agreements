import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { copyEntriesSkippingDirs, preserveXmlSpace } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export const AnchoredParagraphBindingsConfigSchema = z.object({
  groups: z.array(z.object({
    id: z.string().min(1),
    start_anchor: z.string().min(1),
    end_anchor: z.string().min(1),
    expected_group_matches: z.literal(1),
    bindings: z.array(z.object({
      label: z.string().min(1),
      field: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
      expected_matches: z.literal(1),
      insert_after_label: z.literal(true),
      preserve_following_tabs: z.literal(true),
    }).strict()).min(1),
  }).strict()).min(1),
}).strict();

export type AnchoredParagraphBindingsConfig = z.infer<typeof AnchoredParagraphBindingsConfigSchema>;

/**
 * Canonicalize only layout whitespace and Word's common smart-punctuation
 * substitutions. Matching remains case- and punctuation-sensitive otherwise.
 */
function canonicalMatchText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedText(para: Element): string {
  const chunks: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.namespaceURI === W_NS && el.localName === 't') chunks.push(el.textContent ?? '');
    if (el.namespaceURI === W_NS && (el.localName === 'tab' || el.localName === 'br')) chunks.push(' ');
    for (let i = 0; i < el.childNodes.length; i++) walk(el.childNodes[i]);
  };
  walk(para);
  return canonicalMatchText(chunks.join(''));
}

function directBodyParagraphs(doc: Document): Element[] {
  const bodies = doc.getElementsByTagNameNS(W_NS, 'body');
  if (bodies.length !== 1) throw new Error('anchored paragraph bindings: expected exactly one document body');
  const result: Element[] = [];
  const children = bodies[0].childNodes;
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    if (child.nodeType === 1 && child.namespaceURI === W_NS && child.localName === 'p') result.push(child);
  }
  return result;
}

function exactAnchorIndices(paragraphs: Element[], anchor: string): number[] {
  const expected = canonicalMatchText(anchor);
  const matches: number[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    if (normalizedText(paragraphs[i]) === expected) matches.push(i);
  }
  return matches;
}

/** Bind fields after plain labels between unique sibling body-paragraph anchors. */
export function bindAnchoredParagraphFields(
  inputPath: string,
  outputPath: string,
  rawConfig: AnchoredParagraphBindingsConfig,
): void {
  const config = AnchoredParagraphBindingsConfigSchema.parse(rawConfig);
  const zip = new AdmZip(inputPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('anchored paragraph bindings: word/document.xml not found');
  const doc = new DOMParser().parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const paragraphs = directBodyParagraphs(doc);

  // Validate the complete plan before mutation, so every failure is atomic.
  const insertions: Array<{ textNode: Element; field: string; groupId: string }> = [];
  for (const group of config.groups) {
    const starts = exactAnchorIndices(paragraphs, group.start_anchor);
    const ends = exactAnchorIndices(paragraphs, group.end_anchor);
    if (starts.length !== group.expected_group_matches || ends.length !== group.expected_group_matches) {
      throw new Error(
        `anchored paragraph bindings '${group.id}': expected one unique start/end anchor; ` +
        `found start=${starts.length}, end=${ends.length}`,
      );
    }
    const start = starts[0];
    const end = ends[0];
    if (end <= start) throw new Error(`anchored paragraph bindings '${group.id}': end anchor does not follow start anchor`);

    for (const binding of group.bindings) {
      const matches: Element[] = [];
      const expectedLabel = canonicalMatchText(binding.label);
      for (let i = start + 1; i < end; i++) {
        const texts = paragraphs[i].getElementsByTagNameNS(W_NS, 't');
        for (let j = 0; j < texts.length; j++) {
          if (canonicalMatchText(texts[j].textContent ?? '') === expectedLabel) matches.push(texts[j]);
        }
      }
      if (matches.length !== binding.expected_matches) {
        throw new Error(
          `anchored paragraph bindings '${group.id}' label '${binding.label}': ` +
          `expected one match inside boundaries; found ${matches.length}`,
        );
      }
      insertions.push({ textNode: matches[0], field: binding.field, groupId: group.id });
    }
  }

  for (const insertion of insertions) {
    const run = insertion.textNode.parentNode as Element | null;
    if (!run || run.localName !== 'r' || run.namespaceURI !== W_NS) {
      throw new Error(`anchored paragraph bindings '${insertion.groupId}': label is not directly inside a run`);
    }
    const tag = doc.createElementNS(W_NS, 'w:t');
    preserveXmlSpace(tag);
    tag.textContent = `{${insertion.field}}`;
    run.insertBefore(tag, insertion.textNode.nextSibling);
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  const outZip = new AdmZip();
  copyEntriesSkippingDirs(zip, outZip, (name, data) =>
    name === 'word/document.xml' ? Buffer.from(serialized, 'utf-8') : data,
  );
  writeFileSync(outputPath, outZip.toBuffer());
}

export function loadAnchoredParagraphBindingsConfig(path: string): AnchoredParagraphBindingsConfig {
  return AnchoredParagraphBindingsConfigSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
}
