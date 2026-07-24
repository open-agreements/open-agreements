---
jurisdiction: "New Jersey"
slug: new-jersey
countryCode: US
snapshotAsOf: "2026-07-23"
lastReviewed: "2026-06-06"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/new-jersey
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice guide,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/new-jersey · **Snapshot as of:** 2026-07-23 · License: CC BY 4.0 · © openagreements.org

# New Jersey Consumer Privacy Law (NJDPA)[^about]

The New Jersey Data Privacy Act gives New Jersey consumers rights over their personal data and imposes notice, contracting, and consent duties on controllers above defined thresholds — it is enforced exclusively by the Attorney General as an unlawful practice under the Consumer Fraud Act, with no private right of action and only a temporary right to cure.


## At a glance

| Question | New Jersey |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | If you meet the 100,000-consumer (or 25,000 plus any data-sale revenue) threshold in New Jersey, the NJDPA requires a privacy notice, opt-in consent to process sensitive data, and processor contracts — enforced by the Attorney General as an unlawful practice under the Consumer Fraud Act, with no consumer lawsuits and a cure period that sunsets after the law's first 18 months. |
| **Main law** | N.J.S.A. 56:8-166.4 et seq. (New Jersey Data Privacy Act), effective January 15, 2025 |
| **Privacy policy required?** | Yes — a reasonably accessible, clear, and meaningful notice with seven statutorily fixed contents |
| **Who does it cover?** | Controllers doing business in New Jersey (or targeting residents) that control or process the data of 100,000+ consumers a year (excluding payment-only data), or 25,000+ while deriving any revenue or a discount from selling data — no revenue floor, and no exemption for nonprofits |
| **Can consumers sue?** | No |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Consent required first |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | No — enforcement is exclusively the Attorney General's |
| **Who enforces it?** | New Jersey Attorney General, through the Division of Consumer Affairs (exclusive) |

## Does the New Jersey Data Privacy Act apply to your business? {#does-njdpa-apply}

**Short answer.** It turns on consumer volume, not overall revenue. The NJDPA applies to controllers that do business in New Jersey or target its residents and that, in a calendar year, control or process the personal data of at least 100,000 consumers (setting aside data used only to complete a payment), or at least 25,000 consumers while deriving any revenue or a discount from selling personal data [^stat-166-5-apply]. Several categories of regulated data and entities — including GLBA-regulated financial institutions and HIPAA-covered health information — fall outside the law entirely [^stat-166-13-exempt].

Two features make New Jersey broader than many of its peers. There is no minimum dollar-revenue floor, so a smaller company that handles a high volume of resident data can be covered. And the second threshold has no majority-of-revenue test: deriving any revenue, or even a discount, from selling personal data is enough at 25,000 consumers. A consumer is a New Jersey resident acting in an individual or household context, not someone in a commercial or employment context. The law also carves out, among others, GLBA-regulated financial institutions, HIPAA-covered protected health information, FCRA-governed consumer-reporting data, and state and local government — but, unlike most state privacy laws, it contains no blanket exemption for nonprofit organizations.

## What must your New Jersey privacy policy contain? {#privacy-policy-contents}

**Short answer.** A controller must provide a reasonably accessible, clear, and meaningful privacy notice that lists the categories of personal data it processes and the purpose for processing them, among other required disclosures [^stat-166-6-notice].

For a template privacy policy, section 56:8-166.6 is the content checklist. The full list runs to seven items: the categories of data processed; the purpose of processing; the categories of all third parties data may be disclosed to; the categories of data shared with third parties; how consumers exercise their rights, including contact information and how to appeal a decision; the process for notifying consumers of material changes; and an active email address or other online mechanism to reach the controller. A controller that sells personal data, or processes it for targeted advertising or profiling that produces legal or similarly significant effects, must also clearly and conspicuously disclose that and how to opt out. Beyond the notice itself, New Jersey requires controllers that process personal data for targeted advertising or the sale of personal data to let consumers opt out through a user-selected universal opt-out mechanism, beginning no later than six months after the act's effective date [^stat-166-11-optout]. The notice the policy presents should match the data practices the controller actually carries out.

## What must your contracts with processors say? {#vendor-contracts}

**Short answer.** A contract between a controller and a processor must govern the processor's handling of the data — so a data processing agreement is a statutory requirement, not a best practice [^stat-166-16-contract]. A separate set of exceptions preserves the parties' ability to comply with other law and run defined internal operations [^stat-166-15-exceptions].

Section 56:8-166.16 specifies the required terms: the processing instructions the processor is bound by, including the nature and purpose of processing; the type of data and the duration; a duty of confidentiality for everyone handling the data; deletion or return of data at the controller's direction when services end; the information needed to demonstrate compliance; cooperation with the controller's assessments and inspections (or an annual independent audit at the processor's expense); and a requirement that any subcontractor be bound by written contract to the same obligations. A separate provision (section 56:8-166.15) sets out the exceptions that let a controller or processor still comply with other laws, respond to legal process, and run ordinary internal operations. A compliant template DPA tracks each of these. The statute is also blunt about who bears the risk: a person that processes outside the controller's instructions is treated as a controller for that processing, and no contract can shift the liabilities the law assigns by role.

## Do you need consent to process sensitive data? {#sensitive-data}

**Short answer.** Yes. A controller may not process a consumer's sensitive data without first obtaining consent, and for a known child it must instead handle the data in accordance with the federal Children's Online Privacy Protection Act [^stat-166-12-consent]. Sensitive data includes data revealing race or ethnicity, religious beliefs, a health condition or diagnosis, financial account credentials, sex life or sexual orientation, citizenship or immigration status, or status as transgender or non-binary; genetic or biometric data used to identify a person; data collected from a known child; and precise geolocation [^stat-166-4-sensitive].

This is the opt-in model: consent must be a clear affirmative act, and the statute expressly rules out acceptance of broad terms of use, passive interactions like hovering or muting, and anything obtained through dark patterns. New Jersey also reaches teenagers: for a consumer the controller knows, or willfully disregards, is at least 13 but younger than 17, it cannot process data for targeted advertising, sale, or profiling without consent. Biometric data is treated as sensitive and so is subject to the same opt-in rule, even though New Jersey has no standalone biometric statute with its own private right of action.

## Can a consumer sue your business under the NJDPA? {#consumer-lawsuit}

**Short answer.** No. The Office of the Attorney General has sole and exclusive authority to enforce the NJDPA, and the law cannot be the basis for a private right of action [^stat-166-19-enforce]. A violation is treated as an unlawful practice under New Jersey's Consumer Fraud Act, the state's general anti-fraud statute [^stat-166-17-violation].

What makes New Jersey distinctive is the enforcement channel: rather than a freestanding penalty scheme, the NJDPA folds violations into the long-standing Consumer Fraud Act, so the Attorney General brings them with the remedies and penalties that statute already supplies. The right to cure is only temporary. For the law's first 18 months, the Division of Consumer Affairs must send notice and allow 30 days to fix a violation it deems curable before bringing an action [^stat-166-17-cure]; after that window closes the Attorney General can proceed directly. Day-to-day rulemaking sits with the Director of the Division of Consumer Affairs, who is charged with promulgating regulations to carry out the act [^stat-166-18-rules]. The practical posture is to build the notice, consent, and contracting controls up front, because the cure off-ramp will not last.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-06. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not New Jersey. This article synthesizes New Jersey primary law and is not legal advice from a New Jersey-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *New Jersey Consumer Privacy Law (NJDPA)*, OpenAgreements (last updated June 6, 2026), https://openagreements.org/practice-guides/privacy/us/new-jersey.

[^stat-166-5-apply]: **N.J.S.A. 56:8-166.5** — "the provisions of P.L.2023, c.266 (C.56:8-166.4 et seq.) shall only apply to controllers that conduct business in the State or produce products or services that are targeted to residents of the State, and that during a calendar year either: a. control or process the personal data of at least 100,000 consumers, excluding personal data processed solely for the purpose of completing a payment transaction; or b. control or process the personal data of at least 25,000 consumers and the controller derives revenue, or receives a discount on the price of any goods or services, from the sale of personal data." *N.J.S.A. 56:8-166.5.* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-13-exempt]: **N.J.S.A. 56:8-166.13** — "a financial institution, data, or an affiliate of a financial institution that is subject to Title V of the federal ‘Gramm-Leach-Bliley Act,’ 15 U.S.C. s.6801 et seq., and the rules and implementing regulations promulgated thereunder;" *N.J.S.A. 56:8-166.13(b).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-6-notice]: **N.J.S.A. 56:8-166.6** — "A controller shall provide to a consumer a reasonably accessible, clear, and meaningful privacy notice that shall include, but may not be limited to: (1) the categories of the personal data that the controller processes; (2) the purpose for processing personal data; (3) the categories of all third parties to which the controller may disclose a consumer's personal data; (4) the categories of personal data that the controller shares with third parties, if any; (5) how consumers may exercise their consumer rights, including the controller's contact information and how a consumer may appeal a controller's decision with regard to the consumer's request; (6) the process by which the controller notifies consumers of material changes to the notification required to be made available pursuant to this subsection, along with the effective date of the notice; and (7) an active electronic mail address or other online mechanism that the consumer may use to contact the controller." *N.J.S.A. 56:8-166.6(a).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-11-optout]: **N.J.S.A. 56:8-166.11** — "Beginning not later than six months following the effective date of P.L.2023, c.266 (C.56:8-166.4 et seq.), a controller that processes personal data for purposes of targeted advertising, or the sale of personal data shall allow consumers to exercise the right to opt out of such processing through a user-selected universal opt-out mechanism." *N.J.S.A. 56:8-166.11(b)(1).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-16-contract]: **N.J.S.A. 56:8-166.16** — "Processing by a processor shall be governed by a contract between the controller and the processor that is binding on both parties and that sets forth: (1) the processing instructions to which the processor is bound, including the nature and purpose of the processing;" *N.J.S.A. 56:8-166.16(e).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-15-exceptions]: **N.J.S.A. 56:8-166.15** — "Nothing in P.L.2023, c.266 (C.56:8-166.4 et seq.) shall be construed to restrict a controller's or processor's ability to: (1) comply with federal or State law or regulations;" *N.J.S.A. 56:8-166.15(a).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-12-consent]: **N.J.S.A. 56:8-166.12** — "not process sensitive data concerning a consumer without first obtaining the consumer's consent, or, in the case of the processing of personal data concerning a known child, without processing such data in accordance with COPPA;" *N.J.S.A. 56:8-166.12(a)(4).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-4-sensitive]: **N.J.S.A. 56:8-166.4** — "means personal data revealing racial or ethnic origin; religious beliefs; mental or physical health condition, treatment, or diagnosis; financial information, which shall include a consumer's account number, account log-in, financial account, or credit or debit card number, in combination with any required security code, access code, or password that would permit access to a consumer's financial account; sex life or sexual orientation; citizenship or immigration status; status as transgender or non-binary; genetic or biometric data that may be processed for the purpose of uniquely identifying an individual; personal data collected from a known child; or precise geolocation data." *N.J.S.A. 56:8-166.4.* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-19-enforce]: **N.J.S.A. 56:8-166.19** — "The Office of the Attorney General shall have sole and exclusive authority to enforce a violation of P.L.2023, c.266 (C.56:8-166.4 et seq.). Nothing in P.L.2023, c.266 (C.56:8-166.4 et seq.) shall be construed as providing the basis for, or subject to, a private right of action for violations of P.L.2023, c.266 (C.56:8-166.4 et seq.)." *N.J.S.A. 56:8-166.19.* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-17-violation]: **N.J.S.A. 56:8-166.17** — "It shall be an unlawful practice and violation of P.L.1960, c.39 (C.56:8-1 et seq.) for a controller to violate the provisions of P.L.2023, c.266 (C.56:8-166.4 et seq.)." *N.J.S.A. 56:8-166.17(a).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-17-cure]: **N.J.S.A. 56:8-166.17** — "Until the first day of the 18th month next following the effective date of P.L.2023, c.266 (C.56:8-166.4 et seq.), prior to bringing an enforcement action before an administrative law judge or a court of competent jurisdiction in this State, the Division of Consumer Affairs in the Department of Law and Public Safety shall issue a notice to the controller if a cure is deemed possible." *N.J.S.A. 56:8-166.17(b).* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>

[^stat-166-18-rules]: **N.J.S.A. 56:8-166.18** — "The Director of the Division of Consumer Affairs in the Department of Law and Public Safety shall promulgate rules and regulations, pursuant to the ‘Administrative Procedure Act,’ P.L.1968, c.410 (C.52:14B-1 et seq.), necessary to effectuate the purposes of P.L.2023, c.266 (C.56:8-166.4 et seq.)." *N.J.S.A. 56:8-166.18.* <https://pub.njleg.gov/bills/2022/PL23/266_.PDF>
