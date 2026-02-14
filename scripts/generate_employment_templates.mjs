import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BorderStyle,
  Document,
  HeightRule,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const ACCENT = '1E5A6B';
const LIGHT = 'EEF4F6';
const DARK = '22313F';

function title(text) {
  return new Paragraph({
    spacing: { before: 220, after: 300 },
    border: {
      top: {
        style: BorderStyle.SINGLE,
        color: ACCENT,
        size: 20,
      },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        color: DARK,
        size: 38,
      }),
    ],
  });
}

function subhead(text) {
  return new Paragraph({
    spacing: { before: 300, after: 220 },
    children: [
      new TextRun({ text, bold: true, color: ACCENT, size: 24 }),
    ],
  });
}

function note(text) {
  return new Paragraph({
    spacing: { after: 220, line: 360 },
    children: [new TextRun({ text, italics: true, color: '4B5563', size: 20 })],
  });
}

function normal(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 140, line: 320, ...(opts.spacing ?? {}) },
    children: [new TextRun({ text, size: 22, color: DARK, ...(opts.run ?? {}) })],
  });
}

function strongLine(label, text) {
  return new Paragraph({
    spacing: { before: 60, after: 140, line: 320 },
    children: [
      new TextRun({ text: `${label} `, bold: true, size: 22, color: DARK }),
      new TextRun({ text, size: 22, color: DARK }),
    ],
  });
}

function sectionLabel(text, spacing = {}) {
  return new Paragraph({
    spacing: { before: 120, after: 150, ...spacing },
    children: [new TextRun({ text, bold: true, size: 24, color: DARK })],
  });
}

function coverTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2400, 7200],
    rows: [
      new TableRow({
        height: { value: 620, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            shading: { fill: LIGHT },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [normal('Term', { run: { bold: true } })],
          }),
          new TableCell({
            shading: { fill: LIGHT },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [normal('Selected Value', { run: { bold: true } })],
          }),
        ],
      }),
      ...rows.map((row) =>
        new TableRow({
          height: { value: 620, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [normal(row.label, { run: { bold: true } })],
            }),
            new TableCell({
              margins: { top: 140, bottom: 140, left: 140, right: 140 },
              children: [
                normal(row.value),
                ...(row.note ? [note(row.note)] : []),
              ],
            }),
          ],
        })
      ),
    ],
  });
}

function clause(num, heading, body) {
  return [
    new Paragraph({
      spacing: { before: 220, after: 80, line: 340 },
      children: [new TextRun({ text: `${num}. ${heading}.`, bold: true, size: 22, color: DARK })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 220, line: 340 },
      children: [new TextRun({ text: body, size: 22, color: DARK })],
    }),
  ];
}

function signatureBlock(lines) {
  const children = [subhead('Signatures')];
  for (const line of lines) {
    children.push(
      strongLine(line.label, line.value),
      new Paragraph({
        spacing: { after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, color: '7A8795', size: 6 },
        },
        children: [new TextRun({ text: ' ', size: 22 })],
      })
    );
  }
  return children;
}

function ipSignatureBlock() {
  return [
    subhead('Signatures'),
    sectionLabel('Company'),
    strongLine('Signature:', ''),
    strongLine('Name:', ''),
    strongLine('Title:', ''),
    sectionLabel('Employee', { before: 260 }),
    strongLine('Signature:', ''),
    strongLine('Name:', '{employee_name}'),
    strongLine('Title:', ''),
  ];
}

function offerLetterDoc() {
  const coverRows = [
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
  ];

  return new Document({
    sections: [
      {
        children: [
          title('Employment Offer Letter'),
          normal('OpenAgreements Employment Terms v1.0', { run: { color: ACCENT, bold: true } }),
          note('Cover Terms: Fill in the selected values below. These Cover Terms control if they conflict with Standard Terms.'),
          coverTable(coverRows),
          new Paragraph({ children: [new PageBreak()] }),
          subhead('Standard Terms'),
          ...clause(
            '1',
            'Position, Scope, and Reporting',
            'If Employee accepts this offer, Employee will join Company in the position listed in Cover Terms and will report to the manager or function listed in Cover Terms, with duties and responsibilities that are reasonably aligned to the role and business needs.'
          ),
          ...clause(
            '2',
            'Employment Type and Work Schedule',
            'Employee will be employed on the employment basis listed in Cover Terms. Company may establish reasonable scheduling, attendance, and collaboration expectations for the role, including core hours and team coordination standards.'
          ),
          ...clause(
            '3',
            'Start Date and Onboarding Conditions',
            'Employment is expected to begin on the start date listed in Cover Terms, subject to completion of onboarding requirements such as identity and work authorization verification, policy acknowledgements, and execution of confidentiality and inventions assignment documents.'
          ),
          ...clause(
            '4',
            'Base Compensation and Payroll',
            'Company will pay the base salary or hourly compensation listed in Cover Terms in accordance with Company payroll practices and applicable law, subject to required withholdings, deductions, and payroll tax obligations.'
          ),
          ...clause(
            '5',
            'Bonus Opportunity',
            'If bonus terms are listed in Cover Terms, those terms describe potential bonus eligibility. Bonus programs, metrics, and payout timing are administered under applicable Company plans and may depend on individual, team, and Company performance criteria.'
          ),
          ...clause(
            '6',
            'Equity Opportunity',
            'If equity terms are listed in Cover Terms, any grant remains subject to board or committee approval, applicable equity plan documents, and separate award documentation. Vesting, exercise, and expiration terms are governed by those plan and award documents.'
          ),
          ...clause(
            '7',
            'Benefits and Time-Off Programs',
            'Employee may be eligible to participate in benefit and paid-time-off programs made available to similarly situated employees, in each case subject to plan terms, enrollment requirements, and Company policy updates permitted by law.'
          ),
          ...clause(
            '8',
            'Work Location and Business Travel',
            'Employee will primarily work from the location listed in Cover Terms. Company may require reasonable business travel and may update workplace expectations, including on-site or remote collaboration requirements, consistent with applicable law.'
          ),
          ...clause(
            '9',
            'Policies, Confidentiality, and Company Property',
            'As a condition of employment, Employee must comply with Company written policies, security requirements, confidentiality obligations, and lawful workplace rules, including policies covering information handling, code and device access, and return of Company property.'
          ),
          ...clause(
            '10',
            'At-Will Employment Relationship',
            'Unless otherwise required by law or a separate written agreement signed by an authorized Company representative, employment is at-will. This means either Employee or Company may end employment at any time, with or without advance notice, and with or without cause.'
          ),
          ...clause(
            '11',
            'Governing Law',
            'This offer letter and any dispute regarding its interpretation are governed by the law listed in Cover Terms, without applying conflicts-of-law principles to the extent not required by applicable law.'
          ),
          ...clause(
            '12',
            'Offer Expiration, Acceptance, and Entire Offer',
            'This offer expires on the date listed in Cover Terms unless extended in writing by Company. By accepting, Employee acknowledges this letter summarizes key employment terms and that any changes must be set out in a later written document authorized by Company.'
          ),
          ...signatureBlock([
            { label: 'Employer Representative', value: '{employer_name}' },
            { label: 'Employee', value: '{employee_name}' },
          ]),
        ],
      },
    ],
  });
}

function ipAssignmentDoc() {
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

  return new Document({
    sections: [
      {
        children: [
          title('Employee IP and Inventions Assignment Agreement'),
          normal('OpenAgreements Employment Terms v1.0', { run: { color: ACCENT, bold: true } }),
          note('Cover Terms: Fill in the selected values below. These Cover Terms support interpretation of Standard Terms.'),
          coverTable(coverRows),
          new Paragraph({ children: [new PageBreak()] }),
          subhead('Standard Terms'),
          ...clause(
            '1',
            'Assignment of Inventions',
            'Employee assigns and agrees to assign to Company all right, title, and interest in inventions, software, works of authorship, discoveries, designs, data models, and related intellectual property created during employment that arise from Company work, use Company resources, or relate to Company actual or anticipated business, to the extent permitted by law.'
          ),
          ...clause(
            '2',
            'Work Made for Hire and Further Assurances',
            'To the extent legally permitted, copyrightable works prepared within the scope of employment are works made for hire for Company. If any rights do not automatically vest in Company, Employee assigns those rights and will sign additional documents reasonably requested to confirm ownership and record assignments.'
          ),
          ...clause(
            '3',
            'Disclosure and Documentation',
            'Employee will promptly disclose covered inventions and maintain reasonably complete records needed to document conception, authorship, development, and transfer of rights for Company business, consistent with lawful policy and confidentiality obligations.'
          ),
          ...clause(
            '4',
            'Prior and Excluded Inventions',
            'Inventions identified in Cover Terms as prior or excluded remain carved out only to the extent permitted by applicable law. Employee represents that the prior inventions disclosure in Cover Terms is complete to Employee knowledge as of the Effective Date.'
          ),
          ...clause(
            '5',
            'Confidential Information and Trade Secrets',
            'Employee will use and protect confidential information solely for authorized Company purposes, will not misuse or disclose confidential information except as permitted by Company policy or law, and will follow the confidential information definition set out in Cover Terms.'
          ),
          ...clause(
            '6',
            'No Conflicting Obligations',
            'Employee represents that performing duties for Company does not knowingly conflict with binding obligations to another person or entity. Employee will not bring third-party confidential information into Company systems or use it in Company work without written authorization.'
          ),
          ...clause(
            '7',
            'Records, Cooperation, and Post-Termination Assistance',
            'Employee will provide the post-termination assistance listed in Cover Terms, including reasonable cooperation with filings, declarations, and assignments needed to confirm or protect Company rights in covered inventions, subject to reimbursement of reasonable out-of-pocket expenses when required by policy.'
          ),
          ...clause(
            '8',
            'Return and Deletion of Materials',
            'Employee will return, and where permitted delete, Company materials within the timing listed in Cover Terms, including devices, documents, credentials, and confidential files, except for records Employee is required to retain by law.'
          ),
          ...clause(
            '9',
            'Survival and Limited Scope',
            'Sections addressing assignment, confidentiality, return of materials, and assistance survive termination to the extent needed to enforce rights that arose during employment. This agreement does not transfer ownership of inventions that applicable law requires to remain with Employee.'
          ),
          ...clause(
            '10',
            'Governing Law and Venue',
            'This agreement is governed by the law listed in Cover Terms, and disputes will be resolved in the venue listed in Cover Terms, subject to non-waivable rights under applicable law.'
          ),
          ...ipSignatureBlock(),
        ],
      },
    ],
  });
}

function confidentialityAckDoc() {
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

  return new Document({
    sections: [
      {
        children: [
          title('Employment Confidentiality Acknowledgement'),
          normal('OpenAgreements Employment Terms v1.0', { run: { color: ACCENT, bold: true } }),
          note('Cover Terms: Fill in the selected values below. These Cover Terms are part of this acknowledgement.'),
          coverTable(coverRows),
          new Paragraph({ children: [new PageBreak()] }),
          subhead('Standard Terms'),
          ...clause('1', 'Confidential Information Handling', 'Employee will use confidential information only for authorized business purposes and within the data access scope listed in Cover Terms.'),
          ...clause('2', 'Approved Tools and Systems', 'Employee will access Company data only through approved tools and systems listed in Cover Terms unless written authorization is provided.'),
          ...clause('3', 'Security Incident Reporting', 'Employee will promptly report suspected incidents to the security reporting contact listed in Cover Terms.'),
          ...clause('4', 'Post-Employment Obligations', 'After employment ends, Employee will continue obligations listed in Cover Terms and as required by law.'),
          ...clause('5', 'Policy Updates', 'Company may update policies from time to time. Employee remains responsible for complying with current written policies communicated by Company.'),
          ...signatureBlock([
            { label: 'Employee Signatory', value: '{signatory_name}' },
            { label: 'Acknowledgement Date', value: '{acknowledgement_date}' },
          ]),
        ],
      },
    ],
  });
}

async function writeDoc(doc, path) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(resolve(path), buf);
}

await writeDoc(offerLetterDoc(), 'templates/openagreements-employment-offer-letter/template.docx');
await writeDoc(ipAssignmentDoc(), 'templates/openagreements-employee-ip-inventions-assignment/template.docx');
await writeDoc(confidentialityAckDoc(), 'templates/openagreements-employment-confidentiality-acknowledgement/template.docx');

console.log('Regenerated employment templates.');
