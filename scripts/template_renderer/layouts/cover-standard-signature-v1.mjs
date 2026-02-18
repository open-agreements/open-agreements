import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  LineRuleType,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

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
      {
        id: 'OAClauseHeading',
        name: 'OA Clause Heading',
        basedOn: 'Normal',
        next: 'OAClauseBody',
        quickFormat: true,
        run: {
          font: style.fonts.body,
          size: 22,
          bold: true,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: style.spacing.clause_heading_before,
            after: style.spacing.clause_heading_after,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
      {
        id: 'OAClauseBody',
        name: 'OA Clause Body',
        basedOn: 'Normal',
        next: 'OAClauseHeading',
        quickFormat: true,
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: style.spacing.body_after,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    ],
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function runsWithDefinedTerms(text, style, opts = {}) {
  const runSize = opts.size ?? 16;
  const runFont = opts.font ?? style.fonts.body;
  const terms = opts.terms ?? style.defined_terms;
  const termSet = new Set(terms);
  const termPattern = terms.length > 0 ? new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'g') : null;
  const parts = termPattern ? text.split(termPattern) : [text];

  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const isTerm = termSet.has(part);
      return new TextRun({
        text: part,
        font: runFont,
        size: runSize,
        bold: opts.bold || isTerm,
        italics: opts.italics ?? false,
        color: opts.color ?? (isTerm ? style.colors.accent : style.colors.ink),
      });
    });
}

function createBorders(style) {
  const nilBorder = {
    style: BorderStyle.NIL,
    color: 'FFFFFF',
    size: 0,
  };
  const ruleBorder = {
    style: BorderStyle.SINGLE,
    color: style.colors.rule,
    size: style.sizes.table_rule,
  };
  return { nilBorder, ruleBorder };
}

function sectionHeader(label, style, nilBorder) {
  return new Header({
    children: [
      new Table({
        width: { size: 10070, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: style.table_widths.section_header,
        borders: {
          top: {
            style: BorderStyle.SINGLE,
            color: style.colors.accent_deep,
            size: style.sizes.header_accent_rule,
          },
          left: nilBorder,
          bottom: nilBorder,
          right: nilBorder,
          insideH: nilBorder,
          insideV: nilBorder,
        },
        rows: [
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                borders: {
                  top: nilBorder,
                  left: nilBorder,
                  bottom: nilBorder,
                  right: nilBorder,
                },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun('')] })],
              }),
              new TableCell({
                borders: {
                  top: nilBorder,
                  left: nilBorder,
                  bottom: nilBorder,
                  right: nilBorder,
                },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: label.toUpperCase(),
                        font: style.fonts.body,
                        size: 18,
                        bold: true,
                        color: style.colors.accent_deep,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun('')],
      }),
    ],
  });
}

function sectionFooter(docLabel, version, includeCloudDocLine, style) {
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
          new TextRun({
            text: `${docLabel} (v${version}). Free to use under CC BY 4.0.`,
            ...baseRun,
          }),
          new TextRun({ text: '\tPage ', ...baseRun }),
          new TextRun({ children: [PageNumber.CURRENT], ...baseRun }),
          new TextRun({ text: ' of ', ...baseRun }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], ...baseRun }),
        ],
      }),
      ...(includeCloudDocLine
        ? [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: '{cloud_drive_id_footer}',
                  font: style.fonts.body,
                  size: 12,
                  color: style.colors.ink_soft,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function buildSection(sectionLabel, documentLabel, documentVersion, children, style, nilBorder, opts = {}) {
  return {
    properties: {
      page: {
        margin: style.page_margin,
      },
    },
    headers: {
      default: sectionHeader(sectionLabel, style, nilBorder),
    },
    footers: {
      default: sectionFooter(documentLabel, documentVersion, opts.include_cloud_doc_line === true, style),
    },
    children,
  };
}

function bodyParagraph(text, style, opts = {}) {
  return new Paragraph({
    style: opts.style,
    contextualSpacing: false,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? style.spacing.body_after,
      line: opts.line ?? style.spacing.line,
      beforeAutoSpacing: false,
      afterAutoSpacing: false,
    },
    alignment: opts.alignment,
    children: runsWithDefinedTerms(text, style, {
      size: opts.size ?? 22,
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color,
      terms: opts.terms,
    }),
  });
}

function noteParagraph(text, style) {
  return bodyParagraph(text, style, {
    italics: true,
    size: 16,
    color: style.colors.ink_soft,
    after: style.spacing.note_after,
    terms: [],
  });
}

function titleParagraph(text, style) {
  return new Paragraph({
    spacing: { before: style.spacing.title_before, after: style.spacing.title_after },
    children: [
      new TextRun({
        text,
        font: style.fonts.heading,
        size: 44,
        color: style.colors.ink,
      }),
    ],
  });
}

function sectionTitleParagraph(text, style) {
  return new Paragraph({
    contextualSpacing: false,
    spacing: {
      before: 0,
      after: style.spacing.section_title_after,
      line: style.spacing.line,
      beforeAutoSpacing: false,
      afterAutoSpacing: false,
    },
    children: [
      new TextRun({
        text,
        font: style.fonts.body,
        size: 22,
        bold: true,
        color: style.colors.accent,
      }),
    ],
  });
}

function horizontalBorders(ruleBorder, nilBorder) {
  return {
    top: ruleBorder,
    left: nilBorder,
    bottom: ruleBorder,
    right: nilBorder,
  };
}

function rowHeadingCell(titleText, subtitleText, style, nilBorder, ruleBorder) {
  return new TableCell({
    columnSpan: 2,
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: ruleBorder,
      right: nilBorder,
    },
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 30, line: style.spacing.line },
        children: [
          new TextRun({
            text: titleText,
            font: style.fonts.body,
            size: 22,
            bold: true,
            color: style.colors.accent,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 20, line: style.spacing.line },
        children: [
          new TextRun({
            text: subtitleText,
            font: style.fonts.body,
            size: 16,
            color: style.colors.accent,
          }),
        ],
      }),
    ],
  });
}

function keyLabelCell(row, style, nilBorder, ruleBorder) {
  const labelText = row.condition ? `{IF ${row.condition}}${row.label}` : row.label;
  return new TableCell({
    borders: horizontalBorders(ruleBorder, nilBorder),
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: row.hint ? 10 : 0, line: style.spacing.line },
        children: [
          new TextRun({
            text: labelText,
            font: style.fonts.body,
            size: 22,
            bold: true,
            color: style.colors.ink,
          }),
        ],
      }),
      ...(row.hint
        ? [
            new Paragraph({
              spacing: { after: 0, line: style.spacing.line },
              children: [
                new TextRun({
                  text: row.hint,
                  font: style.fonts.body,
                  size: 14,
                  color: style.colors.muted,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function keyValueCell(row, style, nilBorder, ruleBorder) {
  const valueText = row.condition ? `${row.value}{END-IF}` : row.value;
  return new TableCell({
    borders: horizontalBorders(ruleBorder, nilBorder),
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      bodyParagraph(valueText, style, { size: 22, after: row.note ? 40 : 0 }),
      ...(row.note ? [noteParagraph(row.note, style)] : []),
    ],
  });
}

function coverTable(rows, headingTitle, subtitle, style, nilBorder, ruleBorder) {
  return new Table({
    width: { size: 10070, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: style.table_widths.cover_terms,
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
      insideH: nilBorder,
      insideV: nilBorder,
    },
    rows: [
      new TableRow({ children: [rowHeadingCell(headingTitle, subtitle, style, nilBorder, ruleBorder)] }),
      ...rows.map((row) =>
        new TableRow({
          height: { value: style.sizes.cover_row_height, rule: HeightRule.ATLEAST },
          children: [keyLabelCell(row, style, nilBorder, ruleBorder), keyValueCell(row, style, nilBorder, ruleBorder)],
        })
      ),
    ],
  });
}

function clauseParagraphs(index, clauseItem, style) {
  return [
    new Paragraph({
      style: 'OAClauseHeading',
      contextualSpacing: false,
      spacing: {
        before: style.spacing.clause_heading_before,
        after: style.spacing.clause_heading_after,
        line: style.spacing.line,
        beforeAutoSpacing: false,
        afterAutoSpacing: false,
      },
      children: [
        new TextRun({
          text: `${index}. ${clauseItem.heading}.`,
          font: style.fonts.body,
          size: 22,
          bold: true,
          color: style.colors.ink,
        }),
      ],
    }),
    bodyParagraph(clauseItem.body, style, { size: 22, style: 'OAClauseBody' }),
  ];
}

function signatureLabelCell(label, hint, style, nilBorder) {
  return new TableCell({
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
    },
    margins: { top: 216, left: 115, bottom: 216, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: hint ? 10 : 0, line: style.spacing.line },
        children: [
          new TextRun({
            text: label,
            font: style.fonts.body,
            size: 18,
            bold: true,
            color: style.colors.ink,
          }),
        ],
      }),
      ...(hint
        ? [
            new Paragraph({
              spacing: { after: 0, line: style.spacing.line },
              children: [
                new TextRun({
                  text: hint,
                  font: style.fonts.body,
                  size: 14,
                  color: style.colors.muted,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function signatureHeaderCell(text, style, nilBorder) {
  return new TableCell({
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
    },
    margins: { top: 216, left: 115, bottom: 120, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: style.spacing.line },
        children: [
          new TextRun({
            text,
            font: style.fonts.body,
            size: 16,
            bold: true,
            color: style.colors.muted,
          }),
        ],
      }),
    ],
  });
}

function signatureLineCell(value, style, nilBorder, ruleBorder) {
  return new TableCell({
    borders: {
      top: ruleBorder,
      left: nilBorder,
      bottom: ruleBorder,
      right: nilBorder,
    },
    margins: { top: 216, left: 115, bottom: 216, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: style.spacing.line },
        children: [
          new TextRun({
            text: value,
            font: style.fonts.body,
            size: 18,
            color: style.colors.ink,
          }),
        ],
      }),
    ],
  });
}

function signatureSpacerCell(nilBorder) {
  return new TableCell({
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
    },
    margins: { top: 216, left: 0, bottom: 216, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph('')],
  });
}

function twoPartySignatureTable(signatureSpec, style, nilBorder, ruleBorder) {
  return new Table({
    width: { size: 10075, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: style.table_widths.signature_two_party,
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
      insideH: nilBorder,
      insideV: nilBorder,
    },
    rows: [
      new TableRow({
        children: [
          signatureLabelCell('', '', style, nilBorder),
          signatureHeaderCell(signatureSpec.party_a.toUpperCase(), style, nilBorder),
          signatureSpacerCell(nilBorder),
          signatureHeaderCell(signatureSpec.party_b.toUpperCase(), style, nilBorder),
        ],
      }),
      ...signatureSpec.rows.map((row) =>
        new TableRow({
          height: { value: style.sizes.signature_row_height, rule: HeightRule.ATLEAST },
          children: [
            signatureLabelCell(row.label, row.hint, style, nilBorder),
            signatureLineCell(row.left ?? '', style, nilBorder, ruleBorder),
            signatureSpacerCell(nilBorder),
            signatureLineCell(row.right ?? '', style, nilBorder, ruleBorder),
          ],
        })
      ),
    ],
  });
}

function onePartySignatureTable(signatureSpec, style, nilBorder, ruleBorder) {
  return new Table({
    width: { size: 10070, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: style.table_widths.signature_one_party,
    borders: {
      top: nilBorder,
      left: nilBorder,
      bottom: nilBorder,
      right: nilBorder,
      insideH: nilBorder,
      insideV: nilBorder,
    },
    rows: [
      new TableRow({
        children: [
          signatureLabelCell('', '', style, nilBorder),
          signatureHeaderCell(signatureSpec.party.toUpperCase(), style, nilBorder),
        ],
      }),
      ...signatureSpec.rows.map((row) =>
        new TableRow({
          height: { value: style.sizes.signature_row_height, rule: HeightRule.ATLEAST },
          children: [
            signatureLabelCell(row.label, row.hint, style, nilBorder),
            signatureLineCell(row.value ?? '', style, nilBorder, ruleBorder),
          ],
        })
      ),
    ],
  });
}

function renderMarkdown(spec) {
  const lines = [];
  const { document, sections } = spec;

  lines.push(`# ${document.title}`);
  lines.push('');
  lines.push(`${document.label} (v${document.version}). ${document.license}.`);
  lines.push('');

  lines.push(`## ${sections.cover_terms.heading_title}`);
  lines.push('');
  lines.push(sections.cover_terms.subtitle);
  lines.push('');
  lines.push('| Term | Value |');
  lines.push('|------|-------|');
  for (const row of sections.cover_terms.rows) {
    lines.push(`| **${row.label}** | ${row.value} |`);
  }
  lines.push('');

  lines.push(`## ${sections.standard_terms.heading_title}`);
  lines.push('');
  for (let i = 0; i < sections.standard_terms.clauses.length; i += 1) {
    const clauseItem = sections.standard_terms.clauses[i];
    lines.push(`### ${i + 1}. ${clauseItem.heading}`);
    lines.push('');
    lines.push(clauseItem.body);
    lines.push('');
  }

  lines.push(`## ${sections.signature.heading_title}`);
  lines.push('');
  lines.push(sections.signature.preamble);
  lines.push('');

  if (sections.signature.mode === 'two-party') {
    const sectionsOut = [
      {
        party: sections.signature.party_a,
        rows: sections.signature.rows.map((row) => ({ label: row.label, value: row.left ?? '' })),
      },
      {
        party: sections.signature.party_b,
        rows: sections.signature.rows.map((row) => ({ label: row.label, value: row.right ?? '' })),
      },
    ];
    for (const section of sectionsOut) {
      lines.push(`**${section.party}**`);
      lines.push('');
      for (const row of section.rows) {
        lines.push(`${row.label}: ${row.value || '_______________'}`);
      }
      lines.push('');
    }
  } else {
    lines.push(`**${sections.signature.party}**`);
    lines.push('');
    for (const row of sections.signature.rows) {
      lines.push(`${row.label}: ${row.value || '_______________'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function renderCoverStandardSignatureV1(spec, style) {
  const { nilBorder, ruleBorder } = createBorders(style);
  const { document, sections } = spec;

  const standardClauseParagraphs = sections.standard_terms.clauses.flatMap((clauseItem, idx) =>
    clauseParagraphs(idx + 1, clauseItem, style)
  );

  const signatureTable = sections.signature.mode === 'two-party'
    ? twoPartySignatureTable(sections.signature, style, nilBorder, ruleBorder)
    : onePartySignatureTable(sections.signature, style, nilBorder, ruleBorder);

  const doc = new Document({
    styles: buildDocumentStyles(style),
    sections: [
      buildSection(
        sections.cover_terms.section_label,
        document.label,
        document.version,
        [
          titleParagraph(document.title, style),
          coverTable(
            sections.cover_terms.rows,
            sections.cover_terms.heading_title,
            sections.cover_terms.subtitle,
            style,
            nilBorder,
            ruleBorder
          ),
        ],
        style,
        nilBorder,
        { include_cloud_doc_line: document.include_cloud_doc_line }
      ),
      buildSection(
        sections.standard_terms.section_label,
        document.label,
        document.version,
        [
          sectionTitleParagraph(sections.standard_terms.heading_title, style),
          ...standardClauseParagraphs,
        ],
        style,
        nilBorder
      ),
      buildSection(
        sections.signature.section_label,
        document.label,
        document.version,
        [
          sectionTitleParagraph(sections.signature.heading_title, style),
          bodyParagraph(sections.signature.preamble, style, {
            terms: [],
            size: 16,
          }),
          signatureTable,
        ],
        style,
        nilBorder
      ),
    ],
  });

  return {
    document: doc,
    markdown: renderMarkdown(spec),
  };
}
