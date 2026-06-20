---
jurisdiction: "Pennsylvania"
slug: pennsylvania
countryCode: US
snapshotAsOf: "2026-06-19"
lastReviewed: "2026-06-07"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/pennsylvania
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice note,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/pennsylvania · **Snapshot as of:** 2026-06-19 · License: CC BY 4.0 · © openagreements.org

# Pennsylvania Consumer Privacy Law[^about]

Pennsylvania has no comprehensive consumer-privacy statute. The operative state law is the Breach of Personal Information Notification Act (73 P.S. §§ 2301 et seq.), enforced exclusively by the Attorney General under the Unfair Trade Practices and Consumer Protection Law; the rest of a Pennsylvania privacy program rides the federal and sectoral overlay (FTC Act § 5, GLBA, HIPAA, COPPA).


## At a glance

| Question | Pennsylvania |
| --- | --- |
| **Law coverage** | No comprehensive law |
| **Summary** | Pennsylvania has not enacted a comprehensive consumer-privacy law, so there are no general data-rights, notice-at-collection, consent, or processor-contract duties under state law. The operative state statute is the Breach of Personal Information Notification Act, which requires notice of a data breach without unreasonable delay and is enforced solely by the Attorney General. Everything else in a Pennsylvania-facing privacy program comes from the federal and sectoral overlay — FTC Act § 5, GLBA, HIPAA, and COPPA — so build to those and to the Breach Act, and the program auto-upgrades if Pennsylvania later enacts an omnibus law. One state-law exposure does demand attention now — Pennsylvania's all-party-consent wiretap statute (WESCA) has become the basis for website session-replay and tracking-pixel class actions, so obtain visitor consent before running third-party tracking. |
| **Main law** | Pennsylvania Breach of Personal Information Notification Act, 73 P.S. §§ 2301 et seq. — Pennsylvania has no comprehensive consumer-privacy law; the Breach Act plus a federal and sectoral overlay is the operative framework |
| **Privacy policy required?** | No comprehensive Pennsylvania statute mandates a consumer privacy policy or fixes its contents; contents are driven by FTC Act § 5 (a policy that misstates practices is deceptive), the UTPCPL, and the GLBA, HIPAA, and COPPA rules where the business is in scope |
| **Who does it cover?** | Any entity — a sole proprietorship, partnership, corporation, association, or other group, for profit or not — doing business in Pennsylvania that maintains, stores, or manages computerized personal information of Pennsylvania residents; no revenue or consumer-volume threshold |
| **Can consumers sue?** | Yes |
| **Privacy policy rule** | No state policy checklist |
| **Consent for sensitive data?** | No special rule |
| **Browser opt-out signals?** | Not required |
| **Lawsuit detail** | Not under the Breach Act — the Attorney General has exclusive UTPCPL enforcement authority; but Pennsylvania's all-party-consent wiretap law (WESCA, 18 Pa.C.S. § 5725) provides a private cause of action that drives website session-replay class actions |
| **Who enforces it?** | Pennsylvania Office of Attorney General |

## Which privacy laws apply to your business in Pennsylvania? {#which-privacy-laws-apply}

**Short answer.** There is no comprehensive Pennsylvania consumer-privacy law. The operative state statute is the Breach of Personal Information Notification Act, which applies to any entity — defined as a State agency, a political subdivision, or an individual or a business doing business in the Commonwealth — that maintains, stores, or manages computerized personal information of Pennsylvania residents [^stat-2302-entity]. It carries no revenue or consumer-volume threshold, and it governs breach response rather than day-to-day data handling [^stat-2329-apply].

Unlike California, Virginia, or Colorado, Pennsylvania has not enacted an omnibus privacy statute, so its residents do not have general rights to access, delete, correct, or opt out of the sale of their personal data under state law, and businesses are not subject to state notice-at-collection, consent, or data-protection-assessment duties. What fills the gap is a layered framework: the Breach Act sets the one statewide data-security duty, and the rest of a Pennsylvania privacy program rides a federal and sectoral overlay. Section 5 of the FTC Act reaches deceptive or unfair privacy practices nationwide; the Gramm-Leach-Bliley Act governs financial institutions; HIPAA governs covered health entities and their business associates; the Children's Online Privacy Protection Act governs services directed to children under 13; and CAN-SPAM and the TCPA govern email and SMS marketing. Pennsylvania's own Wiretapping and Electronic Surveillance Control Act (WESCA) — an all-party-consent wiretap statute — sits alongside the Breach Act as state law and has become the main engine of website session-replay and tracking-pixel litigation against businesses, a point developed in the consumer-lawsuit prong below. None of those federal regimes is a Pennsylvania statute, but together with WESCA and the Breach Act they are what actually shapes a compliant Pennsylvania-facing program today. This note is written to stay durable: if Pennsylvania later enacts a comprehensive law, the program built to this overlay upgrades rather than restarts.

## What must your Pennsylvania privacy policy contain? {#privacy-policy-contents}

**Short answer.** No Pennsylvania statute requires a general consumer privacy policy or fixes what it must say. For most businesses, the privacy policy is governed not by a state checklist but by the rule that whatever you publish has to be true: under Section 5 of the FTC Act and Pennsylvania's Unfair Trade Practices and Consumer Protection Law, a policy that misstates how you collect, use, share, retain, or secure data is a deceptive practice [^fed-ftc5-deceptive]. Where a sectoral regime applies, that regime supplies the contents instead — a HIPAA covered entity, for example, must give individuals a notice of the uses and disclosures of their protected health information and of their rights and the entity's duties [^fed-hipaa-notice].

In practice this means the drafting question in Pennsylvania is less what must be included and more does the policy match actual practice. Build the policy from the federal and sectoral overlay: the GLBA privacy-notice rules if you are a financial institution, the HIPAA Notice of Privacy Practices if you are a covered entity or business associate, and a COPPA notice if your service is directed to children under 13. For everyone else, follow best practice — describe the categories of data collected, the purposes, the third parties you share with, and how users exercise any choices you offer — and then honor it, because the enforceable obligation is consistency between the statement and the conduct. There is no Pennsylvania-mandated source to cite here, which is itself the point: the contents are overlay-driven, not state-statute-driven.

## What must your contracts with vendors say? {#vendor-contracts}

**Short answer.** Pennsylvania has no omnibus data-processing-agreement requirement — no state statute prescribes controller-to-processor terms, audit rights, deletion clauses, or subprocessor flow-downs for general private-sector contracts. Vendor data terms are instead driven by the sectoral regimes that apply to your business and by contract best practice.

Where a federal or sectoral regime is in scope, it supplies the contracting obligations: the GLBA Safeguards Rule requires financial institutions to oversee service providers by contract and to require them to implement appropriate safeguards [^fed-glba-safeguards]; HIPAA requires a business-associate agreement with mandatory data-protection, breach-reporting, and downstream-subcontractor terms before sharing protected health information [^fed-hipaa-baa]. Outside those verticals, the prudent move is to carry the same protections forward as a matter of best practice — processing limited to documented instructions, confidentiality, reasonable security, breach notification back to your business, and return or deletion of data at the end of the engagement — even though no Pennsylvania statute compels them. The Breach Act touches vendors only narrowly: a vendor that holds data on another entity's behalf must notify that entity after discovering a breach, leaving the entity responsible for notifying residents. That is a breach-response duty, not a general DPA mandate, so there is no Pennsylvania source to cite for omnibus vendor terms.

## When must you notify people of a data breach in Pennsylvania? {#breach-notification}

**Short answer.** An entity that maintains, stores, or manages computerized personal information must notify any Pennsylvania resident whose unencrypted and unredacted personal information was, or is reasonably believed to have been, accessed and acquired by an unauthorized person [^stat-2303-notice]. The notice must be made without unreasonable delay [^stat-2303-notice]. A reportable breach is the unauthorized access and acquisition of computerized data that materially compromises personal information and causes, or is reasonably believed to cause, loss or injury to a resident [^stat-2302-breach]. When notice goes to more than 500 persons at one time, the entity must also notify the nationwide consumer reporting agencies without unreasonable delay [^stat-2305-cra].

This is the one prong where Pennsylvania imposes a hard, statutory clock, so it is the center of any Pennsylvania incident-response plan. Personal information under the Act is a resident's name combined with an unencrypted, unredacted Social Security number, driver's license or state ID number, financial-account or card number with its access code, certain medical or health-insurance information, or online-account credentials. Encryption and redaction are safe harbors — a breach of properly encrypted data generally does not trigger notice unless the key was also compromised. Public entities face fixed, shorter clocks the Act spells out separately (State agencies and certain local entities measured in business days), and the Attorney General must be notified concurrently once a breach reaches more than 500 Pennsylvania residents. An entity that follows its own breach-notification procedures under an information privacy or security policy consistent with the Act is deemed compliant, and a financial institution that meets the federal interagency notice guidance is likewise deemed compliant.

## Can a consumer sue your business in Pennsylvania over privacy? {#consumer-lawsuit}

**Short answer.** Not under the Breach Act. A violation of the Act is deemed an unfair or deceptive practice under the Unfair Trade Practices and Consumer Protection Law [^stat-2308-utpcpl], and the Office of Attorney General has exclusive authority to bring that action — so the Breach Act gives consumers no private right of action [^stat-2308-exclusive]. Other Pennsylvania law is a different story. The Wiretapping and Electronic Surveillance Control Act (WESCA) makes it a third-degree felony to intentionally intercept any wire, electronic, or oral communication without all parties' consent [^wesca-5703], and it gives any person whose communication is intercepted a private civil cause of action — with liquidated and punitive damages and fees [^wesca-5725]. The Third Circuit held in Popa v. Harriet Carter Gifts that this framework reaches ordinary website tracking, so third-party session-replay or pixel code can be an unlawful interception unless the visitor consented [^case-popa].

Enforcement of Pennsylvania's one statewide data-security duty is therefore a public matter: the Attorney General, through the Bureau of Consumer Protection, brings UTPCPL actions for failures to notify or to secure data, seeking injunctions, restitution, and civil penalties. That does not mean a Pennsylvania business faces no litigation exposure — it means the exposure comes from other doors. Plaintiffs routinely plead common-law theories such as negligence and breach of implied contract after a breach, though those face steep standing hurdles absent actual misuse of the data. The fastest-growing exposure is WESCA: after Popa, plaintiffs' firms have filed waves of class actions treating third-party session-replay, chat, and advertising-pixel code as an unlawful two-party-consent interception, and the practical defense is to obtain the visitor's consent to that tracking before it runs. The durable takeaway: the Breach Act itself is AG-enforced only, but a Pennsylvania privacy program still has to manage real private-suit exposure under the wiretap law.

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-07. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not Pennsylvania. This article synthesizes Pennsylvania primary law and is not legal advice from a Pennsylvania-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship.

[^stat-2302-entity]: **73 P.S. § 2302** — "‘Entity.’ A State agency, a political subdivision of the Commonwealth or an individual or a business doing business in this Commonwealth." *73 P.S. § 2302.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2302/>

[^stat-2329-apply]: **73 P.S. § 2329** — "This act shall apply to the determination or notification of a breach of the security of the system that occurs on or after the effective date of this section." *73 P.S. § 2329.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2329/>

[^fed-ftc5-deceptive]: **FTC Act § 5** — "Unfair methods of competition in or affecting commerce, and unfair or deceptive acts or practices in or affecting commerce, are hereby declared unlawful." *15 U.S.C. § 45(a)(1).* <https://www.law.cornell.edu/uscode/text/15/45#:~:text=Unfair%20methods%20of%20competition%20in,commerce%2C%20are%20hereby%20declared%20unlawful.>

[^fed-hipaa-notice]: **HIPAA Notice of Privacy Practices** — "an individual has a right to adequate notice of the uses and disclosures of protected health information that may be made by the covered entity, and of the individual's rights and the covered entity's legal duties with respect to protected health information" *45 C.F.R. § 164.520.* <https://www.law.cornell.edu/cfr/text/45/164.520#:~:text=an%20individual%20has%20a%20right,respect%20to%20protected%20health%20information>

[^fed-glba-safeguards]: **GLBA Safeguards Rule** — "Requiring your service providers by contract to implement and maintain such safeguards" *16 C.F.R. § 314.4.* <https://www.law.cornell.edu/cfr/text/16/314.4#:~:text=Requiring%20your%20service%20providers%20by,implement%20and%20maintain%20such%20safeguards>

[^fed-hipaa-baa]: **HIPAA Business Associate Contracts** — "A contract between the covered entity and a business associate must" *45 C.F.R. § 164.504.* <https://www.law.cornell.edu/cfr/text/45/164.504#:~:text=A%20contract%20between%20the%20covered,and%20a%20business%20associate%20must>

[^stat-2303-notice]: **73 P.S. § 2303** — "An entity that maintains, stores or manages computerized data that includes personal information shall provide notice of any breach of the security of the system following determination of the breach of the security of the system to any resident of this Commonwealth whose unencrypted and unredacted personal information was or is reasonably believed to have been accessed and acquired by an unauthorized person." *73 P.S. § 2303(a).* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2303/>

[^stat-2302-breach]: **73 P.S. § 2302** — "The unauthorized access and acquisition of computerized data that materially compromises the security or confidentiality of personal information maintained by the entity as part of a database of personal information regarding multiple individuals and that causes or the entity reasonably believes has caused or will cause loss or injury to any resident of this Commonwealth." *73 P.S. § 2302.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2302/>

[^stat-2305-cra]: **73 P.S. § 2305** — "When an entity provides notification under this act to more than 500 persons at one time, the entity shall also notify, without unreasonable delay, all consumer reporting agencies that compile and maintain files on consumers on a nationwide basis, as defined in section 603 of the Fair Credit Reporting Act (Public Law 91-508, 15 U.S.C. § 1681a), of the timing, distribution and number of notices." *73 P.S. § 2305.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2305/>

[^stat-2308-utpcpl]: **73 P.S. § 2308** — "A violation of this act shall be deemed to be an unfair or deceptive act or practice in violation of the act of December 17, 1968 (P.L. 1224, No. 387)," *73 P.S. § 2308.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2308/>

[^stat-2308-exclusive]: **73 P.S. § 2308** — "The Office of Attorney General shall have exclusive authority to bring an action under the Unfair Trade Practices and Consumer Protection Law for a violation of this act." *73 P.S. § 2308.* <https://codes.findlaw.com/pa/title-73-ps-trade-and-commerce/pa-st-sect-73-2308/>

[^wesca-5703]: **18 Pa.C.S. § 5703** — "Except as otherwise provided in this chapter, a person is guilty of a felony of the third degree if he: (1) intentionally intercepts, endeavors to intercept, or procures any other person to intercept or endeavor to intercept any wire, electronic or oral communication;" *18 Pa.C.S. § 5703.* <https://codes.findlaw.com/pa/title-18-pacsa-crimes-and-offenses/pa-csa-sect-18-5703/>

[^wesca-5725]: **18 Pa.C.S. § 5725** — "Any person whose wire, electronic or oral communication is intercepted, disclosed or used in violation of this chapter shall have a civil cause of action against any person who intercepts, discloses or uses or procures any other person to intercept, disclose or use, such communication;" *18 Pa.C.S. § 5725(a).* <https://codes.findlaw.com/pa/title-18-pacsa-crimes-and-offenses/pa-csa-sect-18-5725/>

[^case-popa]: **Popa v. Harriet Carter Gifts, Inc., 52 F.4th 121 (3d Cir. 2022)** — "Thus if someone consents to the interception of her communications with a website, the WESCA does not impose liability." *Popa v. Harriet Carter Gifts, Inc., 52 F.4th 121 (3d Cir. 2022).* <https://www.courtlistener.com/opinion/8403630/ashley-popa-v-harriet-carter-gifts-inc/#:~:text=Thus%20if%20someone%20consents%20to,WESCA%20does%20not%20impose%20liability.>
