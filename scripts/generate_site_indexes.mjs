import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";

const SITE_ORIGIN = (process.env.SITE_URL || "https://openagreements.ai").replace(/\/+$/, "");
const OUTPUT_DIR = resolve(process.cwd(), "_site");
const STATIC_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp4",
  ".mov",
  ".pdf",
  ".zip",
  ".doc",
  ".docx",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

function walkFiles(dirPath) {
  const files = [];
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosixPath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function htmlFileToRoute(filePath) {
  const rel = toPosixPath(relative(OUTPUT_DIR, filePath));
  if (rel === "index.html") {
    return "/";
  }
  if (rel.endsWith("/index.html")) {
    const route = `/${rel.slice(0, -"/index.html".length)}`;
    return route || "/";
  }
  if (rel.endsWith(".html")) {
    return `/${rel.slice(0, -".html".length)}`;
  }
  return null;
}

function routeToAbsoluteUrl(route) {
  if (route === "/") {
    return `${SITE_ORIGIN}/`;
  }
  return `${SITE_ORIGIN}${route}`;
}

function extractTitle(htmlContent) {
  const match = htmlContent.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) {
    return "";
  }
  return collapseWhitespace(match[1]);
}

function extractDescription(htmlContent) {
  const metaTags = htmlContent.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (!/name=["']description["']/i.test(tag)) {
      continue;
    }
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (contentMatch) {
      return collapseWhitespace(contentMatch[1]);
    }
  }
  return "";
}

function collapseWhitespace(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extensionFromPath(pathname) {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  const lastDot = cleanPath.lastIndexOf(".");
  if (lastDot === -1) {
    return "";
  }
  return cleanPath.slice(lastDot).toLowerCase();
}

function normalizeInternalHref(rawHref, sourceRoute) {
  const href = rawHref.trim();
  if (!href) {
    return null;
  }
  if (/^(mailto:|tel:|javascript:)/i.test(href)) {
    return null;
  }

  if (href.startsWith("#")) {
    return sourceRoute === "/" ? `/${href}` : `${sourceRoute}${href}`;
  }

  let localHref = href;
  if (/^https?:\/\//i.test(href)) {
    const parsed = new URL(href);
    if (parsed.origin !== SITE_ORIGIN) {
      return null;
    }
    localHref = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } else if (!href.startsWith("/")) {
    return null;
  }

  const hashIndex = localHref.indexOf("#");
  const hash = hashIndex >= 0 ? localHref.slice(hashIndex) : "";
  const pathAndQuery = hashIndex >= 0 ? localHref.slice(0, hashIndex) : localHref;
  const queryIndex = pathAndQuery.indexOf("?");
  const query = queryIndex >= 0 ? pathAndQuery.slice(queryIndex) : "";
  let pathname = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;

  pathname = pathname || "/";
  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return `${pathname}${query}${hash}`;
}

function extractInternalLinks(htmlContent, sourceRoute) {
  const results = [];
  const anchorPattern = /<a\s+[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(htmlContent))) {
    const normalizedHref = normalizeInternalHref(match[2], sourceRoute);
    if (!normalizedHref) {
      continue;
    }
    const linkText = collapseWhitespace(match[3].replace(/<[^>]*>/g, " "));
    results.push({
      href: normalizedHref,
      text: linkText,
    });
  }

  return results;
}

function isIndexableInternalLink(href) {
  const pathname = href.split("?")[0].split("#")[0];
  const extension = extensionFromPath(pathname);
  if (!extension) {
    return true;
  }
  return !STATIC_EXTENSIONS.has(extension);
}

function xmlEscape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const allFiles = walkFiles(OUTPUT_DIR);
const htmlFiles = allFiles.filter((filePath) => filePath.endsWith(".html"));

const pages = htmlFiles
  .map((filePath) => {
    const route = htmlFileToRoute(filePath);
    if (!route) {
      return null;
    }
    const htmlContent = readFileSync(filePath, "utf8");
    const fileStats = statSync(filePath);
    return {
      route,
      absoluteUrl: routeToAbsoluteUrl(route),
      title: extractTitle(htmlContent),
      description: extractDescription(htmlContent),
      lastmod: fileStats.mtime.toISOString().slice(0, 10),
      sourceFile: toPosixPath(relative(OUTPUT_DIR, filePath)),
      links: extractInternalLinks(htmlContent, route),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.route.localeCompare(b.route));

const uniqueLinkMap = new Map();
for (const page of pages) {
  for (const link of page.links) {
    if (!isIndexableInternalLink(link.href)) {
      continue;
    }
    if (!uniqueLinkMap.has(link.href)) {
      uniqueLinkMap.set(link.href, link.text || link.href);
    } else if (!uniqueLinkMap.get(link.href) && link.text) {
      uniqueLinkMap.set(link.href, link.text);
    }
  }
}

const helpfulLinks = [...uniqueLinkMap.entries()]
  .map(([href, text]) => ({ href, text: text || href }))
  .sort((a, b) => a.href.localeCompare(b.href));

const canonicalEntries = ["/", "/templates"]
  .map((route) => pages.find((page) => page.route === route))
  .filter(Boolean);

const generatedIso = new Date().toISOString();
const llmsLines = [
  "# OpenAgreements",
  "",
  `> LLM-friendly index for ${SITE_ORIGIN}. Generated during build at ${generatedIso}.`,
  "",
  "## Canonical entry points",
];

if (canonicalEntries.length === 0) {
  llmsLines.push("- No canonical pages were found in the generated HTML.");
} else {
  for (const page of canonicalEntries) {
    const label = page.title || page.route;
    const desc = page.description ? ` - ${page.description}` : "";
    llmsLines.push(`- [${label}](${page.absoluteUrl})${desc}`);
  }
}

llmsLines.push("");
llmsLines.push("## Page index");
for (const page of pages) {
  const label = page.title || page.route;
  const desc = page.description ? ` - ${page.description}` : "";
  llmsLines.push(`- [${label}](${page.absoluteUrl})${desc}`);
}

llmsLines.push("");
llmsLines.push("## Helpful internal links");
for (const link of helpfulLinks) {
  llmsLines.push(`- [${link.text}](${routeToAbsoluteUrl(link.href)})`);
}

llmsLines.push("");
llmsLines.push("## Discovery files");
llmsLines.push(`- [sitemap.xml](${SITE_ORIGIN}/sitemap.xml)`);
llmsLines.push(`- [llms-full.txt](${SITE_ORIGIN}/llms-full.txt)`);
llmsLines.push("");

const llmsFullLines = [
  "# OpenAgreements Full LLM Index",
  "",
  `Generated: ${generatedIso}`,
  `Origin: ${SITE_ORIGIN}`,
  "",
  `## Pages (${pages.length})`,
];

for (const page of pages) {
  const title = page.title || page.route;
  const description = page.description || "No meta description set.";
  llmsFullLines.push(
    `- [${title}](${page.absoluteUrl}) | route=${page.route} | source=${page.sourceFile} | description=${description}`,
  );
}

llmsFullLines.push("");
llmsFullLines.push(`## Internal links (${helpfulLinks.length})`);
for (const link of helpfulLinks) {
  llmsFullLines.push(`- [${link.text}](${routeToAbsoluteUrl(link.href)})`);
}
llmsFullLines.push("");

const sitemapLines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

for (const page of pages) {
  sitemapLines.push("  <url>");
  sitemapLines.push(`    <loc>${xmlEscape(page.absoluteUrl)}</loc>`);
  sitemapLines.push(`    <lastmod>${page.lastmod}</lastmod>`);
  sitemapLines.push("    <changefreq>weekly</changefreq>");
  sitemapLines.push(`    <priority>${page.route === "/" ? "1.0" : "0.7"}</priority>`);
  sitemapLines.push("  </url>");
}
sitemapLines.push("</urlset>");
sitemapLines.push("");

const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

writeFileSync(resolve(OUTPUT_DIR, "llms.txt"), `${llmsLines.join("\n")}\n`, "utf8");
writeFileSync(resolve(OUTPUT_DIR, "llms-full.txt"), `${llmsFullLines.join("\n")}\n`, "utf8");
writeFileSync(resolve(OUTPUT_DIR, "sitemap.xml"), sitemapLines.join("\n"), "utf8");
writeFileSync(resolve(OUTPUT_DIR, "robots.txt"), robotsTxt, "utf8");

console.log(
  `[generate_site_indexes] Wrote llms.txt, llms-full.txt, sitemap.xml, and robots.txt for ${pages.length} pages.`,
);
