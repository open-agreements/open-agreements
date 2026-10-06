---
jurisdiction: "California"
slug: california
countryCode: US
content_packaged_at: "2026-10-05"
law_checked_through: "2026-10-01"
human_reviewed_at: null
next_review_due: "2027-03-30"
canonicalUrl: https://openagreements.org/practice-guides/privacy/us/california
license: CC BY 4.0
stale: false
---

> [!IMPORTANT]
> **Informational only — not legal advice.** This is a snapshot of an OpenAgreements practice guide,
> provided for general information. It is not legal advice, does not create an attorney-client
> relationship, and is not a substitute for a licensed attorney in the relevant jurisdiction.
> Laws change; verify against the canonical version before relying on it.
>
> **Canonical:** https://openagreements.org/practice-guides/privacy/us/california · **Snapshot as of:** 2026-10-05 · License: CC BY 4.0 · © openagreements.org

# California Consumer Privacy Law (CCPA/CPRA): Data Privacy for Businesses[^about]

California data privacy law explained for businesses: who the CCPA and CPRA cover, what a privacy policy and notice at collection must say, consumer rights, vendor contracts, and enforcement.


## At a glance

| Question | California |
| --- | --- |
| **Law coverage** | Comprehensive law |
| **Summary** | A CCPA-covered business must post a compliant privacy policy, honor consumer rights and opt-out signals, put statutory terms in vendor contracts, and maintain reasonable security. A smaller commercial site may still owe a privacy policy under CalOPPA. |
| **Main law** | Cal. Civ. Code § 1798.140(d)(1). |
| **Privacy policy required?** | Yes — an online privacy policy with statutorily fixed contents, updated at least every 12 months |
| **Who does it cover?** | For-profit businesses meeting a CCPA threshold (including the $26,625,000 revenue threshold effective January 1, 2025), plus qualifying affiliates, joint ventures, and voluntary certifiers |
| **Can consumers sue?** | Limited path |
| **Privacy policy rule** | Policy contents fixed by law |
| **Consent for sensitive data?** | Opt-out right or limits instead |
| **Browser opt-out signals?** | Must be honored |
| **Lawsuit detail** | Narrow — data breaches only (§ 1798.150) |
| **Who enforces it?** | California Privacy Protection Agency (CPPA) and the Attorney General |

## Which businesses does the CCPA cover? {#does-ccpa-apply}

**Short answer.** The CCPA, as amended by the CPRA, generally covers a for-profit entity that does business in California, determines the purposes and means of processing consumers' personal information, and meets at least one statutory threshold. [^stat-140-business] The definition also covers certain commonly branded entities that control or are controlled by a covered business and with which that business shares consumers' personal information, qualifying joint ventures or partnerships, and entities that voluntarily certify compliance. [^stat-140-affiliates][^stat-140-joint-ventures][^stat-140-voluntary] For the revenue threshold, the [CPPA adjustment effective January 1, 2025](https://www.cppa.ca.gov/regulations/cpi_adjustment.html) sets $26,625,000.

The revenue test is not the only threshold in paragraph (d)(1): that paragraph also covers entities that annually buy, sell, or share the personal information of 100,000 or more consumers or households, or derive 50 percent or more of annual revenue from selling or sharing personal information [^stat-140-business].

An applicability review turns on three inputs: preceding-calendar-year gross revenue, the annual number of consumers or households whose personal information the entity buys, sells, or shares, and the share of annual revenue from selling or sharing personal information. The affiliate, joint-venture, and voluntary-certification paths require separate review. Posting a policy does not itself answer the CCPA coverage question. [^stat-140-business][^stat-140-affiliates][^stat-140-joint-ventures][^stat-140-voluntary]

California's Online Privacy Protection Act (CalOPPA) has a separate policy duty with no revenue or volume threshold: [Cal. Bus. & Prof. Code § 22575(a)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575) requires an operator of a commercial website or online service that collects personally identifiable information online about California residents who use or visit it to conspicuously post or make available a privacy policy. A site below the CCPA thresholds may still owe that policy.

For a covered business preparing its online notice, the [privacy policy reviewer checklist](/checklists/privacy-policy/us) provides a document-level review alongside the California-specific requirements below.

## What must your California privacy policy contain? {#privacy-policy-contents}

**Short answer.** A CCPA-covered business must describe consumer rights and request methods in its online privacy policy or, without one, on its website [^stat-130-policy]. It must update that information at least once every 12 months [^stat-130-policy]. The implementing regulation specifies the policy's required contents [^reg-7011-policy]. At or before collection, the business must separately identify the personal information categories collected and their purposes [^stat-100-notice].

For a template privacy policy, that means the document is not a static disclaimer — it is a dated, annually-updated instrument that must, at minimum: (1) describe each consumer right under sections 1798.100, 1798.105, 1798.106, 1798.110, 1798.115, and 1798.125; (2) list the categories of personal information collected, the sources, the business or commercial purposes, and the categories of third parties to whom information is disclosed or sold; and (3) state at least two methods for exercising rights. The notice at collection is a distinct, just-in-time disclosure given at the point of collection, not a substitute for the policy.

The CPPA's implementing regulation spells out the same obligation in granular form: it enumerates exactly what the privacy policy must include, beginning with a comprehensive description of the business's information practices [^reg-7011-policy]. A template that maps each regulatory line item to a section of the policy is the most reliable way to demonstrate compliance.

> [!NOTE]
> **Practice note.**
>
> Treat the requirement to update the policy at least once every 12 months as a hard maintenance obligation, not a courtesy. A privacy policy whose last-reviewed date has gone stale is itself a compliance gap, independent of whether the underlying practices changed — the statute makes the annual refresh a standalone duty [^stat-130-policy].

## What must your contracts with vendors and service providers say? {#vendor-contracts}

**Short answer.** The CCPA requires a written agreement when a business sells or shares personal information or discloses it to a service provider or contractor for a business purpose [^stat-100d-contracts]. The agreement must limit the recipient to specified purposes and require compliance with the CCPA [^stat-100d-contracts].

This is the provision that makes a data processing agreement a statutory requirement rather than a best practice. A recipient that lacks a compliant contract does not qualify as a service provider or contractor, which means the disclosure can be treated as a sale or a share — triggering opt-out rights and disclosure obligations the business may not have planned for. The implementing CPPA regulation supplies the specific clauses a compliant template DPA must carry — including identifying the limited and specified business purposes and barring generic, contract-wide descriptions [^reg-7051-contracts].

## Can a consumer sue your business after a data breach? {#data-breach-lawsuits}

**Short answer.** A California consumer may sue under the CCPA only for a qualifying data breach caused by a business's failure to maintain reasonable security [^stat-150-pra]. The claim covers specified nonencrypted, nonredacted personal information or an email address paired with account-access credentials [^stat-150-pra].

There is no California appellate decision squarely defining the outer edges of this private right of action. The Ninth Circuit has, however, recognized that CCPA breach claims carry real settlement value: in reviewing a data-breach class settlement it noted the CCPA claims "potentially conferred statutory damages to the California subclass"[^cpk-9th] and were weighed in assessing the settlement’s adequacy [^cpk-9th]. For a business, the practical takeaway is that the litigation exposure is concentrated entirely at the security-failure-plus-breach boundary.

## Do the new CPPA rules on AI, risk assessments, and cybersecurity audits apply to you? {#ai-cyber-risk-rules}

**Short answer.** The CPPA's new risk-assessment, cybersecurity-audit, and automated-decisionmaking rules apply only when a business's processing meets the relevant regulatory thresholds [^reg-7150-risk][^reg-7120-cyber][^reg-7200-admt]. The audit and automated-decisionmaking requirements phase in on different schedules [^reg-7121-timing][^reg-7200-admt].

There are three thresholds to map against your operations. First, a risk assessment is required before you begin any processing that presents significant risk to privacy — which the regulation defines to include selling or sharing personal information, processing sensitive personal information, and using ADMT for a significant decision [^reg-7150-risk]. Second, an annual cybersecurity audit is required once your processing presents significant risk to security, with the first audit report due April 1, 2028 for the largest businesses and phasing in later for smaller ones [^reg-7120-cyber][^reg-7121-timing]. Third, if you use ADMT to make a significant decision about a consumer — in lending, housing, education, employment, or healthcare — you must reach compliance, including pre-use notices and opt-out and access rights, no later than January 1, 2027 [^reg-7200-admt].

> [!NOTE]
> **Practice note.**
>
> For a template privacy program, inventory now where automated tools drive significant decisions and where high-risk processing occurs. The documentation obligations are dated: ADMT compliance by January 1, 2027 and the first cybersecurity-audit reports and risk-assessment submissions from April 1, 2028 — so the records need to exist before those dates, not after [^reg-7121-timing].

[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-10-01. License: CC BY 4.0. Steven Obiajulu, J.D. is admitted in New York, not California. This article synthesizes California primary law and is not legal advice from a California-admitted attorney. This article is for informational purposes only and does not create an attorney-client relationship. Source excerpts and linked materials belong to their owners. CC BY 4.0. Cite as Steven Obiajulu, *California Consumer Privacy Law (CCPA/CPRA): Data Privacy for Businesses*, OpenAgreements (last updated October 1, 2026), https://openagreements.org/practice-guides/privacy/us/california.

[^stat-140-business]: **Cal. Civ. Code § 1798.140** — "A sole proprietorship, partnership, limited liability company, corporation, association, or other legal entity that is organized or operated for the profit or financial benefit of its shareholders or other owners, that collects consumers’ personal information, or on the behalf of which such information is collected and that alone, or jointly with others, determines the purposes and means of the processing of consumers’ personal information, that does business in the State of California, and that satisfies one or more of the following thresholds: (A) As of January 1 of the calendar year, had annual gross revenues in excess of twenty-five million dollars ($25,000,000) in the preceding calendar year, as adjusted pursuant to subdivision (d) of Section 1798.199.95. (B) Alone or in combination, annually buys, sells, or shares the personal information of 100,000 or more consumers or households. (C) Derives 50 percent or more of its annual revenues from selling or sharing consumers’ personal information." *Cal. Civ. Code § 1798.140(d)(1).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140>

[^stat-140-affiliates]: **Cal. Civ. Code § 1798.140(d)(2)** — "Any entity that controls or is controlled by a business, as defined in paragraph (1), and that shares common branding with the business and with whom the business shares consumers’ personal information." *Cal. Civ. Code § 1798.140(d)(2).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140>

[^stat-140-joint-ventures]: **Cal. Civ. Code § 1798.140(d)(3)** — "A joint venture or partnership composed of businesses in which each business has at least a 40 percent interest." *Cal. Civ. Code § 1798.140(d)(3).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140>

[^stat-140-voluntary]: **Cal. Civ. Code § 1798.140(d)(4)** — "A person that does business in California, that is not covered by paragraph (1), (2), or (3), and that voluntarily certifies to the California Privacy Protection Agency that it is in compliance with, and agrees to be bound by, this title." *Cal. Civ. Code § 1798.140(d)(4).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140>

[^stat-130-policy]: **Cal. Civ. Code § 1798.130** — "Disclose the following information in its online privacy policy or policies if the business has an online privacy policy or policies and in any California-specific description of consumers’ privacy rights, or if the business does not maintain those policies, on its internet website, and update that information at least once every 12 months: (A) A description of a consumer’s rights pursuant to Sections 1798.100, 1798.105, 1798.106, 1798.110, 1798.115, and 1798.125 and two or more designated methods for submitting requests, except as provided in subparagraph (A) of paragraph (1) of subdivision (a)." *Cal. Civ. Code § 1798.130(a)(5).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.130>

[^reg-7011-policy]: **Cal. Code Regs. tit. 11, § 7011** — "The privacy policy shall include the following information:" *Cal. Code Regs. tit. 11, § 7011(e).* <https://cppa.ca.gov/regulations/pdf/20230329_final_regs_text.pdf#page=13>

[^stat-100-notice]: **Cal. Civ. Code § 1798.100** — "A business that controls the collection of a consumer’s personal information shall, at or before the point of collection, inform consumers of the following:" *Cal. Civ. Code § 1798.100(a).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.100>

[^stat-100d-contracts]: **Cal. Civ. Code § 1798.100(d)** — "A business that collects a consumer’s personal information and that sells that personal information to, or shares it with, a third party or that discloses it to a service provider or contractor for a business purpose shall enter into an agreement with the third party, service provider, or contractor, that:" *Cal. Civ. Code § 1798.100(d).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.100>

[^reg-7051-contracts]: **Cal. Code Regs. tit. 11, § 7051** — "Identify the specific business purpose(s) for which the service provider or contractor is processing personal information pursuant to the written contract with the business, and specify that the business is disclosing the personal information to the service provider or contractor only for the limited and specified business purpose(s) set forth within the contract." *Cal. Code Regs. tit. 11, § 7051(a)(2).* <https://cppa.ca.gov/regulations/pdf/20230329_final_regs_text.pdf#page=50>

[^stat-150-pra]: **Cal. Civ. Code § 1798.150** — "Any consumer whose nonencrypted and nonredacted personal information, as defined in subparagraph (A) of paragraph (1) of subdivision (d) of Section 1798.81.5, or whose email address in combination with a password or security question and answer that would permit access to the account is subject to an unauthorized access and exfiltration, theft, or disclosure as a result of the business’ violation of the duty to implement and maintain reasonable security procedures and practices appropriate to the nature of the information to protect the personal information may institute a civil action" *Cal. Civ. Code § 1798.150(a)(1).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.150>

[^cpk-9th]: **In re California Pizza Kitchen, Inc., 129 F.4th 667 (9th Cir. 2025)** — "The district court also considered the California Consumer Privacy Act (CCPA) claims—which potentially conferred statutory damages to the California subclass—in assessing the adequacy of the settlement." *In re California Pizza Kitchen, Inc., 129 F.4th 667 (9th Cir. 2025).* <https://www.courtlistener.com/opinion/10338139/in-re-aviva-kirsten-v-california-pizza-kitchen-inc/#:~:text=The%20district%20court%20also%20considered,the%20adequacy%20of%20the%20settlement.>

[^reg-7150-risk]: **Cal. Code Regs. tit. 11, § 7150** — "Every business whose processing of consumers’ personal information presents significant risk to consumers’ privacy as set forth in subsection (b) must conduct a risk assessment before initiating that processing." *Cal. Code Regs. tit. 11, § 7150(a).* <https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf#page=100>

[^reg-7120-cyber]: **Cal. Code Regs. tit. 11, § 7120** — "Every business whose processing of consumers’ personal information presents significant risk to consumers’ security as set forth in subsection (b) must complete a cybersecurity audit." *Cal. Code Regs. tit. 11, § 7120(a).* <https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf#page=88>

[^reg-7200-admt]: **Cal. Code Regs. tit. 11, § 7200** — "A business that uses ADMT for a significant decision prior to January 1, 2027, must be in compliance with the requirements of this Article no later than January 1, 2027." *Cal. Code Regs. tit. 11, § 7200(b).* <https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf#page=112>

[^reg-7121-timing]: **Cal. Code Regs. tit. 11, § 7121** — "April 1, 2028, if the business’s annual gross revenue for 2026 was more than one hundred million dollars ($100,000,000) as of January 1, 2027." *Cal. Code Regs. tit. 11, § 7121(a)(1).* <https://cppa.ca.gov/regulations/pdf/ccpa_updates_cyber_risk_admt_appr_text.pdf#page=88>
