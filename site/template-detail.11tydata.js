// JS computed data eliminates Nunjucks double-escaping.
// When eleventyComputed uses Nunjucks template strings like "{{ t.displayName }}",
// the template engine auto-escapes & → &amp;. Then when the layout renders
// {{ title }}, it escapes again → &amp;amp;. Using JS functions avoids the first
// escape entirely — only the layout's single auto-escape runs, which is correct.
export default {
  eleventyComputed: {
    title: (data) => `${data.t.displayName} | OpenAgreements`,
    description: (data) => data.t.description,
  },
};
