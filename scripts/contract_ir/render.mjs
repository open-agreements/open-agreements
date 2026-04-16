import {
  AlignmentType,
  Document,
  LineRuleType,
  PageBreak,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
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

  const document = new Document({
    styles: buildDocumentStyles(template.styleRegistry),
    sections: [
      {
        properties: {
          page: {
            size: template.styleRegistry.docx.page_size,
            margin: template.styleRegistry.docx.page_margin,
          },
        },
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
