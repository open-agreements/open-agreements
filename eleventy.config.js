import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);

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
  eleventyConfig.addPassthroughCopy("site/main.js");
  eleventyConfig.addPassthroughCopy("site/templates-filter.js");
  eleventyConfig.addPassthroughCopy("site/.well-known");
  eleventyConfig.addPassthroughCopy("site/styles.css");
  eleventyConfig.addPassthroughCopy("site/downloads");
  eleventyConfig.addPassthroughCopy("site/schemas");
  eleventyConfig.ignores.add("site/downloads/**/*.md");

  // The docs .md files are gitignored (they're copied from docs/ at build time)
  // but Eleventy needs to process them, so disable gitignore-based ignoring.
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
