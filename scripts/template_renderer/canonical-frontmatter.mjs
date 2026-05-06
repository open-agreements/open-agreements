import yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export function parseCanonicalFrontmatter(raw, filePath) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`Canonical source (${filePath}) must start with YAML frontmatter`);
  }

  let frontmatter;
  try {
    frontmatter = yaml.load(match[1]);
  } catch (err) {
    throw new Error(
      `Canonical source frontmatter (${filePath}) failed to parse: ${err.message}`,
      { cause: err },
    );
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

export function assertCanonicalIdentity(frontmatter, filePath) {
  if (!isNonEmptyString(frontmatter?.template_id)) {
    throw new Error(`Canonical source (${filePath}) is missing template_id`);
  }
  if (!isNonEmptyString(frontmatter?.layout_id)) {
    throw new Error(`Canonical source (${filePath}) is missing layout_id`);
  }
  if (!isNonEmptyString(frontmatter?.style_id)) {
    throw new Error(`Canonical source (${filePath}) is missing style_id`);
  }
}
