---
template_id: openagreements-employment-offer-letter
layout_id: cover-standard-signature-v1
style_id: openagreements-default-v1
outputs:
  docx: content/templates/openagreements-employment-offer-letter/template.docx
document:
  title: Employment Offer Letter
  label: OpenAgreements Employment Offer Letter
  version: "1.1"
  license: Free to use under CC BY 4.0
  include_cloud_doc_line: true
  cover_row_height: 700
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

# Employment Offer Letter

## Cover Terms

The key business terms of this Employment Offer Letter are as follows.

| Kind | Label | Value | Show When |
| --- | --- | --- | --- |
| row | Employer | {employer_name} | always |
| row | Employee | {employee_name} | always |
| row | Position Title | {position_title} | always |
| row | Employment Type | {employment_type} | always |
| row | Start Date | {start_date} | always |
| row | Reporting Manager | {reporting_manager} | always |
| row | Base Salary | {base_salary} | always |
| row | Bonus Terms | {bonus_terms} | bonus_terms |
| row | Equity Terms | {equity_terms} | equity_terms |
| row | Primary Work Location | {work_location} | always |
| row | Governing Law | {governing_law} | always |
| row | Offer Expiration Date | {offer_expiration_date} | always |

## Standard Terms

<!-- oa:clause id=position-scope-and-reporting -->
### Position, Scope, and Reporting

If Employee accepts this offer, Employee will join Company in the position listed in Cover Terms and will report to the manager or function listed in Cover Terms, with duties and responsibilities that are reasonably aligned to the role and business needs.

<!-- oa:clause id=employment-type-and-work-schedule -->
### Employment Type and Work Schedule

Employee will be employed on the employment basis listed in Cover Terms. Company may establish reasonable scheduling, attendance, and collaboration expectations for the role, including core hours and team coordination standards.

<!-- oa:clause id=start-date-and-onboarding-conditions -->
### Start Date and Onboarding Conditions

Employment is expected to begin on the start date listed in Cover Terms, subject to completion of onboarding requirements such as identity and work authorization verification, policy acknowledgements, and execution of confidentiality and inventions assignment documents.

<!-- oa:clause id=base-compensation-and-payroll -->
### Base Compensation and Payroll

Company will pay the base salary or hourly compensation listed in Cover Terms in accordance with Company payroll practices and applicable law, subject to required withholdings, deductions, and payroll tax obligations.

<!-- oa:clause id=bonus-opportunity -->
### Bonus Opportunity

If bonus terms are listed in Cover Terms, those terms describe potential bonus eligibility. Bonus programs, metrics, and payout timing are administered under applicable Company plans and may depend on individual, team, and Company performance criteria.

<!-- oa:clause id=equity-opportunity -->
### Equity Opportunity

If equity terms are listed in Cover Terms, any grant remains subject to board or committee approval, applicable equity plan documents, and separate award documentation. Vesting, exercise, and expiration terms are governed by those plan and award documents.

<!-- oa:clause id=benefits-and-time-off-programs -->
### Benefits and Time-Off Programs

Employee may be eligible to participate in benefit and paid-time-off programs made available to similarly situated employees, in each case subject to plan terms, enrollment requirements, and Company policy updates permitted by law.

<!-- oa:clause id=work-location-and-business-travel -->
### Work Location and Business Travel

Employee will primarily work from the location listed in Cover Terms. Company may require reasonable business travel and may update workplace expectations, including on-site or remote collaboration requirements, consistent with applicable law.

<!-- oa:clause id=policies-confidentiality-and-company-property -->
### Policies, Confidentiality, and Company Property

As a condition of employment, Employee must comply with Company written policies, security requirements, confidentiality obligations, and lawful workplace rules, including policies covering information handling, code and device access, and return of Company property.

<!-- oa:clause id=at-will-employment-relationship -->
### At-Will Employment Relationship

Unless otherwise required by law or a separate written agreement signed by an authorized Company representative, employment is at-will. This means either Employee or Company may end employment at any time, with or without advance notice, and with or without cause.

<!-- oa:clause id=governing-law -->
### Governing Law

This offer letter and any dispute regarding its interpretation are governed by the law listed in Cover Terms, without applying conflicts-of-law principles to the extent not required by applicable law.

<!-- oa:clause id=offer-expiration-acceptance-and-entire-offer -->
### Offer Expiration, Acceptance, and Entire Offer

This offer expires on the date listed in Cover Terms unless extended in writing by Company. By accepting, Employee acknowledges this letter summarizes key employment terms and that any changes must be set out in a later written document authorized by Company.

## Signatures

<!-- oa:signature-mode arrangement=entity-plus-individual -->

By signing this Employment Offer Letter, each party agrees to these Cover Terms and Standard Terms.

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
