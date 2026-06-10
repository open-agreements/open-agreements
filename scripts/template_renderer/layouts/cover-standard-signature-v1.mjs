import { createHash } from 'node:crypto';
import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeightRule,
  InternalHyperlink,
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
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';

// Internal bookmark name for a clause heading, used as the anchor target of the
// cover-notice cross-reference jump. Hashed (not the raw clause id) to stay
// within Word's bookmark-name rules (<=40 chars, letters/digits/underscore,
// must start with a letter) regardless of how long or hyphenated the id is.
// Deterministic so rendered output is stable across runs. The same name is
// embedded in the cover-notice `<<xref:…>>` sentinel, so the post-fill linking
// pass never needs to know this scheme.
function clauseBookmarkName(id) {
  return `oa_xref_${createHash('sha1').update(id).digest('hex').slice(0, 16)}`;
}

function buildDocumentStyles(style) {
  // Apple Pages requires explicit named paragraph styles — paragraphs without a
  // referenced pStyle either drop inline alignment or inherit the previous
  // paragraph's style properties. See #262, #263, and #339 for prior incidents.
  const normalSpacing = {
    before: 0,
    after: style.spacing.body_after,
    line: style.spacing.line,
    lineRule: LineRuleType.AUTO,
  };
  return {
    default: {
      document: {
        run: {
          font: style.fonts.body,
          size: 22,
          color: style.colors.ink,
        },
        paragraph: { spacing: normalSpacing },
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
        paragraph: { spacing: normalSpacing },
      },
      {
        id: 'OATitle',
        name: 'OA Title',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: style.fonts.heading,
          size: 44,
          color: style.colors.ink,
        },
        paragraph: {
          spacing: {
            before: style.spacing.title_before,
            after: style.spacing.title_after,
            line: style.spacing.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
      {
        id: 'OASectionTitle',
        name: 'OA Section Title',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: style.fonts.body,
          size: 22,
          bold: true,
          color: style.colors.accent,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: style.spacing.section_title_after,
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
    // Every visible-text paragraph in document.xml must reference a named style
    // so Apple Pages doesn't drop inline properties or inherit from the previous
    // paragraph. Default to 'Normal' when callers don't specify (#262, #339).
    style: opts.style ?? 'Normal',
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
    style: 'OATitle',
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
    style: 'OASectionTitle',
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
    margins: { top: COVER_CELL_MARGIN.top, left: COVER_CELL_MARGIN.outer, bottom: COVER_CELL_MARGIN.bottom, right: COVER_CELL_MARGIN.outer },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        style: 'Normal',
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
        style: 'Normal',
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

// Cover term row layout constants
const COVER_CELL_MARGIN = { top: 80, bottom: 80, outer: 115, subIndent: 345 };
const COVER_GROUP_HEADER_SPACER = { line: 120, fontSize: 4, char: '\u200B' };
const COVER_GROUP_HEADER_LINE_SPACING = 240; // single spacing (240/240 = 1.0 lines)
const COVER_GROUP_HEADER_HEIGHT_RATIO = 1.13;

function isGroupHeaderRow(row) {
  return !row.sub && row.value === '';
}

function keyLabelCell(row, style, nilBorder, ruleBorder) {
  const isSub = row.sub === true;
  const isGroupHeader = isGroupHeaderRow(row);
  return new TableCell({
    borders: horizontalBorders(ruleBorder, nilBorder),
    margins: { top: COVER_CELL_MARGIN.top, left: isSub ? COVER_CELL_MARGIN.subIndent : COVER_CELL_MARGIN.outer, bottom: COVER_CELL_MARGIN.bottom, right: COVER_CELL_MARGIN.outer },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      // Group headers get a line break paragraph before the label for consistent spacing
      // (works regardless of single/multi-line wrapping; before-paragraph spacing only
      // gets respected when there's an actual preceding paragraph)
      ...(isGroupHeader
        ? [new Paragraph({ style: 'Normal', spacing: { after: 0, line: COVER_GROUP_HEADER_SPACER.line }, children: [new TextRun({ text: COVER_GROUP_HEADER_SPACER.char, size: COVER_GROUP_HEADER_SPACER.fontSize })] })]
        : []),
      // For conditional sub-rows, put {IF} in a separate zero-height paragraph so docx-templates
      // can remove it cleanly without leaving an empty paragraph artifact.
      // For group headers, put {IF} inline to avoid corrupting cell properties.
      ...(row.condition && isSub
        ? [new Paragraph({ style: 'Normal', spacing: { after: 0, line: 0 }, children: [new TextRun({ text: `{IF ${row.condition}}`, size: 1 })] })]
        : []),
      new Paragraph({
        style: 'Normal',
        spacing: { before: 0, after: row.hint ? 10 : 0, line: isGroupHeader ? COVER_GROUP_HEADER_LINE_SPACING : style.spacing.line },
        children: [
          new TextRun({
            text: (row.condition && !isSub) ? `{IF ${row.condition}}${row.label}` : row.label,
            font: style.fonts.body,
            size: isSub ? 20 : 22,
            bold: !isSub,
            italics: isSub,
            color: isSub ? style.colors.ink_soft : style.colors.ink,
          }),
        ],
      }),
      ...(row.hint
        ? [
            new Paragraph({
              style: 'Normal',
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

function keyValueCell(row, style, nilBorder, ruleBorder, opts = {}) {
  const valueText = row.condition ? `${row.value}{END-IF}` : row.value;
  const lines = valueText.split('\n');
  const valueParagraphs = lines.map((line, i) =>
    bodyParagraph(line, style, { size: 22, after: i < lines.length - 1 ? 40 : (row.note ? 40 : 0), terms: opts.terms })
  );
  return new TableCell({
    borders: horizontalBorders(ruleBorder, nilBorder),
    margins: { top: COVER_CELL_MARGIN.top, left: COVER_CELL_MARGIN.outer, bottom: COVER_CELL_MARGIN.bottom, right: COVER_CELL_MARGIN.outer },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      ...valueParagraphs,
      ...(row.note ? [noteParagraph(row.note, style)] : []),
    ],
  });
}

function coverTable(rows, headingTitle, subtitle, style, nilBorder, ruleBorder, opts = {}) {
  const baseHeight = opts.coverRowHeight ?? style.sizes.cover_row_height;
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
      ...rows.map((row) => {
        const rowHeight = isGroupHeaderRow(row) ? Math.round(baseHeight * COVER_GROUP_HEADER_HEIGHT_RATIO) : baseHeight;
        return new TableRow({
          height: { value: rowHeight, rule: HeightRule.ATLEAST },
          children: [keyLabelCell(row, style, nilBorder, ruleBorder), keyValueCell(row, style, nilBorder, ruleBorder, opts)],
        });
      }),
    ],
  });
}

function definitionSubParagraphs(parentIndex, terms, style) {
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));
  const paragraphs = [];
  for (let i = 0; i < sorted.length; i++) {
    const { term, definition } = sorted[i];
    const subIndex = `${parentIndex}.${i + 1}`;
    paragraphs.push(
      new Paragraph({
        style: 'OAClauseBody',
        contextualSpacing: false,
        spacing: {
          before: i === 0 ? 0 : style.spacing.clause_heading_before,
          after: style.spacing.body_after,
          line: style.spacing.line,
          beforeAutoSpacing: false,
          afterAutoSpacing: false,
        },
        children: [
          new TextRun({
            text: `${subIndex} `,
            font: style.fonts.body,
            size: 22,
            color: style.colors.ink,
          }),
          new TextRun({
            text: `\u201C${term}\u201D`,
            font: style.fonts.body,
            size: 22,
            bold: true,
            color: style.colors.accent,
          }),
          new TextRun({
            text: ` ${definition}`,
            font: style.fonts.body,
            size: 22,
            color: style.colors.ink,
          }),
        ],
      })
    );
  }
  return paragraphs;
}

function bodyParagraphsFromText(text, style, opts = {}) {
  const lines = text
    .split('\n')
    .filter((line) => line.trim().length > 0);
  return lines.map((line, i) =>
    bodyParagraph(line, style, {
      ...opts,
      after: i < lines.length - 1 ? (opts.after ?? style.spacing.body_after) : (opts.after ?? style.spacing.body_after),
    })
  );
}

function signaturePreambleParagraphs(text, style, opts = {}) {
  const lines = text.split('\n');
  const paragraphs = [];
  let sawParagraph = false;
  let pendingBlankLine = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      pendingBlankLine = sawParagraph || pendingBlankLine;
      continue;
    }

    paragraphs.push(
      bodyParagraph(line, style, {
        terms: [],
        size: opts.size ?? 22,
        before: !sawParagraph
          ? (opts.firstParagraphBefore ?? 0)
          : pendingBlankLine
            ? (opts.blankLineBefore ?? style.spacing.body_after)
            : 0,
        after: opts.after ?? style.spacing.body_after,
      })
    );
    sawParagraph = true;
    pendingBlankLine = false;
  }

  return paragraphs;
}

// `bookmarkName` (optional) wraps the heading text in a bookmark so the
// cover-notice cross-reference can jump to it. Only emitted for clauses the
// notice links to (confirm clauses); the leading "N." number is still literal
// text re-sequenced by the post-fill renumber pass, which leaves the bookmark
// intact.
function clauseHeadingParagraph(index, heading, style, bookmarkName) {
  const headingRun = new TextRun({
    text: `${index}. ${heading}.`,
    font: style.fonts.body,
    size: 22,
    bold: true,
    color: style.colors.ink,
  });
  return new Paragraph({
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
      bookmarkName
        ? new Bookmark({ id: bookmarkName, children: [headingRun] })
        : headingRun,
    ],
  });
}

// Highlighted bracket flagging a statutory-compliance representation that has
// not yet been human-confirmed. Static text (no {field} tag), so the fill
// pipeline leaves the yellow highlight intact; it only appears inside the
// {IF !<confirm>} block, so a confirmed fill drops it cleanly.
function confirmBracketParagraph(note, authorityUrl, style) {
  return new Paragraph({
    style: 'OAClauseBody',
    contextualSpacing: false,
    spacing: {
      before: 0,
      after: style.spacing.body_after,
      line: style.spacing.line,
      beforeAutoSpacing: false,
      afterAutoSpacing: false,
    },
    children: [
      new TextRun({
        text: `[CONFIRM before signing: ${note}; see ${authorityUrl}]`,
        font: style.fonts.body,
        size: 22,
        bold: true,
        color: style.colors.ink,
        highlight: 'yellow',
      }),
    ],
  });
}

// Cover-page confirmation notice (page one). When a template has any `confirm=`
// clause, a yellow banner lists each still-unconfirmed *applicable* item so a
// reader who reviews only the Cover Terms still sees the open item. The whole
// banner is gated on the derived `{IF any_confirmation_pending}`; each bullet is
// gated on its own `{IF <gate>}{IF !<confirm>}` so confirmed or inapplicable
// items drop out. The text never contains the literal "[CONFIRM before signing:"
// token, so it cannot satisfy or spoof the in-body compliance-bracket validator.
function confirmationNoticeParagraphs(clauses, style) {
  const confirmClauses = (clauses ?? []).filter((c) => c && c.confirm);
  if (confirmClauses.length === 0) return [];

  const ctrl = (text) =>
    new Paragraph({ style: 'Normal', spacing: { after: 0, line: 0 }, children: [new TextRun({ text, size: 1 })] });
  const bulletSpacing = {
    before: 0,
    after: style.spacing.body_after,
    line: style.spacing.line,
    beforeAutoSpacing: false,
    afterAutoSpacing: false,
  };
  const yellow = (text, bold = false) =>
    new Paragraph({
      style: 'OAClauseBody',
      contextualSpacing: false,
      spacing: bulletSpacing,
      children: [
        new TextRun({ text, font: style.fonts.body, size: 22, bold, color: style.colors.ink, highlight: 'yellow' }),
      ],
    });

  // Runs for an item bullet: plain (yellow-highlighted) text vs a clickable
  // (blue, underlined) link run. Both keep the yellow highlight so the whole
  // notice reads as one banner.
  const plainRun = (text) =>
    new TextRun({ text, font: style.fonts.body, size: 22, color: style.colors.ink, highlight: 'yellow' });
  const linkRun = (text) =>
    new TextRun({
      text,
      font: style.fonts.body,
      size: 22,
      color: '0563C1',
      underline: { type: UnderlineType.SINGLE },
      highlight: 'yellow',
    });
  // One item bullet: "• <Section N jump> — <heading> — for more details see <url>".
  // The section number is a `<<xref:…>>` sentinel resolved to the live, post-
  // renumber "Section N" by the fill pipeline; it is wrapped in an internal
  // hyperlink that jumps to the clause's heading bookmark. The URL is a real
  // external hyperlink. Never emits the literal "[CONFIRM before signing:" token.
  const bulletParagraph = (clause) => {
    const bm = clauseBookmarkName(clause.id);
    return new Paragraph({
      style: 'OAClauseBody',
      contextualSpacing: false,
      spacing: bulletSpacing,
      children: [
        plainRun('• '),
        new InternalHyperlink({ anchor: bm, children: [linkRun(`<<xref:${bm}>>`)] }),
        plainRun(` — ${clause.heading} — for more details see `),
        new ExternalHyperlink({ link: clause.authority_url, children: [linkRun(clause.authority_url)] }),
      ],
    });
  };

  const out = [ctrl('{IF any_confirmation_pending}')];
  out.push(yellow('CONFIRMATION REQUIRED BEFORE SIGNING', true));
  // The clickable "Section N" link makes the in-body location self-evident, so
  // the notice no longer needs to tell the reader to find the section or click
  // the link. Must not contain the literal "[CONFIRM before signing:" token so
  // it can't spoof the in-body bracket validator.
  out.push(
    yellow(
      'For each item below, confirm the stated fact occurred, then delete its yellow "CONFIRM before signing" bracket in the Standard Terms. Delete this notice before signing.'
    )
  );
  out.push(yellow('Items requiring confirmation:'));
  for (const clause of confirmClauses) {
    if (clause.condition) out.push(ctrl(`{IF ${clause.condition}}`));
    out.push(ctrl(`{IF !${clause.confirm}}`));
    out.push(bulletParagraph(clause));
    out.push(ctrl('{END-IF}'));
    if (clause.condition) out.push(ctrl('{END-IF}'));
  }
  out.push(ctrl('{END-IF}'));
  return out;
}

function clauseParagraphs(index, clauseItem, style, opts = {}) {
  if (clauseItem.type === 'definitions') {
    return [
      clauseHeadingParagraph(index, clauseItem.heading, style),
      ...definitionSubParagraphs(index, clauseItem.terms, style),
    ];
  }

  // Bookmark the heading only when the cover-notice cross-reference targets it
  // (confirm clauses), keeping the anchor footprint to clauses that need it.
  const headingBookmark = clauseItem.confirm ? clauseBookmarkName(clauseItem.id) : undefined;
  const headingParagraph = clauseHeadingParagraph(index, clauseItem.heading, style, headingBookmark);
  const termsOpt = opts.terms;
  const bodyParas = bodyParagraphsFromText(clauseItem.body, style, { size: 22, style: 'OAClauseBody', terms: termsOpt });

  // A control-tag paragraph ({IF …}/{END-IF}) in the clause-body style.
  const tag = (text) => bodyParagraph(text, style, { size: 22, style: 'OAClauseBody', terms: [] });
  // A zero-height control-tag paragraph for wrappers that sit ABOVE a clause
  // heading (clean-omission / applicability gate). Keeping the {IF}/{END-IF}
  // marker zero-height avoids a stray blank line above the heading once
  // docx-templates strips the tag (same precedent as the cover-table sub-rows).
  const wrapTag = (text) =>
    new Paragraph({ style: 'Normal', spacing: { after: 0, line: 0 }, children: [new TextRun({ text, size: 1 })] });

  if (clauseItem.condition && clauseItem.omitted_body) {
    // Placeholder mode (back-compat): the heading always renders; the body is
    // shown gated on {IF condition} and swapped for the [Intentionally Omitted.]
    // placeholder gated on {IF !condition}. (Not combinable with confirm — the
    // schema/parser forbid that.)
    const omittedPara = tag(clauseItem.omitted_body);
    return [
      headingParagraph,
      tag(`{IF ${clauseItem.condition}}`), ...bodyParas, tag('{END-IF}'),
      tag(`{IF !${clauseItem.condition}}`), omittedPara, tag('{END-IF}'),
    ];
  }

  let core;
  if (clauseItem.confirm) {
    // Statutory-compliance representation: render the recital body
    // unconditionally, then append a highlighted [CONFIRM …] bracket gated on
    // {IF !<confirm>} so it shows only while the fact is unconfirmed. Never a
    // silent omit; never future-tense.
    const confirmPara = confirmBracketParagraph(clauseItem.confirm_note, clauseItem.authority_url, style);
    core = [headingParagraph, ...bodyParas, tag(`{IF !${clauseItem.confirm}}`), confirmPara, tag('{END-IF}')];
  } else {
    core = [headingParagraph, ...bodyParas];
  }

  if (clauseItem.condition) {
    // Clean omission / applicability gate: a `when=<field>` clause WITHOUT an
    // `omitted=` placeholder wraps the entire clause (heading + body, plus any
    // confirm bracket) in {IF condition} so it is FULLY absent — no heading, no
    // placeholder — when the condition is false. Downstream clauses are
    // renumbered after fill so no gap remains.
    return [wrapTag(`{IF ${clauseItem.condition}}`), ...core, wrapTag('{END-IF}')];
  }

  return core;
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
        style: 'Normal',
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
              style: 'Normal',
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
        style: 'Normal',
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
        style: 'Normal',
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

// Shared shell for the 4-column dual-party signature table used by the legacy
// `two-party` mode. Callers normalize inputs into `{ leftHeader, rightHeader, rows }`
// where each row is
// `{ label, hint?, leftValue, rightValue, leftLined?, rightLined? }`.
function dualPartySignatureTable({ leftHeader, rightHeader, rows }, style, nilBorder, ruleBorder) {
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
          signatureHeaderCell(leftHeader.toUpperCase(), style, nilBorder),
          signatureSpacerCell(nilBorder),
          signatureHeaderCell(rightHeader.toUpperCase(), style, nilBorder),
        ],
      }),
      ...rows.map((row) =>
        new TableRow({
          height: { value: style.sizes.signature_row_height, rule: HeightRule.ATLEAST },
          children: [
            signatureLabelCell(row.label, row.hint, style, nilBorder),
            signatureLineCell(row.leftValue ?? '', style, nilBorder, row.leftLined === false ? nilBorder : ruleBorder),
            signatureSpacerCell(nilBorder),
            signatureLineCell(row.rightValue ?? '', style, nilBorder, row.rightLined === false ? nilBorder : ruleBorder),
          ],
        })
      ),
    ],
  });
}

function twoPartySignatureTable(signatureSpec, style, nilBorder, ruleBorder) {
  return dualPartySignatureTable(
    {
      leftHeader: signatureSpec.party_a,
      rightHeader: signatureSpec.party_b,
      rows: signatureSpec.rows.map((row) => ({
        label: row.label,
        hint: row.hint,
        leftValue: row.left,
        rightValue: row.left_only ? '' : row.right,
        rightLined: !row.left_only,
      })),
    },
    style,
    nilBorder,
    ruleBorder
  );
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

function signerHasRowId(signer, rowId) {
  return signer.rows.some((row) => row.id === rowId);
}

function validateSignerModeArrangement(signatureSpec) {
  if (signatureSpec.arrangement !== 'entity-plus-individual') {
    return;
  }

  if (signatureSpec.signers.length !== 2) {
    throw new Error(
      `cover-standard-signature-v1 requires exactly 2 signers for arrangement=entity-plus-individual; received ${signatureSpec.signers.length}`
    );
  }

  const [entitySigner, individualSigner] = signatureSpec.signers;
  if (entitySigner.kind !== 'entity') {
    throw new Error(
      `cover-standard-signature-v1 arrangement=entity-plus-individual requires signer "${entitySigner.id}" to have kind=entity`
    );
  }
  if (individualSigner.kind !== 'individual' && individualSigner.kind !== 'acknowledging-individual') {
    throw new Error(
      `cover-standard-signature-v1 arrangement=entity-plus-individual requires signer "${individualSigner.id}" to have kind=individual or kind=acknowledging-individual`
    );
  }
  if (signerHasRowId(individualSigner, 'title')) {
    throw new Error(
      `cover-standard-signature-v1 arrangement=entity-plus-individual requires signer "${individualSigner.id}" to omit the Title row`
    );
  }
}

function signerTableFromSigner(signer, style, nilBorder, ruleBorder) {
  return onePartySignatureTable(
    {
      party: signer.label,
      rows: signer.rows.map((row) => ({
        label: row.label,
        hint: row.hint,
        value: row.value,
      })),
    },
    style,
    nilBorder,
    ruleBorder
  );
}

function repeatingSignatureRowText(row) {
  const lowerLabel = row.label.toLowerCase();
  if (lowerLabel === 'signature' || lowerLabel === 'signature line') {
    return row.value || '______________________________';
  }
  if (!row.value) {
    return `${row.label}: _______________`;
  }
  return `${row.label}: ${row.value}`;
}

function repeatingStackedSignatureParagraphs(signatureSpec, style, opts = {}) {
  if (!signatureSpec.repeat) {
    throw new Error('cover-standard-signature-v1 stacked signer sections require repeat metadata');
  }
  if (signatureSpec.signers.length !== 1) {
    throw new Error(
      `cover-standard-signature-v1 repeat-backed stacked signer sections require exactly 1 signer prototype; received ${signatureSpec.signers.length}`
    );
  }

  const signer = signatureSpec.signers[0];
  const paragraphs = [
    bodyParagraph(`{FOR ${signatureSpec.repeat.item_name} IN ${signatureSpec.repeat.collection_field}}`, style, {
      size: 22,
      after: 0,
      terms: [],
    }),
  ];

  paragraphs.push(
    bodyParagraph(signer.label, style, {
      size: 22,
      bold: true,
      before: opts.firstRowBefore ?? style.spacing.clause_heading_before,
      after: 0,
      terms: [],
    })
  );

  signer.rows.forEach((row, index) => {
    paragraphs.push(
      bodyParagraph(repeatingSignatureRowText(row), style, {
        size: 22,
        before: 0,
        after: index === signer.rows.length - 1 ? (opts.blockAfter ?? style.spacing.body_after) : (opts.rowAfter ?? 0),
        terms: [],
      })
    );
  });

  paragraphs.push(
    bodyParagraph(`{END-FOR ${signatureSpec.repeat.item_name}}`, style, {
      size: 22,
      after: opts.loopCloseAfter ?? style.spacing.body_after,
      terms: [],
    })
  );

  return paragraphs;
}

function appendSignatureMarkdown(lines, signatureSection) {
  for (const preambleParagraph of signatureSection.preamble.split('\n').map((line) => line.trim()).filter(Boolean)) {
    lines.push(preambleParagraph);
    lines.push('');
  }

  if (signatureSection.mode === 'two-party') {
    const sectionsOut = [
      {
        party: signatureSection.party_a,
        rows: signatureSection.rows.map((row) => ({ label: row.label, value: row.left ?? '' })),
      },
      {
        party: signatureSection.party_b,
        rows: signatureSection.rows.filter((row) => !row.left_only).map((row) => ({ label: row.label, value: row.right ?? '' })),
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
    return;
  }

  if (signatureSection.mode === 'signers' && signatureSection.arrangement === 'stacked' && signatureSection.repeat) {
    const signer = signatureSection.signers[0];
    lines.push(`{FOR ${signatureSection.repeat.item_name} IN ${signatureSection.repeat.collection_field}}`);
    lines.push('');
    lines.push(`**${signer.label}**`);
    lines.push('');
    for (const row of signer.rows) {
      lines.push(repeatingSignatureRowText(row));
      lines.push('');
    }
    lines.push(`{END-FOR ${signatureSection.repeat.item_name}}`);
    lines.push('');
    return;
  }

  if (signatureSection.mode === 'signers') {
    for (const signer of signatureSection.signers) {
      lines.push(`**${signer.label}**`);
      lines.push('');
      for (const row of signer.rows) {
        lines.push(`${row.label}: ${row.value || '_______________'}`);
      }
      lines.push('');
    }
    return;
  }

  lines.push(`**${signatureSection.party}**`);
  lines.push('');
  for (const row of signatureSection.rows) {
    lines.push(`${row.label}: ${row.value || '_______________'}`);
  }
  lines.push('');
}

function signerTableSpacer(style) {
  return new Paragraph({
    style: 'Normal',
    spacing: { before: 0, after: style.spacing.body_after, line: style.spacing.line },
    children: [new TextRun({ text: '' })],
  });
}

function signerModeSignatureChildren(signatureSpec, style, nilBorder, ruleBorder) {
  validateSignerModeArrangement(signatureSpec);

  return signatureSpec.signers.flatMap((signer, index) => (
    index === 0
      ? [signerTableFromSigner(signer, style, nilBorder, ruleBorder)]
      : [signerTableSpacer(style), signerTableFromSigner(signer, style, nilBorder, ruleBorder)]
  ));
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
    if (row.sub) {
      lines.push(`| ${row.label} | ${row.value} |`);
    } else {
      if (row.value) {
        lines.push(`| **${row.label}** | ${row.value} |`);
      } else {
        lines.push(`| **${row.label}** | |`);
      }
    }
  }
  lines.push('');

  lines.push(`## ${sections.standard_terms.heading_title}`);
  lines.push('');
  for (let i = 0; i < sections.standard_terms.clauses.length; i += 1) {
    const clauseItem = sections.standard_terms.clauses[i];
    lines.push(`### ${i + 1}. ${clauseItem.heading}`);
    lines.push('');
    if (clauseItem.type === 'definitions') {
      for (let j = 0; j < clauseItem.terms.length; j++) {
        lines.push(`${i + 1}.${j + 1} **"${clauseItem.terms[j].term}"** ${clauseItem.terms[j].definition}`);
        lines.push('');
      }
    } else {
      lines.push(clauseItem.body);
      lines.push('');
    }
  }

  lines.push(`## ${sections.signature.heading_title}`);
  lines.push('');
  appendSignatureMarkdown(lines, sections.signature);

  return lines.join('\n');
}

export function renderCoverStandardSignatureV1(spec, style) {
  const { nilBorder, ruleBorder } = createBorders(style);
  const { document, sections } = spec;

  // Derive defined terms from definitions clause if present (DRY)
  const highlightMode = document.defined_term_highlight_mode || 'all_instances';
  const definitionsClause = sections.standard_terms.clauses.find((c) => c.type === 'definitions');
  const derivedTerms = definitionsClause
    ? definitionsClause.terms.flatMap((t) => [t.term, ...(t.aliases ?? [])])
    : style.defined_terms;

  const standardClauseParagraphs = sections.standard_terms.clauses.flatMap((clauseItem, idx) => {
    const isDefinitionsClause = clauseItem.type === 'definitions';
    let termsForClause;
    if (highlightMode === 'none') {
      termsForClause = [];
    } else if (highlightMode === 'definition_site_only') {
      // Only highlight in the definitions clause itself (handled internally by definitionSubParagraphs)
      termsForClause = [];
    } else {
      termsForClause = derivedTerms;
    }
    return clauseParagraphs(idx + 1, clauseItem, style, { terms: termsForClause });
  });

  const signatureChildren = sections.signature.mode === 'two-party'
    ? [twoPartySignatureTable(sections.signature, style, nilBorder, ruleBorder)]
    : sections.signature.mode === 'signers' &&
        sections.signature.arrangement === 'stacked' &&
        sections.signature.repeat
      ? repeatingStackedSignatureParagraphs(sections.signature, style)
      : sections.signature.mode === 'signers'
        ? signerModeSignatureChildren(sections.signature, style, nilBorder, ruleBorder)
        : [onePartySignatureTable(sections.signature, style, nilBorder, ruleBorder)];

  const doc = new Document({
    styles: buildDocumentStyles(style),
    sections: [
      buildSection(
        sections.cover_terms.section_label,
        document.label,
        document.version,
        [
          titleParagraph(document.title, style),
          ...confirmationNoticeParagraphs(sections.standard_terms.clauses, style),
          coverTable(
            sections.cover_terms.rows,
            sections.cover_terms.heading_title,
            sections.cover_terms.subtitle,
            style,
            nilBorder,
            ruleBorder,
            { terms: highlightMode === 'all_instances' ? undefined : [], coverRowHeight: document.cover_row_height }
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
          ...signaturePreambleParagraphs(sections.signature.preamble, style, {
            size: 22,
          }),
          ...signatureChildren,
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
