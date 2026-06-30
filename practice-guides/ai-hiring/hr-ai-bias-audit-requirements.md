---
type: Practice Guide
title: Defensible bias audits for HR AI tools
description: >-
  When HR AI tools need bias audits under NYC law, Title VII, Colorado rules,
  and the EU AI Act, plus what vendor audits should prove.
resource: >-
  https://openagreements.org/practice-guides/ai-hiring/hr-ai-bias-audit-requirements
timestamp: '2026-04-20'
tags:
  - ai-hiring
  - hr-ai-bias-audit-requirements
---

# Defensible bias audits for HR AI tools[^about]

When HR AI tools need bias audits under NYC law, Title VII, Colorado rules, and the EU AI Act, plus what vendor audits should prove.

## Which laws require bias audits for AI hiring tools in 2026? {#which-laws-require-ai-hiring-bias-audits}

**Short answer.** It depends on the jurisdiction: NYC requires an annual independent bias audit for covered AI hiring tools, while federal law, Colorado, and the EU focus on broader defensibility, impact assessment, and governance records.

As of April 20, 2026, there is still no single HR-AI audit standard. New York City is the only U.S. regime now in force that expressly requires a formal bias audit for employment AI, annually, by an independent auditor, with public posting. Federal employment law still determines whether the tool is defensible when challenged, and that inquiry is broader: protected-group impact, sample adequacy, job relatedness, business necessity, and recordkeeping. Colorado and the EU AI Act point in a different direction. They require impact assessment, risk management, logging, notice, annual review, and monitoring rather than NYC's exact public-ratio model, and neither clearly copies NYC's outside-auditor structure. So bias-audited is now an overloaded claim. It may mean NYC-compliant, statistically screened, or governance-documented. Those are different answers. [^new-york-city-department-of-consumer-and-worker][^29-c-f-r-1607-4-b][^colorado-general-assembly-sb25b-004-increase-tra][^regulation-eu-2024-1689]

## Does a bias audit make an AI hiring tool legally defensible? {#does-a-bias-audit-make-ai-hiring-defensible}

**Short answer.** No, an audit alone does not answer the Title VII question; employers still need records showing impact, validity, job relatedness, business necessity, and monitoring.

The federal baseline is still Title VII plus the Uniform Guidelines on Employee Selection Procedures. Title VII asks whether an employer used a particular employment practice that causes a disparate impact and, if so, whether that practice is job related for the position in question and consistent with business necessity. UGESP makes the mechanics more concrete. It requires impact records by group, allows sampling only when it is appropriate and adequate in size, and treats the four-fifths (4/5ths) or eighty percent rule as a screening device rather than a full defense. That is still the core reason a defensible audit is bigger than a single fairness ratio. No direct authority surfaced in the source set requiring one universal p-value, confidence interval, bootstrap method, or minimum cell size across HR AI tools. [^42-u-s-c-2000e-2-k-1-a-i][^29-c-f-r-1607-4-b-2][^29-c-f-r-1607-15]

Once the statutes run out, the source set moves to standards rather than more law. NIST's AI RMF and SP 1270, ISO/IEC 42001, ISO/IEC 23894, ISO/IEC TR 24027, and the academic auditing literature all push toward lifecycle governance, representative data analysis, and post-deployment monitoring rather than one-number certification. They help explain why a vendor can honestly say audited without proving employment-law defensibility. They do not create a Title VII safe harbor. [^nist-ai-risk-management-framework][^nist-sp-1270-towards-a-standard-for-identifying][^iso-iec-42001-2023][^iso-iec-23894-2023][^iso-iec-tr-24027-2021][^manish-raghavan-pauline-t-kim-limitations-of-the][^inioluwa-deborah-raji-et-al-closing-the-ai-accou]

The employer bar is not especially split on the floor. Seyfarth says the four-fifths rule is a general rule of thumb, not a substitute for formal statistical analysis in every case. Mayer Brown lands in the same place from the Title VII side: a passing ratio is not dispositive, and vendor assurances do not settle the employer's liability question. That is a quiet but important consensus. The firms are not saying audits are useless. They are saying the legal question is still broader than the certificate. [^seyfarth-shaw-eeoc-issues-technical-assistance-g][^mayer-brown-eeoc-issues-title-vii-guidance-on-em]

## Does NYC require an independent bias audit for AI hiring tools? {#does-nyc-require-independent-ai-hiring-bias-audits}

**Short answer.** Yes, NYC is the clearest current U.S. rule because covered automated employment decision tools need a recent independent audit, public results, and notice before use.

New York City's AEDT law is the clearest positive-law answer because it actually requires something called a bias audit. DCWP states that an AEDT cannot be used unless it "has been subject to a bias audit within one year of the use"[^new-york-city-department-of-consumer-and-worker-2], the summary results are publicly available, and notice is given before use. But the regime is narrower than its reputation. It is built around race, ethnicity, and sex impact ratios plus public disclosure. The source set did not surface a statutory power rule, a confidence-interval requirement, or an ADA or ADEA analogue inside Local Law 144 itself. A tool can therefore be NYC-compliant and still leave important employment-law questions open. [^new-york-city-department-of-consumer-and-worker-2][^rules-of-the-city-of-new-york-automated-employme]

DLA Piper adds a different concern. Its January 30, 2026 note on a critical public audit of NYC enforcement reads less like a dispute about the statute and more like a warning that audit quality is becoming visible. Once public audit summaries, watchdog reports, and regulator scrutiny enter the picture, a thin annual deliverable can start to look worse than no grand claims at all. Perhaps that is the most practical recent development in this area: the market is no longer debating only whether an audit exists, but whether the audit says anything useful. [^dla-piper-critical-audit-of-nyc-s-ai-hiring-law][^dla-piper-us-new-york-city-set-to-enforce-ai-law]

- 

## Do Colorado and the EU require AI hiring bias audits? {#do-colorado-and-eu-require-ai-hiring-bias-audits}

**Short answer.** No, not in the same way as NYC; Colorado and the EU emphasize risk management, impact assessment, documentation, notices, monitoring, and human review.

Colorado's AI Act is broader, but structurally different. The law now takes effect on June 30, 2026 after a 2025 delay. It asks developers and deployers of high-risk AI systems to use reasonable care to protect consumers from known or reasonably foreseeable risks of algorithmic discrimination, and for deployers it builds a package of risk-management policy, impact assessment, annual review, notice, appeal with human review if technically feasible, and a public website statement summarizing deployed high-risk systems and how risks are managed. That is not the same thing as a NYC-style third-party statistical bias audit. In the source set, no Colorado authority required a particular fairness metric, minimum sample size, or outside auditor for that impact-assessment layer. [^colorado-general-assembly-sb24-205-consumer-prot][^colorado-general-assembly-sb25b-004-increase-tra-2][^colorado-session-laws-chapter-4078]

The EU AI Act is more prescriptive on governance and less prescriptive on audit form. Employment and worker-management systems sit in Annex III high-risk territory. The Act requires risk management, data governance using representative and statistically appropriate data, testing against "prior defined metrics and probabilistic thresholds"[^regulation-eu-2024-1689-2], technical documentation, logging, human oversight, and post-market monitoring. For most Annex III employment systems, conformity assessment runs through internal control under Article 43(2), not a mandatory outside auditor. The high-risk obligations relevant here are enacted, but the general application date for that layer is August 2, 2026. So the EU model looks less like NYC's annual public audit and more like a documented management system with lifecycle evidence. [^regulation-eu-2024-1689-2]

Littler's Colorado framing is also useful because it resists calling the statute a hiring bias-audit law. Its point is that Colorado creates a broader deployer-side documentation and review burden for consequential decision systems. Fisher Phillips makes a parallel point from another angle: the first serious question is still methodology. Was the tool tested by four-fifths ratio, statistical significance, or something else? In other words, the firms keep asking what math and what documentation sit behind the audit label, not just whether the label exists. [^littler-colorado-s-landmark-ai-legislation-would][^littler-what-does-the-2025-artificial-intelligen][^fisher-phillips-eeoc-s-latest-ai-guidance-sends]

## What should employers ask AI hiring vendors about bias audits? {#what-should-employers-ask-ai-hiring-vendors-about-audits}

**Short answer.** Employers should ask what the audit actually measured, who performed it, whether results were public or internal, and what monitoring happens after deployment.

The non-obvious consequence is that bias audit is now an overloaded procurement term. In the current market it can mean an NYC public-ratio audit, an industrial-organizational validation project, or an AI-governance documentation workflow. HireVue's use of DCI Consulting Group illustrates the first lineage. FairNow, Holistic AI, and Warden illustrate the second. The public materials in the source set are clearer on cadence, independence, publication, and workflow than on cell sizes, missing demographic labels, or drift handling. That does not make them empty. It means the market has optimized around legally legible artifacts. [^hirevue-hirevue-leads-industry-in-fair-and-ethic][^fairnow-nyc-local-law-144-ai-hiring-compliance-g][^holistic-ai-nyc-bias-audit-solution][^warden-navigating-the-nyc-bias-audit-law-for-hr][^dci-consulting-nyc-local-law-144-choose-your-aud]

This follows directly from the law. New York City created the first recurring public deliverable, so vendors built products around annual audits and posting. Colorado and the EU reward impact-assessment records, public summaries, technical documentation, and monitoring. Federal employment law still asks the older question: what was measured, on whom, with what impact, and why keep using it after adverse impact appears. Companies buying an audit are therefore often buying one layer of the answer, not the whole answer. [^new-york-city-department-of-consumer-and-worker-3][^colorado-general-assembly-sb24-205-consumer-prot-2][^regulation-eu-2024-1689-3][^29-c-f-r-1607-4-b-3]

Third-party independence is likewise regime-specific. NYC clearly requires an independent auditor. Colorado and the EU do not copy that rule, and internal teams may actually see more of the model, the data pipeline, and the post-deployment drift than an outside reviewer can. That leaves the market in an understandable but awkward place: outside review carries credibility, while internal review often carries access. A defensible record increasingly looks like both rather than either. [^new-york-city-department-of-consumer-and-worker-3][^colorado-general-assembly-sb24-205-consumer-prot-2][^regulation-eu-2024-1689-3][^inioluwa-deborah-raji-et-al-closing-the-ai-accou-2]

- 

## What statistical methods matter for small AI hiring bias audits? {#what-statistics-matter-for-ai-hiring-bias-audits}

**Short answer.** Unclear, because no source in this set imposes one universal p-value, confidence interval, bootstrap protocol, or minimum cell size for HR AI audits.

Small and segmented hiring funnels are where this gap is sharpest. UGESP insists on measurement and says sampling must be adequate, but the statutes and standards in the source set do not supply one universal power threshold or minimum cell size for HR AI audits. So thin applicant volumes can produce results that are formally reportable but substantively weak. Perhaps the practical divide is not compliant versus non-compliant. It is legible versus persuasive. [^29-c-f-r-1607-4-b-4][^manish-raghavan-pauline-t-kim-limitations-of-the-2][^nist-sp-1270-towards-a-standard-for-identifying-2]

- What statistical method counts as enough? No direct authority surfaced in the source set for a universally required p-value, confidence interval, Bayesian threshold, or bootstrap protocol. That leaves room for justified tailoring, and also room for weak bespoke science marketed as sophistication. [^29-c-f-r-1607-4-b-4][^regulation-eu-2024-1689-4][^nist-ai-risk-management-framework-2][^manish-raghavan-pauline-t-kim-limitations-of-the-2]
- How should audits treat self-selection and historical-data bias? The methodology sources are fairly clear that hiring data often reflect earlier recruiting filters and social skews. A clean output ratio on that data may therefore understate how much the model is reproducing older exclusions. [^nist-sp-1270-towards-a-standard-for-identifying-2][^inioluwa-deborah-raji-et-al-closing-the-ai-accou-3]
- How transparent can methodology become before trade-secret concerns stop it? The EU AI Act expressly preserves intellectual property, confidential business information, and trade secrets. Perhaps the likely outcome is that some of the most important audit evidence stays nonpublic unless discovery or regulator access pulls it into view. [^regulation-eu-2024-1689-4]



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-20. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^new-york-city-department-of-consumer-and-worker]: **New York City Department of Consumer and Worker Protection, Automated Employm...** — "has been subject to a bias audit within one year of the use" *New York City Department of Consumer and Worker Protection, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^29-c-f-r-1607-4-b]: **29 C.F.R. § 1607.4(B)** — "The records called for by this section are to be maintained by sex, and the following races and ethnic groups: Blacks (Negroes), American Indians (including Alaskan Natives), Asians (including Pacific Islanders), Hispanic" *29 C.F.R. § 1607.4(B).* <https://www.ecfr.gov/current/title-29/part-1607/section-1607.4>

[^colorado-general-assembly-sb25b-004-increase-tra]: **Colorado General Assembly, SB25B-004 Increase Transparency for Algorithmic Sy...** — "The act extends the effective date of the requirements of Senate Bill 24-205 to June 30, 2026." *Colorado General Assembly, SB25B-004 Increase Transparency for Algorithmic Systems.* <https://leg.colorado.gov/bills/sb25b-004>

[^regulation-eu-2024-1689]: **Regulation (EU) 2024/1689** — "prior defined metrics and probabilistic thresholds" *Regulation (EU) 2024/1689.* <https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng>

[^42-u-s-c-2000e-2-k-1-a-i]: **42 U.S.C. § 2000e-2(k)(1)(A)(i)** — "an unlawful employment practice is established when the complaining party demonstrates that race, color, religion, sex, or national origin was a motivating factor for any employment practice, even though other factors also motivated the practice." *42 U.S.C. § 2000e-2(k)(1)(A)(i).* <https://www.law.cornell.edu/uscode/text/42/2000e-2#:~:text=an%20unlawful%20employment%20practice%20is,factors%20also%20motivated%20the%20practice.>

[^29-c-f-r-1607-4-b-2]: **29 C.F.R. § 1607.4(B)** — "The records called for by this section are to be maintained by sex, and the following races and ethnic groups: Blacks (Negroes), American Indians (including Alaskan Natives), Asians (including Pacific Islanders), Hispanic" *29 C.F.R. § 1607.4(B).* <https://www.ecfr.gov/current/title-29/part-1607/section-1607.4>

[^29-c-f-r-1607-15]: **29 C.F.R. § 1607.15** — "Users of selection procedures other than those users complying with section 15A(1) below should maintain and have available for each job information on adverse impact of the selection process for that job and, where it is determined a selection process has an adverse impact, evidence of validity as set forth below." *29 C.F.R. § 1607.15.* <https://www.govinfo.gov/link/cfr/29/1607?link-type=pdf&sectionnum=15&year=mostrecent>

[^nist-ai-risk-management-framework]: **NIST AI Risk Management Framework** — "The NIST AI Risk Management Framework (AI RMF) is intended for voluntary use and to improve the ability to incorporate trustworthiness considerations into the design, development, use, and evaluation of AI products, services, and systems." *NIST AI Risk Management Framework.* <https://www.nist.gov/itl/ai-risk-management-framework>

[^nist-sp-1270-towards-a-standard-for-identifying]: **NIST SP 1270, Towards a Standard for Identifying and Managing Bias in Artific...** — "Systemic biases result from procedures and practices of particular institutions that operate in ways which result in certain social groups being advantaged or favored and others being disadvantaged or devalued." *NIST SP 1270, Towards a Standard for Identifying and Managing Bias in Artificial Intelligence.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1270.pdf>

[^iso-iec-42001-2023]: **ISO/IEC 42001:2023** — "ISO/IEC 42001 is an international standard that specifies requirements for establishing, implementing, maintaining, and continually improving an Artificial Intelligence Management System (AIMS) within organizations." *ISO/IEC 42001:2023.* <https://www.iso.org/standard/42001>

[^iso-iec-23894-2023]: **ISO/IEC 23894:2023** — "This document provides guidance on how organizations that develop, produce, deploy or use products, systems and services that utilize artificial intelligence (AI) can manage risk specifically related to AI." *ISO/IEC 23894:2023.* <https://www.iso.org/standard/77304.html>

[^iso-iec-tr-24027-2021]: **ISO/IEC TR 24027:2021** — "This document addresses bias in relation to AI systems, especially with regards to AI-aided decision-making." *ISO/IEC TR 24027:2021.* <https://www.iso.org/standard/77607.html>

[^manish-raghavan-pauline-t-kim-limitations-of-the]: **Manish Raghavan & Pauline T. Kim, Limitations of the 'Four-Fifths Rule' and Statistical Parity Tests for Measuring Fairness** — "The four-fifths ratio was never intended to be a rule of law, but rather a ‘rule of thumb.’" *Manish Raghavan & Pauline T. Kim, Limitations of the 'Four-Fifths Rule' and Statistical Parity Tests for Measuring Fairness.* <https://georgetownlawtechreview.org/wp-content/uploads/2024/01/Raghavan_Kim_Final-Proof.pdf>

[^inioluwa-deborah-raji-et-al-closing-the-ai-accou]: **Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing** — "In this paper, we introduce a framework for algorithmic auditing that supports artificial intelligence system development end-to-end, to be applied throughout the internal organization development lifecycle." *Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing.* <https://arxiv.org/abs/2001.00973>

[^seyfarth-shaw-eeoc-issues-technical-assistance-g]: **Seyfarth Shaw commentary** — "The EEOC did not unveil new policies in the TA but reiterated that its long existing policies and practices continue to apply to the technologies (such as artificial intelligence and machine learning tools) that are grabbing the public’s attention today." *Seyfarth Shaw, EEOC Issues Technical Assistance Guidance On The Use Of Advanced Technology Tools, Including Artificial Intelligence, To Make Employment Decisions.* <https://www.seyfarth.com/news-insights/eeoc-issues-technical-assistance-guidance-on-the-use-of-advanced-technology-tools-including-artificial-intelligence.html>

[^mayer-brown-eeoc-issues-title-vii-guidance-on-em]: **Mayer Brown commentary** — "The EEOC’s AI Disparate Impact Guidance makes clear that the EEOC treats employer use of algorithmic decision-making tools as an employment ‘selection procedure’ under Title VII." *Mayer Brown, EEOC Issues Title VII Guidance on Employer Use of AI and Other Algorithmic Decisionmaking Tools.* <https://www.mayerbrown.com/en/insights/publications/2023/07/eeoc-issues-title-vii-guidance-on-employer-use-of-ai-other-algorithmic-decisionmaking-tools>

[^new-york-city-department-of-consumer-and-worker-2]: **New York City Department of Consumer and Worker Protection, Automated Employm...** — "has been subject to a bias audit within one year of the use" *New York City Department of Consumer and Worker Protection, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^rules-of-the-city-of-new-york-automated-employme]: **Rules of the City of New York, Automated Employment Decision Tools rule** — "The proposed rules would clarify the requirements for the use of automated employment decision tools within New York City, the notices to employees and candidates for employment regarding the use of the tool, the bias audit for the tool, and the required published results of the bias audit." *Rules of the City of New York, Automated Employment Decision Tools rule.* <https://rules.cityofnewyork.us/rule/automated-employment-decision-tools/>

[^dla-piper-critical-audit-of-nyc-s-ai-hiring-law]: **DLA Piper commentary** — "The New York State Comptroller’s December 2025 audit evaluated the New York City Department of Consumer and Worker Protection’s (DCWP) enforcement of Local Law 144, which regulates the use of automated employment decision tools (AEDTs) in hiring and promotion." *DLA Piper, Critical audit of NYC's AI hiring law signals increased risk for employers.* <https://www.dlapiper.com/insights/publications/2026/01/critical-audit-of-nyc-ai-hiring-law-signals-increased-risk-for-employers>

[^dla-piper-us-new-york-city-set-to-enforce-ai-law]: **DLA Piper, US: New York City set to enforce AI law** — "Local Law 144 of 2021, which took effect on 1 January 2023, regulates employers’ use of automated employment decision tools (AEDTs) in making hiring and promotion decisions." *DLA Piper, US: New York City set to enforce AI law.* <https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/us-new-york-city-set-to-enforce-ai-law>

[^colorado-general-assembly-sb24-205-consumer-prot]: **Colorado General Assembly, SB24-205 Consumer Protections for Artificial Intel...** — "On and after February 1, 2026, the act requires a developer of a high-risk artificial intelligence system (high-risk system) to use reasonable care to protect consumers from any known or reasonably foreseeable risks of algorithmic discrimination" *Colorado General Assembly, SB24-205 Consumer Protections for Artificial Intelligence.* <https://leg.colorado.gov/bills/sb24-205>

[^colorado-general-assembly-sb25b-004-increase-tra-2]: **Colorado General Assembly, SB25B-004 Increase Transparency for Algorithmic Sy...** — "The act extends the effective date of the requirements of Senate Bill 24-205 to June 30, 2026." *Colorado General Assembly, SB25B-004 Increase Transparency for Algorithmic Systems.* <https://leg.colorado.gov/bills/sb25b-004>

[^colorado-session-laws-chapter-4078]: **Colorado Session Laws, Chapter 4078** — "ON AND AFTER FEBRUARY 1, 2026, A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION" *Colorado Session Laws, Chapter 4078.* <https://leg.colorado.gov/bill_files/47770/download>

[^regulation-eu-2024-1689-2]: **Regulation (EU) 2024/1689** — "prior defined metrics and probabilistic thresholds" *Regulation (EU) 2024/1689.* <https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng>

[^littler-colorado-s-landmark-ai-legislation-would]: **Littler commentary** — "Colorado Senate Bill 24-205 (‘SB205’), landmark legislation that expressly creates statutory tort liability for AI algorithmic discrimination in the employment context, has passed both houses of the Colorado General Assembly" *Littler, Colorado's Landmark AI Legislation Would Create Significant Compliance Burden for Employers Using AI Tools.* <https://www.littler.com/news-analysis/asap/colorados-landmark-ai-legislation-would-create-significant-compliance-burden>

[^littler-what-does-the-2025-artificial-intelligen]: **Littler, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like** — "In the absence of federal regulation, several states have either passed or are considering legislation aimed at mitigating the risk of an employer’s use of an AI system resulting in algorithmic discrimination." *Littler, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like.* <https://www.littler.com/news-analysis/asap/what-does-2025-artificial-intelligence-legislative-and-regulatory-landscape-look>

[^fisher-phillips-eeoc-s-latest-ai-guidance-sends]: **Fisher Phillips commentary** — "an improper application of AI could violate Title VII, the federal anti-discrimination law, when used for recruitment, hiring, retention, promotion, transfer, performance monitoring, demotion, or dismissal." *Fisher Phillips, EEOC's Latest AI Guidance Sends Warning to Employers.* <https://www.fisherphillips.com/en/insights/insights/eeocs-latest-ai-guidance-sends-warning>

[^hirevue-hirevue-leads-industry-in-fair-and-ethic]: **HireVue, HireVue leads industry in fair and ethical hiring practice, engaging external auditor DCI Consulting Group for external bias audit of algorithms** — "Competency-based and game-based algorithms will be audited for bias with respect to race, gender and the intersectional combination of race and gender across multiple job levels and use cases." *HireVue, HireVue leads industry in fair and ethical hiring practice, engaging external auditor DCI Consulting Group for external bias audit of algorithms.* <https://www.hirevue.com/press-release/hirevue-leads-industry-in-fair-and-ethical-hiring-practice-engaging-external-auditor-dci-consulting-group-for-external-bias-audit-of-algorithms>

[^fairnow-nyc-local-law-144-ai-hiring-compliance-g]: **FairNow, NYC Local Law 144: AI Hiring Compliance Guide** — "We provide a unified platform to centralize ISO 42001, NIST AI RMF, and EU AI Act requirements, reducing the administrative burden of staying compliant." *FairNow, NYC Local Law 144: AI Hiring Compliance Guide.* <https://fairnow.ai/guide/nyc-local-law-144/>

[^holistic-ai-nyc-bias-audit-solution]: **Holistic AI, NYC Bias Audit Solution** — "Local Law 144 requires the audit to be independent. Many organizations engage a third-party auditor to demonstrate independence." *Holistic AI, NYC Bias Audit Solution.* <https://www.holisticai.com/nyc-bias-audit>

[^warden-navigating-the-nyc-bias-audit-law-for-hr]: **Warden, Navigating the NYC Bias Audit Law for HR Tech Platforms** — "NYC LL144 creates mandatory compliance obligations for HR tech vendors and their enterprise clients alike." *Warden, Navigating the NYC Bias Audit Law for HR Tech Platforms.* <https://www.warden-ai.com/resources/navigating-the-nyc-bias-audit-law-for-hr-tech-platforms>

[^dci-consulting-nyc-local-law-144-choose-your-aud]: **DCI Consulting, NYC Local Law 144: Choose Your Auditor Wisely** — "Per NYC LL-144, independent auditors may not have: 1) been involved developing the AEDT, 2) been employed by the organization or vendor, or 3) a financial interest in the organization or vendor." *DCI Consulting, NYC Local Law 144: Choose Your Auditor Wisely.* <https://blog.dciconsult.com/nyc-ll-144-auditor>

[^new-york-city-department-of-consumer-and-worker-3]: **New York City Department of Consumer and Worker Protection, Automated Employm...** — "has been subject to a bias audit within one year of the use" *New York City Department of Consumer and Worker Protection, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^colorado-general-assembly-sb24-205-consumer-prot-2]: **Colorado General Assembly, SB24-205 Consumer Protections for Artificial Intel...** — "On and after February 1, 2026, the act requires a developer of a high-risk artificial intelligence system (high-risk system) to use reasonable care to protect consumers from any known or reasonably foreseeable risks of algorithmic discrimination" *Colorado General Assembly, SB24-205 Consumer Protections for Artificial Intelligence.* <https://leg.colorado.gov/bills/sb24-205>

[^regulation-eu-2024-1689-3]: **Regulation (EU) 2024/1689** — "prior defined metrics and probabilistic thresholds" *Regulation (EU) 2024/1689.* <https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng>

[^29-c-f-r-1607-4-b-3]: **29 C.F.R. § 1607.4(B)** — "The records called for by this section are to be maintained by sex, and the following races and ethnic groups: Blacks (Negroes), American Indians (including Alaskan Natives), Asians (including Pacific Islanders), Hispanic" *29 C.F.R. § 1607.4(B).* <https://www.ecfr.gov/current/title-29/part-1607/section-1607.4>

[^inioluwa-deborah-raji-et-al-closing-the-ai-accou-2]: **Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing** — "In this paper, we introduce a framework for algorithmic auditing that supports artificial intelligence system development end-to-end, to be applied throughout the internal organization development lifecycle." *Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing.* <https://arxiv.org/abs/2001.00973>

[^29-c-f-r-1607-4-b-4]: **29 C.F.R. § 1607.4(B)** — "The records called for by this section are to be maintained by sex, and the following races and ethnic groups: Blacks (Negroes), American Indians (including Alaskan Natives), Asians (including Pacific Islanders), Hispanic" *29 C.F.R. § 1607.4(B).* <https://www.ecfr.gov/current/title-29/part-1607/section-1607.4>

[^manish-raghavan-pauline-t-kim-limitations-of-the-2]: **Manish Raghavan & Pauline T. Kim, Limitations of the 'Four-Fifths Rule' and Statistical Parity Tests for Measuring Fairness** — "The four-fifths ratio was never intended to be a rule of law, but rather a ‘rule of thumb.’" *Manish Raghavan & Pauline T. Kim, Limitations of the 'Four-Fifths Rule' and Statistical Parity Tests for Measuring Fairness.* <https://georgetownlawtechreview.org/wp-content/uploads/2024/01/Raghavan_Kim_Final-Proof.pdf>

[^nist-sp-1270-towards-a-standard-for-identifying-2]: **NIST SP 1270, Towards a Standard for Identifying and Managing Bias in Artific...** — "Systemic biases result from procedures and practices of particular institutions that operate in ways which result in certain social groups being advantaged or favored and others being disadvantaged or devalued." *NIST SP 1270, Towards a Standard for Identifying and Managing Bias in Artificial Intelligence.* <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.1270.pdf>

[^regulation-eu-2024-1689-4]: **Regulation (EU) 2024/1689** — "prior defined metrics and probabilistic thresholds" *Regulation (EU) 2024/1689.* <https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng>

[^nist-ai-risk-management-framework-2]: **NIST AI Risk Management Framework** — "The NIST AI Risk Management Framework (AI RMF) is intended for voluntary use and to improve the ability to incorporate trustworthiness considerations into the design, development, use, and evaluation of AI products, services, and systems." *NIST AI Risk Management Framework.* <https://www.nist.gov/itl/ai-risk-management-framework>

[^inioluwa-deborah-raji-et-al-closing-the-ai-accou-3]: **Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing** — "In this paper, we introduce a framework for algorithmic auditing that supports artificial intelligence system development end-to-end, to be applied throughout the internal organization development lifecycle." *Inioluwa Deborah Raji et al., Closing the AI Accountability Gap: Defining an End-to-End Framework for Internal Algorithmic Auditing.* <https://arxiv.org/abs/2001.00973>
