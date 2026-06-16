---
type: Practice Note
title: Adverse-action procedures when AI drives the decision
description: >-
  FCRA and state adverse-action rules for AI hiring decisions, including
  notices, vendor CRA status, auto-reject screens, and explanations.
resource: 'https://openagreements.org/practice-guides/ai-hiring/adverse-action-ai-driven'
timestamp: '2026-04-19'
tags:
  - ai-hiring
  - adverse-action-ai-driven
---

# Adverse-action procedures when AI drives the decision[^about]

FCRA and state adverse-action rules for AI hiring decisions, including notices, vendor CRA status, auto-reject screens, and explanations.

## Does using AI to screen job applicants trigger FCRA adverse-action notices? {#ai-hiring-fcra-trigger}

**Short answer.** Yes, if a third party assembles or evaluates applicant or employee information for employment use in a way that makes the output a consumer report. AI branding is not the trigger; third-party reporting for employment eligibility is.

**The trigger is third-party reporting, not AI.** The FCRA definition of `consumer report` is broad enough to reach information bearing on a person’s character, general reputation, personal characteristics, or mode of living when it is used as a factor in employment eligibility. CFPB Circular 2024-06 makes the same move in plain English. It says third-party reports "obtained from third parties and used by employers to make hiring, promotion, reassignment, or retention decisions"[^consumer-financial-protection-bureau-consumer-fi] can fall within the FCRA even when they arrive as dossiers or scores rather than a conventional background check. [^15-u-s-c-1681a-d-1][^consumer-financial-protection-bureau-consumer-fi]

There is broad agreement on the threshold point. Littler, Goodwin, and Fisher Phillips all read CFPB Circular 2024-06 as a warning that third-party workplace scoring, monitoring, and screening products can trigger FCRA obligations. Littler frames workforce tracking technology, including AI, as capable of producing employment reports that require the usual FCRA sequence. Goodwin is more explicit that the hardest cases are licensed-software deployments and first-party-data models; perhaps some stay outside the statute, but the answer is fact-bound rather than categorical. Fisher Phillips takes the broadest operational view, treating both employers and vendors as potentially exposed when workplace AI tools collect, score, or package employee information. [^littler-the-cfpb-cautions-employers-about-using][^goodwin-cfpb-advises-employers-to-comply-with-th][^fisher-phillips-employers-and-vendors-have-fcra]

AI recruiting can convert software procurement into background-check law. A product can present as ranking, semantic matching, or employee analytics; the legal question is whether it assembles or evaluates third-party information for employment use. Once that line is crossed, speed becomes procedure. Rejection queues become notice queues. [^15-u-s-c-1681a-d-1][^consumer-financial-protection-bureau-consumer-fi][^goodwin-cfpb-advises-employers-to-comply-with-th]

The vendor and in-house paths diverge more than product teams often expect. A model trained only on first-party observations may sit outside FCRA because of the transactions-or-experiences exclusion. That does not turn off Title VII or state AI law. Outsourcing the scoring engine can reduce engineering work while increasing classification risk, especially where the vendor enriches the employer’s file with public or inferred data. [^15-u-s-c-1681a-d-1][^fisher-phillips-employers-and-vendors-have-fcra][^jones-walker-ai-hiring-under-fire-what-the-eight]

## What FCRA notices are required after an AI hiring rejection? {#ai-hiring-fcra-notice-sequence}

**Short answer.** If the AI output is a consumer report, the employer should use the familiar employment FCRA sequence. That means pre-procurement disclosure and authorization, pre-adverse report and rights summary, and a post-adverse notice with agency and dispute information.

**The federal sequence is still mechanical.** Section 1681b(b)(2)(A) requires a clear, conspicuous standalone disclosure and written authorization before procurement. Section 1681b(b)(3)(A) requires, before any adverse action based in whole or in part on the report, "a copy of the report"[^15-u-s-c-1681b-b-3-a] and a written description of the consumer’s rights. Section 1681m(a) then requires the post-adverse notice: the action, the agency’s identity, and the applicant’s dispute and free-report rights. [^15-u-s-c-1681b-b-3-a][^15-u-s-c-1681m] The EEOC/FTC employer guidance still describes the reporting company as one that "didn't make the hiring decision, and can't give specific reasons for it"[^eeoc-and-ftc-background-checks-what-employers-ne] That is why the cleaner reading is that federal employment FCRA remains a report-and-rights statute, not an ECOA-style reason-code statute. [^eeoc-and-ftc-background-checks-what-employers-ne]

The frontier commentary is where the article gets interesting. Jones Walker and Ogletree treat the January 2026 Eightfold complaint as perhaps the first live test of whether AI matching scores become consumer reports when a vendor compiles public and inferred applicant data at scale. [^jones-walker-ai-hiring-under-fire-what-the-eight-2][^ogletree-deakins-groundbreaking-lawsuit-tests-wh] Hunton Andrews Kurth pulls the discussion back to a more ordinary but still expensive place: even before a court answers the CRA question, old disclosure-form cases still punish employers that stuff federal notices, state notices, and vendor language into one document. [^hunton-andrews-kurth-state-law-information-uncle]

## Which states require extra rights when employers use AI hiring tools? {#state-ai-hiring-notice-explanation-rights}

**Short answer.** Washington, California, New York City, Colorado, and Illinois can add obligations beyond the federal FCRA packet. The practical problem is that national hiring creates stacked notice, audit, consent, explanation, correction, and appeal workflows.

**State overlays do not collapse into one packet.** Washington’s Fair Credit Reporting Act appears to go further than federal law by requiring "a reasonable opportunity to respond"[^wash-rev-code-19-182-020-2-d] to disputed report information before adverse action. California’s ICRAA and CCRAA keep their own disclosure, copy, and employment credit report rules alive. [^wash-rev-code-19-182-020-2-d][^cal-civ-code-1786-16][^cal-civ-code-1786-40][^cal-civ-code-1785-20-5] New York City’s Local Law 144 requires notice "no less than ten business days before such use"[^new-york-city-admin-code-20-870-to-20-874] of an automated employment decision tool and ties that notice to a bias-audit regime. Colorado’s AI Act, effective February 1, 2026, adds principal-reason disclosure, data-source disclosure, correction rights, and an appeal path with human review if technically feasible. Illinois’s Artificial Intelligence Video Interview Act requires notice, an explanation of how the AI works and the general characteristics it evaluates, and consent before AI analysis of a video interview. [^new-york-city-admin-code-20-870-to-20-874][^nyc-dcwp-automated-employment-decision-tools-aed][^colorado-sb-24-205][^820-ilcs-42-artificial-intelligence-video-interv]

National hiring does not produce one notice regime. It produces a stack: federal FCRA, little-FCRA form rules, AEDT advance notices, bias-audit publication, Colorado-style explanation and appeal rights, Illinois consent rules, and Title VII validation sitting beside them rather than inside them. The same decision can therefore be simultaneously fast in product design and slower in legal effect. [^wash-rev-code-19-182-020-2-d][^cal-civ-code-1786-16][^new-york-city-admin-code-20-870-to-20-874][^colorado-sb-24-205][^820-ilcs-42-artificial-intelligence-video-interv][^eeoc-what-is-the-eeoc-s-role-in-ai]

The near-term problem is probably not that every ATS rejection suddenly needs a neural-network reason code. The near-term problem is that companies operating across states are acquiring explanation duties from Colorado, Illinois, NYC, plaintiffs, and procurement committees whether or not Section 1681m itself ever gets read that way. Opaque models therefore create friction even before they create precedent. [^15-u-s-c-1681m-2][^colorado-sb-24-205][^820-ilcs-42-artificial-intelligence-video-interv][^new-york-city-admin-code-20-870-to-20-874]

## Is an AI scoring vendor a consumer reporting agency under the FCRA? {#ai-scoring-vendor-consumer-reporting-agency}

**Short answer.** A scoring vendor is most exposed when it compiles, enriches, or evaluates third-party applicant data for employment decisions. First-party or licensed-software deployments remain fact-specific rather than automatically inside or outside the FCRA.

CFPB Circular 2024-06 takes an expansive view of third-party dossiers and scores. Goodwin and Fisher Phillips, by contrast, describe licensed software and first-party-data deployments as fact-specific edge cases rather than automatic FCRA products. The complaint in *Kistler v. Eightfold AI Inc.* may become the leading test, but perhaps only for the public-data-enrichment end of the market. [^consumer-financial-protection-bureau-consumer-fi-2][^goodwin-cfpb-advises-employers-to-comply-with-th-2][^fisher-phillips-employers-and-vendors-have-fcra-2][^jones-walker-ai-hiring-under-fire-what-the-eight-3]

## Does an AI auto-reject screen count as an adverse employment action? {#ai-auto-reject-adverse-action}

**Short answer.** An auto-reject threshold is more likely to look like adverse action than a tool that only reorders candidates for later human review. The line is still unsettled for AI-heavy recruiting funnels.

An auto-reject threshold looks closer to a denial of employment than a tool that merely reorders a pool for later human review. Plaintiffs are pressing the broader theory. Employers are pressing the funnel-management theory. No court in the source set has cleanly drawn the line for AI-heavy recruiting pipelines. [^15-u-s-c-1681a-d-1-2][^ogletree-deakins-groundbreaking-lawsuit-tests-wh-2][^jones-walker-ai-hiring-under-fire-what-the-eight-4]

## How much explanation must employers give for an AI hiring rejection? {#ai-hiring-explanation-enough}

**Short answer.** Federal employment FCRA still centers on the report, rights summary, reporting-agency notice, and dispute rights. More detailed reason or explanation duties are coming mainly from state AI laws, litigation pressure, and anti-discrimination governance.

Federal employment FCRA still points to the report copy, the rights summary, and the CRA/dispute notice. Colorado and Illinois, by contrast, explicitly demand reasons or explanations that look much closer to what product teams informally call reason codes. Perhaps the cleaner view is that explanation pressure is arriving from state AI statutes and litigation posture rather than from a clear new federal employment rule. [^eeoc-and-ftc-background-checks-what-employers-ne-2][^15-u-s-c-1681b-b-3-a-2][^15-u-s-c-1681m-3][^colorado-sb-24-205-2][^820-ilcs-42-artificial-intelligence-video-interv-2]

**Title VII still runs on a separate track.** EEOC guidance treats AI systems as ordinary selection procedures. The familiar disparate-impact analysis does not disappear because the tool came from a vendor, and vendor assurances do not settle the employer’s liability question. [^eeoc-what-is-the-eeoc-s-role-in-ai-2][^perkins-coie-new-eeoc-guidance-clarifies-employe][^seyfarth-shaw-eeoc-issues-technical-assistance-g]

On the discrimination side, the employer bar is unusually aligned. Perkins Coie and Seyfarth say AI tools are just selection procedures with better branding. The anti-discrimination analysis is still the old one: protected-group impact, validation, business necessity, and no vendor shield. That matters here because a company can get the FCRA packet right and still lose on Title VII, or pass a bias audit and still miss FCRA notice or dispute rights. [^perkins-coie-new-eeoc-guidance-clarifies-employe][^seyfarth-shaw-eeoc-issues-technical-assistance-g]



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-19. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^consumer-financial-protection-bureau-consumer-fi]: **Consumer Financial Protection Bureau, Consumer Financial Protection Circular ...** — "obtained from third parties and used by employers to make hiring, promotion, reassignment, or retention decisions" *Consumer Financial Protection Bureau, Consumer Financial Protection Circular 2024-06: Background Dossiers and Algorithmic Scores for Hiring, Promotion, and Other Employment Decisions.* <https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-06-background-dossiers-and-algorithmic-scores-for-hiring-promotion-and-other-employment-decisions/>

[^15-u-s-c-1681a-d-1]: **15 U.S.C. § 1681a(d)(1)** — "The term does not include (A) any report containing information solely as to transactions or experiences between the consumer and the person making the report" *15 U.S.C. § 1681a(d)(1).* <https://www.law.cornell.edu/uscode/text/15/1681a#:~:text=The%20term%20does%20not%20include,the%20person%20making%20the%20report>

[^littler-the-cfpb-cautions-employers-about-using]: **Littler commentary** — "The CFPB has the primary regulatory and interpretive role regarding the FCRA and shares the enforcement role with the Federal Trade Commission (FTC)." *Littler, The CFPB Cautions Employers About Using Technology to Track, Assess, and Evaluate Workers.* <https://www.littler.com/news-analysis/asap/cfpb-cautions-employers-about-using-technology-track-assess-and-evaluate-workers>

[^goodwin-cfpb-advises-employers-to-comply-with-th]: **Goodwin commentary** — "the CFPB makes clear that it considers such third-party reports to be ‘consumer reports’ when they are used in making hiring, promotion, reassignment, and retention decisions. That renders them subject to the FCRA." *Goodwin, CFPB Advises Employers to Comply With the FCRA When Using AI-Powered Employee Monitoring Reports.* <https://www.goodwinlaw.com/en/insights/publications/2024/11/alerts-otherindustries-cfpb-advises-employers-to-comply>

[^fisher-phillips-employers-and-vendors-have-fcra]: **Fisher Phillips commentary** — "The Consumer Financial Protection Bureau’s (CFPB) October 24 Circular reminds employers that their obligations under the federal Fair Credit Reporting Act (FCRA) may extend to employee monitoring, assessment, and AI tools." *Fisher Phillips, Employers and Vendors Have FCRA Obligations When Using Workplace AI Tools: Your Step-by-Step Compliance Guide.* <https://www.fisherphillips.com/en/insights/insights/employers-vendors-fcra-obligations-when-using-workplace-ai-tools-compliance-guide>

[^jones-walker-ai-hiring-under-fire-what-the-eight]: **Jones Walker commentary** — "The Eightfold case isn't another AI discrimination lawsuit. It's a consumer protection action that reframes how plaintiffs can attack automated hiring." *Jones Walker, AI Hiring Under Fire: What the Eightfold Lawsuit Means for Every Employer Using Algorithmic Screening.* <https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html?id=102mkh2>

[^15-u-s-c-1681b-b-3-a]: **15 U.S.C. § 1681b(b)(3)(A)** — "a copy of the report" *15 U.S.C. § 1681b(b)(3)(A).* <https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap41-subchapIII-sec1681b.htm>

[^15-u-s-c-1681m]: **15 U.S.C. § 1681m** — "If any person takes any adverse action with respect to any consumer that is based in whole or in part on any information contained in a consumer report, the person shall- (1) provide oral, written, or electronic notice of the adverse action to the consumer;" *15 U.S.C. § 1681m.* <https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1681m&num=0&edition=prelim>

[^eeoc-and-ftc-background-checks-what-employers-ne]: **EEOC and FTC, Background Checks: What Employers Need to Know** — "didn't make the hiring decision, and can't give specific reasons for it" *EEOC and FTC, Background Checks: What Employers Need to Know.* <https://www.eeoc.gov/laws/guidance/background-checks-what-employers-need-know>

[^jones-walker-ai-hiring-under-fire-what-the-eight-2]: **Jones Walker commentary** — "The Eightfold case isn't another AI discrimination lawsuit. It's a consumer protection action that reframes how plaintiffs can attack automated hiring." *Jones Walker, AI Hiring Under Fire: What the Eightfold Lawsuit Means for Every Employer Using Algorithmic Screening.* <https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html?id=102mkh2>

[^ogletree-deakins-groundbreaking-lawsuit-tests-wh]: **Ogletree Deakins, Groundbreaking Lawsuit Tests Whether AI Hiring Tools Trigger FCRA Compliance** — "The FCRA requires employers to provide stand-alone written disclosures to employees and job applicants, and to obtain written authorization before obtaining a report." *Ogletree Deakins, Groundbreaking Lawsuit Tests Whether AI Hiring Tools Trigger FCRA Compliance.* <https://ogletree.com/insights-resources/blog-posts/groundbreaking-lawsuit-tests-whether-ai-hiring-tools-trigger-fcra-compliance/>

[^hunton-andrews-kurth-state-law-information-uncle]: **Hunton Andrews Kurth commentary** — "the court ‘now hold[s] that a prospective employer violates [the] standalone document requirement by including extraneous information relating to various state disclosure requirements in that disclosure.’" *Hunton Andrews Kurth, State Law Information + Unclear Wording = FCRA Violations.* <https://www.hunton.com/hunton-employment-labor-perspectives/state-law-information-unclear-wording-fcra-violations>

[^wash-rev-code-19-182-020-2-d]: **Wash. Rev. Code § 19.182.020(2)(d)** — "a reasonable opportunity to respond" *Wash. Rev. Code § 19.182.020(2)(d).* <https://app.leg.wa.gov/rcw/default.aspx?cite=19.182.020>

[^cal-civ-code-1786-16]: **Cal. Civ. Code § 1786.16** — "Any person described in subdivision (d) of Section 1786.12 shall not procure or cause to be prepared an investigative consumer report unless the following applicable conditions are met:" *Cal. Civ. Code § 1786.16.* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1786.16.>

[^cal-civ-code-1786-40]: **Cal. Civ. Code § 1786.40** — "the user of the investigative consumer report shall so advise the consumer against whom the adverse action has been taken and supply the name and address of the investigative consumer reporting agency making the report." *Cal. Civ. Code § 1786.40.* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1786.40>

[^cal-civ-code-1785-20-5]: **Cal. Civ. Code § 1785.20.5** — "Prior to requesting a consumer credit report for employment purposes, the user of the report shall provide written notice to the person involved." *Cal. Civ. Code § 1785.20.5.* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1785.20.5.>

[^new-york-city-admin-code-20-870-to-20-874]: **New York City Admin. Code §§ 20-870 to 20-874** — "no less than ten business days before such use" *New York City Admin. Code §§ 20-870 to 20-874.* <https://legistar.council.nyc.gov/LegislationDetail.aspx?GUID=B051915D-A9AC-451E-81F8-6596032FA3F9&ID=4344524>

[^nyc-dcwp-automated-employment-decision-tools-aed]: **NYC DCWP, Automated Employment Decision Tools (AEDT)** — "prohibits employers and employment agencies from using an automated employment decision tool unless the tool has been subject to a bias audit within one year of the use of the tool, information about the bias audit is publicly available, and certain notices have been provided to employees or job candidates." *NYC DCWP, Automated Employment Decision Tools (AEDT).* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^colorado-sb-24-205]: **Colorado SB 24-205** — "ON AND AFTER FEBRUARY 1, 2026, A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION" *Colorado SB 24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^820-ilcs-42-artificial-intelligence-video-interv]: **820 ILCS 42, Artificial Intelligence Video Interview Act** — "An employer that asks applicants to record video interviews and uses an artificial intelligence analysis of the applicant-submitted videos shall do all of the following when considering applicants for positions based in Illinois before asking applicants to submit video interviews" *820 ILCS 42, Artificial Intelligence Video Interview Act.* <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4015&ChapterID=68&Print=True>

[^eeoc-what-is-the-eeoc-s-role-in-ai]: **EEOC, What is the EEOC's role in AI?** — "These laws apply to the use of AI and other new technologies in employment just as they apply to other employment practices." *EEOC, What is the EEOC's role in AI?.* <https://www.eeoc.gov/sites/default/files/2024-04/20240429_What%20is%20the%20EEOCs%20role%20in%20AI.pdf>

[^15-u-s-c-1681m-2]: **15 U.S.C. § 1681m** — "If any person takes any adverse action with respect to any consumer that is based in whole or in part on any information contained in a consumer report, the person shall- (1) provide oral, written, or electronic notice of the adverse action to the consumer;" *15 U.S.C. § 1681m.* <https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1681m&num=0&edition=prelim>

[^consumer-financial-protection-bureau-consumer-fi-2]: **Consumer Financial Protection Bureau, Consumer Financial Protection Circular ...** — "obtained from third parties and used by employers to make hiring, promotion, reassignment, or retention decisions" *Consumer Financial Protection Bureau, Consumer Financial Protection Circular 2024-06: Background Dossiers and Algorithmic Scores for Hiring, Promotion, and Other Employment Decisions.* <https://www.consumerfinance.gov/compliance/circulars/consumer-financial-protection-circular-2024-06-background-dossiers-and-algorithmic-scores-for-hiring-promotion-and-other-employment-decisions/>

[^goodwin-cfpb-advises-employers-to-comply-with-th-2]: **Goodwin commentary** — "the CFPB makes clear that it considers such third-party reports to be ‘consumer reports’ when they are used in making hiring, promotion, reassignment, and retention decisions. That renders them subject to the FCRA." *Goodwin, CFPB Advises Employers to Comply With the FCRA When Using AI-Powered Employee Monitoring Reports.* <https://www.goodwinlaw.com/en/insights/publications/2024/11/alerts-otherindustries-cfpb-advises-employers-to-comply>

[^fisher-phillips-employers-and-vendors-have-fcra-2]: **Fisher Phillips commentary** — "The Consumer Financial Protection Bureau’s (CFPB) October 24 Circular reminds employers that their obligations under the federal Fair Credit Reporting Act (FCRA) may extend to employee monitoring, assessment, and AI tools." *Fisher Phillips, Employers and Vendors Have FCRA Obligations When Using Workplace AI Tools: Your Step-by-Step Compliance Guide.* <https://www.fisherphillips.com/en/insights/insights/employers-vendors-fcra-obligations-when-using-workplace-ai-tools-compliance-guide>

[^jones-walker-ai-hiring-under-fire-what-the-eight-3]: **Jones Walker commentary** — "The Eightfold case isn't another AI discrimination lawsuit. It's a consumer protection action that reframes how plaintiffs can attack automated hiring." *Jones Walker, AI Hiring Under Fire: What the Eightfold Lawsuit Means for Every Employer Using Algorithmic Screening.* <https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html?id=102mkh2>

[^15-u-s-c-1681a-d-1-2]: **15 U.S.C. § 1681a(d)(1)** — "The term does not include (A) any report containing information solely as to transactions or experiences between the consumer and the person making the report" *15 U.S.C. § 1681a(d)(1).* <https://www.law.cornell.edu/uscode/text/15/1681a#:~:text=The%20term%20does%20not%20include,the%20person%20making%20the%20report>

[^ogletree-deakins-groundbreaking-lawsuit-tests-wh-2]: **Ogletree Deakins, Groundbreaking Lawsuit Tests Whether AI Hiring Tools Trigger FCRA Compliance** — "The FCRA requires employers to provide stand-alone written disclosures to employees and job applicants, and to obtain written authorization before obtaining a report." *Ogletree Deakins, Groundbreaking Lawsuit Tests Whether AI Hiring Tools Trigger FCRA Compliance.* <https://ogletree.com/insights-resources/blog-posts/groundbreaking-lawsuit-tests-whether-ai-hiring-tools-trigger-fcra-compliance/>

[^jones-walker-ai-hiring-under-fire-what-the-eight-4]: **Jones Walker commentary** — "The Eightfold case isn't another AI discrimination lawsuit. It's a consumer protection action that reframes how plaintiffs can attack automated hiring." *Jones Walker, AI Hiring Under Fire: What the Eightfold Lawsuit Means for Every Employer Using Algorithmic Screening.* <https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html?id=102mkh2>

[^eeoc-and-ftc-background-checks-what-employers-ne-2]: **EEOC and FTC, Background Checks: What Employers Need to Know** — "didn't make the hiring decision, and can't give specific reasons for it" *EEOC and FTC, Background Checks: What Employers Need to Know.* <https://www.eeoc.gov/laws/guidance/background-checks-what-employers-need-know>

[^15-u-s-c-1681b-b-3-a-2]: **15 U.S.C. § 1681b(b)(3)(A)** — "a copy of the report" *15 U.S.C. § 1681b(b)(3)(A).* <https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap41-subchapIII-sec1681b.htm>

[^15-u-s-c-1681m-3]: **15 U.S.C. § 1681m** — "If any person takes any adverse action with respect to any consumer that is based in whole or in part on any information contained in a consumer report, the person shall- (1) provide oral, written, or electronic notice of the adverse action to the consumer;" *15 U.S.C. § 1681m.* <https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1681m&num=0&edition=prelim>

[^colorado-sb-24-205-2]: **Colorado SB 24-205** — "ON AND AFTER FEBRUARY 1, 2026, A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION" *Colorado SB 24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^820-ilcs-42-artificial-intelligence-video-interv-2]: **820 ILCS 42, Artificial Intelligence Video Interview Act** — "An employer that asks applicants to record video interviews and uses an artificial intelligence analysis of the applicant-submitted videos shall do all of the following when considering applicants for positions based in Illinois before asking applicants to submit video interviews" *820 ILCS 42, Artificial Intelligence Video Interview Act.* <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4015&ChapterID=68&Print=True>

[^eeoc-what-is-the-eeoc-s-role-in-ai-2]: **EEOC, What is the EEOC's role in AI?** — "These laws apply to the use of AI and other new technologies in employment just as they apply to other employment practices." *EEOC, What is the EEOC's role in AI?.* <https://www.eeoc.gov/sites/default/files/2024-04/20240429_What%20is%20the%20EEOCs%20role%20in%20AI.pdf>

[^perkins-coie-new-eeoc-guidance-clarifies-employe]: **Perkins Coie commentary** — "employers are generally liable for the outcomes of using selection tools to make employment decisions." *Perkins Coie, New EEOC Guidance Clarifies Employer Responsibility for Discrimination in AI Employment Tools.* <https://perkinscoie.com/insights/update/new-eeoc-guidance-clarifies-employer-responsibility-discrimination-ai-employment>

[^seyfarth-shaw-eeoc-issues-technical-assistance-g]: **Seyfarth Shaw commentary** — "The EEOC did not unveil new policies in the TA but reiterated that its long existing policies and practices continue to apply to the technologies (such as artificial intelligence and machine learning tools) that are grabbing the public’s attention today." *Seyfarth Shaw, EEOC Issues Technical Assistance Guidance On The Use Of Advanced Technology Tools, Including Artificial Intelligence.* <https://www.seyfarth.com/news-insights/eeoc-issues-technical-assistance-guidance-on-the-use-of-advanced-technology-tools-including-artificial-intelligence.html>
