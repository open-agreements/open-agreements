---
template_id: openagreements-restrictive-covenant-wyoming
layout_id: cover-standard-signature-v1
style_id: openagreements-default-v1
outputs:
  docx: content/templates/openagreements-restrictive-covenant-wyoming/template.docx
document:
  title: Employee Restrictive Covenant Agreement
  label: OpenAgreements Employee Restrictive Covenant (Wyoming)
  version: "2.0"
  license: Free to use under CC BY 4.0
  include_cloud_doc_line: true
  defined_term_highlight_mode: definition_site_only
  cover_row_height: 317
sections:
  cover_terms:
    section_label: Cover Terms
    heading_title: Cover Terms
  standard_terms:
    section_label: Standard Terms
    heading_title: Standard Terms
  signature:
    section_label: Signature Page
    heading_title: Signatures
---

# Employee Restrictive Covenant Agreement

## Cover Terms

The terms below are incorporated into and form part of this agreement.

| Kind | Label | Value | Show When |
| --- | --- | --- | --- |
| row | Employer | {employer_name} | always |
| row | Employee | {employee_name} | always |
| row | Employee Title / Position | {employee_title} | employee_title |
| row | Effective Date | {effective_date} | always |
| row | Governing Law | {governing_law} | always |
| group | Confidentiality |  | always |
| subrow | Trade Secrets Duration | {confidentiality_trade_secret_duration} | always |
| subrow | Other Confidential Information Duration | {confidentiality_other_duration} | always |
| group | Employee Non-Solicitation |  | employee_nonsolicit_included |
| subrow | Duration | {employee_nonsolicit_duration} | employee_nonsolicit_included |
| group | Customer Non-Solicitation |  | customer_nonsolicit_included |
| subrow | Duration | {customer_nonsolicit_duration} | customer_nonsolicit_included |
| group | Non-Competition |  | noncompete_included |
| subrow | Duration | {noncompete_duration} | noncompete_included |
| subrow | Restricted Territory | {territory} | noncompete_included |
| subrow | Competitive Business | {competitive_business_definition} | noncompete_included |
| subrow | Specified Competitors | {specified_competitors} | noncompete_included |
| group | No Business with Covered Customers |  | nondealing_included |
| subrow | Duration | {nondealing_duration} | nondealing_included |
| group | Non-Investment |  | noninvestment_included |
| subrow | Duration | {noninvestment_duration} | noninvestment_included |
| group | Non-Disparagement |  | always |
| subrow | Duration | {nondisparagement_duration} | always |

## Standard Terms

<!-- oa:clause id=defined-terms type=definitions -->
### Defined Terms

[[Competitive Business]] means the business activities described in Cover Terms under Competitive Business.

[[Confidential Information]] means non-public information relating to Employer's business, including trade secrets, customer lists, pricing, business processes, technical data, and strategic plans, but excluding information that becomes public through no fault of Employee.

[[Covered Customers]] means customers, vendors, referral sources, and business partners with whom Employee had material contact or for whom Employee had responsibility during the {covered_customer_period} before termination of employment.

[[Covered Employees]] means employees with whom Employee worked or whom Employee managed during the {covered_employee_period} before termination of employment.

[[Passive Public Holdings]] means ownership of securities of a publicly traded company representing less than {passive_public_holdings_threshold} of any class of such company’s securities, and interests in diversified mutual funds, index funds, and exchange-traded funds that may hold securities of a Competitive Business.

[[Protected Interests]] means Employer's legitimate business interests in its Confidential Information, customer and business-partner relationships, workforce stability, and goodwill.

[[Restricted Period]] means the duration specified in Cover Terms for each covenant, beginning on the date Employee's employment with Employer ends for any reason.

[[Restricted Territory]] means the geographic area described in Cover Terms under Restricted Territory.

[[Solicit]] means to directly or indirectly contact, approach, induce, encourage, or provide Confidential Information to any person or entity for the purpose of diverting business away from Employer, but does not include responding to general advertisements or unsolicited inquiries not initiated by Employee.

[[Trade Secrets]] has the meaning given in Wyo. Stat. § 6-3-501(a)(xi).

<!-- oa:clause id=timing-and-employee-acknowledgements -->
### Timing and Employee Acknowledgements

Employee acknowledges that the restrictions in this agreement are reasonable and necessary to protect Employer's Protected Interests. Employee acknowledges having had the opportunity to consult with independent legal counsel before signing this agreement. This agreement is effective as of the Effective Date listed in Cover Terms.

<!-- oa:clause id=confidential-information-and-trade-secret-protection -->
### Confidential Information and Trade Secret Protection

Employee must treat all Confidential Information as strictly confidential. Employee must not use or disclose Confidential Information except as required to perform authorized job duties or with Employer's prior written consent. Employee's obligations regarding trade secrets continue in perpetuity. Employee's obligations regarding other Confidential Information continue for the period specified in Cover Terms. Trade secrets are protected under Wyoming law, including Wyo. Stat. § 6-3-501(a)(xi).

<!-- oa:clause id=permitted-disclosures-and-protected-conduct -->
### Permitted Disclosures and Protected Conduct

Nothing in this agreement prohibits Employee from: (a) reporting possible violations of law to any government agency, including the Securities and Exchange Commission, the Equal Employment Opportunity Commission, the Occupational Safety and Health Administration, or any other federal, state, or local agency; (b) making disclosures protected under whistleblower provisions of any law; (c) discussing wages, hours, or other terms and conditions of employment as protected by applicable law; (d) testifying truthfully in legal proceedings; or (e) filing a sealed complaint in court using Confidential Information without liability. Pursuant to the Defend Trade Secrets Act (18 U.S.C. § 1833(b)), Employee may not be held criminally or civilly liable for disclosing a trade secret in confidence to a government official or attorney solely for the purpose of reporting or investigating a suspected violation of law, or in a sealed court filing.

<!-- oa:clause id=return-deletion-and-certification-of-company-property -->
### Return, Deletion, and Certification of Company Property

Upon termination of employment, Employee must promptly return to Employer all documents, devices, files, credentials, and other materials containing or relating to Confidential Information. Where permitted, Employee must permanently delete electronic copies of Confidential Information from personal devices and accounts. Employee must certify compliance with this section in writing upon Employer's request.

<!-- oa:clause id=non-solicitation-of-employees when=employee_nonsolicit_included omitted="[Intentionally Omitted.]" -->
### Non-Solicitation of Employees

During the Restricted Period, Employee must not Solicit, recruit, hire, or attempt to hire any Covered Employee. This restriction does not prohibit Employee from providing a professional reference upon request or from hiring a person who responds to a general advertisement not directed specifically at Employer's employees.

<!-- oa:clause id=non-solicitation-of-customers-vendors-referral-sources-and-business-partners when=customer_nonsolicit_included omitted="[Intentionally Omitted.]" -->
### Non-Solicitation of Customers, Vendors, Referral Sources, and Business Partners

During the Restricted Period, Employee must not Solicit the business of any Covered Customer. Practitioner sources flag uncertainty about whether Wyo. Stat. § 1-23-108 could reach certain non-solicitation provisions depending on how they function.

<!-- oa:clause id=no-business-with-covered-customers when=nondealing_included omitted="[Intentionally Omitted.]" -->
### No Business with Covered Customers

During the Restricted Period, Employee must not accept, service, or do business with any Covered Customer, regardless of whether Employee or the Covered Customer first initiated contact. This restriction is broader than non-solicitation because it applies even if the Covered Customer approaches Employee. If the Cover Terms indicate that this restriction applies, it requires a lawful restriction pathway under Wyo. Stat. § 1-23-108.

<!-- oa:clause id=non-competition when=noncompete_included omitted="[Intentionally Omitted.]" -->
### Non-Competition

During the Restricted Period, Employee must not engage in, be employed by, consult for, or have an active ownership interest in any Competitive Business within the Restricted Territory. This covenant is included only because the restriction pathway specified by Employer supports its enforceability under Wyo. Stat. § 1-23-108. Passive Public Holdings are permitted.

<!-- oa:clause id=non-investment when=noninvestment_included omitted="[Intentionally Omitted.]" -->
### Non-Investment

During the Restricted Period, Employee must not acquire or hold any active ownership interest in, serve as a director, officer, manager, or advisor to, or have material economic participation in any Competitive Business. This restriction primarily targets active or material ownership in private competitors. Passive Public Holdings are permitted. This covenant requires a lawful restriction pathway under Wyo. Stat. § 1-23-108.

<!-- oa:clause id=non-disparagement -->
### Non-Disparagement

During the Restricted Period specified in Cover Terms for Non-Disparagement, Employee must not make statements that are intended to or reasonably likely to disparage Employer, its officers, directors, employees, products, or services. This section does not restrict Employee from making truthful statements in legal proceedings, providing truthful testimony, making disclosures to government agencies, or exercising rights protected by law.

<!-- oa:clause id=physician-specific-rights-and-notices -->
### Physician-Specific Rights and Notices

If Employee is a physician, then notwithstanding any other provision of this agreement, Wyo. Stat. § 1-23-108(b) preserves other enforceable provisions of this agreement even if a non-compete provision is void. A physician Employee with patients diagnosed with rare disorders (as defined by the National Organization for Rare Disorders) may notify those patients of their new practice location without liability under this agreement.

<!-- oa:clause id=no-conflicting-obligations -->
### No Conflicting Obligations

Employee represents that performing duties for Employer and complying with this agreement does not conflict with any prior agreement, court order, or legal obligation binding on Employee. Employee must promptly disclose to Employer any potential conflict that arises during employment.

<!-- oa:clause id=notice-to-future-employers-and-other-third-parties -->
### Notice to Future Employers and Other Third Parties

Employer may disclose the existence and terms of this agreement to any prospective employer or business associate of Employee if Employer has a reasonable belief that Employee may breach this agreement. Employee consents to this disclosure.

<!-- oa:clause id=tolling-during-breach -->
### Tolling During Breach

If Employee breaches any restrictive covenant in this agreement, the Restricted Period for that covenant is extended by one day for each day of the breach, so that the full duration of the restriction runs from the date the breach ends.

<!-- oa:clause id=remedies -->
### Remedies

Employee acknowledges that a breach of this agreement may cause Employer irreparable harm for which money damages would be inadequate. Employer may seek injunctive or other equitable relief in addition to any other remedies available at law. If Employer prevails in any action to enforce this agreement, Employee must reimburse Employer's reasonable attorney's fees and costs. Employer does not ask any court to modify, reform, or rewrite any provision of this agreement.

<!-- oa:clause id=enforceability-severability-and-no-reformation-request -->
### Enforceability, Severability, and No Reformation Request

If any provision of this agreement is found to be unenforceable, the remaining provisions remain in full force and effect. Consistent with Hassler v. Circle C Resources, 2022 WY 28, Employer acknowledges that Wyoming courts may decline to reform overbroad restrictive covenants and may instead void them entirely. Accordingly, this agreement does not include a reformation clause and does not request that any court rewrite its terms. Each restrictive covenant in this agreement is intended to be independently enforceable.

<!-- oa:clause id=survival-and-expiration-of-each-covenant -->
### Survival and Expiration of Each Covenant

Each restrictive covenant in this agreement survives the termination of Employee's employment for the Restricted Period specified in Cover Terms. Obligations under the Confidential Information and Trade Secret Protection section survive indefinitely to the extent they relate to trade secrets. All other provisions survive to the extent necessary to enforce rights that arose during employment.

<!-- oa:clause id=assignment-and-successors -->
### Assignment and Successors

Employee may not assign this agreement or any rights or obligations under it. Employer may assign this agreement to any affiliate, successor, or acquirer of all or substantially all of Employer's business or assets. This agreement is binding on and inures to the benefit of the parties and their respective heirs, successors, and permitted assigns.

<!-- oa:clause id=governing-law-venue-and-dispute-process -->
### Governing Law, Venue, and Dispute Process

This agreement is governed by the law listed in Cover Terms, including Wyo. Stat. § 1-23-108 for contracts entered into on or after July 1, 2025. Disputes will be resolved in the courts of the Governing Law state, subject to non-waivable rights under applicable law.

<!-- oa:clause id=entire-agreement-amendment-waiver-and-electronic-signatures -->
### Entire Agreement, Amendment, Waiver, and Electronic Signatures

This agreement constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior agreements, understandings, and negotiations on this subject. This agreement may be amended only in writing signed by both parties. A party's failure to enforce any provision does not waive that party's right to enforce it later. This agreement may be executed in counterparts, including by electronic signature, each of which is an original.

## Signatures

<!-- oa:signature-mode arrangement=entity-plus-individual -->

By signing this agreement, each party acknowledges and agrees to the restrictive covenant obligations above. Employee confirms having read and understood each provision, including the Cover Terms.

<!-- oa:signer id=employer kind=entity capacity=through_representative label="Employer" -->
**Employer**

Signature: _______________
Print Name: {employer_name}
Title: _______________
Date: _______________

<!-- oa:signer id=employee kind=individual capacity=personal label="Employee" -->
**Employee**

Signature: _______________
Print Name: {employee_name}
Date: _______________
