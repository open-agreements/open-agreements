---
template_id: openagreements-board-consent-safe
layout_id: cover-standard-signature-v1
style_id: openagreements-default-v1
outputs:
  docx: content/templates/openagreements-board-consent-safe/template.docx
document:
  title: Board Consent for SAFE Financing
  label: OpenAgreements Board Consent for SAFE Financing
  version: "1.1"
  license: Free to use under CC BY 4.0
  defined_term_highlight_mode: none
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

# Board Consent for SAFE Financing

## Cover Terms

The key business terms of this board consent are as follows.

| Kind | Label | Value | Show When |
| --- | --- | --- | --- |
| row | Company | {company_name} | always |
| row | Effective Date | {effective_date} | always |
| row | Aggregate SAFE Purchase Amount | ${purchase_amount} | always |
| row | Governing Law | Delaware | always |

## Standard Terms

<!-- oa:clause id=board-action-under-delaware-law -->
### Board Action Under Delaware Law

All members of the Board of Directors of Company adopt this action by unanimous written consent pursuant to Section 141(f) of the Delaware General Corporation Law.

<!-- oa:clause id=approval-of-safe-financing -->
### Approval of SAFE Financing

Board has determined that it is in the best interests of Company to enter into one or more Simple Agreements for Future Equity, or SAFEs, for the aggregate purchase amount listed in Cover Terms, and each SAFE in substantially the form presented to Board is approved.

<!-- oa:clause id=officer-authority -->
### Officer Authority

Each officer of Company is authorized and directed, for and on behalf of Company, to execute and deliver each SAFE and any related agreements, certificates, notices, or other documents required or contemplated by any SAFE or otherwise necessary or appropriate in connection with the SAFE financing.

<!-- oa:clause id=negotiated-changes -->
### Negotiated Changes

Each officer of Company is further authorized to negotiate and approve additions, modifications, amendments, or deletions to any SAFE or related document, and execution and delivery by that officer will be conclusive evidence of that approval.

<!-- oa:clause id=reservation-and-issuance-of-shares -->
### Reservation and Issuance of Shares

Shares of Company capital stock issuable upon conversion of each SAFE are reserved for issuance, and when issued in accordance with the applicable SAFE, those shares will be duly and validly issued, fully paid, and nonassessable.

<!-- oa:clause id=securities-law-compliance -->
### Securities Law Compliance

The SAFE financing is approved to be offered and sold in reliance on applicable exemptions from registration under the Securities Act of 1933, as amended, and applicable state securities laws. Each officer of Company is authorized to execute and file any forms, certificates, notices, or other documents that are necessary or appropriate in connection with that compliance.

<!-- oa:clause id=further-actions -->
### Further Actions

Each officer of Company is authorized and directed to take any further actions and execute any additional documents necessary or appropriate to implement these approvals.

## Signatures

<!-- oa:signature-mode arrangement=stacked repeat=board_members item=member -->

This Action by Written Consent shall be filed with the minutes of the proceedings of the Board of Directors of Company.

By signing below, each director adopts this board consent as of the effective date listed in Cover Terms. Any copy, facsimile, PDF, or other reliable reproduction of this board consent may be substituted or used in lieu of the original writing for any purpose for which the original writing could be used, provided that the reproduction is a complete reproduction of the entire original writing.

<!-- oa:signer id=director kind=individual capacity=personal label="Director" -->
**Director**

Signature: _______________
Print Name: {member.name}
Date: {effective_date}
