import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import AdmZip from 'adm-zip';
import { createReport } from 'docx-templates';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const ROOT = resolve('.');
const OUT_DIR = resolve(ROOT, 'artifacts/docx-bakeoff-free');
const INPUT_MD = resolve(OUT_DIR, '00-input-sample.md');
const INPUT_CSS = resolve(OUT_DIR, '00-legal-style.css');

const SAMPLE_MD = `# OpenAgreements Mutual NDA (Sample)

**Version:** 1.0  
**Prepared Date:** February 17, 2026

## Cover Terms

| Term | Value |
|---|---|
| Disclosing Party | Acme AI, Inc. |
| Receiving Party | Beta Systems LLC |
| Effective Date | February 17, 2026 |
| Purpose | Evaluating a potential software partnership |
| Governing Law | Delaware |
| Confidentiality Period | 3 years |

## Standard Terms

1. **Purpose Limitation.** Confidential Information may be used only for the Purpose.
2. **Non-Disclosure.** The Receiving Party will protect Confidential Information with at least reasonable care.
3. **Permitted Access.** Access is limited to personnel and advisors who need to know and are bound by confidentiality obligations.
4. **Exclusions.** Confidential Information does not include information that is public, independently developed, or rightfully received from a third party.
5. **Compelled Disclosure.** If disclosure is legally required, the Receiving Party will provide prompt notice where legally permitted.
6. **Return or Deletion.** On request, the Receiving Party will return or delete Confidential Information, except where retention is required by law.
7. **No License.** No intellectual property license is granted except as expressly set forth.
8. **No Warranty.** Confidential Information is provided \"as is\" without warranties.
9. **Injunctive Relief.** Unauthorized disclosure may cause irreparable harm and permit equitable relief.
10. **Term.** This Agreement begins on the Effective Date and continues until terminated by either party on written notice.
11. **Survival.** Confidentiality obligations survive termination for the Confidentiality Period.
12. **Entire Agreement.** This document is the complete agreement on confidentiality between the parties.

### Operational Controls

- Restrict data room access to named users.
- Rotate credentials every 90 days.
- Log downloads and administrative events.
- Require MFA for all systems containing Confidential Information.

### Signature Blocks

**Disclosing Party:** Acme AI, Inc.  
By: ______________________  
Name: ____________________  
Title: _____________________

**Receiving Party:** Beta Systems LLC  
By: ______________________  
Name: ____________________  
Title: _____________________
`;

const SAMPLE_CSS = `
:root {
  --ink: #1f2937;
  --accent: #0b4f6c;
  --muted: #6b7280;
  --line: #d1d5db;
}
body {
  font-family: "Georgia", "Times New Roman", serif;
  color: var(--ink);
  line-height: 1.45;
  margin: 1.25in;
  font-size: 11.5pt;
}
h1 { font-size: 21pt; color: var(--accent); margin-bottom: 0.1in; }
h2 { font-size: 14pt; color: var(--accent); margin-top: 0.24in; }
h3 { font-size: 12pt; color: var(--ink); margin-top: 0.18in; }
table { border-collapse: collapse; width: 100%; margin: 0.14in 0; }
th, td { border: 1px solid var(--line); padding: 7px; }
th { background: #f3f4f6; }
`;

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeFile(path, contents) {
  ensureDir(path);
  writeFileSync(path, contents);
}

function run(name, bin, args) {
  try {
    execFileSync(bin, args, { stdio: 'pipe' });
    return { name, ok: true, details: 'generated' };
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr) : error?.message;
    return { name, ok: false, details: (stderr || 'failed').trim() };
  }
}

function paragraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 120, line: 300 },
    children: [new TextRun({ text, size: options.size ?? 22, bold: options.bold ?? false })],
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true })],
  });
}

function parseMarkdownToSimpleAst(markdown) {
  const md = new MarkdownIt({ html: false });
  const tokens = md.parse(markdown, {});
  const nodes = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (token.type === 'heading_open') {
      const inline = tokens[i + 1];
      nodes.push({ type: 'heading', depth: Number(token.tag.slice(1)), text: inline.content });
      i += 2;
      continue;
    }

    if (token.type === 'paragraph_open') {
      const inline = tokens[i + 1];
      nodes.push({ type: 'paragraph', text: inline.content });
      i += 2;
      continue;
    }

    if (token.type === 'ordered_list_open') {
      const items = [];
      i += 1;
      while (i < tokens.length && tokens[i].type !== 'ordered_list_close') {
        if (tokens[i].type === 'list_item_open') {
          const paragraphToken = tokens[i + 2];
          items.push(paragraphToken.content);
          i += 4;
          continue;
        }
        i += 1;
      }
      nodes.push({ type: 'ordered', items });
      continue;
    }

    if (token.type === 'bullet_list_open') {
      const items = [];
      i += 1;
      while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
        if (tokens[i].type === 'list_item_open') {
          const paragraphToken = tokens[i + 2];
          items.push(paragraphToken.content);
          i += 4;
          continue;
        }
        i += 1;
      }
      nodes.push({ type: 'bullet', items });
      continue;
    }

    if (token.type === 'table_open') {
      const rows = [];
      i += 1;
      while (i < tokens.length && tokens[i].type !== 'table_close') {
        if (tokens[i].type === 'tr_open') {
          const cells = [];
          i += 1;
          while (i < tokens.length && tokens[i].type !== 'tr_close') {
            if (tokens[i].type === 'th_open' || tokens[i].type === 'td_open') {
              cells.push(tokens[i + 1].content);
              i += 2;
              continue;
            }
            i += 1;
          }
          rows.push(cells);
        }
        i += 1;
      }
      nodes.push({ type: 'table', rows });
    }
  }

  return nodes;
}

async function writeDocx(path, doc) {
  const buffer = await Packer.toBuffer(doc);
  writeFile(path, buffer);
}

async function method3AstToDocx(statuses) {
  const ast = parseMarkdownToSimpleAst(SAMPLE_MD);
  const children = [];

  for (const node of ast) {
    if (node.type === 'heading') {
      const headingLevel =
        node.depth === 1
          ? HeadingLevel.HEADING_1
          : node.depth === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      children.push(heading(node.text, headingLevel));
      continue;
    }

    if (node.type === 'paragraph') {
      children.push(paragraph(node.text));
      continue;
    }

    if (node.type === 'ordered') {
      node.items.forEach((item, index) => {
        children.push(paragraph(`${index + 1}. ${item}`));
      });
      continue;
    }

    if (node.type === 'bullet') {
      node.items.forEach((item) => {
        children.push(paragraph(`• ${item}`));
      });
      continue;
    }

    if (node.type === 'table') {
      const rows = node.rows.map((row, rowIndex) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [paragraph(cell, { bold: rowIndex === 0 })],
              })
          ),
        })
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        })
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  await writeDocx(resolve(OUT_DIR, '03-ast-to-docx.docx'), doc);
  statuses.push({ name: '03 AST -> DOCX (TS parser + docx)', ok: true, details: 'generated' });
}

async function method4TemplateFill(statuses) {
  const templatePath = resolve(ROOT, 'content/templates/openagreements-employment-offer-letter/template.docx');
  const outputPath = resolve(OUT_DIR, '04-docx-template-fill.docx');
  const replacements = {
    employer_name: 'OpenAgreements, Inc.',
    employee_name: 'Jordan Lee',
    position_title: 'Senior Software Engineer',
    employment_type: 'full-time',
    start_date: 'March 10, 2026',
    reporting_manager: 'VP Engineering',
    base_salary: '$190,000 annually',
    bonus_terms: 'Up to 15% annual bonus based on company and individual performance.',
    equity_terms: 'Stock options covering 0.20% of fully diluted shares, subject to board approval.',
    work_location: 'Remote in the United States with occasional team offsites.',
    governing_law: 'Delaware',
    offer_expiration_date: 'March 1, 2026',
  };

  const escapeXml = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const zip = new AdmZip(templatePath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error('word/document.xml not found in template');
  }

  let xml = zip.readAsText(entry);
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\{${key}\\}`, 'g');
    xml = xml.replace(pattern, escapeXml(value));
  }
  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf-8'));
  zip.writeZip(outputPath);

  statuses.push({ name: '04 DOCX template + merge fill (OOXML placeholder replace)', ok: true, details: 'generated' });
}

async function method5OpenXmlDocx(statuses) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [new TextRun({ text: 'Mutual NDA', bold: true, size: 34 })],
          }),
          paragraph('Version 1.0 | OpenAgreements style experiment', { size: 21 }),
          heading('Cover Terms', HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              ['Term', 'Value'],
              ['Disclosing Party', 'Acme AI, Inc.'],
              ['Receiving Party', 'Beta Systems LLC'],
              ['Governing Law', 'Delaware'],
            ].map(
              (row, rowIndex) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [paragraph(cell, { bold: rowIndex === 0 })],
                      })
                  ),
                })
            ),
          }),
          heading('Standard Terms', HeadingLevel.HEADING_2),
          paragraph('1. Purpose Limitation. Confidential Information may be used only for evaluating the business relationship.'),
          paragraph('2. Non-Disclosure. The Receiving Party will protect Confidential Information with reasonable care.'),
          paragraph('3. Return or Deletion. On request, materials are returned or deleted except where retention is legally required.'),
          heading('Signatures', HeadingLevel.HEADING_2),
          paragraph('Disclosing Party: ____________________'),
          paragraph('Receiving Party: ____________________'),
        ],
      },
    ],
  });

  await writeDocx(resolve(OUT_DIR, '05-openxml-generated.docx'), doc);
  statuses.push({ name: '05 OpenXML generation (docx library)', ok: true, details: 'generated' });
}

function renderModel() {
  return {
    title: 'OpenAgreements Services Addendum (Model-Driven)',
    subtitle: 'Single source document model demo',
    coverTerms: [
      ['Customer', 'Nimbus Robotics LLC'],
      ['Provider', 'OpenAgreements Services, Inc.'],
      ['Term', '12 months'],
      ['Renewal', 'Auto-renewal unless 30-day notice'],
    ],
    clauses: [
      'Scope. Provider will deliver services described in mutually signed statements of work.',
      'Fees. Customer will pay fees listed in the applicable order form.',
      'Confidentiality. Each party will protect Confidential Information with reasonable care.',
      'Limitation of Liability. Liability caps and exclusions are governed by the master agreement.',
    ],
  };
}

async function method6SingleSource(statuses) {
  const model = renderModel();

  const html = `<!doctype html><html><head><meta charset=\"utf-8\" /><title>${model.title}</title><style>${SAMPLE_CSS}</style></head><body>
<h1>${model.title}</h1>
<p><strong>${model.subtitle}</strong></p>
<h2>Cover Terms</h2>
<table><thead><tr><th>Term</th><th>Value</th></tr></thead><tbody>
${model.coverTerms.map(([term, value]) => `<tr><td>${term}</td><td>${value}</td></tr>`).join('')}
</tbody></table>
<h2>Clauses</h2>
<ol>${model.clauses.map((clause) => `<li>${clause}</li>`).join('')}</ol>
</body></html>`;

  writeFile(resolve(OUT_DIR, '06-model-rendered.html'), html);

  const doc = new Document({
    sections: [
      {
        children: [
          heading(model.title, HeadingLevel.HEADING_1),
          paragraph(model.subtitle, { bold: true }),
          heading('Cover Terms', HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              ['Term', 'Value'],
              ...model.coverTerms,
            ].map(
              (row, rowIndex) =>
                new TableRow({
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [paragraph(cell, { bold: rowIndex === 0 })],
                      })
                  ),
                })
            ),
          }),
          heading('Clauses', HeadingLevel.HEADING_2),
          ...model.clauses.map((clause, i) => paragraph(`${i + 1}. ${clause}`)),
        ],
      },
    ],
  });

  await writeDocx(resolve(OUT_DIR, '06-model-rendered.docx'), doc);
  statuses.push({ name: '06 Single source model -> HTML + DOCX', ok: true, details: 'generated' });
}

function escapeRtf(text) {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

async function method8Rtf(statuses) {
  const lines = [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0 Times New Roman;}{\\f1 Arial;}}',
    '\\f1\\fs44\\b OpenAgreements Mutual NDA (RTF Path)\\b0\\f0\\fs24\\par',
    '\\fs24\\b Cover Terms\\b0\\par',
    'Disclosing Party: Acme AI, Inc.\\par',
    'Receiving Party: Beta Systems LLC\\par',
    'Governing Law: Delaware\\par',
    '\\par',
    '\\fs24\\b Standard Terms\\b0\\par',
    ...[
      '1. Purpose Limitation. Confidential Information may be used only for the stated purpose.',
      '2. Non-Disclosure. Receiving Party will protect Confidential Information with reasonable care.',
      '3. Return or Deletion. Materials are returned or deleted upon request where legally permitted.',
    ].map((line) => `${escapeRtf(line)}\\par`),
    '}',
  ];

  const rtfPath = resolve(OUT_DIR, '08-generated.rtf');
  writeFile(rtfPath, lines.join('\n'));

  const result = run(
    '08 RTF -> DOCX (textutil)',
    'textutil',
    ['-convert', 'docx', '-output', resolve(OUT_DIR, '08-rtf-to-docx.docx'), rtfPath]
  );
  statuses.push(result);
}

async function method9GoogleBlocked(statuses) {
  const doc = new Document({
    sections: [
      {
        children: [
          heading('Google Docs Renderer (Method 9)', HeadingLevel.HEADING_1),
          paragraph('Not executed in this run because Google Docs API credentials were not configured in this environment.'),
          paragraph('To run this method, provide OAuth/service-account setup and call Docs API create+batchUpdate, then export as DOCX.'),
        ],
      },
    ],
  });

  await writeDocx(resolve(OUT_DIR, '09-google-docs-not-executed.docx'), doc);
  writeFile(
    resolve(OUT_DIR, '09-google-docs-steps.md'),
    `# Method 9 (Google Docs API)\n\nStatus: blocked in local run (missing Google credentials).\n\nSuggested command sequence:\n1. Create a Doc via Google Docs API\n2. Apply formatting with batchUpdate\n3. Export with Drive API as DOCX\n`
  );
  statuses.push({ name: '09 Google Docs API -> DOCX', ok: false, details: 'blocked (missing credentials)' });
}

async function method10FreeEngineAlternative(statuses) {
  const tempTemplatePath = resolve(OUT_DIR, '10-template-free-engine-base.docx');
  const templateDoc = new Document({
    sections: [
      {
        children: [
          heading('OpenAgreements Professional Report', HeadingLevel.HEADING_1),
          paragraph('Client: +++INS client_name+++'),
          paragraph('Prepared by: +++INS preparer+++'),
          heading('Highlights', HeadingLevel.HEADING_2),
          paragraph('- +++INS highlight_1+++'),
          paragraph('- +++INS highlight_2+++'),
          paragraph('- +++INS highlight_3+++'),
          heading('Brand Mark', HeadingLevel.HEADING_2),
          paragraph('+++IMAGE logo+++'),
        ],
      },
    ],
  });

  await writeDocx(tempTemplatePath, templateDoc);
  const reportBuffer = await createReport({
    template: readFileSync(tempTemplatePath),
    data: {
      client_name: 'Beta Systems LLC',
      preparer: 'OpenAgreements Automation',
      highlight_1: 'Consistent clause numbering across sections',
      highlight_2: 'Template-driven updates for legal operations',
      highlight_3: 'Professional formatting suitable for Word-first workflows',
      logo: {
        width: 4,
        height: 1.2,
        data: readFileSync(resolve(ROOT, 'site/assets/openagreements_logo.jpg')),
        extension: '.jpg',
      },
    },
  });

  writeFile(resolve(OUT_DIR, '10-free-engine-docx-templates-advanced.docx'), reportBuffer);
  statuses.push({ name: '10 Free engine alt (docx-templates advanced)', ok: true, details: 'generated' });
}

function writeSummary(statuses) {
  const rows = statuses
    .map((s, idx) => `| ${idx + 1} | ${s.name} | ${s.ok ? 'OK' : 'Blocked/Failed'} | ${s.details.replace(/\n/g, ' ')} |`)
    .join('\n');

  const summary = `# DOCX Bake-off (Free-Only)\n\nOutput folder: \`${OUT_DIR}\`\n\n## Inputs\n- \`00-input-sample.md\`\n- \`00-legal-style.css\`\n\n## Method Status\n| # | Method | Status | Notes |\n|---|---|---|---|\n${rows}\n\n## Output Files\n- \`01-pandoc-reference.docx\`\n- \`02-html-css-source.html\`\n- \`02-html-css-to-docx.docx\`\n- \`03-ast-to-docx.docx\`\n- \`04-docx-template-fill.docx\`\n- \`05-openxml-generated.docx\`\n- \`06-model-rendered.html\`\n- \`06-model-rendered.docx\`\n- \`07-intermediate.tex\`\n- \`07-latex-to-docx.docx\`\n- \`08-generated.rtf\`\n- \`08-rtf-to-docx.docx\`\n- \`09-google-docs-not-executed.docx\`\n- \`09-google-docs-steps.md\`\n- \`10-template-free-engine-base.docx\`\n- \`10-free-engine-docx-templates-advanced.docx\`\n\n## Notes\n- Free-only constraint applied.\n- Method 9 needs Google API credentials to produce a real renderer output.\n- Method 10 uses \`docx-templates\` as a free alternative to commercial engines.\n`;

  writeFile(resolve(OUT_DIR, 'README.md'), summary);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFile(INPUT_MD, SAMPLE_MD);
  writeFile(INPUT_CSS, SAMPLE_CSS);

  const statuses = [];

  statuses.push(
    run('01 Pandoc md->docx + reference.docx', 'pandoc', [
      INPUT_MD,
      '--reference-doc',
      resolve(ROOT, 'content/templates/openagreements-employment-offer-letter/template.docx'),
      '-o',
      resolve(OUT_DIR, '01-pandoc-reference.docx'),
    ])
  );

  const method2StepA = run('02A md->html with custom css', 'pandoc', [
    INPUT_MD,
    '-s',
    '--css',
    INPUT_CSS,
    '-o',
    resolve(OUT_DIR, '02-html-css-source.html'),
  ]);
  const method2StepB = run('02B html->docx converter', 'pandoc', [
    resolve(OUT_DIR, '02-html-css-source.html'),
    '-o',
    resolve(OUT_DIR, '02-html-css-to-docx.docx'),
  ]);
  statuses.push({
    name: '02 Markdown -> HTML (custom CSS) -> DOCX',
    ok: method2StepA.ok && method2StepB.ok,
    details: `md->html: ${method2StepA.ok ? 'ok' : method2StepA.details}; html->docx: ${method2StepB.ok ? 'ok' : method2StepB.details}`,
  });

  await method3AstToDocx(statuses);
  await method4TemplateFill(statuses);
  await method5OpenXmlDocx(statuses);
  await method6SingleSource(statuses);

  const method7StepA = run('07A md->latex', 'pandoc', [
    INPUT_MD,
    '-o',
    resolve(OUT_DIR, '07-intermediate.tex'),
  ]);
  const method7StepB = run('07B latex->docx', 'pandoc', [
    resolve(OUT_DIR, '07-intermediate.tex'),
    '-o',
    resolve(OUT_DIR, '07-latex-to-docx.docx'),
  ]);
  statuses.push({
    name: '07 Markdown -> LaTeX -> DOCX',
    ok: method7StepA.ok && method7StepB.ok,
    details: `md->tex: ${method7StepA.ok ? 'ok' : method7StepA.details}; tex->docx: ${method7StepB.ok ? 'ok' : method7StepB.details}`,
  });

  await method8Rtf(statuses);
  await method9GoogleBlocked(statuses);
  await method10FreeEngineAlternative(statuses);

  writeSummary(statuses);

  console.log(`DOCX bake-off completed. See ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
