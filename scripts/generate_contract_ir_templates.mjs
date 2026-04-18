import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderContractIrTemplate } from './contract_ir/index.mjs';

const TEMPLATE_DIRS = [
  'content/templates/openagreements-board-consent-safe',
  'content/templates/openagreements-stockholder-consent-safe',
];

async function main() {
  for (const templateDir of TEMPLATE_DIRS) {
    const absoluteDir = resolve(templateDir);
    const { template, buffer } = await renderContractIrTemplate(absoluteDir);

    writeFileSync(resolve(absoluteDir, 'template.docx'), buffer);

    console.log(
      `Generated Contract IR template ${template.frontmatter.template_id} from ${template.contentPath}`
    );
  }

  console.log('Regenerated Contract IR templates.');
}

await main();
