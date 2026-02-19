import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(syntaxHighlight);
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
