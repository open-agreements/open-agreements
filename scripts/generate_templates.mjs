import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Packer } from 'docx';
import {
  loadContractSpec,
  loadStyleProfile,
  renderFromValidatedSpec,
} from './template_renderer/index.mjs';
import { compileCanonicalSourceFile } from './template_renderer/canonical-source.mjs';
import { discoverTemplateSources } from './template_renderer/canonical-sources.mjs';

const STYLE_PATH = 'scripts/template-specs/styles/openagreements-default-v1.json';

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
  const sources = discoverTemplateSources(process.cwd());

  if (sources.length === 0) {
    throw new Error('No template sources discovered under content/templates/');
  }

  for (const source of sources) {
    const spec = source.type === 'canonical'
      ? (() => {
          const compiled = compileCanonicalSourceFile(source.templatePath);
          writeJson(compiled.contractSpec, source.jsonPath);
          return compiled.contractSpec;
        })()
      : loadContractSpec(source.jsonPath);

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
      `Generated ${spec.template_id} (${source.type}) with layout=${spec.layout_id} style=${spec.style_id}`
    );
  }

  console.log(`Regenerated ${sources.length} branded templates via shared renderer.`);
}

await main();
