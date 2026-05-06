import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertCanonicalIdentity,
  parseCanonicalFrontmatter,
} from './canonical-frontmatter.mjs';
import { validateContractSpec } from './schema.mjs';

const DIRECTIVE_RE = /^<!--\s*oa:([a-z-]+)(?:\s+([\s\S]*?))?\s*-->$/;
const ATTR_RE = /([a-z_][a-z0-9_-]*)=(?:"([^"]*)"|([^\s]+))/g;
const TOP_LEVEL_SECTION_RE = /^##\s+(.+)$/;
const CLAUSE_HEADING_RE = /^###\s+(.+)$/;
const BOLD_ONLY_RE = /^\*\*(.+)\*\*$/;
const BRACKET_REFERENCE_RE = /\[\[([^[\]]+?)\]\]/g;
const FIELD_NAME_RE = /^[a-z_][a-z0-9_]*$/;
const ALWAYS = 'always';
const LEADING_ARTICLE_RE = /^(?:a|an|the)$/i;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeNumberedHeading(text) {
  return text
    .replace(/^\d+\.\d+\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .trim();
}

function slugifyLabel(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function directiveFromLine(line) {
  const match = line.trim().match(DIRECTIVE_RE);
  if (!match) {
    return null;
  }

  const attrs = {};
  const rawAttrs = match[2] ?? '';
  let cursor = 0;

  for (const attrMatch of rawAttrs.matchAll(ATTR_RE)) {
    if (attrMatch.index !== undefined) {
      const skipped = rawAttrs.slice(cursor, attrMatch.index).trim();
      if (skipped.length > 0) {
        throw new Error(`Malformed oa:${match[1]} directive: "${line.trim()}"`);
      }
      cursor = attrMatch.index + attrMatch[0].length;
    }

    attrs[attrMatch[1]] = attrMatch[2] ?? attrMatch[3] ?? '';
  }

  if (rawAttrs.slice(cursor).trim().length > 0) {
    throw new Error(`Malformed oa:${match[1]} directive: "${line.trim()}"`);
  }

  return {
    name: match[1],
    attrs,
  };
}

function splitTopLevelSections(body, filePath) {
  const sections = [];
  const lines = body.split(/\r?\n/);
  let currentTitle = null;
  let currentLines = [];

  for (const line of lines) {
    const match = line.match(TOP_LEVEL_SECTION_RE);
    if (match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, lines: currentLines });
      }
      currentTitle = normalizeNumberedHeading(match[1]);
      currentLines = [];
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, lines: currentLines });
  }

  const byTitle = new Map(sections.map((section) => [section.title, section.lines]));
  for (const requiredTitle of ['Standard Terms', 'Signatures']) {
    if (!byTitle.has(requiredTitle)) {
      throw new Error(`Canonical source (${filePath}) is missing required "## ${requiredTitle}" section`);
    }
  }

  return byTitle;
}

function paragraphsFromLines(lines) {
  const paragraphs = [];
  let current = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) {
      if (current.length > 0) {
        paragraphs.push(current.map((part) => part.trim()).join(' '));
        current = [];
      }
      continue;
    }
    current.push(line);
  }

  if (current.length > 0) {
    paragraphs.push(current.map((part) => part.trim()).join(' '));
  }

  return paragraphs;
}

function paragraphTextFromLines(lines) {
  return paragraphsFromLines(lines).join('\n\n');
}

function parseMarkdownTable(lines, filePath) {
  invariant(lines.length >= 2, `Canonical source (${filePath}) has an incomplete markdown table`);

  const rows = lines
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()));

  invariant(rows.length >= 2, `Canonical source (${filePath}) must include a header row and divider row`);

  const headers = rows[0].map((header) => header.toLowerCase());
  const divider = rows[1];
  invariant(
    divider.every((cell) => /^:?-{3,}:?$/.test(cell)),
    `Canonical source (${filePath}) has an invalid markdown table divider`
  );

  return rows.slice(2).map((cells, index) => {
    invariant(
      cells.length === headers.length,
      `Canonical source (${filePath}) table row ${index + 1} has ${cells.length} cells; expected ${headers.length}`
    );

    return Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]]));
  });
}

function conditionFromValue(raw, filePath, label) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value || value.toLowerCase() === ALWAYS) {
    return undefined;
  }
  invariant(
    FIELD_NAME_RE.test(value),
    `Canonical source (${filePath}) uses invalid condition "${value}" on ${label}`
  );
  return value;
}

function parseCoverTerms(lines, filePath) {
  const tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  invariant(tableStart >= 0, `Canonical source (${filePath}) is missing the Cover Terms table`);

  const proseLines = lines
    .slice(0, tableStart)
    .filter((line) => !directiveFromLine(line));
  const tableLines = lines.slice(tableStart).filter((line) => line.trim().startsWith('|'));
  const rows = parseMarkdownTable(tableLines, filePath);

  return {
    subtitle: paragraphTextFromLines(proseLines),
    rows: rows.map((row, index) => {
      const kind = row.kind?.toLowerCase();
      invariant(
        kind === 'row' || kind === 'group' || kind === 'subrow',
        `Canonical source (${filePath}) has invalid cover row kind "${row.kind}" on row ${index + 1}`
      );
      invariant(row.label?.length > 0, `Canonical source (${filePath}) cover row ${index + 1} is missing a label`);

      return {
        kind,
        label: row.label,
        value: row.value ?? '',
        condition: conditionFromValue(
          row.when ?? row['show when'],
          filePath,
          `cover row "${row.label}"`
        ),
      };
    }),
  };
}

function parseAliases(aliasChunk, filePath, contextLabel) {
  const aliases = [];
  const rawMatches = [...aliasChunk.matchAll(BRACKET_REFERENCE_RE)];
  invariant(rawMatches.length > 0, `Canonical source (${filePath}) ${contextLabel} has an empty Aliases directive`);

  for (const match of rawMatches) {
    const alias = match[1].trim();
    invariant(alias.length > 0, `Canonical source (${filePath}) ${contextLabel} has an empty alias`);
    aliases.push(alias);
  }

  const leftover = aliasChunk.replace(BRACKET_REFERENCE_RE, '').replace(/[,\s]/g, '');
  invariant(
    leftover.length === 0,
    `Canonical source (${filePath}) ${contextLabel} uses invalid alias syntax; aliases must be comma-separated [[...]] spans`
  );

  return aliases;
}

function consumeAliasDirective(text, filePath, contextLabel) {
  const leadingWhitespaceMatch = text.match(/^\s*/);
  const leadingWhitespace = leadingWhitespaceMatch?.[0] ?? '';
  const trimmedLead = text.slice(leadingWhitespace.length);

  if (!trimmedLead.startsWith('(')) {
    return { aliases: [], remainder: text };
  }

  const match = trimmedLead.match(/^\(([^)]*)\)([\s\S]*)$/);
  if (!match) {
    return { aliases: [], remainder: text };
  }

  const directiveMatch = match[1].trim().match(/^aliases?\s*:\s*([\s\S]+)$/i);
  if (!directiveMatch) {
    return { aliases: [], remainder: text };
  }

  return {
    aliases: parseAliases(directiveMatch[1].trim(), filePath, contextLabel),
    remainder: `${leadingWhitespace}${match[2]}`,
  };
}

function parseDefinitionParagraph(paragraph, filePath, index) {
  const matches = [...paragraph.matchAll(BRACKET_REFERENCE_RE)];
  invariant(
    matches.length > 0,
    `Canonical source (${filePath}) definition paragraph ${index + 1} must contain a canonical [[Defined Term]]`
  );

  const first = matches[0];
  const prefix = paragraph.slice(0, first.index).trim();
  invariant(
    prefix.length === 0 || LEADING_ARTICLE_RE.test(prefix),
    `Canonical source (${filePath}) definition paragraph ${index + 1} may only place an optional leading article before the canonical [[Defined Term]]`
  );

  const term = first[1].trim();
  invariant(term.length > 0, `Canonical source (${filePath}) definition paragraph ${index + 1} has an empty canonical term`);

  const afterCanonical = paragraph.slice(first.index + first[0].length);
  const { aliases, remainder } = consumeAliasDirective(
    afterCanonical,
    filePath,
    `definition "${term}"`
  );
  const definition = remainder.trim();
  invariant(
    definition.length > 0,
    `Canonical source (${filePath}) definition "${term}" is missing definition text after the declaration`
  );

  return {
    term,
    ...(aliases.length > 0 ? { aliases } : {}),
    definition,
  };
}

function parseDefinitionsClauseBody(lines, filePath) {
  const terms = [];
  const seenTerms = new Set();
  const paragraphs = paragraphsFromLines(lines);

  invariant(paragraphs.length > 0, `Canonical source (${filePath}) definitions clause has no definition paragraphs`);

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const parsed = parseDefinitionParagraph(paragraph, filePath, index);

    invariant(
      !seenTerms.has(parsed.term),
      `Canonical source (${filePath}) has duplicate defined term "${parsed.term}"`
    );
    seenTerms.add(parsed.term);

    terms.push(parsed);
  }

  return terms;
}

function parseStandardTerms(lines, filePath) {
  const clauses = [];
  const seenClauseIds = new Set();
  let pendingDirective = null;
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (line.length === 0) {
      index += 1;
      continue;
    }

    const directive = directiveFromLine(rawLine);
    if (directive) {
      pendingDirective = directive;
      index += 1;
      continue;
    }

    const headingMatch = line.match(CLAUSE_HEADING_RE);
    invariant(headingMatch, `Canonical source (${filePath}) standard terms must use "### Clause" headings`);
    invariant(
      pendingDirective?.name === 'clause',
      `Canonical source (${filePath}) clause "${normalizeNumberedHeading(headingMatch[1])}" is missing an oa:clause directive`
    );
    invariant(
      pendingDirective.attrs.id,
      `Canonical source (${filePath}) clause "${normalizeNumberedHeading(headingMatch[1])}" is missing an id`
    );

    const id = pendingDirective.attrs.id;
    invariant(!seenClauseIds.has(id), `Canonical source (${filePath}) has duplicate clause id "${id}"`);
    seenClauseIds.add(id);

    const clauseDirective = pendingDirective;
    pendingDirective = null;
    index += 1;

    const clauseLines = [];
    while (index < lines.length) {
      const nextLine = lines[index];
      const nextDirective = directiveFromLine(nextLine);
      if (nextDirective?.name === 'clause' || CLAUSE_HEADING_RE.test(nextLine.trim())) {
        break;
      }
      clauseLines.push(nextLine);
      index += 1;
    }

    const heading = normalizeNumberedHeading(headingMatch[1]);
    if (clauseDirective.attrs.type === 'definitions') {
      clauses.push({
        id,
        type: 'definitions',
        heading,
        terms: parseDefinitionsClauseBody(clauseLines, filePath),
      });
      continue;
    }

    const condition = conditionFromValue(
      clauseDirective.attrs.when ?? clauseDirective.attrs.condition,
      filePath,
      `clause "${id}"`
    );
    const omittedBody = clauseDirective.attrs.omitted ?? clauseDirective.attrs.omitted_body;

    clauses.push({
      id,
      heading,
      body: paragraphTextFromLines(clauseLines),
      ...(condition ? { condition } : {}),
      ...(omittedBody ? { omitted_body: omittedBody } : {}),
    });
  }

  return clauses;
}

function normalizeSignatureValue(value) {
  return /^_+$/.test(value) ? '' : value;
}

function normalizeRepeatingSignerReference(value, repeatItemName) {
  if (!repeatItemName || !value) {
    return value;
  }

  return value.replace(new RegExp(`\\{${repeatItemName}\\.`, 'g'), `{$${repeatItemName}.`);
}

function parseSignerRows(lines, signerLabel, filePath, opts = {}) {
  const rows = [];
  const seenIds = new Set();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const boldOnlyMatch = line.match(BOLD_ONLY_RE);
    if (boldOnlyMatch) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    invariant(
      separatorIndex > 0,
      `Canonical source (${filePath}) signer "${signerLabel}" must use "Label: value" lines`
    );

    const label = line.slice(0, separatorIndex).trim();
    const id = slugifyLabel(label);
    invariant(id.length > 0, `Canonical source (${filePath}) signer "${signerLabel}" has an empty row label`);
    invariant(!seenIds.has(id), `Canonical source (${filePath}) signer "${signerLabel}" has duplicate row id "${id}"`);
    seenIds.add(id);

    rows.push({
      id,
      label,
      value: normalizeRepeatingSignerReference(
        normalizeSignatureValue(line.slice(separatorIndex + 1).trim()),
        opts.repeatItemName
      ),
    });
  }

  invariant(rows.length > 0, `Canonical source (${filePath}) signer "${signerLabel}" has no signature rows`);
  return rows;
}

function parseSignatures(lines, filePath) {
  const signers = [];
  const seenSignerIds = new Set();
  let signatureMode = null;
  let repeat = null;
  let currentSigner = null;
  let currentLines = [];
  const preambleLines = [];

  function flushCurrentSigner() {
    if (!currentSigner) {
      return;
    }
    signers.push({
      ...currentSigner,
      rows: parseSignerRows(currentLines, currentSigner.label, filePath, {
        repeatItemName: repeat?.item_name,
      }),
    });
    currentSigner = null;
    currentLines = [];
  }

  for (const rawLine of lines) {
    const directive = directiveFromLine(rawLine);
    if (!directive) {
      if (currentSigner) {
        currentLines.push(rawLine);
      } else {
        preambleLines.push(rawLine);
      }
      continue;
    }

    if (directive.name === 'signature-mode') {
      invariant(!signatureMode, `Canonical source (${filePath}) declares oa:signature-mode more than once`);
      signatureMode = directive.attrs.arrangement || directive.attrs.id || 'stacked';
      const repeatCollection = directive.attrs.repeat;
      const repeatItemName = directive.attrs.item;
      invariant(
        Boolean(repeatCollection) === Boolean(repeatItemName),
        `Canonical source (${filePath}) repeat-backed oa:signature-mode must declare both repeat and item`
      );
      if (repeatCollection) {
        invariant(
          FIELD_NAME_RE.test(repeatCollection),
          `Canonical source (${filePath}) uses invalid repeat collection "${repeatCollection}" in oa:signature-mode`
        );
        invariant(
          FIELD_NAME_RE.test(repeatItemName),
          `Canonical source (${filePath}) uses invalid repeat item "${repeatItemName}" in oa:signature-mode`
        );
        invariant(
          signatureMode === 'stacked',
          `Canonical source (${filePath}) repeat-backed oa:signature-mode requires arrangement=stacked`
        );
        repeat = {
          collection_field: repeatCollection,
          item_name: repeatItemName,
        };
      }
      continue;
    }

    if (directive.name === 'signer') {
      flushCurrentSigner();
      invariant(directive.attrs.id, `Canonical source (${filePath}) signer directive is missing an id`);
      invariant(directive.attrs.kind, `Canonical source (${filePath}) signer "${directive.attrs.id}" is missing a kind`);
      invariant(
        !seenSignerIds.has(directive.attrs.id),
        `Canonical source (${filePath}) has duplicate signer id "${directive.attrs.id}"`
      );
      seenSignerIds.add(directive.attrs.id);
      currentSigner = {
        id: directive.attrs.id,
        label: directive.attrs.label || directive.attrs.id,
        kind: directive.attrs.kind,
        capacity: directive.attrs.capacity,
      };
      continue;
    }

    throw new Error(`Canonical source (${filePath}) has unsupported oa:${directive.name} directive in Signatures`);
  }

  flushCurrentSigner();
  invariant(signatureMode, `Canonical source (${filePath}) is missing an oa:signature-mode directive`);
  invariant(signers.length > 0, `Canonical source (${filePath}) must declare at least one signer`);
  if (repeat) {
    invariant(
      signers.length === 1,
      `Canonical source (${filePath}) repeat-backed stacked signatures require exactly one signer prototype`
    );
  }

  return {
    arrangement: signatureMode,
    ...(repeat ? { repeat } : {}),
    preamble: paragraphTextFromLines(preambleLines),
    signers,
  };
}

function buildDefinitionRegistry(clauses, filePath) {
  const registry = new Map();

  for (const clause of clauses) {
    if (clause.type !== 'definitions') {
      continue;
    }

    for (const term of clause.terms) {
      invariant(
        !registry.has(term.term),
        `Canonical source (${filePath}) reuses canonical defined term "${term.term}"`
      );
      registry.set(term.term, term.term);

      for (const alias of term.aliases ?? []) {
        invariant(
          !registry.has(alias),
          `Canonical source (${filePath}) alias collision on "${alias}"`
        );
        registry.set(alias, term.term);
      }
    }
  }

  return registry;
}

function buildClauseHeadingMap(clauses) {
  const clauseHeadings = new Map();

  for (const clause of clauses) {
    clauseHeadings.set(clause.id, clause.heading);
  }

  return clauseHeadings;
}

function resolveExplicitReferences(text, definitionRegistry, clauseHeadings, filePath) {
  if (!text) {
    return text;
  }

  return text.replace(BRACKET_REFERENCE_RE, (_match, rawTarget) => {
    const target = rawTarget.trim();
    const lowerTarget = target.toLowerCase();

    if (lowerTarget.startsWith('clause:')) {
      const clauseId = target.slice(target.indexOf(':') + 1).trim();
      const clauseHeading = clauseHeadings.get(clauseId);
      if (!clauseHeading) {
        throw new Error(`Canonical source (${filePath}) references unknown clause id "${clauseId}"`);
      }
      return clauseHeading;
    }

    if (lowerTarget.startsWith('def:')) {
      throw new Error(
        `Canonical source (${filePath}) uses legacy [[def:...]] syntax; replace it with [[${target.slice(target.indexOf(':') + 1).trim()}]]`
      );
    }

    if (!definitionRegistry.has(target)) {
      throw new Error(`Canonical source (${filePath}) references unknown defined term or alias "${target}"`);
    }

    return target;
  });
}

function normalizeCanonicalTemplate(frontmatter, sections, filePath) {
  const definitionRegistry = buildDefinitionRegistry(sections.standard_terms.clauses, filePath);
  const clauseHeadings = buildClauseHeadingMap(sections.standard_terms.clauses);

  return {
    template_id: frontmatter.template_id,
    layout_id: frontmatter.layout_id,
    style_id: frontmatter.style_id,
    outputs: frontmatter.outputs ?? {},
    document: frontmatter.document,
    sections: {
      ...(sections.cover_terms ? {
        cover_terms: {
          subtitle: resolveExplicitReferences(
            sections.cover_terms.subtitle,
            definitionRegistry,
            clauseHeadings,
            filePath
          ),
          rows: sections.cover_terms.rows.map((row) => ({
            ...row,
            value: resolveExplicitReferences(row.value, definitionRegistry, clauseHeadings, filePath),
          })),
        },
      } : {}),
      standard_terms: {
        clauses: sections.standard_terms.clauses.map((clause) => (
          clause.type === 'definitions'
            ? {
                ...clause,
                terms: clause.terms.map((term) => ({
                  ...term,
                  definition: resolveExplicitReferences(
                    term.definition,
                    definitionRegistry,
                    clauseHeadings,
                    filePath
                  ),
                })),
              }
            : {
                ...clause,
                body: resolveExplicitReferences(clause.body, definitionRegistry, clauseHeadings, filePath),
                omitted_body: clause.omitted_body
                  ? resolveExplicitReferences(clause.omitted_body, definitionRegistry, clauseHeadings, filePath)
                  : undefined,
              }
        )),
      },
      signature: {
        arrangement: sections.signature.arrangement,
        ...(sections.signature.repeat ? { repeat: sections.signature.repeat } : {}),
        preamble: resolveExplicitReferences(
          sections.signature.preamble,
          definitionRegistry,
          clauseHeadings,
          filePath
        ),
        signers: sections.signature.signers.map((signer) => ({
          ...signer,
          rows: signer.rows.map((row) => ({
            ...row,
            value: resolveExplicitReferences(row.value, definitionRegistry, clauseHeadings, filePath),
          })),
        })),
      },
    },
  };
}

function projectToContractSpec(normalized, frontmatter, filePath) {
  const outputDocxPath = normalized.outputs.docx ?? frontmatter.output_docx_path;

  invariant(outputDocxPath, `Canonical source (${filePath}) is missing outputs.docx`);
  invariant(
    !normalized.outputs.markdown && !frontmatter.output_markdown_path,
    `Canonical source (${filePath}) must not declare output_markdown_path; the canonical template.md is itself the source`
  );
  invariant(frontmatter.sections?.standard_terms, `Canonical source (${filePath}) is missing frontmatter sections.standard_terms`);
  invariant(frontmatter.sections?.signature, `Canonical source (${filePath}) is missing frontmatter sections.signature`);
  invariant(
    !frontmatter.sections?.cover_terms || normalized.sections.cover_terms,
    `Canonical source (${filePath}) declares frontmatter sections.cover_terms but is missing the "## Cover Terms" body section`
  );
  invariant(
    !normalized.sections.cover_terms || frontmatter.sections?.cover_terms,
    `Canonical source (${filePath}) has a "## Cover Terms" body section but is missing frontmatter sections.cover_terms`
  );

  return validateContractSpec({
    template_id: normalized.template_id,
    layout_id: normalized.layout_id,
    style_id: normalized.style_id,
    output_docx_path: outputDocxPath,
    document: normalized.document,
    sections: {
      ...(normalized.sections.cover_terms ? {
        cover_terms: {
          section_label: frontmatter.sections.cover_terms.section_label,
          heading_title: frontmatter.sections.cover_terms.heading_title,
          subtitle: normalized.sections.cover_terms.subtitle,
          rows: normalized.sections.cover_terms.rows.map((row) => ({
            kind: row.kind,
            label: row.label,
            value: row.value,
            ...(row.condition ? { condition: row.condition } : {}),
            ...(row.kind === 'subrow' ? { sub: true } : {}),
          })),
        },
      } : {}),
      standard_terms: {
        section_label: frontmatter.sections.standard_terms.section_label,
        heading_title: frontmatter.sections.standard_terms.heading_title,
        clauses: normalized.sections.standard_terms.clauses.map((clause) => (
          clause.type === 'definitions'
            ? {
                id: clause.id,
                type: 'definitions',
                heading: clause.heading,
                terms: clause.terms.map((term) => ({
                  term: term.term,
                  ...(term.aliases?.length ? { aliases: term.aliases } : {}),
                  definition: term.definition,
                })),
              }
            : {
                id: clause.id,
                heading: clause.heading,
                body: clause.body,
                ...(clause.condition ? { condition: clause.condition } : {}),
                ...(clause.omitted_body ? { omitted_body: clause.omitted_body } : {}),
              }
        )),
      },
      signature: {
        mode: 'signers',
        arrangement: normalized.sections.signature.arrangement,
        ...(normalized.sections.signature.repeat ? { repeat: normalized.sections.signature.repeat } : {}),
        section_label: frontmatter.sections.signature.section_label,
        heading_title: frontmatter.sections.signature.heading_title,
        preamble: normalized.sections.signature.preamble,
        signers: normalized.sections.signature.signers.map((signer) => ({
          id: signer.id,
          label: signer.label,
          kind: signer.kind,
          ...(signer.capacity ? { capacity: signer.capacity } : {}),
          rows: signer.rows,
        })),
      },
    },
  }, filePath);
}

export function compileCanonicalSourceString(raw, filePath = 'canonical source') {
  const { frontmatter, body } = parseCanonicalFrontmatter(raw, filePath);
  const sectionLines = splitTopLevelSections(body, filePath);

  assertCanonicalIdentity(frontmatter, filePath);
  invariant(frontmatter.document, `Canonical source (${filePath}) is missing document frontmatter`);

  const normalized = normalizeCanonicalTemplate(frontmatter, {
    ...(sectionLines.has('Cover Terms')
      ? { cover_terms: parseCoverTerms(sectionLines.get('Cover Terms'), filePath) }
      : {}),
    standard_terms: {
      clauses: parseStandardTerms(sectionLines.get('Standard Terms'), filePath),
    },
    signature: parseSignatures(sectionLines.get('Signatures'), filePath),
  }, filePath);

  return {
    frontmatter,
    normalized,
    contractSpec: projectToContractSpec(normalized, frontmatter, filePath),
  };
}

export function compileCanonicalSourceFile(path) {
  const filePath = resolve(path);
  return compileCanonicalSourceString(readFileSync(filePath, 'utf-8'), filePath);
}
