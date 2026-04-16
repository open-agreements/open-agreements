import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';
import {
  styleSlugPattern,
  validateContractIrFrontmatter,
  validateContractIrSchemaRegistry,
  validateContractIrStyleRegistry,
  variableNamePattern,
} from './schema.mjs';
import { renderContractIrToArtifacts } from './render.mjs';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const STYLE_LINE_RE = /^\{style=([a-z0-9][a-z0-9-]*)\}$/;
const EXACT_INLINE_STYLE_RE = /\{[^{}\n]+\}\{style=[a-z0-9][a-z0-9-]*\}/g;
const DOCX_TEMPLATE_TAG_RE =
  /^\{(?:IF !?[a-z_][a-z0-9_]*|END-IF|FOR [A-Za-z_]\w* IN [A-Za-z_]\w*|END-FOR [A-Za-z_]\w*|\$[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\}/;

function readYaml(path, label) {
  const parsed = yaml.load(readFileSync(path, 'utf-8'));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`${label} (${path}) must contain a YAML object`);
  }
  return parsed;
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`Contract IR content document (${filePath}) must start with YAML frontmatter`);
  }

  const frontmatter = yaml.load(match[1]);
  if (!frontmatter || typeof frontmatter !== 'object') {
    throw new Error(`Contract IR frontmatter (${filePath}) must be a YAML object`);
  }

  return {
    frontmatter: validateContractIrFrontmatter(frontmatter, filePath),
    body: match[2],
  };
}

function validateMalformedStyleSyntax(body, filePath) {
  const cleanedInline = body.replace(EXACT_INLINE_STYLE_RE, '');
  const cleanedBlock = cleanedInline.replace(/^\{style=[a-z0-9][a-z0-9-]*\}\s*$/gm, '');

  if (cleanedBlock.includes('{style=')) {
    throw new Error(`Malformed {style=slug} tag in ${filePath}`);
  }
}

function parseBlocks(body, styleRegistry, schemaRegistry, filePath) {
  validateMalformedStyleSyntax(body, filePath);

  const lines = body.split(/\r?\n/);
  const blocks = [];
  let pendingStyle = null;
  let current = [];

  function flushCurrent() {
    if (current.length === 0) {
      return;
    }

    const rawBlock = current.join(' ').trim();
    current = [];
    if (!rawBlock) {
      return;
    }

    const headingMatch = rawBlock.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        blockStyle: pendingStyle,
        inlines: parseInline(headingMatch[2], styleRegistry, schemaRegistry, filePath),
      });
      pendingStyle = null;
      return;
    }

    blocks.push({
      type: 'paragraph',
      blockStyle: pendingStyle,
      inlines: parseInline(rawBlock, styleRegistry, schemaRegistry, filePath),
    });
    pendingStyle = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushCurrent();
      continue;
    }

    if (trimmed.startsWith('{style=')) {
      if (!STYLE_LINE_RE.test(trimmed)) {
        throw new Error(`Malformed {style=slug} tag in ${filePath}: "${trimmed}"`);
      }
      if (current.length > 0) {
        current.push(line);
        continue;
      }
      if (pendingStyle) {
        throw new Error(`Consecutive block style tags without content in ${filePath}`);
      }
      const slug = trimmed.match(STYLE_LINE_RE)[1];
      if (!styleRegistry.block_styles[slug]) {
        throw new Error(`Unknown block style slug "${slug}" in ${filePath}`);
      }
      pendingStyle = slug;
      continue;
    }

    current.push(line);
  }

  flushCurrent();

  if (pendingStyle) {
    throw new Error(`Dangling block style tag "{style=${pendingStyle}}" at end of ${filePath}`);
  }

  return blocks;
}

function parseInline(text, styleRegistry, schemaRegistry, filePath) {
  const nodes = [];
  let cursor = 0;

  function readDelimited(delimiter) {
    const end = text.indexOf(delimiter, cursor + delimiter.length);
    if (end === -1) {
      return null;
    }
    const content = text.slice(cursor + delimiter.length, end);
    cursor = end + delimiter.length;
    return content;
  }

  while (cursor < text.length) {
    if (text.startsWith('{{', cursor)) {
      const end = text.indexOf('}}', cursor + 2);
      if (end === -1) {
        throw new Error(`Unclosed variable tag in ${filePath}: "${text.slice(cursor)}"`);
      }
      const variableName = text.slice(cursor + 2, end).trim();
      if (!variableNamePattern.test(variableName)) {
        throw new Error(`Malformed variable "{{${variableName}}}" in ${filePath}`);
      }
      if (!schemaRegistry.variables[variableName]) {
        throw new Error(`Unknown variable "${variableName}" in ${filePath}`);
      }
      nodes.push({ type: 'variable', name: variableName });
      cursor = end + 2;
      continue;
    }

    if (text.startsWith('***', cursor)) {
      const content = readDelimited('***');
      if (content == null) {
        throw new Error(`Unclosed *** emphasis in ${filePath}`);
      }
      nodes.push({
        type: 'strong_emphasis',
        children: parseInline(content, styleRegistry, schemaRegistry, filePath),
      });
      continue;
    }

    if (text.startsWith('**', cursor)) {
      const content = readDelimited('**');
      if (content == null) {
        throw new Error(`Unclosed ** emphasis in ${filePath}`);
      }
      nodes.push({
        type: 'strong',
        children: parseInline(content, styleRegistry, schemaRegistry, filePath),
      });
      continue;
    }

    if (text[cursor] === '{' && !text.startsWith('{{', cursor)) {
      const inlineMatch = text
        .slice(cursor)
        .match(/^\{([^{}\n]+)\}\{style=([a-z0-9][a-z0-9-]*)\}/);

      if (inlineMatch) {
        const [, target, slug] = inlineMatch;
        if (!styleSlugPattern.test(slug) || !styleRegistry.inline_styles[slug]) {
          throw new Error(`Unknown inline style slug "${slug}" in ${filePath}`);
        }
        nodes.push({
          type: 'styled',
          styleSlug: slug,
          children: parseInline(target, styleRegistry, schemaRegistry, filePath),
        });
        cursor += inlineMatch[0].length;
        continue;
      }

      const docxTemplateTagMatch = text.slice(cursor).match(DOCX_TEMPLATE_TAG_RE);
      if (docxTemplateTagMatch) {
        nodes.push({ type: 'text', value: docxTemplateTagMatch[0] });
        cursor += docxTemplateTagMatch[0].length;
        continue;
      }

      throw new Error(`Malformed inline {style=slug} tag in ${filePath}`);
    }

    if (text[cursor] === '*') {
      const content = readDelimited('*');
      if (content == null) {
        throw new Error(`Unclosed * emphasis in ${filePath}`);
      }
      nodes.push({
        type: 'emphasis',
        children: parseInline(content, styleRegistry, schemaRegistry, filePath),
      });
      continue;
    }

    let nextCursor = cursor + 1;
    while (
      nextCursor < text.length &&
      !text.startsWith('{{', nextCursor) &&
      text[nextCursor] !== '*' &&
      text[nextCursor] !== '{'
    ) {
      nextCursor += 1;
    }
    nodes.push({ type: 'text', value: text.slice(cursor, nextCursor) });
    cursor = nextCursor;
  }

  return nodes;
}

export function loadContractIrTemplate(templateDir) {
  const contentPath = resolve(templateDir, 'content.md');
  const metadataPath = resolve(templateDir, 'metadata.yaml');
  const rawContent = readFileSync(contentPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(rawContent, contentPath);
  const contentDir = dirname(contentPath);

  const schemaPath = resolve(contentDir, frontmatter.schema);
  const stylePath = resolve(contentDir, frontmatter.docStyle);

  const schemaRegistry = validateContractIrSchemaRegistry(
    readYaml(schemaPath, 'Contract IR schema registry'),
    schemaPath
  );
  const styleRegistry = validateContractIrStyleRegistry(
    readYaml(stylePath, 'Contract IR style registry'),
    stylePath
  );

  const blocks = parseBlocks(body, styleRegistry, schemaRegistry, contentPath);

  return {
    templateDir,
    contentPath,
    metadataPath,
    schemaPath,
    stylePath,
    metadata: readYaml(metadataPath, 'Template metadata'),
    frontmatter,
    schemaRegistry,
    styleRegistry,
    blocks,
  };
}

export async function renderContractIrTemplate(templateDir) {
  const template = loadContractIrTemplate(templateDir);
  return {
    template,
    ...(await renderContractIrToArtifacts(template)),
  };
}
