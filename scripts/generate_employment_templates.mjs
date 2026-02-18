import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Packer } from 'docx';
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

async function writeDocx(doc, outPath) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(resolve(outPath), buf);
}

function writeMarkdown(markdown, outPath) {
  writeFileSync(resolve(outPath), markdown, 'utf-8');
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
    writeMarkdown(markdown, spec.output_markdown_path);

    console.log(
      `Generated ${spec.template_id} with layout=${spec.layout_id} style=${spec.style_id}`
    );
  }

  console.log('Regenerated branded employment templates via JSON specs + shared renderer.');
}

await main();
