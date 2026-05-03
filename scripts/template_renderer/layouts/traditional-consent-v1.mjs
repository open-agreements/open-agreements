import {
  AlignmentType,
  Document,
  Footer,
  LineRuleType,
  PageNumber,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  UnderlineType,
} from 'docx';

const INLINE_BOLD_RE = /\*\*([^*]+)\*\*/g;

// Traditional Delaware corporate consents use a serif body face. The shared
// OpenAgreements default style profile is sans-serif (used by employment
// templates), so this layout overrides fonts.body locally before any helper
// reads it. See renderTraditionalConsentV1 for the override site.
const TRADITIONAL_BODY_FONT = 'Times New Roman';

function buildDocumentStyles(style) {
  return {
    default: {
      document: {
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: 0,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: 0,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    ],
  };
}

function inlineBoldRuns(text, baseRun) {
  const runs = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_BOLD_RE)) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...baseRun, text: text.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({ ...baseRun, text: match[1], bold: true }));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ ...baseRun, text: text.slice(lastIndex) }));
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ ...baseRun, text: '' }));
  }
  return runs;
}

function bodyParagraph(text, style, opts = {}) {
  return new Paragraph({
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? style.spacing.body_after,
      line: opts.line ?? style.spacing.line,
    },
    alignment: opts.alignment,
    children: inlineBoldRuns(text, {
      font: style.fonts.body,
      size: opts.size ?? 22,
      color: opts.color ?? style.colors.ink,
      italics: opts.italics ?? false,
      bold: opts.bold ?? false,
    }),
  });
}

function titleParagraph(title, style) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: 0,
      after: style.spacing.body_after,
      line: style.spacing.line,
    },
    children: [
      new TextRun({
        text: title,
        font: style.fonts.body,
        size: 22,
        bold: true,
        color: style.colors.ink,
      }),
    ],
  });
}

function clauseHeadingParagraph(heading, style) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: style.spacing.clause_heading_before,
      after: style.spacing.clause_heading_after,
      line: style.spacing.line,
    },
    children: [
      new TextRun({
        text: heading,
        font: style.fonts.body,
        size: 22,
        bold: true,
        underline: { type: UnderlineType.SINGLE, color: style.colors.ink },
        color: style.colors.ink,
      }),
    ],
  });
}

function paragraphsFromBody(body, style) {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => bodyParagraph(line, style, { size: 22, after: style.spacing.body_after }));
}

function clauseParagraphs(clauseItem, style) {
  if (clauseItem.type === 'definitions') {
    // Definitions clauses are uncommon in consents and the cover-standard layout's
    // OAClauseHeading + definitionSubParagraphs infrastructure isn't trivially
    // portable to centered/underlined headings. Add support when a consent
    // template needs it.
    throw new Error('traditional-consent-v1 does not yet support definitions clauses');
  }
  return [
    clauseHeadingParagraph(clauseItem.heading, style),
    ...paragraphsFromBody(clauseItem.body, style),
  ];
}

function signaturePageBreakParagraph(style) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: style.spacing.body_after,
      after: style.spacing.body_after,
      line: style.spacing.line,
    },
    children: [
      new TextRun({
        text: '[Signature Page Follows]',
        font: style.fonts.body,
        size: 22,
        color: style.colors.ink,
      }),
    ],
  });
}

function repeatingSignatureRowText(row) {
  const lowerLabel = row.label.toLowerCase();
  if (lowerLabel === 'signature' || lowerLabel === 'signature line') {
    return row.value || '______________________________';
  }
  // Traditional signature blocks place the printed name bare under the signature
  // line (no "Print Name:" prefix), matching the Cooley/Joey reference structure.
  if (lowerLabel === 'print name' || lowerLabel === 'name') {
    return row.value || '_______________';
  }
  if (!row.value) {
    return `${row.label}: _______________`;
  }
  return `${row.label}: ${row.value}`;
}

function repeatingStackedSignatureParagraphs(signatureSpec, style) {
  if (!signatureSpec.repeat) {
    throw new Error('traditional-consent-v1 signatures require repeat metadata');
  }
  if (signatureSpec.signers.length !== 1) {
    throw new Error(
      `traditional-consent-v1 repeat-backed signatures require exactly 1 signer prototype; received ${signatureSpec.signers.length}`
    );
  }

  const signer = signatureSpec.signers[0];
  const paragraphs = [];

  paragraphs.push(
    bodyParagraph(`{FOR ${signatureSpec.repeat.item_name} IN ${signatureSpec.repeat.collection_field}}`, style, {
      size: 22,
      after: 0,
    })
  );

  signer.rows.forEach((row, index) => {
    const isLastRow = index === signer.rows.length - 1;
    paragraphs.push(
      new Paragraph({
        spacing: {
          before: index === 0 ? style.spacing.clause_heading_before : 0,
          after: isLastRow ? style.spacing.body_after : 0,
          line: style.spacing.line,
        },
        keepNext: !isLastRow,
        keepLines: true,
        widowControl: true,
        children: inlineBoldRuns(repeatingSignatureRowText(row), {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        }),
      })
    );
  });

  paragraphs.push(
    bodyParagraph(`{END-FOR ${signatureSpec.repeat.item_name}}`, style, {
      size: 22,
      after: style.spacing.body_after,
    })
  );

  return paragraphs;
}

function signaturePreambleParagraphs(text, style) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => bodyParagraph(line, style, { size: 22, after: style.spacing.body_after }));
}

function plainFooter(docLabel, version, style) {
  const baseRun = {
    font: style.fonts.body,
    size: 13,
    color: style.colors.ink_soft,
  };
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: `${docLabel} (v${version}). Free to use under CC BY 4.0.`, ...baseRun }),
          new TextRun({ text: '\tPage ', ...baseRun }),
          new TextRun({ children: [PageNumber.CURRENT], ...baseRun }),
          new TextRun({ text: ' of ', ...baseRun }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], ...baseRun }),
        ],
      }),
    ],
  });
}

function appendSignatureMarkdown(lines, signatureSection) {
  for (const preambleParagraph of signatureSection.preamble.split('\n').map((line) => line.trim()).filter(Boolean)) {
    lines.push(preambleParagraph);
    lines.push('');
  }
  if (signatureSection.mode === 'signers' && signatureSection.arrangement === 'stacked' && signatureSection.repeat) {
    const signer = signatureSection.signers[0];
    lines.push(`{FOR ${signatureSection.repeat.item_name} IN ${signatureSection.repeat.collection_field}}`);
    lines.push('');
    for (const row of signer.rows) {
      lines.push(repeatingSignatureRowText(row));
      lines.push('');
    }
    lines.push(`{END-FOR ${signatureSection.repeat.item_name}}`);
    lines.push('');
    return;
  }
  throw new Error('traditional-consent-v1 only supports repeat-backed stacked signatures');
}

function renderMarkdown(spec) {
  const { document, sections } = spec;
  const lines = [];
  lines.push(`# ${document.title}`);
  lines.push('');
  lines.push(`${document.label} (v${document.version}). ${document.license}.`);
  lines.push('');
  // document.opening_note is intentionally not rendered into the document body.
  // It remains available on the contract spec for MCP consumers to surface.
  if (document.opening_recital) {
    lines.push(document.opening_recital);
    lines.push('');
  }
  for (const clause of sections.standard_terms.clauses) {
    if (clause.type === 'definitions') continue;
    lines.push(`## ${clause.heading}`);
    lines.push('');
    lines.push(clause.body);
    lines.push('');
  }
  lines.push('[Signature Page Follows]');
  lines.push('');
  appendSignatureMarkdown(lines, sections.signature);
  return lines.join('\n');
}

export function renderTraditionalConsentV1(spec, baseStyle) {
  const { document, sections } = spec;
  // Override the shared profile's body face just for this layout; every helper
  // reads style.fonts.body, so this single substitution carries through.
  const style = { ...baseStyle, fonts: { ...baseStyle.fonts, body: TRADITIONAL_BODY_FONT } };

  const bodyChildren = [];
  bodyChildren.push(titleParagraph(document.title, style));
  // document.opening_note is exposed to MCP consumers via the contract spec
  // but is deliberately not painted onto the DOCX body — traditional consents
  // (Cooley/Joey reference) carry no in-document drafting note.
  if (document.opening_recital) {
    for (const para of paragraphsFromBody(document.opening_recital, style)) {
      bodyChildren.push(para);
    }
  }
  for (const clause of sections.standard_terms.clauses) {
    for (const para of clauseParagraphs(clause, style)) {
      bodyChildren.push(para);
    }
  }
  bodyChildren.push(signaturePageBreakParagraph(style));

  const signatureChildren = [];
  for (const para of signaturePreambleParagraphs(sections.signature.preamble, style)) {
    signatureChildren.push(para);
  }
  for (const para of repeatingStackedSignatureParagraphs(sections.signature, style)) {
    signatureChildren.push(para);
  }

  const docxDoc = new Document({
    styles: buildDocumentStyles(style),
    sections: [
      {
        properties: { page: { margin: style.page_margin } },
        footers: { default: plainFooter(document.label, document.version, style) },
        children: bodyChildren,
      },
      {
        properties: { page: { margin: style.page_margin } },
        footers: { default: plainFooter(document.label, document.version, style) },
        children: signatureChildren,
      },
    ],
  });

  return {
    document: docxDoc,
    markdown: renderMarkdown(spec),
  };
}
