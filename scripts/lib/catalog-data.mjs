import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(__dirname, "../..");

export const CATEGORIES = [
  {
    slug: "confidentiality",
    label: "Confidentiality",
    description: "Mutual and one-way NDAs from industry-standard sources.",
    match: (id) => id.endsWith("-nda"),
  },
  {
    slug: "sales-licensing",
    label: "Sales & Licensing",
    description: "Cloud service agreements, software licenses, and order forms.",
    match: (id) => /cloud-service|csa-|software-license|order-form/.test(id),
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
        id,
      ),
  },
  {
    slug: "employment",
    label: "Employment",
    description:
      "Offer letters, IP assignments, confidentiality acknowledgements, and restrictive covenants.",
    match: (id) => /employment|employee-ip|restrictive-covenant/.test(id),
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
    description: "NVCA model documents for Series A and later rounds.",
    match: (id) => id.startsWith("nvca-"),
  },
  {
    slug: "other",
    label: "Other",
    description: "Additional templates that do not map to the primary categories.",
    match: () => false,
  },
];

// Template demand snapshot — user-directed content fetches (browser + AI agent
// + SDK, excluding crawler/indexing traffic) over the trailing 180 days, from
// the Vercel content-fetch Log Drain view
// `open-agreements.vercel_drains.content_fetch_classified`. Pulled 2026-06-30.
//
// Drives README/catalog ordering so editorial prominence follows real demand:
// category groups are ordered by the sum of their members' demand, and
// templates within a group are ordered by their own demand. Builds must be
// deterministic and offline, so this is a committed snapshot rather than a live
// query — refresh it with the `analytics-review` runbook (the per-path
// `cls IN ("browser","ai_agent","sdk")` query). Slugs absent here sort to 0.
export const TEMPLATE_USAGE_DEMAND = {
  "yc-safe-valuation-cap": 384,
  "common-paper-mutual-nda": 241,
  "openagreements-stockholder-consent-safe": 201,
  "yc-safe-pro-rata-side-letter": 154,
  "common-paper-design-partner-agreement": 152,
  "nvca-rofr-co-sale-agreement": 142,
  "bonterms-mutual-nda": 110,
  "openagreements-employment-offer-letter": 107,
  "openagreements-employee-ip-inventions-assignment": 104,
  "nvca-investors-rights-agreement": 88,
  "yc-safe-mfn": 88,
  "common-paper-term-sheet": 77,
  "nvca-voting-agreement": 76,
  "openagreements-board-consent-safe": 75,
  "nvca-stock-purchase-agreement": 73,
  "common-paper-csa-click-through": 64,
  "openagreements-restrictive-covenant-wyoming": 64,
  "working-group-list": 62,
  "yc-safe-discount": 62,
  "common-paper-data-processing-agreement": 61,
  "nvca-certificate-of-incorporation": 60,
  "common-paper-independent-contractor-agreement": 58,
  "openagreements-restrictive-covenant-florida": 57,
  "common-paper-ai-addendum": 56,
  "nvca-indemnification-agreement": 56,
  "openagreements-due-diligence-request-list": 56,
  "common-paper-professional-services-agreement": 55,
  "common-paper-partnership-agreement": 54,
  "bonterms-professional-services-agreement": 53,
  "common-paper-csa-without-sla": 53,
  "common-paper-pilot-agreement": 53,
  "common-paper-csa-with-sla": 51,
  "common-paper-order-form": 51,
  "nvca-management-rights-letter": 46,
  "common-paper-cloud-service-agreement": 44,
  "common-paper-software-license-agreement": 44,
  "common-paper-order-form-with-sla": 43,
  "common-paper-ai-addendum-in-app": 40,
  "common-paper-csa-with-ai": 40,
  "common-paper-business-associate-agreement": 37,
  "closing-checklist": 36,
  "common-paper-statement-of-work": 35,
  "openagreements-employment-confidentiality-acknowledgement": 34,
  "common-paper-amendment": 33,
  "common-paper-letter-of-intent": 33,
  "common-paper-one-way-nda": 33,
  "openagreements-restrictive-covenant-massachusetts": 5,
};

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
    OpenAgreements: "https://openagreements.org",
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
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function detectCategory(id) {
  for (const category of CATEGORIES) {
    if (category.match(id)) {
      return category.slug;
    }
  }
  return "other";
}

function getContentTier(id, isRecipe) {
  if (isRecipe) return "recipe";
  if (id.startsWith("yc-safe-")) return "external";
  return "template";
}

function getContentRepoPath(id, contentTier) {
  if (contentTier === "recipe") return `content/recipes/${id}`;
  if (contentTier === "external") return `content/external/${id}`;
  return `content/templates/${id}`;
}

function loadCatalogItems(rootDir) {
  const bin = resolve(rootDir, "bin/open-agreements.js");
  const raw = execFileSync("node", [bin, "list", "--json"], {
    cwd: rootDir,
    encoding: "utf-8",
    timeout: 30000,
  });
  return JSON.parse(raw).items;
}

export function buildCatalog({ rootDir = REPO_ROOT } = {}) {
  const items = loadCatalogItems(rootDir);

  const templates = items.map((item) => {
    const isRecipe = !item.license;
    const contentTier = getContentTier(item.name, isRecipe);
    const flags = isRecipe
      ? { distributable: false, fillable: false }
      : LICENSE_FLAGS[item.license] || { distributable: false, fillable: false };
    const sourceLabel = getSourceLabel(item);
    const category = detectCategory(item.name);
    const isOpenAgreements =
      item.name.startsWith("openagreements-") || sourceLabel === "OpenAgreements";
    const hasPreview = isOpenAgreements;
    const templateDir = resolve(rootDir, "content", "templates", item.name);
    const hasDocxDownload =
      hasPreview &&
      flags.distributable &&
      existsSync(resolve(templateDir, "template.docx"));
    const hasMarkdownDownload =
      hasPreview &&
      flags.distributable &&
      existsSync(resolve(templateDir, "template.md"));

    const templateData = {
      id: item.name,
      displayName: formatName(item.name),
      description: item.description,
      license: item.license || "Recipe",
      isRecipe,
      sourceLabel,
      sourceUrl: getSourceUrl(item),
      sourceDocUrl: item.source_url,
      priorityFields: item.fields.filter((field) => field.required).length,
      totalFields: item.fields.length,
      category,
      hasPreview,
      hasDocxDownload,
      hasMarkdownDownload,
      contentTier,
      repoPath: getContentRepoPath(item.name, contentTier),
      usageDemand: TEMPLATE_USAGE_DEMAND[item.name] ?? 0,
      ...flags,
    };

    if (hasPreview) {
      templateData.fields = item.fields.map((field) => ({
        name: field.name,
        displayName: formatFieldName(field.name),
        type: field.type,
        required: field.required,
        section: field.section || "General",
        description: field.description || "",
        default: field.default != null ? String(field.default) : null,
        defaultValueRationale: field.default_value_rationale || null,
      }));

      templateData.hasRationale = item.fields.some(
        (field) => field.default_value_rationale,
      );

      if (item.market_data_citations?.length) {
        templateData.marketDataCitations = item.market_data_citations;
      }

      const previewDir = resolve(
        rootDir,
        "site",
        "assets",
        "previews",
        item.name,
      );
      if (existsSync(previewDir)) {
        templateData.previewPages = readdirSync(previewDir)
          .filter((file) => file.endsWith(".png"))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((file) => `/assets/previews/${item.name}/${file}`);
      }

    }

    return templateData;
  });

  const categories = CATEGORIES.map((category) => {
    const categoryTemplates = templates.filter(
      (template) => template.category === category.slug,
    );
    const sources = [...new Set(categoryTemplates.map((template) => template.sourceLabel))];
    const usageDemand = categoryTemplates.reduce(
      (sum, template) => sum + template.usageDemand,
      0,
    );
    return {
      slug: category.slug,
      label: category.label,
      description: category.description,
      count: categoryTemplates.length,
      sources,
      usageDemand,
    };
  })
    .filter((category) => category.count > 0)
    // Order groups by real demand (most-used first); ties keep CATEGORIES order.
    .sort((a, b) => b.usageDemand - a.usageDemand);

  const previewTemplates = templates.filter((template) => template.hasPreview);

  return { templates, categories, previewTemplates };
}

export function prepareCatalogDownloads({
  rootDir = REPO_ROOT,
  templates,
  downloadsDir,
}) {
  if (!existsSync(downloadsDir)) {
    mkdirSync(downloadsDir, { recursive: true });
  }

  for (const template of templates) {
    if (template.hasDocxDownload) {
      const sourcePath = resolve(
        rootDir,
        "content",
        "templates",
        template.id,
        "template.docx",
      );
      const destinationPath = resolve(downloadsDir, `${template.id}.docx`);
      if (
        !existsSync(destinationPath) ||
        statSync(destinationPath).mtimeMs < statSync(sourcePath).mtimeMs
      ) {
        copyFileSync(sourcePath, destinationPath);
      }
    }

    if (template.hasMarkdownDownload) {
      const templateDir = resolve(rootDir, "content", "templates", template.id);
      const sourcePath = resolve(templateDir, "template.md");
      const destinationPath = resolve(downloadsDir, `${template.id}.md`);
      if (existsSync(sourcePath)) {
        if (
          !existsSync(destinationPath) ||
          statSync(destinationPath).mtimeMs < statSync(sourcePath).mtimeMs
        ) {
          copyFileSync(sourcePath, destinationPath);
        }
      }
    }
  }
}
