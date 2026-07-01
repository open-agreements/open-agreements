import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { loadMetadata } from '../metadata.js';
import { extractSearchText } from '../field-selector/replacement-keys.js';

export interface TemplateValidationResult {
  templateId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Extract text content from a DOCX file by unzipping and reading word/document.xml.
 * Concatenates <w:t> text within each <w:p> paragraph, then joins paragraphs with
 * newlines to prevent false {tag} matches across element boundaries.
 */
function extractDocxText(docxPath: string): string {
  const zip = new AdmZip(docxPath);
  const documentXml = zip.getEntry('word/document.xml');
  if (!documentXml) return '';
  const xml = documentXml.getData().toString('utf-8');

  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textParts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(paraXml)) !== null) {
      textParts.push(tMatch[1]);
    }
    if (textParts.length > 0) {
      paragraphs.push(textParts.join(''));
    }
  }
  return paragraphs.join('\n');
}

/** Decode the handful of XML entities that OOXML escaping can introduce into
 *  `<w:t>` text (notably `&amp;` for `&` in a URL), so a captured bracket URL
 *  compares equal to the raw `authority_url` from metadata.yaml. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Enforce the `statutory_compliance_representation` contract against the rendered
 * template text. This is the load-bearing guard that the decided `confirm=`
 * behavior actually shipped — three checks per field:
 *
 *  1. The clause renders the highlighted `[CONFIRM before signing: …; see <url>]`
 *     bracket gated on `{IF !<field>}`. Presence of a bare `{IF !field}` is NOT
 *     sufficient (the legacy `when=field omitted="…"` mechanism also emits one),
 *     so the negated conditional MUST be immediately followed by the literal
 *     bracket.
 *  2. The URL and note inside the bracket EQUAL the field's metadata
 *     `authority_url` / `confirm_note`. These now have a single authoring source
 *     (metadata.yaml — the directive no longer restates them), so this is no
 *     longer an author-drift check between two hand-edited files. It is an
 *     integrity check between metadata.yaml and the COMMITTED rendered artifact:
 *     `validateTemplate` scans the committed `template.docx`, so a stale DOCX (or
 *     `.template.generated.json`) — e.g. a metadata edit shipped without
 *     regenerating — is caught here, as are hand-authored JSON templates that
 *     carry `confirm`/`authority_url`/`confirm_note` directly. Equality, not
 *     substring: a value with an extra suffix must fail.
 *  3. The clause body always renders — i.e. the affirmative `{IF <field>}` form
 *     is absent. A `confirm=` clause only ever emits `{IF !<field>}`; a legacy
 *     `when=<field>` clause wraps its body in `{IF <field>}`. Asserting the
 *     affirmative form is absent proves the body is unconditional and closes the
 *     spoof where an `omitted="[CONFIRM …]"` string mimics the bracket.
 */
export function checkStatutoryComplianceReps(
  searchableText: string,
  fields: { name: string; statutory_compliance_representation?: boolean; authority_url?: string; confirm_note?: string }[],
  errors: string[],
): void {
  const scrFields = fields.filter((f) => f.statutory_compliance_representation === true);
  if (scrFields.length === 0) return;

  // Capture the field, the note, and the URL. The note uses a lazy `[\s\S]*?` so
  // a literal `]` inside it does not truncate the match; the URL is the
  // non-space, non-`]` run after "; see ".
  const confirmRe = /\{IF !(\w+)\}\s*\[CONFIRM before signing: ([\s\S]*?); see ([^\]\s]+)\]/g;
  const bracketByField = new Map<string, { note: string; url: string }>();
  let match: RegExpExecArray | null;
  while ((match = confirmRe.exec(searchableText)) !== null) {
    bracketByField.set(match[1], {
      note: decodeXmlEntities(match[2]),
      url: decodeXmlEntities(match[3]),
    });
  }

  for (const field of scrFields) {
    const bracket = bracketByField.get(field.name);
    if (bracket === undefined) {
      errors.push(
        `statutory_compliance_representation field "${field.name}" must be gated by a clause confirm= — ` +
        `no "{IF !${field.name}} [CONFIRM before signing: …; see <url>]" bracket found in the rendered template`
      );
      continue;
    }
    const { note, url } = bracket;
    if (field.authority_url && url !== field.authority_url) {
      errors.push(
        `statutory_compliance_representation field "${field.name}" authority_url ` +
        `("${field.authority_url}") does not match the URL in its rendered [CONFIRM …] bracket ` +
        `("${url}") — metadata.yaml and the committed rendered template have drifted (regenerate the template)`
      );
    }
    if (field.confirm_note && note !== field.confirm_note) {
      errors.push(
        `statutory_compliance_representation field "${field.name}" confirm_note ` +
        `("${field.confirm_note}") does not match the note in its rendered [CONFIRM …] bracket ` +
        `("${note}") — metadata.yaml and the committed rendered template have drifted (regenerate the template)`
      );
    }
    // The recital body must render unconditionally: a confirm= clause never
    // wraps its body in an affirmative {IF <field>}.
    if (searchableText.includes(`{IF ${field.name}}`)) {
      errors.push(
        `statutory_compliance_representation field "${field.name}" must use confirm= (the recital body ` +
        `always renders); found an affirmative "{IF ${field.name}}" indicating legacy when=/omitted gating`
      );
    }
  }
}

/**
 * Validate that a template's metadata fields match the placeholders in its DOCX file.
 */
export function validateTemplate(templateDir: string, templateId: string): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let metadata;
  try {
    metadata = loadMetadata(templateDir);
  } catch (err) {
    return {
      templateId,
      valid: false,
      errors: [`Failed to load metadata: ${(err as Error).message}`],
      warnings: [],
    };
  }

  const templatePath = join(templateDir, 'template.docx');
  if (!existsSync(templatePath)) {
    return {
      templateId,
      valid: false,
      errors: ['template.docx not found in template directory'],
      warnings: [],
    };
  }

  // Skip the `{field}` placeholder-coverage / FOR / multiselect scans below ONLY
  // for a genuinely humanized render: a DOCX that carries no OA fill tokens
  // ({field} / {IF …} / {FOR …} / {$…} / {END…}) AND ships a `template.mdoc`
  // provenance twin marking it as LE-authored bracketed prose for manual
  // completion.
  //
  // Both signals are required, and neither alone is sufficient:
  //   - Gating on the `.mdoc` marker alone (the previous behavior) silently
  //     disabled fill-token validation for machine-fillable templates, because
  //     every LE-projected template now ships a `.mdoc` twin — so a fill-token
  //     DOCX like board-consent-safe / closing-checklist stopped being checked.
  //   - Gating on token-absence alone masks a fill template whose DOCX is simply
  //     MISSING its required placeholders (that must still error).
  // So: a token-bearing DOCX is always validated; a token-less DOCX with no
  // `.mdoc` twin is treated as a fill template with missing tokens and validated
  // (reporting them); only token-less + `.mdoc` is a humanized render and skipped.
  //
  // The unsafe-tag security scan is defense-in-depth and runs for EVERY committed
  // DOCX regardless of authorship (a DOCX must never carry docx-templates
  // control/code tags).
  const docxTextForTokenScan = extractDocxText(templatePath);
  const docxHasFillTokens = /\{(?:IF |FOR |END|\$|\w+\})/.test(docxTextForTokenScan);
  const hasMdocTwin = existsSync(join(templateDir, 'template.mdoc'));
  if (!docxHasFillTokens && hasMdocTwin) {
    const rawXml = extractRawDocumentXml(templatePath);
    if (rawXml) {
      scanForUnsafeTemplateTags(rawXml, errors);
    }
    return { templateId, valid: errors.length === 0, errors, warnings };
  }

  const metadataFieldNames = new Set(metadata.fields.map((f) => f.name));
  const priorityFieldNames = new Set(metadata.priority_fields);
  const multiselectFieldNames = new Set(
    metadata.fields
      .filter((field) => field.type === 'multiselect')
      .map((field) => field.name)
  );
  const derivedBooleanMultiselects = metadata.fields.filter(
    (field) => field.type === 'multiselect' && field.derive_booleans === true
  );
  // Map from multiselect field name → set of derived `<option>_enabled` keys.
  // Used below to suppress the "field not in DOCX" warning ONLY when at least
  // one of the field's derived keys is actually referenced in the template.
  // A derive_booleans multiselect with zero derived references is genuinely
  // unused and should still warn (or error if priority-listed).
  const derivedKeysByField = new Map<string, Set<string>>(
    derivedBooleanMultiselects.map((field) => [
      field.name,
      new Set((field.options ?? []).map((option) => `${option}_enabled`)),
    ])
  );

  const rejectDirectMultiselectConditionals = (foundConditionalFields: Set<string>): void => {
    for (const fieldName of multiselectFieldNames) {
      if (!foundConditionalFields.has(fieldName)) {
        continue;
      }
      errors.push(
        `Multiselect field "${fieldName}" must not be referenced directly in {IF ${fieldName}} ` +
        `(empty arrays are truthy); use derived <option>_enabled keys ` +
        `(when derive_booleans: true) or restructure your template logic.`
      );
    }
  };

  // Check if this template uses declarative replacements
  const replacementsPath = join(templateDir, 'replacements.json');
  const hasReplacements = existsSync(replacementsPath);

  if (hasReplacements) {
    // Declarative pipeline: tags are in replacement values, not DOCX text.
    // Validate replacement keys exist in DOCX, and replacement value tags match metadata.
    let replacements: Record<string, string>;
    try {
      replacements = JSON.parse(readFileSync(replacementsPath, 'utf-8'));
    } catch (err) {
      return {
        templateId,
        valid: false,
        errors: [`Failed to parse replacements.json: ${(err as Error).message}`],
        warnings,
      };
    }

    const docxText = extractDocxText(templatePath);

    // Validate replacement keys exist in the original DOCX text
    for (const key of Object.keys(replacements)) {
      const searchText = extractSearchText(key);
      if (!docxText.includes(searchText)) {
        errors.push(
          `Replacement key "${searchText}" not found in template.docx`
        );
      }
    }

    // Collect {tags} from replacement values and the DOCX text
    const foundTags = new Set<string>();
    const replacementTags = new Set<string>(); // tags specifically from replacement values
    const foundConditionalFields = new Set<string>();

    // Tags from replacement values (these will exist after patching)
    for (const value of Object.values(replacements)) {
      const placeholderRegex = /\{(\w+)\}/g;
      let match;
      while ((match = placeholderRegex.exec(value)) !== null) {
        foundTags.add(match[1]);
        replacementTags.add(match[1]);
      }
      const conditionalRegex = /\{IF !?(\w+)\}/g;
      let condMatch;
      while ((condMatch = conditionalRegex.exec(value)) !== null) {
        foundConditionalFields.add(condMatch[1]);
      }
    }

    // Tags already in the DOCX (may exist alongside replacements)
    const docxPlaceholderRegex = /\{(\w+)\}/g;
    let docxMatch;
    while ((docxMatch = docxPlaceholderRegex.exec(docxText)) !== null) {
      foundTags.add(docxMatch[1]);
    }
    const docxConditionalRegex = /\{IF !?(\w+)\}/g;
    let docxCondMatch;
    while ((docxCondMatch = docxConditionalRegex.exec(docxText)) !== null) {
      foundConditionalFields.add(docxCondMatch[1]);
    }

    rejectDirectMultiselectConditionals(foundConditionalFields);

    // Check metadata fields are covered by tags
    for (const fieldName of metadataFieldNames) {
      const derivedKeys = derivedKeysByField.get(fieldName);
      if (derivedKeys) {
        // Suppress coverage warning ONLY if at least one derived key is
        // actually referenced. Otherwise the multiselect is dead weight and
        // the warning/error should fire normally.
        const anyDerivedReferenced = [...derivedKeys].some(
          (key) => foundTags.has(key) || foundConditionalFields.has(key)
        );
        if (anyDerivedReferenced) {
          continue;
        }
      }
      const inTags = foundTags.has(fieldName) || foundConditionalFields.has(fieldName);
      if (!inTags) {
        if (priorityFieldNames.has(fieldName)) {
          errors.push(
            `Priority field "${fieldName}" defined in metadata but not found in replacement values or template.docx`
          );
        } else {
          warnings.push(
            `Optional field "${fieldName}" defined in metadata but not found in replacement values or template.docx`
          );
        }
      }
    }

    // Check for tags not in metadata — replacement-injected tags are errors
    // (they cause runtime ReferenceError), DOCX-native tags are warnings.
    const controlTokens = new Set(['IF', 'END']);
    for (const tag of foundTags) {
      if (controlTokens.has(tag)) continue;
      if (!metadataFieldNames.has(tag)) {
        if (replacementTags.has(tag)) {
          errors.push(
            `Replacement-injected field {${tag}} not defined in metadata — will cause runtime error during fill`
          );
        } else {
          warnings.push(
            `Placeholder {${tag}} found in template but not defined in metadata fields`
          );
        }
      }
    }

    // Confirm brackets may be injected via replacement values, so search both
    // the original DOCX text and the replacement values.
    checkStatutoryComplianceReps(
      `${docxText}\n${Object.values(replacements).join('\n')}`,
      metadata.fields,
      errors,
    );
  } else {
    // Original behavior: scan DOCX text directly for {tags}
    const text = extractDocxText(templatePath);
    const placeholderRegex = /\{(\w+)\}/g;
    const foundTags = new Set<string>();
    let match;
    while ((match = placeholderRegex.exec(text)) !== null) {
      foundTags.add(match[1]);
    }

    const conditionalRegex = /\{IF !?(\w+)\}/g;
    const foundConditionalFields = new Set<string>();
    let condMatch;
    while ((condMatch = conditionalRegex.exec(text)) !== null) {
      foundConditionalFields.add(condMatch[1]);
    }

    rejectDirectMultiselectConditionals(foundConditionalFields);

    // Extract array field names + item bindings from FOR loop constructs.
    // Each loop has shape `{FOR <item> IN <field>}` and references look like
    // `{$<item>.<rowField>}`. Validate that <field> is declared array-typed in
    // metadata and that <rowField> references resolve through the field's items.
    const forLoopRegex = /\{FOR (\w+) IN (\w+)\}/g;
    const repeatItemBindings = new Map<string, string>(); // item -> field
    let forMatch;
    while ((forMatch = forLoopRegex.exec(text)) !== null) {
      const itemName = forMatch[1];
      const collectionName = forMatch[2];
      foundTags.add(collectionName);
      repeatItemBindings.set(itemName, collectionName);

      const field = metadata.fields.find((f) => f.name === collectionName);
      if (!field) {
        errors.push(
          `{FOR ${itemName} IN ${collectionName}} references "${collectionName}" but it is not defined in metadata fields`
        );
      } else if (field.type !== 'array') {
        errors.push(
          `{FOR ${itemName} IN ${collectionName}} requires "${collectionName}" to be type=array in metadata; declared type=${field.type}`
        );
      }
    }

    // Validate {$item.rowField} references against metadata items shape.
    const itemRefRegex = /\{\$(\w+)\.(\w+)\}/g;
    let itemRefMatch;
    while ((itemRefMatch = itemRefRegex.exec(text)) !== null) {
      const itemName = itemRefMatch[1];
      const rowFieldName = itemRefMatch[2];
      const collectionName = repeatItemBindings.get(itemName);
      if (!collectionName) {
        errors.push(
          `{$${itemName}.${rowFieldName}} references item "${itemName}" but no enclosing {FOR ${itemName} IN ...} was found`
        );
        continue;
      }
      const field = metadata.fields.find((f) => f.name === collectionName);
      if (!field || !field.items) continue; // already errored above, or no shape declared
      const itemField = field.items.find((sub) => sub.name === rowFieldName);
      if (!itemField) {
        errors.push(
          `{$${itemName}.${rowFieldName}} references "${rowFieldName}" but "${collectionName}.items" does not declare it`
        );
      }
    }

    // Security: scan for docx-templates control/code tags that should not exist
    // in open-source templates. Only simple {identifier} tags are allowed.
    const rawXml = extractRawDocumentXml(templatePath);
    if (rawXml) {
      scanForUnsafeTemplateTags(rawXml, errors);
    }

    // Check for fields in metadata but not in DOCX
    for (const fieldName of metadataFieldNames) {
      const derivedKeys = derivedKeysByField.get(fieldName);
      if (derivedKeys) {
        // See the parallel branch above: only suppress when at least one
        // derived key is actually referenced.
        const anyDerivedReferenced = [...derivedKeys].some(
          (key) => foundTags.has(key) || foundConditionalFields.has(key)
        );
        if (anyDerivedReferenced) {
          continue;
        }
      }
      const inDocx = foundTags.has(fieldName) || foundConditionalFields.has(fieldName);
      if (!inDocx) {
        if (priorityFieldNames.has(fieldName)) {
          errors.push(
            `Priority field "${fieldName}" defined in metadata but not found as {${fieldName}} in template.docx`
          );
        } else {
          warnings.push(
            `Optional field "${fieldName}" defined in metadata but not found as {${fieldName}} in template.docx`
          );
        }
      }
    }

    // Check for placeholders in DOCX but not in metadata
    const controlTokens = new Set(['IF', 'END']);
    for (const tag of foundTags) {
      if (controlTokens.has(tag)) continue;
      if (!metadataFieldNames.has(tag)) {
        warnings.push(
          `Placeholder {${tag}} found in template.docx but not defined in metadata fields`
        );
      }
    }

    checkStatutoryComplianceReps(text, metadata.fields, errors);
  }

  return { templateId, valid: errors.length === 0, errors, warnings };
}

/**
 * Extract raw word/document.xml string from a DOCX file.
 */
function extractRawDocumentXml(docxPath: string): string | null {
  const zip = new AdmZip(docxPath);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) return null;
  return entry.getData().toString('utf-8');
}

/**
 * Allowed tag patterns:
 *   {identifier}                  — simple placeholder
 *   {IF [!]identifier}            — conditional start
 *   {END-IF}                      — conditional end
 *   {FOR var IN identifier}       — loop start (docx-templates)
 *   {END-FOR var}                 — loop end
 *   {$var.field} / {$var.a.b}     — loop variable access
 */
const SAFE_TAG_RE = /^\{(?:[a-zA-Z_][a-zA-Z0-9_]*|IF !?[a-zA-Z_][a-zA-Z0-9_]*|END-IF|FOR [a-zA-Z_]\w* IN [a-zA-Z_]\w*|END-FOR [a-zA-Z_]\w*|\$[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+)\}$/;

/**
 * Scan the raw OOXML text content for any {…} tokens and reject ones that
 * are not simple identifiers. This blocks docx-templates control tags
 * ({#if}, {/if}, {>partial}, {= expression}, etc.) that could execute
 * arbitrary code in the Node VM sandbox.
 *
 * We extract text from <w:t> elements and scan for curly-brace tokens,
 * then also check across run boundaries within paragraphs.
 */
function scanForUnsafeTemplateTags(xml: string, errors: string[]): void {
  // Extract all text content from <w:t> elements and reassemble per-paragraph
  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textParts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(paraXml)) !== null) {
      textParts.push(tMatch[1]);
    }
    if (textParts.length > 0) {
      paragraphs.push(textParts.join(''));
    }
  }

  const fullText = paragraphs.join('\n');

  // Find all {…} tokens in the reassembled text
  const tokenRegex = /\{[^}]+\}/g;
  let tokenMatch;
  while ((tokenMatch = tokenRegex.exec(fullText)) !== null) {
    const token = tokenMatch[0];
    if (!SAFE_TAG_RE.test(token)) {
      errors.push(
        `Unsafe template tag "${token}" found in template.docx. ` +
        `Only simple {identifier}, {IF [!]identifier}, and {END-IF} tags are allowed. ` +
        `Control tags ({#...}, {/...}, {>...}, {=...}) are not permitted in open-source templates.`
      );
    }
  }
}
