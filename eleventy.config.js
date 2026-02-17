export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("site/assets");
  eleventyConfig.addPassthroughCopy("site/main.js");
  eleventyConfig.addPassthroughCopy("site/templates-filter.js");
  eleventyConfig.addPassthroughCopy("site/.well-known");
  eleventyConfig.addPassthroughCopy("site/styles.css");
  eleventyConfig.addPassthroughCopy("site/downloads");
  eleventyConfig.ignores.add("site/downloads/**/*.md");

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
