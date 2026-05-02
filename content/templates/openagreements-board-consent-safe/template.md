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
    section_label: Board Consent (Approving SAFE) | Delaware
    heading_title: Cover Terms
  standard_terms:
    section_label: Resolutions
    heading_title: Resolutions
  signature:
    section_label: Signature Page
    heading_title: Signatures
---

# Board Consent for SAFE Financing

## Cover Terms

The key terms reflected on this cover page are as follows. This action by written consent of the Board (this "Board Consent") consists of (a) this cover page (this "Cover Page") and (b) the resolutions attached hereto (the "Resolutions"). If there is any conflict between the Cover Page and the Resolutions, the Cover Page controls.

| Kind | Label | Value | Show When |
| --- | --- | --- | --- |
| row | Company | {company_name} | always |
| row | Effective Date | {effective_date} | always |
| row | Instrument | Simple Agreement for Future Equity ("SAFE") | always |
| subrow | Valuation Cap (Post-Money) | {safe_valuation_cap} | always |
| subrow | Discount Rate | {safe_discount_rate} | always |
| subrow | Changes to Standard Terms | {safe_changes_to_standard_terms} | always |
| row | Maximum Aggregate SAFE Purchase Amount | ${purchase_amount} | always |

## Standard Terms

<!-- oa:clause id=board-action-under-delaware-law -->
### Action by Written Consent of the Board

The undersigned, constituting all of the members of the Board of Directors (the "Board") of {company_name}, a Delaware corporation (the "Company"), pursuant to Section 141(f) of the Delaware General Corporation Law, hereby adopt the following resolutions by written consent.

This action by written consent (this "Board Consent") records the approval reflected on the Cover Page and the resolutions below.

<!-- oa:clause id=approval-of-safe-financing -->
### Approval of SAFE Financing

WHEREAS, the Board believes it is in the best interests of the Company to approve the issuance by the Company of one or more SAFEs (each, a "SAFE", and together, the "SAFEs"), of the type described in the Cover Terms, for an aggregate purchase amount of up to the Maximum Aggregate SAFE Purchase Amount listed in the Cover Terms, in accordance with their terms.

RESOLVED, that the issuance by the Company of each SAFE, in substantially the form presented to the Board, be, and it hereby is, approved in all respects.

RESOLVED FURTHER, that the officers of the Company be, and each of them hereby is, authorized and directed, for and on behalf of the Company, to execute and deliver each SAFE, and any and all other agreements, certificates or documents required or contemplated by any SAFE or deemed necessary or appropriate in connection therewith, and to take all actions deemed necessary or appropriate to cause the Company's obligations thereunder to be performed.

<!-- oa:clause id=officer-authority -->
### Officer Authority

Each officer of the Company is authorized and directed, for and on behalf of the Company, to execute and deliver each SAFE and any related agreements, certificates, notices, or other documents required or contemplated by any SAFE or otherwise necessary or appropriate in connection with the SAFE financing.

<!-- oa:clause id=negotiated-changes -->
### Negotiated Changes

Each officer of the Company is further authorized to negotiate and approve additions, modifications, amendments, or deletions to any SAFE or related document, and execution and delivery by that officer will be conclusive evidence of that approval.

<!-- oa:clause id=reservation-and-issuance-of-shares -->
### Reservation and Issuance of Shares

RESOLVED FURTHER, that shares of the Company's capital stock issuable upon conversion of each SAFE be, and they hereby are, reserved for issuance upon conversion of such SAFE in accordance with its terms.

RESOLVED FURTHER, that when shares of the Company's capital stock are issued upon conversion of any SAFE in accordance with its terms, such shares shall be duly and validly issued, fully paid and nonassessable.

<!-- oa:clause id=securities-law-compliance -->
### Securities Law Compliance

RESOLVED FURTHER, that each SAFE shall be offered and sold in reliance on any applicable exemption from registration provided by the Securities Act of 1933, as amended, and any applicable exemption under applicable state blue sky laws, and that the officers of the Company be, and each of them hereby is, authorized and directed, for and on behalf of the Company, to execute and file any forms, certificates, notices or other documents that are necessary or appropriate pursuant to federal or state securities laws.

<!-- oa:clause id=further-actions -->
### General Authorizing Resolution

RESOLVED, that the officers of the Company be, and each of them hereby is, authorized and directed, for and on behalf of the Company, to take such further actions and execute such documents as may be necessary or appropriate in order to implement the foregoing resolutions.

## Signatures

<!-- oa:signature-mode arrangement=stacked repeat=board_members item=member -->

This Board Consent shall be filed with the minutes of the proceedings of the Board.

Each director signs this Board Consent solely in his or her capacity as a director of the Company, and not in any personal capacity as an investor, purchaser, or party to any SAFE.

<!-- oa:signer id=director kind=individual capacity=personal label="Director" -->
Signature: _______________
Print Name: {member.name}
Date: {effective_date}
