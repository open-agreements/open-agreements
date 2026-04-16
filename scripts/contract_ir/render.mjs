import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  LineRuleType,
  PageBreak,
  Packer,
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

function toAlignment(value) {
  switch (value) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justified':
      return AlignmentType.JUSTIFIED;
    case 'left':
    default:
      return AlignmentType.LEFT;
  }
}

function mergeInlineProps(base, incoming) {
  return {
    font: incoming.font ?? base.font,
    size: incoming.font_size ?? base.size,
    color: incoming.color ?? base.color,
    bold: incoming.bold ?? base.bold ?? false,
    italics: incoming.italic ?? base.italics ?? false,
    underline: incoming.underline ?? base.underline ?? false,
  };
}

function mergePreviewEmphasis(base, incoming) {
  if (!incoming || incoming === 'plain') {
    return base;
  }
  return incoming;
}

function styleForParagraph(block, styleRegistry) {
  const defaults = styleRegistry.docx.defaults;
  const headingStyle =
    block.type === 'heading'
      ? styleRegistry.headings[`h${block.level}`] ?? {}
      : {};
  const blockStyle = block.blockStyle
    ? styleRegistry.block_styles[block.blockStyle] ?? {}
    : {};

  return {
    font: blockStyle.font ?? headingStyle.font ?? defaults.font,
    font_size: blockStyle.font_size ?? headingStyle.font_size ?? defaults.font_size,
    color: blockStyle.color ?? headingStyle.color ?? defaults.color,
    bold: blockStyle.bold ?? headingStyle.bold ?? false,
    italic: blockStyle.italic ?? headingStyle.italic ?? false,
    underline: blockStyle.underline ?? headingStyle.underline ?? false,
    align: blockStyle.align ?? headingStyle.align ?? 'left',
    spacing_before: blockStyle.spacing_before ?? headingStyle.spacing_before ?? 0,
    spacing_after:
      blockStyle.spacing_after ?? headingStyle.spacing_after ?? defaults.spacing_after,
    page_break_before:
      blockStyle.page_break_before ?? headingStyle.page_break_before ?? false,
    preview_emphasis: blockStyle.preview_emphasis ?? headingStyle.preview_emphasis ?? 'plain',
  };
}

function toStyleIdFragment(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}

function paragraphStyleIdForBlock(block) {
  if (block.type === 'heading') {
    return `OAHeading${block.level}`;
  }

  if (block.blockStyle) {
    return `OABlock${toStyleIdFragment(block.blockStyle)}`;
  }

  return 'Normal';
}

function paragraphRunStyle(style) {
  return {
    font: style.font,
    size: style.font_size,
    color: style.color,
    bold: style.bold,
    italics: style.italic,
    underline: style.underline,
  };
}

function buildRunOptions(currentStyle, baseStyle, text) {
  const options = { text };

  if (currentStyle.font !== baseStyle.font) {
    options.font = currentStyle.font;
  }

  if (currentStyle.size !== baseStyle.size) {
    options.size = currentStyle.size;
  }

  if (currentStyle.color !== baseStyle.color) {
    options.color = currentStyle.color;
  }

  if (currentStyle.bold !== baseStyle.bold) {
    options.bold = currentStyle.bold;
  }

  if (currentStyle.italics !== baseStyle.italics) {
    options.italics = currentStyle.italics;
  }

  if (currentStyle.underline !== baseStyle.underline) {
    options.underline = currentStyle.underline
      ? { type: UnderlineType.SINGLE }
      : undefined;
  }

  return options;
}

function buildDocumentStyles(styleRegistry) {
  const defaults = styleRegistry.docx.defaults;
  const normalStyle = {
    font: defaults.font,
    font_size: defaults.font_size,
    color: defaults.color,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    spacing_before: 0,
    spacing_after: defaults.spacing_after,
    page_break_before: false,
    preview_emphasis: 'plain',
  };

  // Pages was materially less forgiving than LibreOffice during SAFE board
  // consent backport testing. It expects a concrete Normal paragraph style plus
  // concrete custom paragraph styles for any style IDs referenced in
  // document.xml. Keeping that style tree explicit is the compatibility floor.

  const buildParagraphStyle = (id, name, style) => {
    const paragraphOptions = {
      spacing: {
        before: style.spacing_before,
        after: style.spacing_after,
        line: defaults.line,
        lineRule: LineRuleType.AUTO,
      },
    };

    if (style.align !== 'left') {
      paragraphOptions.alignment = toAlignment(style.align);
    }

    const runOptions = {
      font: style.font,
      size: style.font_size,
      color: style.color,
    };

    if (style.bold) {
      runOptions.bold = true;
    }

    if (style.italic) {
      runOptions.italics = true;
    }

    if (style.underline) {
      runOptions.underline = { type: UnderlineType.SINGLE };
    }

    return {
      id,
      name,
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: runOptions,
      paragraph: paragraphOptions,
    };
  };

  const paragraphStyles = [
    {
      id: 'Normal',
      name: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: {
        font: normalStyle.font,
        size: normalStyle.font_size,
        color: normalStyle.color,
      },
      paragraph: {
        spacing: {
          before: normalStyle.spacing_before,
          after: normalStyle.spacing_after,
          line: defaults.line,
          lineRule: LineRuleType.AUTO,
        },
      },
    },
  ];

  for (const level of [1, 2, 3]) {
    const headingKey = `h${level}`;
    const headingStyle = styleRegistry.headings[headingKey];
    if (!headingStyle) {
      continue;
    }

    paragraphStyles.push(
      buildParagraphStyle(
        `OAHeading${level}`,
        `OA Heading ${level}`,
        styleForParagraph({ type: 'heading', level }, styleRegistry)
      )
    );
  }

  for (const slug of Object.keys(styleRegistry.block_styles)) {
    paragraphStyles.push(
      buildParagraphStyle(
        `OABlock${toStyleIdFragment(slug)}`,
        `OA Block ${slug}`,
        styleForParagraph({ type: 'paragraph', blockStyle: slug }, styleRegistry)
      )
    );
  }

  return {
    default: {
      document: {
        run: {
          font: defaults.font,
          size: defaults.font_size,
          color: defaults.color,
        },
        paragraph: {
          spacing: {
            before: 0,
            after: defaults.spacing_after,
            line: defaults.line,
            lineRule: LineRuleType.AUTO,
          },
        },
      },
    },
    paragraphStyles,
  };
}

function headerLabelForTemplate(template) {
  if (template.frontmatter.running_header) {
    return template.frontmatter.running_header;
  }

  if (template.frontmatter.title && template.frontmatter.jurisdiction) {
    return `${template.frontmatter.title} (${template.frontmatter.jurisdiction})`;
  }

  return template.frontmatter.title ?? null;
}

function buildPageHeader(template) {
  const headerConfig = template.styleRegistry.docx.header;
  const label = headerLabelForTemplate(template);
  if (!headerConfig?.enabled || !label) {
    return undefined;
  }

  const nilBorder = {
    style: BorderStyle.NIL,
    color: 'FFFFFF',
    size: 0,
  };
  const pageWidth = template.styleRegistry.docx.page_size.width;
  const margins = template.styleRegistry.docx.page_margin;
  const tableWidth = pageWidth - margins.left - margins.right;
  const rightColumnWidth = Math.max(2400, Math.floor(tableWidth * 0.34));
  const leftColumnWidth = tableWidth - rightColumnWidth;

  return new Header({
    children: [
      new Table({
        width: { size: tableWidth, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [leftColumnWidth, rightColumnWidth],
        borders: {
          top: {
            style: BorderStyle.SINGLE,
            color: headerConfig.rule_color,
            size: headerConfig.rule_size,
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
                borders: { top: nilBorder, left: nilBorder, bottom: nilBorder, right: nilBorder },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun('')] })],
              }),
              new TableCell({
                borders: { top: nilBorder, left: nilBorder, bottom: nilBorder, right: nilBorder },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: label.toUpperCase(),
                        font: template.styleRegistry.docx.defaults.font,
                        size: headerConfig.font_size,
                        bold: true,
                        color: headerConfig.color,
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
        spacing: { after: headerConfig.spacing_after },
        children: [new TextRun('')],
      }),
    ],
  });
}

function buildHeaderSectionOptions(template, pageHeader) {
  if (!pageHeader) {
    return {};
  }

  const headerConfig = template.styleRegistry.docx.header;
  if (headerConfig?.first_page_only) {
    return {
      headers: {
        first: pageHeader,
      },
      properties: {
        titlePage: true,
      },
    };
  }

  return {
    headers: {
      default: pageHeader,
    },
  };
}

function formatLicenseLabel(license) {
  return String(license).replace(/-/g, ' ');
}

function buildPageFooter(template) {
  const footerConfig = template.styleRegistry.docx.footer;
  if (!footerConfig?.enabled) {
    return undefined;
  }

  const baseRun = {
    font: template.styleRegistry.docx.defaults.font,
    size: footerConfig.font_size,
    color: footerConfig.color,
  };
  const name = template.metadata?.name ?? template.frontmatter.title ?? 'OpenAgreements Template';
  const version = template.metadata?.version ?? '1.0';
  const license = formatLicenseLabel(template.metadata?.license ?? 'CC BY 4.0');

  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({
            text: `${name} (v${version}). Free to use under ${license}.`,
            ...baseRun,
          }),
          new TextRun({ text: '\tPage ', ...baseRun }),
          new TextRun({ children: [PageNumber.CURRENT], ...baseRun }),
          new TextRun({ text: ' of ', ...baseRun }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], ...baseRun }),
        ],
      }),
    ],
  });
}

function buildFooterSectionOptions(template, pageFooter) {
  if (!pageFooter) {
    return {};
  }

  const headerConfig = template.styleRegistry.docx.header;
  if (headerConfig?.first_page_only) {
    return {
      footers: {
        first: pageFooter,
        default: pageFooter,
      },
    };
  }

  return {
    footers: {
      default: pageFooter,
    },
  };
}

function flattenInlineNodes(nodes, styleRegistry, baseStyle, placeholderFormatter) {
  const runs = [];
  const paragraphBaseStyle = paragraphRunStyle(baseStyle);

  function visit(currentNodes, inheritedStyle) {
    for (const node of currentNodes) {
      if (node.type === 'text') {
        runs.push(new TextRun(buildRunOptions(inheritedStyle, paragraphBaseStyle, node.value)));
        continue;
      }

      if (node.type === 'variable') {
        runs.push(
          new TextRun(
            buildRunOptions(
              inheritedStyle,
              paragraphBaseStyle,
              placeholderFormatter(node.name)
            )
          )
        );
        continue;
      }

      if (node.type === 'strong') {
        visit(node.children, mergeInlineProps(inheritedStyle, { bold: true }));
        continue;
      }

      if (node.type === 'emphasis') {
        visit(node.children, mergeInlineProps(inheritedStyle, { italic: true }));
        continue;
      }

      if (node.type === 'strong_emphasis') {
        visit(
          node.children,
          mergeInlineProps(inheritedStyle, { bold: true, italic: true })
        );
        continue;
      }

      if (node.type === 'styled') {
        const inlineStyle = styleRegistry.inline_styles[node.styleSlug] ?? {};
        visit(node.children, mergeInlineProps(inheritedStyle, inlineStyle));
      }
    }
  }

  visit(nodes, {
    ...paragraphBaseStyle,
  });

  return runs;
}

function renderPreviewInline(nodes, styleRegistry, placeholderFormatter) {
  function visit(currentNodes, emphasisMode = 'plain') {
    return currentNodes
      .map((node) => {
        if (node.type === 'text') {
          return node.value;
        }

        if (node.type === 'variable') {
          return placeholderFormatter(node.name);
        }

        if (node.type === 'strong') {
          return `**${visit(node.children, emphasisMode)}**`;
        }

        if (node.type === 'emphasis') {
          return `*${visit(node.children, emphasisMode)}*`;
        }

        if (node.type === 'strong_emphasis') {
          return `***${visit(node.children, emphasisMode)}***`;
        }

        if (node.type === 'styled') {
          const inlineStyle = styleRegistry.inline_styles[node.styleSlug] ?? {};
          const nextMode = mergePreviewEmphasis(
            emphasisMode,
            inlineStyle.preview_emphasis ?? 'plain'
          );
          return applyPreviewEmphasis(visit(node.children, nextMode), nextMode);
        }

        return '';
      })
      .join('');
  }

  return visit(nodes);
}

function applyPreviewEmphasis(text, emphasis) {
  switch (emphasis) {
    case 'italic':
      return `*${text}*`;
    case 'bold':
      return `**${text}**`;
    case 'bold_italic':
      return `***${text}***`;
    case 'plain':
    default:
      return text;
  }
}

function renderMarkdown(template) {
  const lines = [];

  for (const block of template.blocks) {
    const paragraphStyle = styleForParagraph(block, template.styleRegistry);
    const text = renderPreviewInline(
      block.inlines,
      template.styleRegistry,
      (name) => `{${name}}`
    );

    if (block.type === 'heading') {
      lines.push(`${'#'.repeat(block.level)} ${text}`);
      lines.push('');
      continue;
    }

    lines.push(applyPreviewEmphasis(text, paragraphStyle.preview_emphasis));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

export async function renderContractIrToArtifacts(template) {
  const children = template.blocks.flatMap((block) => {
    const paragraphStyle = styleForParagraph(block, template.styleRegistry);
    const paragraphs = [];

    if (paragraphStyle.page_break_before) {
      paragraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        style: paragraphStyleIdForBlock(block),
        children: flattenInlineNodes(
          block.inlines,
          template.styleRegistry,
          paragraphStyle,
          (name) => `{${name}}`
        ),
      })
    );

    return paragraphs;
  });

  const pageHeader = buildPageHeader(template);
  const pageFooter = buildPageFooter(template);
  const headerSectionOptions = buildHeaderSectionOptions(template, pageHeader);
  const footerSectionOptions = buildFooterSectionOptions(template, pageFooter);

  const document = new Document({
    styles: buildDocumentStyles(template.styleRegistry),
    sections: [
      {
        properties: {
          page: {
            size: template.styleRegistry.docx.page_size,
            margin: template.styleRegistry.docx.page_margin,
          },
          ...headerSectionOptions.properties,
        },
        ...(headerSectionOptions.headers ? { headers: headerSectionOptions.headers } : {}),
        ...(footerSectionOptions.footers ? { footers: footerSectionOptions.footers } : {}),
        children,
      },
    ],
  });

  return {
    document,
    buffer: await Packer.toBuffer(document),
    markdown: renderMarkdown(template),
  };
}
