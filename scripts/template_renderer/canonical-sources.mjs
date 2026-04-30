import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tryParseCanonicalFrontmatter } from './canonical-frontmatter.mjs';

const TEMPLATES_DIR = 'content/templates';
const CANONICAL_TEMPLATE_FILENAME = 'template.md';
const CANONICAL_GENERATED_JSON_FILENAME = '.template.generated.json';
const HAND_AUTHORED_JSON_FILENAME = 'template.json';

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Discovery probes shape only (any string in the three identity fields).
// Strict non-empty validation happens later in compileCanonicalSourceString()
// via assertCanonicalIdentity().
function hasCanonicalIdentityShape(frontmatter) {
  return (
    typeof frontmatter?.template_id === 'string' &&
    typeof frontmatter?.layout_id === 'string' &&
    typeof frontmatter?.style_id === 'string'
  );
}

function isCanonicalSource(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return false;
  }
  const parsed = tryParseCanonicalFrontmatter(raw);
  return parsed !== null && hasCanonicalIdentityShape(parsed.frontmatter);
}

function fileExists(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function discoverTemplateSources(repoRoot) {
  const templatesDir = join(repoRoot, TEMPLATES_DIR);
  const sources = [];

  for (const slug of readdirSync(templatesDir)) {
    const dir = join(templatesDir, slug);
    if (!isDirectory(dir)) continue;

    const canonicalPath = join(dir, CANONICAL_TEMPLATE_FILENAME);
    if (fileExists(canonicalPath) && isCanonicalSource(canonicalPath)) {
      sources.push({
        slug,
        type: 'canonical',
        templatePath: relative(repoRoot, canonicalPath),
        jsonPath: relative(repoRoot, join(dir, CANONICAL_GENERATED_JSON_FILENAME)),
      });
      continue;
    }

    const handAuthoredPath = join(dir, HAND_AUTHORED_JSON_FILENAME);
    if (fileExists(handAuthoredPath)) {
      sources.push({
        slug,
        type: 'json',
        templatePath: null,
        jsonPath: relative(repoRoot, handAuthoredPath),
      });
    }
  }

  return sources.sort((a, b) => a.slug.localeCompare(b.slug));
}
