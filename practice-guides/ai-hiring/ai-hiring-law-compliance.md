---
type: Practice Guide
title: 'AI hiring law compliance across NYC, Illinois, and Colorado'
description: >-
  AI hiring law compliance across NYC, Illinois, Colorado, and California,
  including audits, notices, human review, vendors, and EEOC risk.
resource: 'https://openagreements.org/practice-guides/ai-hiring/ai-hiring-law-compliance'
timestamp: '2026-04-19'
tags:
  - ai-hiring
  - ai-hiring-law-compliance
---

# AI hiring law compliance across NYC, Illinois, and Colorado[^about]

AI hiring law compliance across NYC, Illinois, Colorado, and California, including audits, notices, human review, vendors, and EEOC risk.

## Which AI hiring laws apply across NYC, Illinois, Colorado, and California? {#ai-hiring-laws-nyc-illinois-colorado}

**Short answer.** It depends: NYC, Illinois, and Colorado use different triggers, so map the tool, job location, applicant location, and workflow stage before assuming one rule controls.

AI hiring law is not one compliance problem anymore. It is three different kinds of law landing on different parts of the workflow. New York City regulates the tool: a covered `AEDT` used in city hiring or promotion needs a recent bias audit, public posting, advance notice, and an accommodation path. [^new-york-city-administrative-code-20-871][^new-york-city-administrative-code-20-870][^nyc-department-of-consumer-and-worker-protection] Illinois splits the issue in two: the Video Interview Act covers AI analysis of recorded interviews for Illinois-based jobs, while the Illinois Human Rights Act now separately treats discriminatory AI use and nondisclosure in employment decisions as civil-rights problems. [^820-ilcs-42-5][^820-ilcs-42-artificial-intelligence-video-interv][^775-ilcs-5-2-102-l] Colorado is broader and more systemic: if a `high-risk AI system` is a substantial factor in an employment decision about a Colorado resident, the law moves toward risk management, impact assessments, notice, explanation, correction, appeal, and Attorney General oversight. [^colorado-sb24-205][^colorado-sb25b-004] Maryland, California, and Texas matter too, but mostly as narrower overlays rather than substitutes for those three core regimes. [^maryland-labor-and-employment-3-717][^california-civil-rights-council-rulemaking-actio]

The shortest way to map the statutes is by the coverage hook. NYC looks first to the hiring decision `within the city`. Illinois AIVIA looks to `positions based in Illinois`. Illinois IHRA looks to employment decisions covered by Illinois civil-rights law. Colorado looks to a `Colorado resident` subjected to a consequential employment decision by a deployer doing business in the state. [^new-york-city-administrative-code-20-871][^820-ilcs-42-5][^775-ilcs-5-2-102-l][^colorado-sb24-205]

| Regime | Coverage hook | Main obligations | Enforcement shape |
| --- | --- | --- | --- |
| NYC Local Law 144 + DCWP rules | `AEDT` used to screen a candidate or employee for an employment decision within the city | Annual bias audit, public summary results, 10-business-day notice, disclosure of assessed qualifications and data/retention information on request, alternative selection process or accommodation path | DCWP civil penalties; enforcement began July 5, 2023 |
| Illinois Artificial Intelligence Video Interview Act | AI analysis of applicant-submitted video interviews for positions based in Illinois | Pre-interview notice, explanation of how AI works and general characteristics evaluated, consent, deletion on request within 30 days, demographic reporting if AI alone decides who gets an in-person interview | Statutory duties under 820 ILCS 42; the source set does not surface a separate penalty schedule in the core sections |
| Illinois Human Rights Act AI amendment | AI used in recruitment, hiring, promotion, discipline, discharge, training selection, renewal, tenure, or terms and conditions of employment in Illinois | Prohibits AI use that has a discriminatory effect, bars zip code as proxy, and requires notice of AI use in covered employment decisions | Enforced through the Illinois Human Rights Act framework |
| Colorado AI Act | `High-risk AI system` that makes, or is a substantial factor in making, a consequential employment decision about a Colorado resident | Reasonable care, risk-management program, impact assessments, annual review, notice, adverse-decision explanation, correction rights, appeal with human review if technically feasible, website summary, record retention | Attorney General exclusive enforcement; no private right of action under Part 17; effective date moved to June 30, 2026 |

The operative text shows how different these laws are. NYC says "it shall be unlawful"[^new-york-city-administrative-code-20-871] to use an `AEDT` unless it has undergone a qualifying bias audit within the prior year. Illinois AIVIA speaks much more narrowly to AI analysis of video interviews for "positions based in Illinois"[^820-ilcs-42-5] and requires notice, explanation, and consent before the interview. The Illinois IHRA amendment then broadens the state rule by making it a civil-rights violation to use AI in a way that "has the effect of subjecting employees to discrimination"[^775-ilcs-5-2-102-l]. Colorado reaches systems that "make, or are a substantial factor in making, a consequential decision"[^colorado-sb24-205] and defines `consumer` as a Colorado resident. [^new-york-city-administrative-code-20-871][^820-ilcs-42-5][^775-ilcs-5-2-102-l][^colorado-sb24-205]

The other enacted rules matter, but they do different work. Maryland is a biometric consent rule: facial-recognition interview tools require a signed waiver first. [^maryland-labor-and-employment-3-717] California's employment `ADS` rules are now effective and clarify that automated systems sit inside existing FEHA discrimination doctrine rather than outside it. [^california-civil-rights-council-rulemaking-actio][^california-civil-rights-department-final-text-of] Texas enacted a general AI law, but the source set reads its hiring relevance as narrower because the statute excludes individuals acting in an employment context from the definition of `consumer` and its discrimination provision turns on intent rather than ordinary disparate-impact framing. No comparable enacted AI-hiring statute surfaced in the source set for Connecticut or Tennessee as of April 17, 2026. [^connecticut-sb-435-committee-materials][^tennessee-sb-2171-calendar-materials]

The broad agreement is that multistate hiring is now a mapping problem, not a single-rule problem. Jackson Lewis describes the state environment as a patchwork that will keep creating compliance difficulty for multistate employers, while its separate 2026 piece says selecting, auditing, and validating employment decision tools will be harder this year. [^jackson-lewis-the-year-ahead-2026-powering-throu][^jackson-lewis-the-year-ahead-2026-enhancing-data] Littler says much the same in substance, treating Colorado, Illinois, New York, and California as different obligation sets rather than versions of one AI law. [^littler-mendelson-what-does-the-2025-artificial][^littler-mendelson-new-year-new-employment-laws-w][^littler-mendelson-california-approves-landmark-a]

## Does NYC AI hiring law cover remote roles or NYC applicants? {#nyc-ai-hiring-remote-roles}

**Short answer.** Usually yes, if the AI hiring workflow touches an NYC employment decision or NYC candidate in a way covered by Local Law 144, but hybrid arrangements remain fact-bound.

Fisher Phillips is the clearest on the practical reach of remote work. Its warning that a company using AI in hiring in New York City, even remotely, may be covered is not itself primary authority, but it captures the operational reality the statutes create when job location, applicant residence, and employer operations do not line up neatly. [^fisher-phillips-a-current-overview-of-ai-regulat]

The non-obvious consequence is that the unit of analysis is no longer just the employer or the state. It is the combination of tool, workflow stage, job location, and applicant location. A remote hiring funnel can therefore accumulate more than one regime at once. An `AEDT` tied to an NYC role, an Illinois-based position analyzed through recorded video, and a Colorado resident applicant can pull three different rule sets into the same process for three different reasons. [^new-york-city-administrative-code-20-871-2][^820-ilcs-42-5-2][^colorado-sb24-205-2]

The statute is anchored to employment decisions within the city, but its notice language separately refers to candidates and employees who reside in the city. Perhaps the cleanest reading is that NYC role location and NYC residence do different legal work, but the text does not resolve every hybrid arrangement. [^new-york-city-administrative-code-20-871-2][^fisher-phillips-a-current-overview-of-ai-regulat]

## Do Illinois AI hiring laws reach more than recorded video interviews? {#illinois-ai-hiring-beyond-video-interviews}

**Short answer.** Yes, Illinois now has a broader AI employment layer on top of its video-interview law, so recorded interviews are not the only trigger.

Illinois is where the law-firm commentary has changed most visibly. Older summaries could still treat Illinois as mainly a video-interview state. Newer commentary from Morgan Lewis, Littler, and Ogletree does not. It treats the January 1, 2026 IHRA amendment as the larger development because it moves Illinois from a narrow interview statute to a broader anti-discrimination and notice regime across the employment lifecycle. [^morgan-lewis-illinois-passes-new-law-to-address][^littler-mendelson-new-year-new-employment-laws-w-2][^ogletree-deakins-illinois-unveils-draft-notice-r]

Public practice already reflects that shift. NYC has normalized public bias-audit pages because the law requires them. Illinois is beginning to normalize broad AI-use notices rather than video-interview-only notices; the source set includes both University of Illinois guidance distinguishing the two Illinois layers and a public Illinois AI notice from Pilot Travel Centers that extends beyond recorded interviews. [^university-of-illinois-system-hr-ai-guidelines-f][^pilot-travel-centers-llc-illinois-notice-of-ai-u][^new-york-city-administrative-code-20-871-3]

## Can employers rely on AI hiring vendor audits or developer assessments? {#ai-hiring-vendor-audits}

**Short answer.** Only partly, because vendor work may support compliance but does not eliminate employer-side duties for audits, notices, explanations, correction paths, appeals, and recordkeeping.

The more interesting split is over how far vendor work travels. NYC points toward less portability. Hogan Lovells and the city materials treat the law as turning on a qualifying bias audit, public posting, and candidate notice for the employer's actual use of the tool, not just the vendor's general assurances. [^hogan-lovells-to-fight-bias-first-of-its-kind-ne][^nyc-department-of-consumer-and-worker-protection-2] Colorado points in a different direction. Morgan Lewis and Littler both read the Colorado law as placing core duties on the deployer, but the statute still leaves more room than NYC for a smaller employer to rely on a substantially similar developer impact assessment when the statutory conditions are met. [^morgan-lewis-ai-in-the-workplace-the-new-legal-l][^littler-mendelson-what-does-the-2025-artificial-2][^colorado-sb24-205-3]

The second consequence is that procurement does not transfer the problem. NYC still ties legality to an annual bias audit and public posting. Colorado still imposes deployer-side notice, explanation, correction, appeal, and recordkeeping obligations. Illinois still turns on what the employer tells the applicant or employee about AI use. Buying a compliant vendor helps, but it does not collapse the employer-side layer. [^nyc-department-of-consumer-and-worker-protection-2][^colorado-sb24-205-3][^ogletree-deakins-illinois-unveils-draft-notice-r-2]

NYC points toward less portability because of its independent-auditor and public-posting structure. Colorado points toward more portability, but only up to a point, because the deployer still owns the deployment context, candidate notice, adverse-decision explanation, correction path, and appeal workflow. [^new-york-city-administrative-code-20-871-4][^colorado-sb24-205-3][^morgan-lewis-ai-in-the-workplace-the-new-legal-l]

## Does human review keep an AI hiring tool outside the statutes? {#human-review-ai-hiring-tool}

**Short answer.** Usually not by itself, because NYC and Colorado can still cover tools that materially assist or substantially influence a hiring decision.

The third consequence is that `assistive` does not necessarily mean `out of scope`. NYC regulates tools that `substantially assist` discretionary decision-making. Colorado reaches systems that are a `substantial factor` in a consequential decision. That leaves some room for purely administrative tools such as calculators, databases, and scheduling systems to stay outside the statutes, but less room than product marketing language often implies for ranking, classification, scoring, or recommendation layers that materially shape who advances. [^new-york-city-administrative-code-20-870-2][^colorado-sb24-205-4]

Employers often argue that a human decision-maker breaks the chain. The statutes suggest otherwise when the system still `substantially assists` or is a `substantial factor` in the result. The line between administrative support and meaningful influence is still fact-bound. [^new-york-city-administrative-code-20-870-2][^colorado-sb24-205-4]

## Does EEOC enforcement still matter for AI hiring tools? {#eeoc-ai-hiring-enforcement}

**Short answer.** Yes, because EEOC enforcement can still reach AI hiring through existing disability and discrimination law even without a separate federal AI hiring statute.

There is still no federal AI hiring statute in the source set. The federal overlay comes from existing discrimination law. The EEOC materials that remain current in the research corpus still frame AI through the ADA and through the agency's broader enforcement plan, which explicitly recognizes AI and machine learning in recruiting and hiring. [^eeoc-artificial-intelligence-and-the-ada][^eeoc-strategic-enforcement-plan-fiscal-years-202]

Federal law still sits beside all of this rather than underneath it. The source set does not show a separate federal AI hiring statute. It does show continuing EEOC attention to AI under the ADA and under the agency's strategic enforcement priorities. So a company can satisfy a local notice or audit rule and still face the older questions about disparate impact, accessibility, and accommodation. [^eeoc-artificial-intelligence-and-the-ada][^eeoc-strategic-enforcement-plan-fiscal-years-202]

The source set still contains official EEOC materials tying AI to existing discrimination and disability law. It also suggests some earlier AI-specific materials were removed or reorganized. Perhaps the practical point is that plaintiffs and agencies do not need a dedicated federal AI statute to keep using Title VII and the ADA against the underlying employment practice. [^eeoc-artificial-intelligence-and-the-ada][^eeoc-strategic-enforcement-plan-fiscal-years-202]



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-19. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *AI hiring law compliance across NYC, Illinois, and Colorado*, OpenAgreements (last updated April 19, 2026), https://openagreements.org/practice-guides/ai-hiring/ai-hiring-law-compliance.

[^new-york-city-administrative-code-20-871]: **New York City Administrative Code § 20-871** — "it shall be unlawful" *New York City Administrative Code § 20-871.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135843>

[^new-york-city-administrative-code-20-870]: **New York City Administrative Code § 20-870** — "The term âautomated employment decision toolâ means any computational process, derived from machine learning, statistical modeling, data analytics, or artificial intelligence, that issues simplified output, including a score, classification, or recommendation, that is used to substantially assist or replace discretionary decision making for making employment decisions that impact natural persons." *New York City Administrative Code § 20-870.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135839>

[^nyc-department-of-consumer-and-worker-protection]: **NYC Department of Consumer and Worker Protection, Automated Employment Decisi...** — "prohibits employers and employment agencies from using an automated employment decision tool unless the tool has been subject to a bias audit within one year of the use of the tool" *NYC Department of Consumer and Worker Protection, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^820-ilcs-42-5]: **820 ILCS 42/5** — "positions based in Illinois" *820 ILCS 42/5.* <https://www.ilga.gov/ftp/ILCS/Ch%200820/Act%200042/082000420K5.html>

[^820-ilcs-42-artificial-intelligence-video-interv]: **820 ILCS 42, Artificial Intelligence Video Interview Act** — "An employer that asks applicants to record video interviews and uses an artificial intelligence analysis of the applicant-submitted videos shall do all of the following when considering applicants for positions based in Illinois before asking applicants to submit video interviews" *820 ILCS 42, Artificial Intelligence Video Interview Act.* <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4015&ChapterID=68&Print=True>

[^775-ilcs-5-2-102-l]: **775 ILCS 5/2-102(L)** — "has the effect of subjecting employees to discrimination" *775 ILCS 5/2-102(L).* <https://ilga.gov/legislation/ilcs/documents/077500050K2-102.htm>

[^colorado-sb24-205]: **Colorado SB24-205** — "make, or are a substantial factor in making, a consequential decision" *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^colorado-sb25b-004]: **Colorado SB25B-004** — "The act extends the effective date of the requirements of Senate Bill 24-205 to June 30, 2026." *Colorado SB25B-004.* <https://leg.colorado.gov/bills/sb25b-004>

[^maryland-labor-and-employment-3-717]: **Maryland Labor and Employment § 3-717** — "An employer may not use a facial recognition service for the purpose of creating a facial template during an applicant’s interview for employment unless an applicant consents under subsection (c) of this section." *Maryland Labor and Employment § 3-717.* <https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&enactments=false&section=3-717>

[^california-civil-rights-council-rulemaking-actio]: **California Civil Rights Council Rulemaking Actions** — "The Council’s Employment Regulations Regarding Automated Decision Systems have been approved by the Office of Administrative Law and were filed with the Secretary of State on June 27, 2025." *California Civil Rights Council Rulemaking Actions.* <https://calcivilrights.ca.gov/civilrightscouncil/rulemaking-actions/>

[^california-civil-rights-department-final-text-of]: **California Civil Rights Department, Final Text of Proposed Employment Regulat...** — "An Automated-Decision System may be derived from and/or use artificial intelligence, machine-learning algorithms, statistics, and/or other data processing techniques." *California Civil Rights Department, Final Text of Proposed Employment Regulations Regarding Automated-Decision Systems.* <https://calcivilrights.ca.gov/wp-content/uploads/sites/32/2025/06/Final-Text-regulations-automated-employment-decision-systems.pdf>

[^connecticut-sb-435-committee-materials]: **Connecticut SB 435 committee materials** — "The reason for this bill is to provide workers with appropriate protections from Automated Decision Systems in cases where management-level decisions are being made with limited or no human review." *Connecticut SB 435 committee materials.* <https://www.cga.ct.gov/2026/JFR/S/PDF/2026SB-00435-R00LAB-JFR.PDF>

[^tennessee-sb-2171-calendar-materials]: **Tennessee SB 2171 calendar materials** — "A large frontier developer shall write, implement, comply with, and clearly and conspicuously publish on its internet website a public safety plan that describes in detail how the large frontier developer: (A) Defines and assesses thresholds used by the large frontier developer to identify and assess whether a frontier model has capabilities that could pose a catastrophic risk" *Tennessee SB 2171 calendar materials.* <https://www.capitol.tn.gov/Bills/114/Bill/SB2171.pdf>

[^jackson-lewis-the-year-ahead-2026-powering-throu]: **Jackson Lewis commentary** — "Enforcement risk in 2026 depends far more on states where an employer operates than on federal baseline rules as to labor and employment laws." *Jackson Lewis, The Year Ahead 2026: Powering Through the Patchwork.* <https://www.jacksonlewis.com/insights/year-ahead-2026-powering-through-patchwork>

[^jackson-lewis-the-year-ahead-2026-enhancing-data]: **Jackson Lewis commentary** — "Legal requirements surrounding pay equity are expected to continue expanding at the state and local levels." *Jackson Lewis, The Year Ahead 2026: Enhancing Data-Driven Decision-Making.* <https://www.jacksonlewis.com/insights/year-ahead-2026-enhancing-data-driven-decision-making>

[^littler-mendelson-what-does-the-2025-artificial]: **Littler Mendelson commentary** — "In the absence of federal regulation, several states have either passed or are considering legislation aimed at mitigating the risk of an employer’s use of an AI system resulting in algorithmic discrimination." *Littler Mendelson, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like for Employers?.* <https://www.littler.com/news-analysis/asap/what-does-2025-artificial-intelligence-legislative-and-regulatory-landscape-look>

[^littler-mendelson-new-year-new-employment-laws-w]: **Littler Mendelson commentary** — "This roundup of new laws provides a snapshot of generally applicable labor and employment laws taking effect in or around January 1, 2026." *Littler Mendelson, New Year, New Employment Laws – What Takes Effect January 1, 2026.* <https://www.littler.com/news-analysis/asap/new-year-new-employment-laws-what-takes-effect-january-1-2026>

[^littler-mendelson-california-approves-landmark-a]: **Littler Mendelson, California Approves Landmark AI Employment Regulations** — "Revisions to Title 2 of the California Code of Regulations will govern the use of AI-based tools in California starting October 1, 2025." *Littler Mendelson, California Approves Landmark AI Employment Regulations.* <https://www.littler.com/news-analysis/asap/california-approves-landmark-ai-employment-regulations>

[^fisher-phillips-a-current-overview-of-ai-regulat]: **Fisher Phillips, A Current Overview of AI Regulation Across the Country** — "NYC’s Local Law 144 – the first local AI law in the country that regulated the workplace – has been requiring employers using automated employment decision tools (AEDTs) to conduct annual bias audits and notify candidates and employees about their use since 2023." *Fisher Phillips, A Current Overview of AI Regulation Across the Country.* <https://www.fisherphillips.com/en/insights/insights/a-current-overview-of-ai-regulation-across-the-country>

[^new-york-city-administrative-code-20-871-2]: **New York City Administrative Code § 20-871** — "it shall be unlawful for an employer or an employment agency to use an automated employment decision tool to screen a candidate or employee for an employment decision unless:" *New York City Administrative Code § 20-871.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135843>

[^820-ilcs-42-5-2]: **820 ILCS 42/5** — "positions based in Illinois" *820 ILCS 42/5.* <https://www.ilga.gov/ftp/ILCS/Ch%200820/Act%200042/082000420K5.html>

[^colorado-sb24-205-2]: **Colorado SB24-205** — "make, or are a substantial factor in making, a consequential decision" *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^morgan-lewis-illinois-passes-new-law-to-address]: **Morgan Lewis commentary** — "The new law amends the Illinois Human Rights Act (the Act), making it a civil rights violation to (1) use AI that has the effect of subjecting employees to discrimination or to use zip codes as a proxy for protected classes, and (2) fail to notify employees of the employer’s use of AI." *Morgan Lewis, Illinois Passes New Law to Address AI in the Workplace.* <https://www.morganlewis.com/pubs/2024/09/illinois-passes-new-law-to-address-ai-in-the-workplace>

[^littler-mendelson-new-year-new-employment-laws-w-2]: **Littler Mendelson commentary** — "This roundup of new laws provides a snapshot of generally applicable labor and employment laws taking effect in or around January 1, 2026." *Littler Mendelson, New Year, New Employment Laws – What Takes Effect January 1, 2026.* <https://www.littler.com/news-analysis/asap/new-year-new-employment-laws-what-takes-effect-january-1-2026>

[^ogletree-deakins-illinois-unveils-draft-notice-r]: **Ogletree Deakins commentary** — "The draft rules would apply broadly to all employers under the Illinois antidiscrimination law and would necessitate notice whenever AI is involved in covered employment decisions, regardless of whether it leads to unlawful discrimination." *Ogletree Deakins, Illinois Unveils Draft Notice Rules on AI Use in Employment Ahead of Discrimination Ban.* <https://ogletree.com/insights-resources/blog-posts/illinois-unveils-draft-notice-rules-on-ai-use-in-employment-ahead-of-discrimination-ban/>

[^university-of-illinois-system-hr-ai-guidelines-f]: **University of Illinois System HR, AI Guidelines for Hiring and Employment** — "The Illinois Human Rights Act, as amended by Public Act 103-0804, prohibits discriminatory use of Artificial Intelligence (AI) in employment." *University of Illinois System HR, AI Guidelines for Hiring and Employment.* <https://www.hr.uillinois.edu/policy/a_i_guidelines_for_hiring_and_employment>

[^pilot-travel-centers-llc-illinois-notice-of-ai-u]: **Pilot Travel Centers LLC, Illinois Notice of AI Use in Employment Decisions** — "Pilot Travel Centers LLC (‘Pilot’) is providing this notice to inform you that we use artificial intelligence (AI) in connection with our employment decisions." *Pilot Travel Centers LLC, Illinois Notice of AI Use in Employment Decisions.* <https://pilotcompany.com/file/Illinois-notice-of-AI-use-in-employment-decisions>

[^new-york-city-administrative-code-20-871-3]: **New York City Administrative Code § 20-871** — "it shall be unlawful" *New York City Administrative Code § 20-871.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135843>

[^hogan-lovells-to-fight-bias-first-of-its-kind-ne]: **Hogan Lovells commentary** — "The law requires employers and employment agencies that use ‘automated employment decision tools’ within the City to (i) conduct independent audits of such tools for bias and (ii) provide disclosures to candidates and employees at least 10 business days prior to using automated employment decision tools." *Hogan Lovells, To fight bias, first-of-its-kind New York law regulates tech-enabled employment decisions effective January 2023.* <https://www.hoganlovells.com/en/publications/to-fight-bias-novel-ny-law-regulates-tech-enabled-employment-decisions-effective-january-2023>

[^nyc-department-of-consumer-and-worker-protection-2]: **NYC Department of Consumer and Worker Protection, Automated Employment Decisi...** — "prohibits employers and employment agencies from using an automated employment decision tool unless the tool has been subject to a bias audit within one year of the use of the tool" *NYC Department of Consumer and Worker Protection, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^morgan-lewis-ai-in-the-workplace-the-new-legal-l]: **Morgan Lewis commentary** — "a poorly designed or trained AI tool has the potential to discriminate on a much larger scale." *Morgan Lewis, AI in the Workplace: The New Legal Landscape Facing US Employers.* <https://www.morganlewis.com/pubs/2024/07/ai-in-the-workplace-the-new-legal-landscape-facing-us-employers>

[^littler-mendelson-what-does-the-2025-artificial-2]: **Littler Mendelson commentary** — "In the absence of federal regulation, several states have either passed or are considering legislation aimed at mitigating the risk of an employer’s use of an AI system resulting in algorithmic discrimination." *Littler Mendelson, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like for Employers?.* <https://www.littler.com/news-analysis/asap/what-does-2025-artificial-intelligence-legislative-and-regulatory-landscape-look>

[^colorado-sb24-205-3]: **Colorado SB24-205** — "make, or are a substantial factor in making, a consequential decision" *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^ogletree-deakins-illinois-unveils-draft-notice-r-2]: **Ogletree Deakins commentary** — "The draft rules would apply broadly to all employers under the Illinois antidiscrimination law and would necessitate notice whenever AI is involved in covered employment decisions, regardless of whether it leads to unlawful discrimination." *Ogletree Deakins, Illinois Unveils Draft Notice Rules on AI Use in Employment Ahead of Discrimination Ban.* <https://ogletree.com/insights-resources/blog-posts/illinois-unveils-draft-notice-rules-on-ai-use-in-employment-ahead-of-discrimination-ban/>

[^new-york-city-administrative-code-20-871-4]: **New York City Administrative Code § 20-871** — "it shall be unlawful" *New York City Administrative Code § 20-871.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135843>

[^new-york-city-administrative-code-20-870-2]: **New York City Administrative Code § 20-870** — "The term âautomated employment decision toolâ means any computational process, derived from machine learning, statistical modeling, data analytics, or artificial intelligence, that issues simplified output, including a score, classification, or recommendation, that is used to substantially assist or replace discretionary decision making for making employment decisions that impact natural persons." *New York City Administrative Code § 20-870.* <https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-135839>

[^colorado-sb24-205-4]: **Colorado SB24-205** — "make, or are a substantial factor in making, a consequential decision" *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^eeoc-artificial-intelligence-and-the-ada]: **EEOC, Artificial Intelligence and the ADA** — "The Americans with Disabilities Act and the Use of Software, Algorithms, and Artificial Intelligence to Assess Job Applicants and Employees" *EEOC, Artificial Intelligence and the ADA.* <https://www.eeoc.gov/eeoc-disability-related-resources/artificial-intelligence-and-ada>

[^eeoc-strategic-enforcement-plan-fiscal-years-202]: **EEOC, Strategic Enforcement Plan Fiscal Years 2024-2028** — "The Commission defines strategic impact as a significant effect on the development of the law or on promoting compliance across a large organization, geographic region, or industry." *EEOC, Strategic Enforcement Plan Fiscal Years 2024-2028.* <https://www.eeoc.gov/strategic-enforcement-plan-fiscal-years-2024-2028>
