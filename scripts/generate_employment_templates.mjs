import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  LineRuleType,
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
  VerticalAlign,
  WidthType,
} from 'docx';

const BRAND = {
  INK: '1D2021',
  INK_SOFT: '494A4B',
  MUTED: '8C8D8E',
  ACCENT: '117086',
  ACCENT_DEEP: '107087',
  RULE: 'C7C7C7',
};

const PAGE_MARGIN = {
  top: 936,
  right: 1080,
  bottom: 720,
  left: 1080,
  header: 360,
  footer: 432,
  gutter: 0,
};

const COVER_TABLE_COLS = [3420, 6650];
const SIGNATURE_TABLE_COLS = [2605, 3600, 250, 3620];
const HEADER_TABLE_COLS = [7900, 2170];

const DEF_TERMS = [
  'Company',
  'Employee',
  'Customer',
  'Provider',
  'Confidential Information',
  'Cover Terms',
  'Standard Terms',
  'Subscription Period',
  'Governing Law',
];

const DOCUMENT_STYLES = {
  default: {
    document: {
      run: {
        font: 'Arial',
        size: 22,
        color: BRAND.INK,
      },
      paragraph: {
        spacing: {
          before: 0,
          after: 0,
          line: 340,
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
        font: 'Arial',
        size: 22,
        color: BRAND.INK,
      },
      paragraph: {
        spacing: {
          before: 0,
          after: 0,
          line: 340,
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
        font: 'Arial',
        size: 22,
        bold: true,
        color: BRAND.INK,
      },
      paragraph: {
        spacing: {
          before: 320,
          after: 120,
          line: 340,
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
        font: 'Arial',
        size: 22,
        color: BRAND.INK,
      },
      paragraph: {
        spacing: {
          before: 0,
          after: 280,
          line: 340,
          lineRule: LineRuleType.AUTO,
        },
      },
    },
  ],
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function runsWithDefinedTerms(text, terms = DEF_TERMS, opts = {}) {
  const runSize = opts.size ?? 16;
  const runFont = opts.font ?? 'Arial';
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
        color: opts.color ?? (isTerm ? BRAND.ACCENT : BRAND.INK),
      });
    });
}

function sectionHeader(label) {
  return new Header({
    children: [
      new Table({
        width: { size: 10070, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: HEADER_TABLE_COLS,
        borders: {
          top: {
            style: BorderStyle.SINGLE,
            color: BRAND.ACCENT_DEEP,
            size: 14,
          },
          left: NIL_BORDER,
          bottom: NIL_BORDER,
          right: NIL_BORDER,
          insideH: NIL_BORDER,
          insideV: NIL_BORDER,
        },
        rows: [
          new TableRow({
            height: { value: 360, rule: HeightRule.ATLEAST },
            children: [
              new TableCell({
                borders: {
                  top: NIL_BORDER,
                  left: NIL_BORDER,
                  bottom: NIL_BORDER,
                  right: NIL_BORDER,
                },
                margins: { top: 36, left: 0, bottom: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun('')] })],
              }),
              new TableCell({
                borders: {
                  top: NIL_BORDER,
                  left: NIL_BORDER,
                  bottom: NIL_BORDER,
                  right: NIL_BORDER,
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
                        font: 'Arial',
                        size: 18,
                        bold: true,
                        color: BRAND.ACCENT_DEEP,
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

function sectionFooter(docLabel, version, opts = {}) {
  const includeCloudDocLine = opts.includeCloudDocLine === true;
  const baseRun = {
    font: 'Arial',
    size: 13,
    color: BRAND.INK_SOFT,
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
                  font: 'Arial',
                  size: 12,
                  color: BRAND.INK_SOFT,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function buildSection(sectionLabel, docLabel, version, children, opts = {}) {
  return {
    properties: {
      page: {
        margin: PAGE_MARGIN,
      },
    },
    headers: {
      default: sectionHeader(sectionLabel),
    },
    footers: {
      default: sectionFooter(docLabel, version, opts),
    },
    children,
  };
}

function title(text) {
  return new Paragraph({
    spacing: { before: 240, after: 210 },
    children: [
      new TextRun({
        text,
        font: 'Georgia',
        size: 44,
        color: BRAND.INK,
      }),
    ],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    style: opts.style,
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 280,
      line: opts.line ?? 340,
      lineRule: LineRuleType.AUTO,
    },
    alignment: opts.alignment,
    children: runsWithDefinedTerms(text, opts.terms, {
      size: opts.size ?? 22,
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color,
    }),
  });
}

function note(text) {
  return body(text, {
    italics: true,
    size: 16,
    color: BRAND.INK_SOFT,
    after: 80,
    terms: [],
  });
}

const NIL_BORDER = {
  style: BorderStyle.NIL,
  color: 'FFFFFF',
  size: 0,
};

const RULE_BORDER = {
  style: BorderStyle.SINGLE,
  color: BRAND.RULE,
  size: 4,
};

function horizontalBorders() {
  return {
    top: RULE_BORDER,
    left: NIL_BORDER,
    bottom: RULE_BORDER,
    right: NIL_BORDER,
  };
}

function rowHeadingCell(titleText, subtitleText) {
  return new TableCell({
    columnSpan: 2,
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: RULE_BORDER,
      right: NIL_BORDER,
    },
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 30, line: 276 },
        children: [
          new TextRun({
            text: titleText,
            font: 'Arial',
            size: 22,
            bold: true,
            color: BRAND.ACCENT,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 20, line: 276 },
        children: [
          new TextRun({
            text: subtitleText,
            font: 'Arial',
            size: 16,
            color: BRAND.ACCENT,
          }),
        ],
      }),
    ],
  });
}

function keyLabelCell(label, hint, conditionField) {
  const labelText = conditionField ? `{IF ${conditionField}}${label}` : label;
  return new TableCell({
    borders: horizontalBorders(),
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: hint ? 10 : 0, line: 276 },
        children: [
          new TextRun({
            text: labelText,
            font: 'Arial',
            size: 22,
            bold: true,
            color: BRAND.INK,
          }),
        ],
      }),
      ...(hint
        ? [
            new Paragraph({
              spacing: { after: 0, line: 276 },
              children: [
                new TextRun({
                  text: hint,
                  font: 'Arial',
                  size: 14,
                  color: BRAND.MUTED,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function keyValueCell(value, noteText, conditionField) {
  const valueText = conditionField ? `${value}{END-IF}` : value;
  return new TableCell({
    borders: horizontalBorders(),
    margins: { top: 144, left: 115, bottom: 144, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      body(valueText, { size: 22, after: noteText ? 40 : 0, terms: DEF_TERMS }),
      ...(noteText ? [note(noteText)] : []),
    ],
  });
}

function coverTable(rows, titleText, subtitleText) {
  return new Table({
    width: { size: 10070, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: COVER_TABLE_COLS,
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
      insideH: NIL_BORDER,
      insideV: NIL_BORDER,
    },
    rows: [
      new TableRow({
        children: [rowHeadingCell(titleText, subtitleText)],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            height: { value: 700, rule: HeightRule.ATLEAST },
            children: [
              keyLabelCell(row.label, row.hint, row.condition),
              keyValueCell(row.value, row.note, row.condition),
            ],
          })
      ),
    ],
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 0, after: 240, line: 340, lineRule: LineRuleType.AUTO },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 22,
        bold: true,
        color: BRAND.ACCENT,
      }),
    ],
  });
}

function clause(index, headingText, bodyText) {
  return [
    new Paragraph({
      style: 'OAClauseHeading',
      // Keep explicit Standard Terms spacing for cross-editor compatibility.
      spacing: { before: 320, after: 120, line: 340, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text: `${index}. ${headingText}.`,
          font: 'Arial',
          size: 22,
          bold: true,
          color: BRAND.INK,
        }),
      ],
    }),
    body(bodyText, {
      size: 22,
      terms: DEF_TERMS,
      style: 'OAClauseBody',
      after: 280,
      line: 340,
    }),
  ];
}

function createDocument(sections) {
  return new Document({
    styles: DOCUMENT_STYLES,
    sections,
  });
}

function signatureHeaderCell(text) {
  return new TableCell({
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
    },
    margins: { top: 216, left: 115, bottom: 120, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 276 },
        children: [
          new TextRun({
            text,
            font: 'Arial',
            size: 16,
            bold: true,
            color: BRAND.MUTED,
          }),
        ],
      }),
    ],
  });
}

function signatureLabelCell(label, hint) {
  return new TableCell({
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
    },
    margins: { top: 216, left: 115, bottom: 216, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: hint ? 10 : 0, line: 276 },
        children: [
          new TextRun({
            text: label,
            font: 'Arial',
            size: 18,
            bold: true,
            color: BRAND.INK,
          }),
        ],
      }),
      ...(hint
        ? [
            new Paragraph({
              spacing: { after: 0, line: 276 },
              children: [
                new TextRun({
                  text: hint,
                  font: 'Arial',
                  size: 14,
                  color: BRAND.MUTED,
                }),
              ],
            }),
          ]
        : []),
    ],
  });
}

function signatureLineCell(value = '') {
  return new TableCell({
    borders: {
      top: RULE_BORDER,
      left: NIL_BORDER,
      bottom: RULE_BORDER,
      right: NIL_BORDER,
    },
    margins: { top: 216, left: 115, bottom: 216, right: 115 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { after: 0, line: 276 },
        children: [
          new TextRun({
            text: value,
            font: 'Arial',
            size: 18,
            color: BRAND.INK,
          }),
        ],
      }),
    ],
  });
}

function signatureSpacerCell() {
  return new TableCell({
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
    },
    margins: { top: 216, left: 0, bottom: 216, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph('')],
  });
}

function twoPartySignatureTable(partyA, partyB, rows) {
  return new Table({
    width: { size: 10075, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: SIGNATURE_TABLE_COLS,
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
      insideH: NIL_BORDER,
      insideV: NIL_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          signatureLabelCell('', ''),
          signatureHeaderCell(partyA.toUpperCase()),
          signatureSpacerCell(),
          signatureHeaderCell(partyB.toUpperCase()),
        ],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            height: { value: 690, rule: HeightRule.ATLEAST },
            children: [
              signatureLabelCell(row.label, row.hint),
              signatureLineCell(row.left ?? ''),
              signatureSpacerCell(),
              signatureLineCell(row.right ?? ''),
            ],
          })
      ),
    ],
  });
}

function onePartySignatureTable(party, rows) {
  return new Table({
    width: { size: 10070, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [2605, 7465],
    borders: {
      top: NIL_BORDER,
      left: NIL_BORDER,
      bottom: NIL_BORDER,
      right: NIL_BORDER,
      insideH: NIL_BORDER,
      insideV: NIL_BORDER,
    },
    rows: [
      new TableRow({
        children: [
          signatureLabelCell('', ''),
          signatureHeaderCell(party.toUpperCase()),
        ],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            height: { value: 690, rule: HeightRule.ATLEAST },
            children: [
              signatureLabelCell(row.label, row.hint),
              signatureLineCell(row.value ?? ''),
            ],
          })
      ),
    ],
  });
}

function offerLetterDoc() {
  const version = '1.1';
  const docLabel = 'OpenAgreements Employment Offer Letter';

  const coverRows = [
    { label: 'Employer', value: '{employer_name}' },
    { label: 'Employee', value: '{employee_name}' },
    { label: 'Position Title', value: '{position_title}' },
    { label: 'Employment Type', value: '{employment_type}' },
    { label: 'Start Date', value: '{start_date}' },
    { label: 'Reporting Manager', value: '{reporting_manager}' },
    { label: 'Base Salary', value: '{base_salary}' },
    { label: 'Bonus Terms', value: '{bonus_terms}', condition: 'bonus_terms' },
    { label: 'Equity Terms', value: '{equity_terms}', condition: 'equity_terms' },
    { label: 'Primary Work Location', value: '{work_location}' },
    { label: 'Governing Law', value: '{governing_law}' },
    { label: 'Offer Expiration Date', value: '{offer_expiration_date}' },
  ];

  const clauses = [
    [
      'Position, Scope, and Reporting',
      'If Employee accepts this offer, Employee will join Company in the position listed in Cover Terms and will report to the manager or function listed in Cover Terms, with duties and responsibilities that are reasonably aligned to the role and business needs.',
    ],
    [
      'Employment Type and Work Schedule',
      'Employee will be employed on the employment basis listed in Cover Terms. Company may establish reasonable scheduling, attendance, and collaboration expectations for the role, including core hours and team coordination standards.',
    ],
    [
      'Start Date and Onboarding Conditions',
      'Employment is expected to begin on the start date listed in Cover Terms, subject to completion of onboarding requirements such as identity and work authorization verification, policy acknowledgements, and execution of confidentiality and inventions assignment documents.',
    ],
    [
      'Base Compensation and Payroll',
      'Company will pay the base salary or hourly compensation listed in Cover Terms in accordance with Company payroll practices and applicable law, subject to required withholdings, deductions, and payroll tax obligations.',
    ],
    [
      'Bonus Opportunity',
      'If bonus terms are listed in Cover Terms, those terms describe potential bonus eligibility. Bonus programs, metrics, and payout timing are administered under applicable Company plans and may depend on individual, team, and Company performance criteria.',
    ],
    [
      'Equity Opportunity',
      'If equity terms are listed in Cover Terms, any grant remains subject to board or committee approval, applicable equity plan documents, and separate award documentation. Vesting, exercise, and expiration terms are governed by those plan and award documents.',
    ],
    [
      'Benefits and Time-Off Programs',
      'Employee may be eligible to participate in benefit and paid-time-off programs made available to similarly situated employees, in each case subject to plan terms, enrollment requirements, and Company policy updates permitted by law.',
    ],
    [
      'Work Location and Business Travel',
      'Employee will primarily work from the location listed in Cover Terms. Company may require reasonable business travel and may update workplace expectations, including on-site or remote collaboration requirements, consistent with applicable law.',
    ],
    [
      'Policies, Confidentiality, and Company Property',
      'As a condition of employment, Employee must comply with Company written policies, security requirements, confidentiality obligations, and lawful workplace rules, including policies covering information handling, code and device access, and return of Company property.',
    ],
    [
      'At-Will Employment Relationship',
      'Unless otherwise required by law or a separate written agreement signed by an authorized Company representative, employment is at-will. This means either Employee or Company may end employment at any time, with or without advance notice, and with or without cause.',
    ],
    [
      'Governing Law',
      'This offer letter and any dispute regarding its interpretation are governed by the law listed in Cover Terms, without applying conflicts-of-law principles to the extent not required by applicable law.',
    ],
    [
      'Offer Expiration, Acceptance, and Entire Offer',
      'This offer expires on the date listed in Cover Terms unless extended in writing by Company. By accepting, Employee acknowledges this letter summarizes key employment terms and that any changes must be set out in a later written document authorized by Company.',
    ],
  ];

  const signatureRows = [
    { label: 'Signature', left: '', right: '' },
    { label: 'Print Name', left: '{employer_name}', right: '{employee_name}' },
    { label: 'Title', left: '', right: '' },
    { label: 'Date', left: '', right: '' },
  ];

  return createDocument([
      buildSection(
        'Cover Terms',
        docLabel,
        version,
        [
          title('Employment Offer Letter'),
          coverTable(
            coverRows,
            'Cover Terms',
            'The key business terms of this Employment Offer Letter are as follows.'
          ),
        ],
        { includeCloudDocLine: true }
      ),
      buildSection('Standard Terms', docLabel, version, [
        sectionTitle('Standard Terms'),
        ...clauses.flatMap(([headingText, clauseText], index) => clause(index + 1, headingText, clauseText)),
      ]),
      buildSection('Signature Page', docLabel, version, [
        sectionTitle('Signatures'),
        body('By signing this Employment Offer Letter, each party agrees to these Cover Terms and Standard Terms.', {
          terms: [],
          size: 16,
        }),
        twoPartySignatureTable('Employer', 'Employee', signatureRows),
      ]),
    ]);
}

function ipAssignmentDoc() {
  const version = '1.1';
  const docLabel = 'OpenAgreements Employee IP and Inventions Assignment';

  const coverRows = [
    { label: 'Company', value: '{company_name}' },
    { label: 'Employee', value: '{employee_name}' },
    { label: 'Effective Date', value: '{effective_date}' },
    { label: 'Prior Inventions Disclosure', value: '{prior_inventions_disclosure}' },
    { label: 'Excluded Inventions Statement', value: '{excluded_inventions_statement}' },
    { label: 'Confidential Information Definition', value: '{confidential_information_definition}' },
    { label: 'Return of Materials Timing', value: '{return_of_materials_timing}' },
    { label: 'Post-Termination Assistance', value: '{post_termination_assistance}' },
    { label: 'Governing Law', value: '{governing_law}' },
    { label: 'Venue', value: '{venue}' },
  ];

  const clauses = [
    [
      'Assignment of Inventions',
      'Employee assigns and agrees to assign to Company all right, title, and interest in inventions, software, works of authorship, discoveries, designs, data models, and related intellectual property created during employment that arise from Company work, use Company resources, or relate to Company actual or anticipated business, to the extent permitted by law.',
    ],
    [
      'Work Made for Hire and Further Assurances',
      'To the extent legally permitted, copyrightable works prepared within the scope of employment are works made for hire for Company. If any rights do not automatically vest in Company, Employee assigns those rights and will sign additional documents reasonably requested to confirm ownership and record assignments.',
    ],
    [
      'Disclosure and Documentation',
      'Employee will promptly disclose covered inventions and maintain reasonably complete records needed to document conception, authorship, development, and transfer of rights for Company business, consistent with lawful policy and confidentiality obligations.',
    ],
    [
      'Prior and Excluded Inventions',
      'Inventions identified in Cover Terms as prior or excluded remain carved out only to the extent permitted by applicable law. Employee represents that the prior inventions disclosure in Cover Terms is complete to Employee knowledge as of the Effective Date.',
    ],
    [
      'Confidential Information and Trade Secrets',
      'Employee will use and protect confidential information solely for authorized Company purposes, will not misuse or disclose confidential information except as permitted by Company policy or law, and will follow the confidential information definition set out in Cover Terms.',
    ],
    [
      'No Conflicting Obligations',
      'Employee represents that performing duties for Company does not knowingly conflict with binding obligations to another person or entity. Employee will not bring third-party confidential information into Company systems or use it in Company work without written authorization.',
    ],
    [
      'Records, Cooperation, and Post-Termination Assistance',
      'Employee will provide the post-termination assistance listed in Cover Terms, including reasonable cooperation with filings, declarations, and assignments needed to confirm or protect Company rights in covered inventions, subject to reimbursement of reasonable out-of-pocket expenses when required by policy.',
    ],
    [
      'Return and Deletion of Materials',
      'Employee will return, and where permitted delete, Company materials within the timing listed in Cover Terms, including devices, documents, credentials, and confidential files, except for records Employee is required to retain by law.',
    ],
    [
      'Survival and Limited Scope',
      'Sections addressing assignment, confidentiality, return of materials, and assistance survive termination to the extent needed to enforce rights that arose during employment. This agreement does not transfer ownership of inventions that applicable law requires to remain with Employee.',
    ],
    [
      'Governing Law and Venue',
      'This agreement is governed by the law listed in Cover Terms, and disputes will be resolved in the venue listed in Cover Terms, subject to non-waivable rights under applicable law.',
    ],
  ];

  const signatureRows = [
    { label: 'Signature', left: '', right: '' },
    { label: 'Print Name', left: '{company_name}', right: '{employee_name}' },
    { label: 'Title', left: '', right: '' },
    { label: 'Date', left: '', right: '' },
  ];

  return createDocument([
      buildSection(
        'Cover Terms',
        docLabel,
        version,
        [
          title('Employee IP and Inventions Assignment Agreement'),
          coverTable(
            coverRows,
            'Cover Terms',
            'The key business terms of this assignment agreement are as follows.'
          ),
        ],
        { includeCloudDocLine: true }
      ),
      buildSection('Standard Terms', docLabel, version, [
        sectionTitle('Standard Terms'),
        ...clauses.flatMap(([headingText, clauseText], index) => clause(index + 1, headingText, clauseText)),
      ]),
      buildSection('Signature Page', docLabel, version, [
        sectionTitle('Signatures'),
        body('By signing this agreement, each party acknowledges and agrees to the assignment and confidentiality obligations above.', {
          terms: [],
          size: 16,
        }),
        twoPartySignatureTable('Company', 'Employee', signatureRows),
      ]),
    ]);
}

function confidentialityAckDoc() {
  const version = '1.1';
  const docLabel = 'OpenAgreements Employment Confidentiality Acknowledgement';

  const coverRows = [
    { label: 'Company', value: '{company_name}' },
    { label: 'Employee', value: '{employee_name}' },
    { label: 'Policy Effective Date', value: '{policy_effective_date}' },
    { label: 'Approved Tools Scope', value: '{approved_tools_scope}' },
    { label: 'Data Access Scope', value: '{data_access_scope}' },
    { label: 'Security Reporting Contact', value: '{security_reporting_contact}' },
    { label: 'Post-Employment Obligations', value: '{post_employment_obligations}' },
    { label: 'Acknowledgement Date', value: '{acknowledgement_date}' },
    { label: 'Signatory Name', value: '{signatory_name}' },
  ];

  const clauses = [
    [
      'Confidential Information Handling',
      'Employee will use confidential information only for authorized business purposes and within the data access scope listed in Cover Terms.',
    ],
    [
      'Approved Tools and Systems',
      'Employee will access Company data only through approved tools and systems listed in Cover Terms unless written authorization is provided.',
    ],
    [
      'Security Incident Reporting',
      'Employee will promptly report suspected incidents to the security reporting contact listed in Cover Terms.',
    ],
    [
      'Post-Employment Obligations',
      'After employment ends, Employee will continue obligations listed in Cover Terms and as required by law.',
    ],
    [
      'Policy Updates',
      'Company may update policies from time to time. Employee remains responsible for complying with current written policies communicated by Company.',
    ],
  ];

  const signatureRows = [
    { label: 'Signature', value: '' },
    { label: 'Print Name', value: '{signatory_name}' },
    { label: 'Date', value: '{acknowledgement_date}' },
  ];

  return createDocument([
      buildSection(
        'Cover Terms',
        docLabel,
        version,
        [
          title('Employment Confidentiality Acknowledgement'),
          coverTable(
            coverRows,
            'Cover Terms',
            'The key business terms of this confidentiality acknowledgement are as follows.'
          ),
        ],
        { includeCloudDocLine: true }
      ),
      buildSection('Standard Terms', docLabel, version, [
        sectionTitle('Standard Terms'),
        ...clauses.flatMap(([headingText, clauseText], index) => clause(index + 1, headingText, clauseText)),
      ]),
      buildSection('Signature Page', docLabel, version, [
        sectionTitle('Acknowledgement Signature'),
        body('By signing this acknowledgement, Employee confirms understanding of the confidentiality and security obligations above.', {
          terms: [],
          size: 16,
        }),
        onePartySignatureTable('Employee', signatureRows),
      ]),
    ]);
}

function renderMarkdown({ title: docTitle, label, version, license, coverSubtitle, coverRows, clauses, signaturePreamble, signatureSections }) {
  const lines = [];
  lines.push(`# ${docTitle}`);
  lines.push('');
  lines.push(`${label} (v${version}). ${license}.`);
  lines.push('');

  // Cover Terms
  lines.push('## Cover Terms');
  lines.push('');
  lines.push(coverSubtitle);
  lines.push('');
  lines.push('| Term | Value |');
  lines.push('|------|-------|');
  for (const row of coverRows) {
    lines.push(`| **${row.label}** | ${row.value} |`);
  }
  lines.push('');

  // Standard Terms
  lines.push('## Standard Terms');
  lines.push('');
  for (let i = 0; i < clauses.length; i++) {
    const [heading, body] = clauses[i];
    lines.push(`### ${i + 1}. ${heading}`);
    lines.push('');
    lines.push(body);
    lines.push('');
  }

  // Signature
  lines.push('## Signatures');
  lines.push('');
  lines.push(signaturePreamble);
  lines.push('');
  for (const section of signatureSections) {
    lines.push(`**${section.party}**`);
    lines.push('');
    for (const row of section.rows) {
      lines.push(`${row.label}: ${row.value || '_______________'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function offerLetterMarkdown() {
  return renderMarkdown({
    title: 'Employment Offer Letter',
    label: 'OpenAgreements Employment Offer Letter',
    version: '1.1',
    license: 'Free to use under CC BY 4.0',
    coverSubtitle: 'The key business terms of this Employment Offer Letter are as follows.',
    coverRows: [
      { label: 'Employer', value: '{employer_name}' },
      { label: 'Employee', value: '{employee_name}' },
      { label: 'Position Title', value: '{position_title}' },
      { label: 'Employment Type', value: '{employment_type}' },
      { label: 'Start Date', value: '{start_date}' },
      { label: 'Reporting Manager', value: '{reporting_manager}' },
      { label: 'Base Salary', value: '{base_salary}' },
      { label: 'Bonus Terms', value: '{bonus_terms}' },
      { label: 'Equity Terms', value: '{equity_terms}' },
      { label: 'Primary Work Location', value: '{work_location}' },
      { label: 'Governing Law', value: '{governing_law}' },
      { label: 'Offer Expiration Date', value: '{offer_expiration_date}' },
    ],
    clauses: [
      ['Position, Scope, and Reporting', 'If Employee accepts this offer, Employee will join Company in the position listed in Cover Terms and will report to the manager or function listed in Cover Terms, with duties and responsibilities that are reasonably aligned to the role and business needs.'],
      ['Employment Type and Work Schedule', 'Employee will be employed on the employment basis listed in Cover Terms. Company may establish reasonable scheduling, attendance, and collaboration expectations for the role, including core hours and team coordination standards.'],
      ['Start Date and Onboarding Conditions', 'Employment is expected to begin on the start date listed in Cover Terms, subject to completion of onboarding requirements such as identity and work authorization verification, policy acknowledgements, and execution of confidentiality and inventions assignment documents.'],
      ['Base Compensation and Payroll', 'Company will pay the base salary or hourly compensation listed in Cover Terms in accordance with Company payroll practices and applicable law, subject to required withholdings, deductions, and payroll tax obligations.'],
      ['Bonus Opportunity', 'If bonus terms are listed in Cover Terms, those terms describe potential bonus eligibility. Bonus programs, metrics, and payout timing are administered under applicable Company plans and may depend on individual, team, and Company performance criteria.'],
      ['Equity Opportunity', 'If equity terms are listed in Cover Terms, any grant remains subject to board or committee approval, applicable equity plan documents, and separate award documentation. Vesting, exercise, and expiration terms are governed by those plan and award documents.'],
      ['Benefits and Time-Off Programs', 'Employee may be eligible to participate in benefit and paid-time-off programs made available to similarly situated employees, in each case subject to plan terms, enrollment requirements, and Company policy updates permitted by law.'],
      ['Work Location and Business Travel', 'Employee will primarily work from the location listed in Cover Terms. Company may require reasonable business travel and may update workplace expectations, including on-site or remote collaboration requirements, consistent with applicable law.'],
      ['Policies, Confidentiality, and Company Property', 'As a condition of employment, Employee must comply with Company written policies, security requirements, confidentiality obligations, and lawful workplace rules, including policies covering information handling, code and device access, and return of Company property.'],
      ['At-Will Employment Relationship', 'Unless otherwise required by law or a separate written agreement signed by an authorized Company representative, employment is at-will. This means either Employee or Company may end employment at any time, with or without advance notice, and with or without cause.'],
      ['Governing Law', 'This offer letter and any dispute regarding its interpretation are governed by the law listed in Cover Terms, without applying conflicts-of-law principles to the extent not required by applicable law.'],
      ['Offer Expiration, Acceptance, and Entire Offer', 'This offer expires on the date listed in Cover Terms unless extended in writing by Company. By accepting, Employee acknowledges this letter summarizes key employment terms and that any changes must be set out in a later written document authorized by Company.'],
    ],
    signaturePreamble: 'By signing this Employment Offer Letter, each party agrees to these Cover Terms and Standard Terms.',
    signatureSections: [
      { party: 'Employer', rows: [{ label: 'Signature' }, { label: 'Print Name', value: '{employer_name}' }, { label: 'Title' }, { label: 'Date' }] },
      { party: 'Employee', rows: [{ label: 'Signature' }, { label: 'Print Name', value: '{employee_name}' }, { label: 'Title' }, { label: 'Date' }] },
    ],
  });
}

function ipAssignmentMarkdown() {
  return renderMarkdown({
    title: 'Employee IP and Inventions Assignment Agreement',
    label: 'OpenAgreements Employee IP and Inventions Assignment',
    version: '1.1',
    license: 'Free to use under CC BY 4.0',
    coverSubtitle: 'The key business terms of this assignment agreement are as follows.',
    coverRows: [
      { label: 'Company', value: '{company_name}' },
      { label: 'Employee', value: '{employee_name}' },
      { label: 'Effective Date', value: '{effective_date}' },
      { label: 'Prior Inventions Disclosure', value: '{prior_inventions_disclosure}' },
      { label: 'Excluded Inventions Statement', value: '{excluded_inventions_statement}' },
      { label: 'Confidential Information Definition', value: '{confidential_information_definition}' },
      { label: 'Return of Materials Timing', value: '{return_of_materials_timing}' },
      { label: 'Post-Termination Assistance', value: '{post_termination_assistance}' },
      { label: 'Governing Law', value: '{governing_law}' },
      { label: 'Venue', value: '{venue}' },
    ],
    clauses: [
      ['Assignment of Inventions', 'Employee assigns and agrees to assign to Company all right, title, and interest in inventions, software, works of authorship, discoveries, designs, data models, and related intellectual property created during employment that arise from Company work, use Company resources, or relate to Company actual or anticipated business, to the extent permitted by law.'],
      ['Work Made for Hire and Further Assurances', 'To the extent legally permitted, copyrightable works prepared within the scope of employment are works made for hire for Company. If any rights do not automatically vest in Company, Employee assigns those rights and will sign additional documents reasonably requested to confirm ownership and record assignments.'],
      ['Disclosure and Documentation', 'Employee will promptly disclose covered inventions and maintain reasonably complete records needed to document conception, authorship, development, and transfer of rights for Company business, consistent with lawful policy and confidentiality obligations.'],
      ['Prior and Excluded Inventions', 'Inventions identified in Cover Terms as prior or excluded remain carved out only to the extent permitted by applicable law. Employee represents that the prior inventions disclosure in Cover Terms is complete to Employee knowledge as of the Effective Date.'],
      ['Confidential Information and Trade Secrets', 'Employee will use and protect confidential information solely for authorized Company purposes, will not misuse or disclose confidential information except as permitted by Company policy or law, and will follow the confidential information definition set out in Cover Terms.'],
      ['No Conflicting Obligations', 'Employee represents that performing duties for Company does not knowingly conflict with binding obligations to another person or entity. Employee will not bring third-party confidential information into Company systems or use it in Company work without written authorization.'],
      ['Records, Cooperation, and Post-Termination Assistance', 'Employee will provide the post-termination assistance listed in Cover Terms, including reasonable cooperation with filings, declarations, and assignments needed to confirm or protect Company rights in covered inventions, subject to reimbursement of reasonable out-of-pocket expenses when required by policy.'],
      ['Return and Deletion of Materials', 'Employee will return, and where permitted delete, Company materials within the timing listed in Cover Terms, including devices, documents, credentials, and confidential files, except for records Employee is required to retain by law.'],
      ['Survival and Limited Scope', 'Sections addressing assignment, confidentiality, return of materials, and assistance survive termination to the extent needed to enforce rights that arose during employment. This agreement does not transfer ownership of inventions that applicable law requires to remain with Employee.'],
      ['Governing Law and Venue', 'This agreement is governed by the law listed in Cover Terms, and disputes will be resolved in the venue listed in Cover Terms, subject to non-waivable rights under applicable law.'],
    ],
    signaturePreamble: 'By signing this agreement, each party acknowledges and agrees to the assignment and confidentiality obligations above.',
    signatureSections: [
      { party: 'Company', rows: [{ label: 'Signature' }, { label: 'Print Name', value: '{company_name}' }, { label: 'Title' }, { label: 'Date' }] },
      { party: 'Employee', rows: [{ label: 'Signature' }, { label: 'Print Name', value: '{employee_name}' }, { label: 'Title' }, { label: 'Date' }] },
    ],
  });
}

function confidentialityAckMarkdown() {
  return renderMarkdown({
    title: 'Employment Confidentiality Acknowledgement',
    label: 'OpenAgreements Employment Confidentiality Acknowledgement',
    version: '1.1',
    license: 'Free to use under CC BY 4.0',
    coverSubtitle: 'The key business terms of this confidentiality acknowledgement are as follows.',
    coverRows: [
      { label: 'Company', value: '{company_name}' },
      { label: 'Employee', value: '{employee_name}' },
      { label: 'Policy Effective Date', value: '{policy_effective_date}' },
      { label: 'Approved Tools Scope', value: '{approved_tools_scope}' },
      { label: 'Data Access Scope', value: '{data_access_scope}' },
      { label: 'Security Reporting Contact', value: '{security_reporting_contact}' },
      { label: 'Post-Employment Obligations', value: '{post_employment_obligations}' },
      { label: 'Acknowledgement Date', value: '{acknowledgement_date}' },
      { label: 'Signatory Name', value: '{signatory_name}' },
    ],
    clauses: [
      ['Confidential Information Handling', 'Employee will use confidential information only for authorized business purposes and within the data access scope listed in Cover Terms.'],
      ['Approved Tools and Systems', 'Employee will access Company data only through approved tools and systems listed in Cover Terms unless written authorization is provided.'],
      ['Security Incident Reporting', 'Employee will promptly report suspected incidents to the security reporting contact listed in Cover Terms.'],
      ['Post-Employment Obligations', 'After employment ends, Employee will continue obligations listed in Cover Terms and as required by law.'],
      ['Policy Updates', 'Company may update policies from time to time. Employee remains responsible for complying with current written policies communicated by Company.'],
    ],
    signaturePreamble: 'By signing this acknowledgement, Employee confirms understanding of the confidentiality and security obligations above.',
    signatureSections: [
      { party: 'Employee', rows: [{ label: 'Signature' }, { label: 'Print Name', value: '{signatory_name}' }, { label: 'Date', value: '{acknowledgement_date}' }] },
    ],
  });
}

async function writeDoc(doc, path) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(resolve(path), buf);
}

function writeMd(content, path) {
  writeFileSync(resolve(path), content, 'utf-8');
}

await writeDoc(offerLetterDoc(), 'content/templates/openagreements-employment-offer-letter/template.docx');
await writeDoc(ipAssignmentDoc(), 'content/templates/openagreements-employee-ip-inventions-assignment/template.docx');
await writeDoc(confidentialityAckDoc(), 'content/templates/openagreements-employment-confidentiality-acknowledgement/template.docx');

writeMd(offerLetterMarkdown(), 'content/templates/openagreements-employment-offer-letter/template.md');
writeMd(ipAssignmentMarkdown(), 'content/templates/openagreements-employee-ip-inventions-assignment/template.md');
writeMd(confidentialityAckMarkdown(), 'content/templates/openagreements-employment-confidentiality-acknowledgement/template.md');

console.log('Regenerated branded employment templates (open-source pipeline).');
