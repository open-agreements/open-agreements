/**
 * Generate template DOCX files with {tag} placeholders.
 * These are source templates that docx-templates will fill.
 *
 * Run: node scripts/generate-template-docx.mjs
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '..', 'templates');

function bold(text) {
  return new TextRun({ text, bold: true });
}

function normal(text) {
  return new TextRun({ text });
}

function tag(name) {
  // docx-templates uses {CMD} syntax — we use cmdDelimiter: ['{', '}']
  // So the literal text in the DOCX should be: {tagname}
  // But docx-templates treats {X} as a command — for simple variable insertion
  // the tag must be the variable name directly between delimiters.
  return new TextRun({ text: `{${name}}` });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level });
}

function para(...runs) {
  return new Paragraph({ children: runs });
}

function spacer() {
  return new Paragraph({ text: '' });
}

// ─── Common Paper Mutual NDA ──────────────────────────────────────

async function generateCommonPaperNDA() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('Mutual Non-Disclosure Agreement'),
        heading('Common Paper MNDA Standard Terms Version 2.0', HeadingLevel.HEADING_2),
        spacer(),
        heading('Cover Page', HeadingLevel.HEADING_2),
        spacer(),
        para(bold('Party 1: '), tag('party_1_name')),
        para(bold('Party 1 Notice Email: '), tag('party_1_email')),
        spacer(),
        para(bold('Party 2: '), tag('party_2_name')),
        para(bold('Party 2 Notice Email: '), tag('party_2_email')),
        spacer(),
        para(bold('Effective Date: '), tag('effective_date')),
        para(bold('Purpose: '), tag('purpose')),
        para(bold('MNDA Term: '), tag('mnda_term')),
        para(bold('Term of Confidentiality: '), tag('confidentiality_term')),
        para(bold('Governing Law: '), tag('governing_law')),
        para(bold('Jurisdiction: '), tag('jurisdiction')),
        spacer(),
        heading('Standard Terms', HeadingLevel.HEADING_2),
        spacer(),
        heading('1. Purpose', HeadingLevel.HEADING_3),
        para(
          normal('The parties wish to explore a potential business relationship (the "'),
          bold('Purpose'),
          normal('"). In connection with the Purpose, each party (a "'),
          bold('Discloser'),
          normal('") may disclose certain confidential and proprietary information to the other party (a "'),
          bold('Receiver'),
          normal('"). This Agreement governs the use and protection of that information.')
        ),
        spacer(),
        heading('2. Confidential Information', HeadingLevel.HEADING_3),
        para(
          normal('"'),
          bold('Confidential Information'),
          normal('" means any information disclosed by the Discloser to the Receiver, directly or indirectly, in writing, orally, or by inspection of tangible objects, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.')
        ),
        spacer(),
        heading('3. Obligations', HeadingLevel.HEADING_3),
        para(
          normal('The Receiver shall: (a) use the Confidential Information solely for the Purpose; (b) not disclose Confidential Information to any third party except to its employees, agents, or contractors who need to know such information and are bound by obligations of confidentiality at least as protective as those herein; and (c) protect the confidentiality of the Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.')
        ),
        spacer(),
        heading('4. Exclusions', HeadingLevel.HEADING_3),
        para(
          normal('Confidential Information does not include information that: (a) is or becomes publicly known through no fault of the Receiver; (b) was known to the Receiver prior to disclosure; (c) is independently developed by the Receiver without use of the Confidential Information; or (d) is rightfully received from a third party without restriction on disclosure.')
        ),
        spacer(),
        heading('5. Term and Termination', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement will remain in effect for the MNDA Term specified on the Cover Page. Either party may terminate this Agreement with 30 days prior written notice. The obligations regarding Confidential Information will survive for the Term of Confidentiality specified on the Cover Page following any termination or expiration.')
        ),
        spacer(),
        heading('6. Return of Materials', HeadingLevel.HEADING_3),
        para(
          normal('Upon termination or upon the Discloser\'s written request, the Receiver shall promptly return or destroy all copies of the Confidential Information in its possession.')
        ),
        spacer(),
        heading('7. No License', HeadingLevel.HEADING_3),
        para(
          normal('Nothing in this Agreement grants either party any right, title, or interest in the other party\'s Confidential Information, except as expressly set forth herein.')
        ),
        spacer(),
        heading('8. Governing Law', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement shall be governed by the laws of the State of '),
          tag('governing_law'),
          normal(', without regard to conflicts of law principles. Any disputes arising under this Agreement shall be resolved in the '),
          tag('jurisdiction'),
          normal('.')
        ),
        spacer(),
        heading('9. Entire Agreement', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, understandings, and communications.')
        ),
        spacer(),
        para(
          normal('Based on the Common Paper Mutual NDA (https://commonpaper.com). Licensed under CC BY 4.0.')
        ),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(templatesDir, 'common-paper-mutual-nda', 'template.docx'), buffer);
  console.log('Generated: common-paper-mutual-nda/template.docx');
}

// ─── Bonterms Mutual NDA ──────────────────────────────────────

async function generateBontermsNDA() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('Mutual Non-Disclosure Agreement'),
        heading('Bonterms Mutual NDA Version 1.0', HeadingLevel.HEADING_2),
        spacer(),
        heading('Cover Page', HeadingLevel.HEADING_2),
        spacer(),
        para(bold('Party 1: '), tag('party_1_name')),
        para(bold('Party 1 Notice Email: '), tag('party_1_email')),
        spacer(),
        para(bold('Party 2: '), tag('party_2_name')),
        para(bold('Party 2 Notice Email: '), tag('party_2_email')),
        spacer(),
        para(bold('Effective Date: '), tag('effective_date')),
        para(bold('Purpose: '), tag('purpose')),
        para(bold('NDA Term: '), tag('nda_term')),
        para(bold('Confidentiality Period: '), tag('confidentiality_period')),
        para(bold('Governing Law: '), tag('governing_law')),
        para(bold('Courts: '), tag('courts')),
        spacer(),
        heading('Standard Terms', HeadingLevel.HEADING_2),
        spacer(),
        heading('1. Definitions', HeadingLevel.HEADING_3),
        para(
          normal('"'),
          bold('Confidential Information'),
          normal('" means non-public information disclosed by a party ("'),
          bold('Discloser'),
          normal('") to the other party ("'),
          bold('Recipient'),
          normal('"), directly or indirectly, that is identified as confidential or that reasonably should be considered confidential given the nature of the information and the circumstances of disclosure.')
        ),
        spacer(),
        heading('2. Obligations', HeadingLevel.HEADING_3),
        para(
          normal('The Recipient shall: (a) use the Confidential Information solely for the Purpose stated on the Cover Page; (b) restrict disclosure of Confidential Information to its employees, agents, and contractors who have a need to know and who are bound by written confidentiality obligations no less protective than this Agreement; and (c) protect the confidentiality of the Confidential Information using at least the same degree of care it uses to protect its own confidential information, but not less than reasonable care.')
        ),
        spacer(),
        heading('3. Exclusions', HeadingLevel.HEADING_3),
        para(
          normal('Confidential Information does not include information that: (a) is or becomes publicly available without breach of this Agreement; (b) the Recipient knew before receiving it from the Discloser; (c) the Recipient receives from a third party who had a right to disclose it; or (d) the Recipient independently develops without use of or reference to the Confidential Information.')
        ),
        spacer(),
        heading('4. Compelled Disclosure', HeadingLevel.HEADING_3),
        para(
          normal('If the Recipient is compelled by law to disclose Confidential Information, it shall give the Discloser prior written notice (to the extent legally permitted) and shall cooperate with the Discloser in seeking a protective order.')
        ),
        spacer(),
        heading('5. Term and Survival', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement begins on the Effective Date and continues for the NDA Term. Either party may terminate by providing 30 days written notice. The confidentiality obligations will survive for the Confidentiality Period after any termination or expiration.')
        ),
        spacer(),
        heading('6. Return and Destruction', HeadingLevel.HEADING_3),
        para(
          normal('Upon the Discloser\'s written request or upon termination, the Recipient shall promptly return or destroy all Confidential Information and certify such return or destruction in writing.')
        ),
        spacer(),
        heading('7. No Rights Granted', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement does not grant either party any license, ownership, or other right to the other party\'s Confidential Information, intellectual property, or technology.')
        ),
        spacer(),
        heading('8. Governing Law and Jurisdiction', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement is governed by the laws of '),
          tag('governing_law'),
          normal('. Each party submits to the exclusive jurisdiction of the '),
          tag('courts'),
          normal('.')
        ),
        spacer(),
        heading('9. General', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement is the entire agreement between the parties on this subject and supersedes all prior discussions and agreements. This Agreement may only be amended in writing signed by both parties.')
        ),
        spacer(),
        para(
          normal('Based on the Bonterms Mutual NDA (https://bonterms.com). Licensed under CC BY 4.0.')
        ),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(templatesDir, 'bonterms-mutual-nda', 'template.docx'), buffer);
  console.log('Generated: bonterms-mutual-nda/template.docx');
}

// ─── Common Paper Cloud Service Agreement ──────────────────────────

async function generateCommonPaperCSA() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        heading('Cloud Service Agreement'),
        heading('Common Paper CSA Standard Terms Version 2.0', HeadingLevel.HEADING_2),
        spacer(),
        heading('Cover Page', HeadingLevel.HEADING_2),
        spacer(),
        para(bold('Provider: '), tag('provider_name')),
        para(bold('Provider Notice Email: '), tag('provider_email')),
        spacer(),
        para(bold('Customer: '), tag('customer_name')),
        para(bold('Customer Notice Email: '), tag('customer_email')),
        spacer(),
        para(bold('Effective Date: '), tag('effective_date')),
        para(bold('Service Description: '), tag('service_description')),
        para(bold('Subscription Term: '), tag('subscription_term')),
        para(bold('Renewal Term: '), tag('renewal_term')),
        para(bold('Fees: '), tag('fees')),
        para(bold('Payment Period: '), tag('payment_period')),
        para(bold('Governing Law: '), tag('governing_law')),
        para(bold('Jurisdiction: '), tag('jurisdiction')),
        para(bold('Provider Liability Cap: '), tag('provider_liability_cap')),
        spacer(),
        heading('Standard Terms', HeadingLevel.HEADING_2),
        spacer(),
        heading('1. Service Access', HeadingLevel.HEADING_3),
        para(
          normal('During the Subscription Term, Provider grants Customer a non-exclusive, non-transferable right to access and use the Service as described on the Cover Page, subject to the terms of this Agreement.')
        ),
        spacer(),
        heading('2. Customer Obligations', HeadingLevel.HEADING_3),
        para(
          normal('Customer shall: (a) use the Service only in accordance with this Agreement and applicable law; (b) be responsible for all activities conducted under its accounts; and (c) not reverse engineer, decompile, or attempt to extract the source code of the Service.')
        ),
        spacer(),
        heading('3. Fees and Payment', HeadingLevel.HEADING_3),
        para(
          normal('Customer shall pay the Fees specified on the Cover Page according to the Payment Period. All fees are non-refundable except as expressly set forth herein. Provider may increase fees upon renewal with at least 30 days written notice.')
        ),
        spacer(),
        heading('4. Confidentiality', HeadingLevel.HEADING_3),
        para(
          normal('Each party agrees to protect the other\'s Confidential Information using the same degree of care it uses to protect its own confidential information, but not less than reasonable care. Confidential Information may only be disclosed to employees and contractors with a need to know who are bound by confidentiality obligations.')
        ),
        spacer(),
        heading('5. Data Protection', HeadingLevel.HEADING_3),
        para(
          normal('Provider shall implement and maintain appropriate technical and organizational security measures to protect Customer Data. Customer Data remains the property of Customer. Provider shall not access Customer Data except as necessary to provide the Service or as required by law.')
        ),
        spacer(),
        heading('6. Warranties', HeadingLevel.HEADING_3),
        para(
          normal('Provider warrants that the Service will perform materially in accordance with its documentation during the Subscription Term. Provider does not warrant that the Service will be uninterrupted or error-free. THE FOREGOING WARRANTIES ARE EXCLUSIVE AND IN LIEU OF ALL OTHER WARRANTIES, EXPRESS OR IMPLIED.')
        ),
        spacer(),
        heading('7. Limitation of Liability', HeadingLevel.HEADING_3),
        para(
          normal('NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. PROVIDER\'S TOTAL LIABILITY SHALL NOT EXCEED THE '),
          tag('provider_liability_cap'),
          normal('.')
        ),
        spacer(),
        heading('8. Term and Termination', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement begins on the Effective Date and continues for the Subscription Term. It will automatically renew for successive Renewal Terms unless either party provides written notice of non-renewal at least 30 days before the end of the then-current term. Either party may terminate for material breach with 30 days written notice if the breach is not cured.')
        ),
        spacer(),
        heading('9. Governing Law', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement shall be governed by the laws of the State of '),
          tag('governing_law'),
          normal('. Any disputes shall be resolved in the '),
          tag('jurisdiction'),
          normal('.')
        ),
        spacer(),
        heading('10. General Provisions', HeadingLevel.HEADING_3),
        para(
          normal('This Agreement, together with any Order Forms, constitutes the entire agreement between the parties regarding its subject matter. Neither party may assign this Agreement without the other party\'s prior written consent.')
        ),
        spacer(),
        para(
          normal('Based on the Common Paper Cloud Service Agreement (https://commonpaper.com). Licensed under CC BY 4.0.')
        ),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(join(templatesDir, 'common-paper-cloud-service-agreement', 'template.docx'), buffer);
  console.log('Generated: common-paper-cloud-service-agreement/template.docx');
}

// Run all generators
await generateCommonPaperNDA();
await generateBontermsNDA();
await generateCommonPaperCSA();
console.log('\nAll template DOCX files generated.');
