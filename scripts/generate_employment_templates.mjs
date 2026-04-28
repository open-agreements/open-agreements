import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Packer } from 'docx';
import {
  loadContractSpec,
  loadStyleProfile,
  renderFromValidatedSpec,
} from './template_renderer/index.mjs';
import { compileCanonicalSourceFile } from './template_renderer/canonical-source.mjs';

const STYLE_PATH = 'scripts/template-specs/styles/openagreements-default-v1.json';
const SOURCES = [
  { type: 'json', path: 'scripts/template-specs/openagreements-employment-offer-letter.json' },
  { type: 'json', path: 'scripts/template-specs/openagreements-employee-ip-inventions-assignment.json' },
  { type: 'json', path: 'scripts/template-specs/openagreements-employment-confidentiality-acknowledgement.json' },
  {
    type: 'canonical',
    path: 'content/templates/openagreements-restrictive-covenant-wyoming/template.md',
  },
];

async function writeDocx(doc, outPath) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(resolve(outPath), buf);
}

function writeMarkdown(markdown, outPath) {
  writeFileSync(resolve(outPath), markdown, 'utf-8');
}

function writeJson(value, outPath) {
  writeFileSync(resolve(outPath), `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function main() {
  const style = loadStyleProfile(STYLE_PATH);
  const seenTemplateIds = new Set();

  for (const source of SOURCES) {
    const spec = source.type === 'json'
      ? loadContractSpec(source.path)
      : (() => {
          const compiled = compileCanonicalSourceFile(source.path);
          if (!compiled.sourceJsonPath) {
            throw new Error(`Canonical source ${source.path} is missing source_json in frontmatter`);
          }
          writeJson(compiled.contractSpec, compiled.sourceJsonPath);
          return compiled.contractSpec;
        })();

    if (seenTemplateIds.has(spec.template_id)) {
      throw new Error(`Duplicate template_id in spec list: ${spec.template_id}`);
    }
    seenTemplateIds.add(spec.template_id);

    const { document, markdown } = renderFromValidatedSpec(spec, style);
    await writeDocx(document, spec.output_docx_path);
    if (spec.output_markdown_path) {
      writeMarkdown(markdown, spec.output_markdown_path);
    }

    console.log(
      `Generated ${spec.template_id} with layout=${spec.layout_id} style=${spec.style_id}`
    );
  }

  console.log('Regenerated branded employment templates via JSON specs + shared renderer.');
}

await main();
