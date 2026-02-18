import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { Packer } from 'docx';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import {
  loadContractSpec,
  loadStyleProfile,
  renderFromValidatedSpec,
} from './template_renderer/index.mjs';

const STYLE_PATH = 'scripts/template-specs/styles/openagreements-default-v1.json';
const SPEC_PATHS = [
  'scripts/template-specs/openagreements-employment-offer-letter.json',
  'scripts/template-specs/openagreements-employee-ip-inventions-assignment.json',
  'scripts/template-specs/openagreements-employment-confidentiality-acknowledgement.json',
];
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function writeDocx(doc, outPath) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(resolve(outPath), buf);
}

function writeMarkdown(markdown, outPath) {
  writeFileSync(resolve(outPath), markdown, 'utf-8');
}

function extractParagraphText(paragraph) {
  const textNodes = paragraph.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent ?? '';
  }
  return text.trim();
}

function isClauseHeadingParagraph(text) {
  return /^\d+\.\s/.test(text);
}

function enforceStandardTermsSpacing(docxPath, signatureHeading) {
  const zip = new AdmZip(resolve(docxPath));
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error(`word/document.xml missing in ${docxPath}`);
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
  const bodies = doc.getElementsByTagNameNS(W_NS, 'body');
  if (bodies.length === 0) {
    throw new Error(`word/body missing in ${docxPath}`);
  }

  const body = bodies[0];
  let inStandardTerms = false;

  for (let i = 0; i < body.childNodes.length; i += 1) {
    const node = body.childNodes[i];
    if (!node || node.nodeType !== 1 || node.localName !== 'p' || node.namespaceURI !== W_NS) {
      continue;
    }

    const paragraph = node;
    const text = extractParagraphText(paragraph);
    if (text === 'Standard Terms') {
      inStandardTerms = true;
      continue;
    }
    if (text === signatureHeading) {
      inStandardTerms = false;
    }
    if (!inStandardTerms || text === '') {
      continue;
    }

    let pPr = null;
    for (let j = 0; j < paragraph.childNodes.length; j += 1) {
      const child = paragraph.childNodes[j];
      if (child && child.nodeType === 1 && child.localName === 'pPr' && child.namespaceURI === W_NS) {
        pPr = child;
        break;
      }
    }
    if (!pPr) {
      pPr = doc.createElementNS(W_NS, 'w:pPr');
      paragraph.insertBefore(pPr, paragraph.firstChild);
    }

    let spacing = null;
    for (let j = 0; j < pPr.childNodes.length; j += 1) {
      const child = pPr.childNodes[j];
      if (child && child.nodeType === 1 && child.localName === 'spacing' && child.namespaceURI === W_NS) {
        spacing = child;
        break;
      }
    }
    if (!spacing) {
      spacing = doc.createElementNS(W_NS, 'w:spacing');
      pPr.insertBefore(spacing, pPr.firstChild);
    }

    const targetAfter = isClauseHeadingParagraph(text) ? '120' : '280';
    spacing.setAttributeNS(W_NS, 'w:after', targetAfter);
    spacing.setAttributeNS(W_NS, 'w:afterAutospacing', '0');
    spacing.setAttributeNS(W_NS, 'w:beforeAutospacing', '0');
    if (!spacing.getAttributeNS(W_NS, 'line')) {
      spacing.setAttributeNS(W_NS, 'w:line', '276');
    }
    if (!spacing.getAttributeNS(W_NS, 'lineRule')) {
      spacing.setAttributeNS(W_NS, 'w:lineRule', 'auto');
    }

    let contextualSpacing = null;
    for (let j = 0; j < pPr.childNodes.length; j += 1) {
      const child = pPr.childNodes[j];
      if (child && child.nodeType === 1 && child.localName === 'contextualSpacing' && child.namespaceURI === W_NS) {
        contextualSpacing = child;
        break;
      }
    }
    if (!contextualSpacing) {
      contextualSpacing = doc.createElementNS(W_NS, 'w:contextualSpacing');
      pPr.appendChild(contextualSpacing);
    }
    contextualSpacing.setAttributeNS(W_NS, 'w:val', '0');
  }

  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf-8'));

  const rebuilt = new AdmZip();
  for (const currentEntry of zip.getEntries()) {
    rebuilt.addFile(currentEntry.entryName, currentEntry.getData());
  }
  writeFileSync(resolve(docxPath), rebuilt.toBuffer());
}

async function main() {
  const style = loadStyleProfile(STYLE_PATH);
  const seenTemplateIds = new Set();

  for (const specPath of SPEC_PATHS) {
    const spec = loadContractSpec(specPath);

    if (seenTemplateIds.has(spec.template_id)) {
      throw new Error(`Duplicate template_id in spec list: ${spec.template_id}`);
    }
    seenTemplateIds.add(spec.template_id);

    const { document, markdown } = renderFromValidatedSpec(spec, style);
    await writeDocx(document, spec.output_docx_path);
    enforceStandardTermsSpacing(
      spec.output_docx_path,
      spec.sections.signature.heading_title
    );
    writeMarkdown(markdown, spec.output_markdown_path);

    console.log(
      `Generated ${spec.template_id} with layout=${spec.layout_id} style=${spec.style_id}`
    );
  }

  console.log('Regenerated branded employment templates via JSON specs + shared renderer.');
}

await main();
