import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { copyFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

const CATEGORIES = [
  {
    slug: "confidentiality",
    label: "Confidentiality",
    description: "Mutual and one-way NDAs from industry-standard sources.",
    match: (id) => id.endsWith("-nda"),
  },
  {
    slug: "sales-licensing",
    label: "Sales & Licensing",
    description:
      "Cloud service agreements, software licenses, and order forms.",
    match: (id) =>
      /cloud-service|csa-|software-license|order-form/.test(id),
  },
  {
    slug: "data-compliance",
    label: "Data & Compliance",
    description: "DPAs, BAAs, and AI addendums for regulated workflows.",
    match: (id) =>
      /data-processing|business-associate|ai-addendum/.test(id),
  },
  {
    slug: "professional-services",
    label: "Professional Services",
    description: "PSAs, SOWs, and independent contractor agreements.",
    match: (id) =>
      /professional-services|statement-of-work|independent-contractor/.test(id),
  },
  {
    slug: "deals-partnerships",
    label: "Deals & Partnerships",
    description:
      "Design partner, pilot, partnership, amendment, LOI, and term sheet agreements.",
    match: (id) =>
      /design-partner|pilot|partnership|amendment|letter-of-intent|term-sheet/.test(
        id
      ),
  },
  {
    slug: "employment",
    label: "Employment",
    description: "Offer letters, IP assignments, and confidentiality acknowledgements.",
    match: (id) => /employment|employee-ip/.test(id),
  },
  {
    slug: "safes",
    label: "SAFEs",
    description: "Y Combinator SAFE variants for early-stage fundraising.",
    match: (id) => id.startsWith("yc-safe-"),
  },
  {
    slug: "venture-financing",
    label: "Venture Financing",
    description:
      "NVCA model documents for Series A and later rounds.",
    match: (id) => id.startsWith("nvca-"),
  },
  {
    slug: "other",
    label: "Other",
    description: "Additional templates that do not map to the primary categories.",
    // Catch-all bucket populated via fallback category assignment.
    match: () => false,
  },
];

const LICENSE_FLAGS = {
  "CC0-1.0": { distributable: true, fillable: true },
  "CC-BY-4.0": { distributable: true, fillable: true },
  "CC-BY-ND-4.0": { distributable: true, fillable: true },
};

function getSourceLabel(item) {
  if (item.name.startsWith("common-paper-")) return "Common Paper";
  if (item.name.startsWith("bonterms-")) return "Bonterms";
  if (item.name.startsWith("nvca-")) return "NVCA";
  if (item.name.startsWith("yc-safe-")) return "Y Combinator";
  if (item.name.startsWith("openagreements-")) return "OpenAgreements";
  return item.source || "Unknown";
}

function getSourceUrl(item) {
  const label = getSourceLabel(item);
  const urls = {
    "Common Paper": "https://commonpaper.com",
    Bonterms: "https://bonterms.com",
    NVCA: "https://nvca.org",
    "Y Combinator": "https://www.ycombinator.com/documents",
    OpenAgreements: "https://openagreements.ai",
  };
  return urls[label] || item.source_url || "#";
}

function formatName(id) {
  return id
    .replace(/^(common-paper-|bonterms-|nvca-|yc-safe-|openagreements-)/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNda\b/g, "NDA")
    .replace(/\bCsa\b/g, "CSA")
    .replace(/\bDpa\b/g, "DPA")
    .replace(/\bBaa\b/g, "BAA")
    .replace(/\bSla\b/g, "SLA")
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSow\b/g, "SOW")
    .replace(/\bIp\b/g, "IP")
    .replace(/\bSafe\b/g, "SAFE")
    .replace(/\bMfn\b/g, "MFN")
    .replace(/\bRofr\b/g, "ROFR")
    .replace(/\bCoi\b/g, "COI")
    .replace(/\bSpa\b/g, "SPA")
    .replace(/\bIra\b/g, "IRA")
    .replace(/\bLoi\b/g, "LOI");
}

function formatFieldName(name) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function copyDownloads(templates) {
  const downloadsDir = resolve(__dirname, "..", "downloads");
  if (!existsSync(downloadsDir)) {
    mkdirSync(downloadsDir, { recursive: true });
  }
  for (const t of templates) {
    if (!t.hasPreview || !t.distributable) continue;
    // Copy DOCX and MD variants
    for (const ext of ["docx", "md"]) {
      const src = resolve(root, "content", "templates", t.id, `template.${ext}`);
      const dest = resolve(downloadsDir, `${t.id}.${ext}`);
      if (!existsSync(src)) continue;
      // Skip copy if destination is already up-to-date (avoids watch-mode churn)
      if (existsSync(dest)) {
        const srcMtime = statSync(src).mtimeMs;
        const destMtime = statSync(dest).mtimeMs;
        if (destMtime >= srcMtime) continue;
      }
      copyFileSync(src, dest);
    }
  }
}

export default function () {
  const bin = resolve(root, "bin/open-agreements.js");
  const raw = execSync(`node ${bin} list --json`, {
    cwd: root,
    encoding: "utf-8",
    timeout: 30000,
  });
  const { items } = JSON.parse(raw);

  const templates = items.map((item) => {
    const isRecipe = !item.license;
    const flags = isRecipe
      ? { distributable: false, fillable: false }
      : LICENSE_FLAGS[item.license] || { distributable: false, fillable: false };

    let category = "other";
    for (const cat of CATEGORIES) {
      if (cat.match(item.name)) {
        category = cat.slug;
        break;
      }
    }

    const isOpenAgreements = item.name.startsWith("openagreements-");
    const hasPreview = isOpenAgreements;

    const templateData = {
      id: item.name,
      displayName: formatName(item.name),
      description: item.description,
      license: item.license || "Recipe",
      isRecipe,
      sourceLabel: getSourceLabel(item),
      sourceUrl: getSourceUrl(item),
      sourceDocUrl: item.source_url,
      requiredFields: item.fields.filter((f) => f.required).length,
      totalFields: item.fields.length,
      category,
      hasPreview,
      ...flags,
    };

    // Include full field metadata and preview images for OpenAgreements templates
    if (isOpenAgreements) {
      templateData.fields = item.fields.map((f) => ({
        name: f.name,
        displayName: formatFieldName(f.name),
        type: f.type,
        required: f.required,
        section: f.section || "General",
        description: f.description || "",
        default: f.default != null ? String(f.default) : null,
      }));

      // Discover pre-rendered page images
      const previewDir = resolve(__dirname, "..", "assets", "previews", item.name);
      if (existsSync(previewDir)) {
        templateData.previewPages = readdirSync(previewDir)
          .filter((f) => f.endsWith(".png"))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((f) => `/assets/previews/${item.name}/${f}`);
      }
    }

    return templateData;
  });

  // Copy distributable OpenAgreements files (DOCX + MD) to site/downloads/
  copyDownloads(templates);

  // Build category summaries for homepage pack cards
  const categories = CATEGORIES.map((cat) => {
    const catTemplates = templates.filter((t) => t.category === cat.slug);
    const sources = [...new Set(catTemplates.map((t) => t.sourceLabel))];
    return {
      slug: cat.slug,
      label: cat.label,
      description: cat.description,
      count: catTemplates.length,
      sources,
    };
  }).filter((c) => c.count > 0);

  const previewTemplates = templates.filter((t) => t.hasPreview);

  return { templates, categories, previewTemplates };
}
