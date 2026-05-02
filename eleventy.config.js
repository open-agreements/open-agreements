import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownIt from "markdown-it";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mdSafe = markdownIt({ html: false, linkify: false });

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

  // canonicalUrl filter: map openagreements.ai paths to usejunior.com equivalents
  eleventyConfig.addNunjucksFilter("canonicalUrl", function (url) {
    const base = "https://usejunior.com/developer-tools/open-agreements";
    const path = url === "/" ? "/" : url.replace(/\/$/, "");

    if (path === "/") return base;
    if (path === "/templates") return `${base}/templates`;
    if (path.startsWith("/templates/")) {
      const slug = path.replace("/templates/", "");
      return `${base}/templates/${slug}`;
    }
    // /docs/*, /trust/* have no equivalent — point to main OA page
    return base;
  });

  // formatReleaseNotes filter: parse GitHub release notes into grouped, clean HTML
  eleventyConfig.addNunjucksFilter("formatReleaseNotes", function (notes) {
    if (!notes || typeof notes !== "string") return "";

    const TYPE_LABELS = [
      ["feat", "Features"],
      ["fix", "Bug Fixes"],
      ["docs", "Documentation"],
      ["refactor", "Refactoring"],
      ["perf", "Performance"],
      ["test", "Tests"],
      ["build", "Build"],
      ["ci", "CI"],
      ["chore", "Chores"],
      ["style", "Style"],
    ];

    // GitHub PR entry: * TITLE by @AUTHOR in URL-or-#N
    const PR_LINE_RE =
      /^\* (.+?) by @[\w.-]+(?:\[bot\])? in (?:https?:\/\/\S+|#\d+)$/;
    const PR_NUM_RE =
      /by @[\w.-]+(?:\[bot\])? in (?:https?:\/\/[^\s]+\/pull\/(\d+)|#(\d+))$/;
    const CC_RE = /^(\w+)(?:\(([^)]+)\))?: (.+)$/;

    const lines = notes.split("\n");

    // If no PR entry lines found, fall back to safe markdown rendering
    if (!lines.some((l) => PR_LINE_RE.test(l.trim()))) {
      return mdSafe.render(notes);
    }

    const warnings = [];
    const groups = {};
    const passthrough = [];
    let skipSection = false;
    let inCustomSection = false;
    let customSectionLines = [];

    function flushCustomSection() {
      if (customSectionLines.length) {
        passthrough.push(mdSafe.render(customSectionLines.join("\n")));
        customSectionLines = [];
      }
      inCustomSection = false;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("## ")) {
        flushCustomSection();
        const heading = trimmed.slice(3).trim();
        if (heading === "What's Changed") {
          skipSection = false;
          inCustomSection = false;
        } else if (heading === "New Contributors") {
          skipSection = true;
          inCustomSection = false;
        } else {
          skipSection = false;
          inCustomSection = true;
          customSectionLines.push(line);
        }
        continue;
      }

      if (skipSection) continue;
      if (trimmed.startsWith("**Full Changelog**")) continue;

      if (trimmed.startsWith("> ")) {
        warnings.push(trimmed.slice(2).trim());
        continue;
      }

      if (PR_LINE_RE.test(trimmed)) {
        const titleMatch = trimmed.match(/^\* (.+?) by @/);
        const prNumMatch = trimmed.match(PR_NUM_RE);
        if (!titleMatch) continue;

        const title = titleMatch[1].trim();
        const prNum = prNumMatch ? (prNumMatch[1] || prNumMatch[2]) : null;
        const ccMatch = title.match(CC_RE);

        if (ccMatch) {
          const [, type, scope, description] = ccMatch;
          const key = type.toLowerCase();
          if (!groups[key]) groups[key] = [];
          groups[key].push({ scope: scope || null, description, pr: prNum });
        } else {
          if (!groups["other"]) groups["other"] = [];
          groups["other"].push({ scope: null, description: title, pr: prNum });
        }
        continue;
      }

      if (inCustomSection) {
        customSectionLines.push(line);
      }
    }

    flushCustomSection();

    let html = "";

    if (warnings.length) {
      const warningContent = warnings
        .map((w) => mdSafe.renderInline(w))
        .join("<br>");
      html += `<div class="cl-warning">${warningContent}</div>\n`;
    }

    const orderedEntries = [];
    const seenKeys = new Set();

    for (const [key, label] of TYPE_LABELS) {
      if (groups[key]) {
        orderedEntries.push([label, groups[key]]);
        seenKeys.add(key);
      }
    }
    for (const key of Object.keys(groups)) {
      if (!seenKeys.has(key) && key !== "other") {
        orderedEntries.push([key, groups[key]]);
      }
    }
    if (groups["other"]) {
      orderedEntries.push(["Other", groups["other"]]);
    }

    for (const [label, entries] of orderedEntries) {
      html += `<div class="cl-group">\n<span class="cl-type-label">${mdSafe.utils.escapeHtml(label)}</span>\n<ul class="cl-entries">\n`;
      for (const { scope, description, pr } of entries) {
        const scopeHtml = scope
          ? `<span class="cl-scope">${mdSafe.utils.escapeHtml(scope)}</span> `
          : "";
        const descHtml = mdSafe.renderInline(description);
        const prHtml = pr ? ` <span class="cl-pr">#${pr}</span>` : "";
        html += `<li>${scopeHtml}${descHtml}${prHtml}</li>\n`;
      }
      html += `</ul>\n</div>\n`;
    }

    for (const block of passthrough) {
      html += `<div class="cl-passthrough">${block}</div>\n`;
    }

    return html;
  });

  // rawMarkdown filter: reads the source .md and strips frontmatter
  eleventyConfig.addNunjucksFilter("rawMarkdown", function (inputPath) {
    try {
      const abs = resolve(inputPath);
      const src = readFileSync(abs, "utf8");
      return src.replace(/^---[\s\S]*?---\n*/, "");
    } catch {
      return "";
    }
  });
  eleventyConfig.addPassthroughCopy("site/assets");
  eleventyConfig.addPassthroughCopy("site/.well-known");
  eleventyConfig.addPassthroughCopy("site/downloads");
  eleventyConfig.addPassthroughCopy("site/schemas");
  eleventyConfig.ignores.add("site/downloads/**/*.md");
  eleventyConfig.ignores.add("site/trust/system-card.md");

  // site/downloads/ is generated at build time and gitignored, but Eleventy still
  // needs to passthrough-copy those generated files into _site/.
  eleventyConfig.setUseGitIgnore(false);

  return {
    dir: {
      input: "site",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
  };
}
