#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import AdmZip from "adm-zip";
import { createReport } from "docx-templates";

import {
  PREVIEWS_DIR,
  REPO_ROOT as ROOT,
  TEMPLATES_DIR,
  isOpenAgreementsOwned,
  listTemplateIds,
  loadTemplateMetadata,
} from "./lib/template-utils.mjs";

const RENDER_SCRIPT = resolve(ROOT, "scripts", "render_docx_pages.mjs");

function parseArgs(argv) {
  const parsed = {
    templates: new Set(),
    dpi: 170,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--template") {
      const value = argv[i + 1];
      i += 1;
      if (!value) {
        throw new Error("--template requires a value");
      }
      for (const item of value.split(",").map((v) => v.trim()).filter(Boolean)) {
        parsed.templates.add(item);
      }
      continue;
    }

    if (arg === "--dpi") {
      const value = Number(argv[i + 1]);
      i += 1;
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--dpi must be a positive number");
      }
      parsed.dpi = Math.round(value);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/generate_template_previews.mjs [options]",
      "",
      "Generates PNG previews for OpenAgreements-owned templates.",
      "",
      "Options:",
      "  --template <id[,id2]>   Limit generation to one or more template IDs",
      "  --dpi <n>               Rasterization DPI passed to render_docx_pages (default: 170)",
      "  -h, --help              Show help",
    ].join("\n")
  );
}

// Tags that must never survive a filled preview. Catches the regression in
// issue #259 — loop scaffolding leaking onto the catalog signature page.
const FORBIDDEN_PREVIEW_TAGS = [
  /\{FOR\s/,
  /\{END-FOR\s/,
  /\{\$/,
  /\{effective_date\}/,
];

async function fillTemplateForPreview(docxPath, sampleValues) {
  const templateBuffer = readFileSync(docxPath);
  // Intentionally minimal createReport call: these consent templates have no
  // leading `$`, no line-break-bearing fields in sample data, no IF blocks,
  // no drafting notes in the signature section, and no table conditionals.
  // Dynamic verification confirmed this produces clean output for both SAFE
  // consent DOCXs. If a future opt-in template needs more, expand here.
  const filled = await createReport({
    template: templateBuffer,
    data: sampleValues,
    cmdDelimiter: ["{", "}"],
    fixSmartQuotes: true,
    processLineBreaks: true,
    processLineBreaksAsNewText: true,
  });
  const buffer = Buffer.from(filled);

  const docXml = new AdmZip(buffer).getEntry("word/document.xml")?.getData().toString("utf8") ?? "";
  for (const pattern of FORBIDDEN_PREVIEW_TAGS) {
    const match = pattern.exec(docXml);
    if (match) {
      throw new Error(
        `Filled preview for ${basename(docxPath)} still contains template control marker matching ${pattern}: "${match[0]}"`
      );
    }
  }
  return buffer;
}

function renderPreviewPages(docxPath, outputDir, dpi) {
  statSync(docxPath);

  mkdirSync(outputDir, { recursive: true });

  for (const name of readdirSync(outputDir)) {
    if (name.endsWith(".png")) {
      rmSync(join(outputDir, name), { force: true });
    }
  }

  const args = [
    RENDER_SCRIPT,
    "--input",
    docxPath,
    "--output-dir",
    outputDir,
    "--prefix",
    "page",
    "--dpi",
    String(dpi),
  ];

  const run = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (run.error) {
    throw new Error(`Failed to execute renderer for ${basename(docxPath)}: ${run.error.message}`);
  }
  if (run.status !== 0) {
    const details = [run.stderr, run.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`Render failed for ${basename(docxPath)}: ${details || `exit ${run.status}`}`);
  }

  const pages = readdirSync(outputDir)
    .filter((name) => /^page-\d+\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (pages.length === 0) {
    throw new Error(`No PNG pages produced for ${basename(docxPath)}`);
  }

  return pages.length;
}

function renderWithQuickLook(docxPath, outputDir, { allowSinglePage = true } = {}) {
  if (process.platform !== "darwin") {
    throw new Error("Quick Look fallback is only available on macOS");
  }
  if (!allowSinglePage) {
    // Filled previews for repeat-loop templates can span multiple pages. The
    // Quick Look fallback only emits a single PNG, which would silently
    // truncate the signature page that issue #259 is specifically about.
    throw new Error(
      `Quick Look fallback truncates to single-page output; ${basename(docxPath)} is a filled multi-page preview. Fix LibreOffice and retry.`
    );
  }

  const tempDir = mkdtempSync(join(tmpdir(), "oa-ql-preview-"));
  try {
    const run = spawnSync(
      "qlmanage",
      ["-t", "-s", "1200", "-o", tempDir, docxPath],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    if (run.error) {
      throw new Error(run.error.message);
    }
    if (run.status !== 0) {
      const details = [run.stderr, run.stdout].filter(Boolean).join("\n").trim();
      throw new Error(details || `exit ${run.status}`);
    }

    const base = basename(docxPath);
    const candidates = [`${base}.png`, ...readdirSync(tempDir).filter((name) => name.endsWith(".png"))];
    const sourceName = candidates.find((name) => existsSync(join(tempDir, name)));
    if (!sourceName) {
      throw new Error("Quick Look produced no PNG output");
    }

    copyFileSync(join(tempDir, sourceName), join(outputDir, "page-1.png"));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  return 1;
}

async function renderPreviewPagesWithFallback(templateId, dpi) {
  const sourceDocxPath = resolve(TEMPLATES_DIR, templateId, "template.docx");
  const outputDir = resolve(PREVIEWS_DIR, templateId);

  const metadata = loadTemplateMetadata(templateId);
  const sampleValues = metadata.previewSampleValues;
  const hasFilledPreview =
    sampleValues && typeof sampleValues === "object" && !Array.isArray(sampleValues);

  let renderDocxPath = sourceDocxPath;
  let fillTempDir;
  try {
    if (hasFilledPreview) {
      fillTempDir = mkdtempSync(join(tmpdir(), "oa-preview-fill-"));
      const filledBuffer = await fillTemplateForPreview(sourceDocxPath, sampleValues);
      renderDocxPath = join(fillTempDir, "filled.docx");
      writeFileSync(renderDocxPath, filledBuffer);
    }
    try {
      return renderPreviewPages(renderDocxPath, outputDir, dpi);
    } catch (error) {
      if (process.platform !== "darwin") {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `LibreOffice render failed for ${templateId}; retrying with Quick Look fallback: ${message}`
      );
      return renderWithQuickLook(renderDocxPath, outputDir, {
        allowSinglePage: !hasFilledPreview,
      });
    }
  } finally {
    if (fillTempDir) {
      rmSync(fillTempDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const allTemplateIds = listTemplateIds();
  const requested = [...args.templates];
  const unknown = requested.filter((id) => !allTemplateIds.includes(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown template ID(s): ${unknown.join(", ")}`);
  }

  const ownedTemplates = allTemplateIds.filter((templateId) =>
    isOpenAgreementsOwned(templateId, loadTemplateMetadata(templateId))
  );
  const targets =
    requested.length > 0
      ? ownedTemplates.filter((id) => args.templates.has(id))
      : ownedTemplates;

  if (targets.length === 0) {
    console.log("No OpenAgreements-owned templates matched. Nothing to render.");
    return;
  }

  const failures = [];
  const rendered = [];

  for (const templateId of targets) {
    try {
      const pageCount = await renderPreviewPagesWithFallback(templateId, args.dpi);
      rendered.push({ templateId, pageCount });
      console.log(`Rendered ${templateId}: ${pageCount} page(s)`);
    } catch (error) {
      failures.push({
        templateId,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error(`Failed ${templateId}: ${failures[failures.length - 1].message}`);
    }
  }

  if (failures.length > 0) {
    const ids = failures.map((f) => f.templateId).join(", ");
    throw new Error(`Preview generation failed for ${failures.length} template(s): ${ids}`);
  }

  console.log(`Generated previews for ${rendered.length} template(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
