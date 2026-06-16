---
type: Practice Note
title: Can AI make hiring decisions?
description: >-
  When employers can use AI in hiring decisions under federal, state, and FCRA
  rules, including human review, vendor liability, and remote roles.
resource: >-
  https://openagreements.org/practice-guides/ai-hiring/can-ai-make-hiring-decisions
timestamp: '2026-04-20'
tags:
  - ai-hiring
  - can-ai-make-hiring-decisions
---

# Can AI make hiring decisions?[^about]

When employers can use AI in hiring decisions under federal, state, and FCRA rules, including human review, vendor liability, and remote roles.

## Can employers use AI to screen applicants without violating federal hiring laws? {#ai-screening-federal-hiring-laws}

**Short answer.** Yes, but AI screening must still satisfy the same federal discrimination, validation, and accommodation rules that apply to any selection practice. The legal question is what the tool does to applicants, not whether the selector is human or automated.

Federal law does not ask whether the selector is human or machine. It asks what the selection practice does. Title VII's disparate-impact provision still turns on whether a plaintiff can identify a `particular employment practice` and whether the employer can show it is "job related for the position in question and consistent with business necessity"[^42-u-s-c-2000e-2-k]. [^42-u-s-c-2000e-2-k] The Uniform Guidelines still supply the familiar benchmark: a selection rate under four-fifths of the most-selected group is generally regarded by the Federal enforcement agencies as evidence of adverse impact. [^29-c-f-r-1607-4] That framework was written for tests, not LLMs, but nothing in the statutory text creates an AI exception.

The ADA adds a separate layer. The EEOC's AI-and-ADA guidance distills the present federal problem into three recurring categories: tools that screen out disabled applicants, tools that fail to accommodate them, and tools that elicit or infer disability-related information the statute does not allow. [^42-u-s-c-12112-and-eeoc-artificial-intelligence] That matters less for drafting job descriptions or summarizing interviews and more for systems that score facial expression, voice, eye contact, typing rhythm, or other traits that can become downstream proxies for disability. [^jackson-lewis-eeoc-doj-release-expectations-on-e]

The consensus from the employment bar is tighter than the headlines suggest. Fisher Phillips, Jackson Lewis, Littler, Ogletree, and Morgan Lewis all treat AI hiring as old employment law plus a new state/local patchwork, not as a new permission structure. Fisher Phillips describes a "patchwork of various state and local laws"[^fisher-phillips-comprehensive-review-of-ai-workp]. Jackson Lewis says employer liability for AI-assisted employment decisions remains "anchored in long-standing civil rights laws"[^jackson-lewis-trump-s-ai-eo-reducing-regulatory]. [^fisher-phillips-comprehensive-review-of-ai-workp][^jackson-lewis-trump-s-ai-eo-reducing-regulatory] On the core federal point, there is very little daylight between them.

## Which state rules apply when AI hiring tools screen NYC, Illinois, or Colorado applicants? {#state-ai-hiring-rules}

**Short answer.** NYC, Illinois, and Colorado can each attach different obligations to the same AI hiring workflow. The triggers turn on the tool, the job location or applicant location, and whether the system substantially affects employment decisions.

The first local rule that changed employer behavior at scale was New York City Local Law 144. Its trigger is not `AI` in the abstract. It is an `AEDT` that issues a "score, classification, or recommendation"[^new-york-city-local-law-144-int-no-1894-a] and is used to substantially assist or replace discretionary decision making in hiring or promotion. [^new-york-city-local-law-144-int-no-1894-a] Once that trigger is met, the statute requires a recent bias audit, public posting of a summary, and at least ten business days' notice before use. [^new-york-city-local-law-144-and-dcwp-aedt-materi] The DCWP materials also make two practical points. The law can reach some remote roles tied to a NYC office, and a completed bias audit is not a city-issued safe harbor from other discrimination law. [^dcwp-automated-employment-decision-tools-aedt-an]

Illinois now works in two layers. The narrower one is the Artificial Intelligence Video Interview Act. It applies when AI analyzes recorded video interviews for "positions based in Illinois"[^820-ilcs-42-5], and it requires notice, an explanation of how the AI works and the general characteristics it uses, and applicant consent before the interview proceeds. [^820-ilcs-42-artificial-intelligence-video-interv] The broader one is the Illinois Human Rights Act amendment effective January 1, 2026. That amendment moves Illinois beyond recorded-video analysis and into ordinary employment decision-making by prohibiting AI use that has a discriminatory effect, barring zip code as a proxy for a protected class, and defining AI broadly enough to include generative AI. [^illinois-public-act-103-0804-and-775-ilcs-5-2-10]

Colorado's AI Act is broader still, but timing matters. SB 24-205 reaches high-risk systems that make, or are a substantial factor in making a consequential decision about employment or an employment opportunity involving a Colorado resident. [^colorado-sb24-205] The duties in the enacted statute are systemic: reasonable care, risk management, impact assessment, notice, and explanation. But as of April 20, 2026, the central deployer obligations are not yet operative because SB25B-004 pushed the effective date to June 30, 2026. [^colorado-sb24-205-and-sb25b-004] That makes Colorado important and slightly easy to overstate at the same time.

Illinois is where the law-firm commentary shows the clearest shift over time. Older summaries could still describe Illinois as mainly a video-interview jurisdiction. Newer commentary from Littler and Morgan Lewis no longer does. They treat the 2026 Human Rights Act amendment as the bigger development because it changes Illinois from a narrow interview law into a broader employment-AI rule about discriminatory effect and notice. [^littler-what-does-the-2025-artificial-intelligen][^morgan-lewis-artificial-intelligence-in-employme]

Ogletree's Colorado writing is useful for a different reason. It underscores that the act is designed to reach employment use, but also flags the under-50-employee exemption and the ambiguity in `substantial factor`. [^ogletree-deakins-colorado-s-artificial-intellige] That combination is typical of the whole field: the direction of travel is clear, while the exact line between assistive and decision-making uses is still fuzzy.

## How much human review is enough for AI hiring recommendations? {#human-review-ai-hiring}

**Short answer.** Human review helps only if it is real enough to change the outcome and explain the hiring decision. A rubber-stamp approval step will not by itself avoid federal, state, local, or vendor-policy risk.

For Claude specifically, the statutory and contractual stories point the same way. Anthropic's Usage Policy classifies employment decisions, resume screening, and hiring tools as high-risk uses and says "a qualified professional in that field must review the content or decision prior to dissemination or finalization"[^anthropic-usage-policy]. [^anthropic-usage-policy] Anthropic's own candidate guidance describes Claude as useful for job descriptions, interview questions, candidate communications, metrics, transcription, and sourcing, but says plainly: "We don't use your data to train Claude or let Claude make hiring decisions."[^anthropic-guidance-on-candidates-ai-usage-how-an] [^anthropic-guidance-on-candidates-ai-usage-how-an]

The non-obvious consequence is that the legal boundary is not `AI` versus `no AI`. It is `selection system` versus `support tool`. A model used to draft job descriptions, propose interview questions, transcribe calls, or summarize recruiting metrics fits much more naturally inside the assistive pattern Anthropic itself describes. A model used to gate who advances, who gets rejected, or who receives an offer turns into a selection practice, and often into a regulated selection tool. [^anthropic-guidance-on-candidates-ai-usage-how-an][^new-york-city-local-law-144-int-no-1894-a-2]

`Human in the loop` is not magic words. If the model still supplies the score, classification, or recommendation that `substantially assists` the decision under NYC law, or is a `substantial factor` under Colorado's act, the local statute can still apply. [^new-york-city-local-law-144-int-no-1894-a-2][^colorado-sb24-205-2] Federal law is even less impressed by labels. Title VII and the ADA look at effect, validation, screen-out, and accommodation, not at whether the product team inserted a human approval button at the end. [^42-u-s-c-2000e-2-k-2][^42-u-s-c-12112-and-eeoc-artificial-intelligence-2]

A bias audit is not the end of the story. New York City requires one, but the city's own materials say the law does not itself prescribe a particular remedial step after the audit. That means the audit is a threshold condition for use, not a declaration that the workflow is lawful overall. [^dcwp-automated-employment-decision-tools-aedt-an-2] A tool can therefore be bias-audited and still difficult to defend under disparate-impact or ADA theories. [^29-c-f-r-1607-4-2][^42-u-s-c-12112-and-eeoc-artificial-intelligence-2]

One view, reflected in some LL144 commentary, is that a genuinely independent human decision-maker may keep a workflow outside certain local triggers or at least weaken causation arguments. The counterview is that a rubber-stamp reviewer does not cure disparate impact, validation gaps, or ADA screen-out. No bright-line rule in the source set resolves that boundary. [^fisher-phillips-comprehensive-review-of-ai-workp-2][^jackson-lewis-eeoc-doj-release-expectations-on-e-2][^anthropic-usage-policy]

Morgan Lewis and Jackson Lewis converge on one practical point. Human review matters, but not as a slogan. The review has to be real enough that the company can still explain job-relatedness, validation, accommodation, and why the human decision-maker was not just accepting a machine-generated ranking as fate. [^morgan-lewis-artificial-intelligence-in-employme-2][^jackson-lewis-eeoc-doj-release-expectations-on-e-2] None of the firm commentary in the source set treats a vendor bias audit or model card as the end of the inquiry.

The more interesting disagreement is about scope at the margins. Littler emphasizes that NYC Local Law 144 only reaches tools that `substantially assist or replace` discretion, and Fisher Phillips goes further, suggesting the law may be narrower than its headlines if managers retain the predominant decision-making role. [^littler-what-does-the-2025-artificial-intelligen-2][^fisher-phillips-comprehensive-review-of-ai-workp-2] That is not disagreement about whether AI hiring is regulated. It is disagreement about how much real human judgment is enough to keep a particular workflow outside one city statute.

## Can an AI hiring vendor be liable for discriminatory screening decisions? {#ai-hiring-vendor-liability}

**Short answer.** Possibly, especially when plaintiffs argue that the employer delegated screening decisions to the vendor software. The source set does not identify an appellate merits ruling that settles how far that theory can travel.

The Workday litigation is testing whether an AI hiring vendor can be treated as an employer's agent when the employer delegates screening to the software. Plaintiffs say the vendor is part of the employment decision. Vendors say they provide configurable software while the employer owns the criteria and outcome. The source set does not identify an appellate merits holding settling that issue. [^fisher-phillips-discrimination-lawsuit-over-work]

## Does an AI applicant score trigger FCRA consumer-report duties? {#ai-applicant-score-fcra}

**Short answer.** It can become an FCRA issue when a vendor compiles, enriches, or scores applicant data in a way plaintiffs characterize as consumer reporting. The Eightfold litigation shows the theory, but the source set does not resolve how broadly it will apply.

The Eightfold litigation is testing whether AI-generated match scores can trigger FCRA-style duties when a vendor compiles or enriches applicant data. Perhaps that theory stays confined to the public-data-enrichment end of the market. Perhaps it spreads further. Either way, it shows that automated hiring can pick up procedural obligations from outside employment discrimination law itself. [^jones-walker-ai-hiring-under-fire-what-the-eight]

## Which location rules apply when AI hiring tools screen remote applicants? {#remote-ai-hiring-location-rules}

**Short answer.** Remote hiring can trigger multiple AI hiring rules because NYC, Illinois, and Colorado use different geographic hooks. A centralized funnel may need to account for office ties, role location, and applicant residence at the same time.

The same workflow can also attract different rules for different reasons. A remote job tied to a NYC office, a recorded video interview for an Illinois-based role, and a Colorado resident in the applicant pool can all cause different laws to attach to the same funnel. [^dcwp-automated-employment-decision-tools-aedt-an-3][^820-ilcs-42-artificial-intelligence-video-interv-2][^colorado-sb24-205-3] The practical result is not one national AI hiring rule. It is one hiring stack that keeps changing legal character as geography and workflow stage change.

The smallest companies do not necessarily escape just because the federal statutes are not written for every employer. Colorado has a narrow under-50 exemption on stated conditions. But the source set does not surface an express small-employer carve-out in NYC Local Law 144 or in Illinois's video-interview statute. [^colorado-sb24-205-3][^new-york-city-local-law-144-int-no-1894-a-3][^820-ilcs-42-artificial-intelligence-video-interv-2] So `too small to matter` is not a stable conclusion once state and local rules enter the picture.

DCWP says some fully remote jobs tied to a NYC office are covered. Illinois keys the video-interview law to positions based in Illinois. Colorado keys its act to consequential decisions about Colorado residents. The hard cases are centralized recruiting teams running one workflow across all three. The statutes overlap, but they do not share one geographic key. [^dcwp-automated-employment-decision-tools-aedt-an-3][^820-ilcs-42-artificial-intelligence-video-interv-2][^colorado-sb24-205-3]



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-20. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^42-u-s-c-2000e-2-k]: **42 U.S.C. § 2000e-2(k)** — "job related for the position in question and consistent with business necessity" *42 U.S.C. § 2000e-2(k).* <https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title42-section2000e-2>

[^29-c-f-r-1607-4]: **29 C.F.R. § 1607.4** — "Each user should maintain and have available for inspection records or other information which will disclose the impact which its tests and other selection procedures have upon employment opportunities of persons by identifiable race, sex, or ethnic group" *29 C.F.R. § 1607.4.* <https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/subject-group-ECFRdb347e844acdea6/section-1607.4>

[^42-u-s-c-12112-and-eeoc-artificial-intelligence]: **42 U.S.C. § 12112 and EEOC, Artificial Intelligence and the ADA** — "The Americans with Disabilities Act and the Use of Software, Algorithms, and Artificial Intelligence to Assess Job Applicants and Employees" *42 U.S.C. § 12112 and EEOC, Artificial Intelligence and the ADA.* <https://www.eeoc.gov/eeoc-disability-related-resources/artificial-intelligence-and-ada>

[^jackson-lewis-eeoc-doj-release-expectations-on-e]: **Jackson Lewis commentary** — "The EEOC’s TAD applies the Americans with Disabilities Act (ADA), including regulations and existing guidance, where technology intersects with workplace legal issues." *Jackson Lewis, EEOC, DOJ Release Expectations on Employers’ Use of Technology, AI for Employment Decisions.* <https://www.jacksonlewis.com/insights/eeoc-doj-release-expectations-employers-use-technology-ai-employment-decisions>

[^fisher-phillips-comprehensive-review-of-ai-workp]: **Fisher Phillips commentary** — "patchwork of various state and local laws" *Fisher Phillips, Comprehensive Review of AI Workplace Law and Litigation as We Enter 2025.* <https://www.fisherphillips.com/en/insights/insights/comprehensive-review-of-ai-workplace-law-and-litigation-as-we-enter-2025>

[^jackson-lewis-trump-s-ai-eo-reducing-regulatory]: **Jackson Lewis commentary** — "anchored in long-standing civil rights laws" *Jackson Lewis, Trump’s AI EO: Reducing Regulatory Fragmentation Not Employer Responsibility.* <https://www.jacksonlewis.com/insights/trumps-ai-eo-reducing-regulatory-fragmentation-not-employer-responsibility>

[^new-york-city-local-law-144-int-no-1894-a]: **New York City Local Law 144 / Int. No. 1894-A** — "score, classification, or recommendation" *New York City Local Law 144 / Int. No. 1894-A.* <https://legistar.council.nyc.gov/LegislationDetail.aspx?GUID=B051915D-A9AC-451E-81F8-6596032FA3F9&ID=4344524>

[^new-york-city-local-law-144-and-dcwp-aedt-materi]: **New York City Local Law 144 and DCWP AEDT materials** — "prohibits employers and employment agencies from using an automated employment decision tool unless the tool has been subject to a bias audit within one year of the use of the tool, information about the bias audit is publicly available, and certain notices have been provided to employees or job candidates." *New York City Local Law 144 and DCWP AEDT materials.* <https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page>

[^dcwp-automated-employment-decision-tools-aedt-an]: **DCWP, Automated Employment Decision Tools (AEDT) and FAQ** — "The Law prohibits employers and employment agencies from using an automated employment decision tool (AEDT) in New York City unless they ensure a bias audit was done and provide required notices." *DCWP, Automated Employment Decision Tools (AEDT) and FAQ.* <https://www.nyc.gov/assets/dca/downloads/pdf/about/DCWP-AEDT-FAQ.pdf>

[^820-ilcs-42-5]: **820 ILCS 42/5** — "positions based in Illinois" *820 ILCS 42/5.* <https://www.ilga.gov/ftp/ILCS/Ch%200820/Act%200042/082000420K5.html>

[^820-ilcs-42-artificial-intelligence-video-interv]: **820 ILCS 42, Artificial Intelligence Video Interview Act** — "An employer that asks applicants to record video interviews and uses an artificial intelligence analysis of the applicant-submitted videos shall do all of the following when considering applicants for positions based in Illinois before asking applicants to submit video interviews" *820 ILCS 42, Artificial Intelligence Video Interview Act.* <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4015&ChapterID=68&Print=True>

[^illinois-public-act-103-0804-and-775-ilcs-5-2-10]: **Illinois Public Act 103-0804 and 775 ILCS 5/2-101** — "For an employer to use artificial intelligence that has the effect of subjecting employees to discrimination on the basis of protected classes under this Article or to use zip codes as a proxy for protected classes under this Article." *Illinois Public Act 103-0804 and 775 ILCS 5/2-101.* <https://www.ilga.gov/Legislation/publicacts/view/103-0804>

[^colorado-sb24-205]: **Colorado SB24-205** — "A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION ARISING FROM THE INTENDED AND CONTRACTED USES OF THE HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM." *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^colorado-sb24-205-and-sb25b-004]: **Colorado SB24-205 and SB25B-004** — "In 2024, the general assembly enacted Senate Bill 24-205, which created consumer protections in interactions with artificial intelligence systems." *Colorado SB24-205 and SB25B-004.* <https://leg.colorado.gov/bills/sb25b-004>

[^littler-what-does-the-2025-artificial-intelligen]: **Littler commentary** — "In the absence of federal regulation, several states have either passed or are considering legislation aimed at mitigating the risk of an employer’s use of an AI system resulting in algorithmic discrimination." *Littler, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like for Employers?.* <https://www.littler.com/news-analysis/asap/what-does-2025-artificial-intelligence-legislative-and-regulatory-landscape-look>

[^morgan-lewis-artificial-intelligence-in-employme]: **Morgan Lewis commentary** — "the adoption of AI technology in the workplace also brings several new legal complexities and risks." *Morgan Lewis, Artificial Intelligence in Employment: Key Takeaways.* <https://www.morganlewis.com/pubs/2025/03/artificial-intelligence-in-employment-key-takeaways>

[^ogletree-deakins-colorado-s-artificial-intellige]: **Ogletree Deakins commentary** — "Colorado becomes the first U.S. state to enact comprehensive legislation regulating the use and development of AI systems." *Ogletree Deakins, Colorado’s Artificial Intelligence Act: What Employers Need to Know.* <https://ogletree.com/insights-resources/blog-posts/colorados-artificial-intelligence-act-what-employers-need-to-know/>

[^anthropic-usage-policy]: **Anthropic, Usage Policy** — "a qualified professional in that field must review the content or decision prior to dissemination or finalization" *Anthropic, Usage Policy.* <https://www.anthropic.com/legal/aup>

[^anthropic-guidance-on-candidates-ai-usage-how-an]: **Anthropic, Guidance on Candidates' AI Usage / How Anthropic uses Claude for hiring** — "We don't use your data to train Claude or let Claude make hiring decisions." *Anthropic, Guidance on Candidates' AI Usage / How Anthropic uses Claude for hiring.* <https://www.anthropic.com/candidate-ai-guidance>

[^new-york-city-local-law-144-int-no-1894-a-2]: **New York City Local Law 144 / Int. No. 1894-A** — "score, classification, or recommendation" *New York City Local Law 144 / Int. No. 1894-A.* <https://legistar.council.nyc.gov/LegislationDetail.aspx?GUID=B051915D-A9AC-451E-81F8-6596032FA3F9&ID=4344524>

[^colorado-sb24-205-2]: **Colorado SB24-205** — "A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION ARISING FROM THE INTENDED AND CONTRACTED USES OF THE HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM." *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^42-u-s-c-2000e-2-k-2]: **42 U.S.C. § 2000e-2(k)** — "job related for the position in question and consistent with business necessity" *42 U.S.C. § 2000e-2(k).* <https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=granuleid%3AUSC-prelim-title42-section2000e-2>

[^42-u-s-c-12112-and-eeoc-artificial-intelligence-2]: **42 U.S.C. § 12112 and EEOC, Artificial Intelligence and the ADA** — "The Americans with Disabilities Act and the Use of Software, Algorithms, and Artificial Intelligence to Assess Job Applicants and Employees" *42 U.S.C. § 12112 and EEOC, Artificial Intelligence and the ADA.* <https://www.eeoc.gov/eeoc-disability-related-resources/artificial-intelligence-and-ada>

[^dcwp-automated-employment-decision-tools-aedt-an-2]: **DCWP, Automated Employment Decision Tools (AEDT) and FAQ** — "The Law prohibits employers and employment agencies from using an automated employment decision tool (AEDT) in New York City unless they ensure a bias audit was done and provide required notices." *DCWP, Automated Employment Decision Tools (AEDT) and FAQ.* <https://www.nyc.gov/assets/dca/downloads/pdf/about/DCWP-AEDT-FAQ.pdf>

[^29-c-f-r-1607-4-2]: **29 C.F.R. § 1607.4** — "Each user should maintain and have available for inspection records or other information which will disclose the impact which its tests and other selection procedures have upon employment opportunities of persons by identifiable race, sex, or ethnic group" *29 C.F.R. § 1607.4.* <https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/subject-group-ECFRdb347e844acdea6/section-1607.4>

[^fisher-phillips-comprehensive-review-of-ai-workp-2]: **Fisher Phillips commentary** — "patchwork of various state and local laws" *Fisher Phillips, Comprehensive Review of AI Workplace Law and Litigation as We Enter 2025.* <https://www.fisherphillips.com/en/insights/insights/comprehensive-review-of-ai-workplace-law-and-litigation-as-we-enter-2025>

[^jackson-lewis-eeoc-doj-release-expectations-on-e-2]: **Jackson Lewis commentary** — "The EEOC’s TAD applies the Americans with Disabilities Act (ADA), including regulations and existing guidance, where technology intersects with workplace legal issues." *Jackson Lewis, EEOC, DOJ Release Expectations on Employers’ Use of Technology, AI for Employment Decisions.* <https://www.jacksonlewis.com/insights/eeoc-doj-release-expectations-employers-use-technology-ai-employment-decisions>

[^morgan-lewis-artificial-intelligence-in-employme-2]: **Morgan Lewis commentary** — "the adoption of AI technology in the workplace also brings several new legal complexities and risks." *Morgan Lewis, Artificial Intelligence in Employment: Key Takeaways.* <https://www.morganlewis.com/pubs/2025/03/artificial-intelligence-in-employment-key-takeaways>

[^littler-what-does-the-2025-artificial-intelligen-2]: **Littler commentary** — "In the absence of federal regulation, several states have either passed or are considering legislation aimed at mitigating the risk of an employer’s use of an AI system resulting in algorithmic discrimination." *Littler, What Does the 2025 Artificial Intelligence Legislative and Regulatory Landscape Look Like for Employers?.* <https://www.littler.com/news-analysis/asap/what-does-2025-artificial-intelligence-legislative-and-regulatory-landscape-look>

[^fisher-phillips-discrimination-lawsuit-over-work]: **Fisher Phillips commentary** — "the ruling serves as a warning to employers and AI vendors alike that they can be held accountable for algorithmic screening tools if they disproportionately harm protected groups – even if the bias wasn’t intentional." *Fisher Phillips, Discrimination Lawsuit Over Workday’s AI Hiring Tools Can Proceed as Class Action: 6 Things Employers Should Do After Latest Court Decision.* <https://www.fisherphillips.com/en/insights/insights/discrimination-lawsuit-over-workdays-ai-hiring-tools-can-proceed-as-class-action-6-things>

[^jones-walker-ai-hiring-under-fire-what-the-eight]: **Jones Walker commentary** — "The Eightfold case isn't another AI discrimination lawsuit. It's a consumer protection action that reframes how plaintiffs can attack automated hiring." *Jones Walker, AI Hiring Under Fire: What the Eightfold Lawsuit Means for Every Employer Using Algorithmic Screening.* <https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-hiring-under-fire-what-the-eightfold-lawsuit-means-for-every-employer-using-a.html?id=102mkh2>

[^dcwp-automated-employment-decision-tools-aedt-an-3]: **DCWP, Automated Employment Decision Tools (AEDT) and FAQ** — "The Law prohibits employers and employment agencies from using an automated employment decision tool (AEDT) in New York City unless they ensure a bias audit was done and provide required notices." *DCWP, Automated Employment Decision Tools (AEDT) and FAQ.* <https://www.nyc.gov/assets/dca/downloads/pdf/about/DCWP-AEDT-FAQ.pdf>

[^820-ilcs-42-artificial-intelligence-video-interv-2]: **820 ILCS 42, Artificial Intelligence Video Interview Act** — "An employer that asks applicants to record video interviews and uses an artificial intelligence analysis of the applicant-submitted videos shall do all of the following when considering applicants for positions based in Illinois before asking applicants to submit video interviews" *820 ILCS 42, Artificial Intelligence Video Interview Act.* <https://www.ilga.gov/Legislation/ILCS/Articles?ActID=4015&ChapterID=68&Print=True>

[^colorado-sb24-205-3]: **Colorado SB24-205** — "A DEVELOPER OF A HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM SHALL USE REASONABLE CARE TO PROTECT CONSUMERS FROM ANY KNOWN OR REASONABLY FORESEEABLE RISKS OF ALGORITHMIC DISCRIMINATION ARISING FROM THE INTENDED AND CONTRACTED USES OF THE HIGH-RISK ARTIFICIAL INTELLIGENCE SYSTEM." *Colorado SB24-205.* <https://leg.colorado.gov/bill_files/47770/download>

[^new-york-city-local-law-144-int-no-1894-a-3]: **New York City Local Law 144 / Int. No. 1894-A** — "score, classification, or recommendation" *New York City Local Law 144 / Int. No. 1894-A.* <https://legistar.council.nyc.gov/LegislationDetail.aspx?GUID=B051915D-A9AC-451E-81F8-6596032FA3F9&ID=4344524>
