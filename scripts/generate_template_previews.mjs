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
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = resolve(ROOT, "content", "templates");
const PREVIEWS_DIR = resolve(ROOT, "site", "assets", "previews");
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

function listTemplateIds() {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadTemplateMetadata(templateId) {
  const metadataPath = resolve(TEMPLATES_DIR, templateId, "metadata.yaml");
  if (!existsSync(metadataPath)) {
    return {};
  }
  const raw = readFileSync(metadataPath, "utf8");
  const parsed = yaml.load(raw);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function isOpenAgreementsOwned(templateId, metadata) {
  if (templateId.startsWith("openagreements-")) {
    return true;
  }
  const sourceUrl = String(metadata.source_url || "").toLowerCase();
  return (
    sourceUrl.includes("openagreements.ai") ||
    sourceUrl.includes("github.com/open-agreements/open-agreements")
  );
}

function renderPreviewPages(templateId, dpi) {
  const docxPath = resolve(TEMPLATES_DIR, templateId, "template.docx");
  statSync(docxPath);

  const outputDir = resolve(PREVIEWS_DIR, templateId);
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
    throw new Error(`Failed to execute renderer for ${templateId}: ${run.error.message}`);
  }
  if (run.status !== 0) {
    const details = [run.stderr, run.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`Render failed for ${templateId}: ${details || `exit ${run.status}`}`);
  }

  const pages = readdirSync(outputDir)
    .filter((name) => /^page-\d+\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (pages.length === 0) {
    throw new Error(`No PNG pages produced for ${templateId}`);
  }

  return pages.length;
}

function renderWithQuickLook(docxPath, outputDir) {
  if (process.platform !== "darwin") {
    throw new Error("Quick Look fallback is only available on macOS");
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

function renderPreviewPagesWithFallback(templateId, dpi) {
  const docxPath = resolve(TEMPLATES_DIR, templateId, "template.docx");
  const outputDir = resolve(PREVIEWS_DIR, templateId);
  try {
    return renderPreviewPages(templateId, dpi);
  } catch (error) {
    if (process.platform !== "darwin") {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `LibreOffice render failed for ${templateId}; retrying with Quick Look fallback: ${message}`
    );
    return renderWithQuickLook(docxPath, outputDir);
  }
}

function main() {
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
      const pageCount = renderPreviewPagesWithFallback(templateId, args.dpi);
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
