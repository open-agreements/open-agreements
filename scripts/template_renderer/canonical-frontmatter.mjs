import yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseCanonicalFrontmatter(raw, filePath) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`Canonical source (${filePath}) must start with YAML frontmatter`);
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(match[1]);
  } catch (err) {
    throw new Error(`Canonical source frontmatter (${filePath}) failed to parse: ${err.message}`);
  }

  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error(`Canonical source frontmatter (${filePath}) must be a YAML object`);
  }

  return { frontmatter, body: match[2] };
}

export function tryParseCanonicalFrontmatter(raw) {
  try {
    return parseCanonicalFrontmatter(raw, '<probe>');
  } catch {
    return null;
  }
}

export function hasCanonicalIdentity(frontmatter) {
  return (
    typeof frontmatter?.template_id === 'string' &&
    typeof frontmatter?.layout_id === 'string' &&
    typeof frontmatter?.style_id === 'string'
  );
}

export function assertCanonicalIdentity(frontmatter, filePath) {
  if (!frontmatter?.template_id) {
    throw new Error(`Canonical source (${filePath}) is missing template_id`);
  }
  if (!frontmatter.layout_id) {
    throw new Error(`Canonical source (${filePath}) is missing layout_id`);
  }
  if (!frontmatter.style_id) {
    throw new Error(`Canonical source (${filePath}) is missing style_id`);
  }
}
