---
type: Practice Note
title: AI vendor evaluation as an executable skills file
description: >-
  Key AI vendor diligence questions for legal teams, including training data,
  output rights, privacy promises, contract terms, and risk tiers.
resource: >-
  https://openagreements.org/practice-guides/ai-vendors/vendor-evaluation-skills-file
timestamp: '2026-04-20'
tags:
  - ai-vendors
  - vendor-evaluation-skills-file
---

# AI vendor evaluation as an executable skills file[^about]

Key AI vendor diligence questions for legal teams, including training data, output rights, privacy promises, contract terms, and risk tiers.

## Which legal rules make AI vendor diligence necessary for regulated data? {#legal-rules-ai-vendor-diligence}

**Short answer.** Existing privacy, health-data, and cross-border rules make AI vendor diligence necessary when regulated data is involved. The legal work is usually processor contracting, business associate agreement scope, transfer-path review, and proof that the vendor can stay inside contractual limits.

No primary-law source in the research says a company must use a particular AI vendor questionnaire. The pressure comes from older rules that turn certain questions into legal necessities once the tool will process regulated or sensitive data. GDPR Article 28 is the clearest example. A controller may use only processors providing "sufficient guarantees"[^regulation-eu-2016-679-art-28] and must put specific processing terms in writing. [^regulation-eu-2016-679-art-28] That is why questions about subprocessors, deletion, audit support, and reuse of prompts or outputs are not procurement theater. They are how a buyer tests whether Article 28 can be satisfied at all.

HIPAA creates the same structure for health-data use cases. The regulation requires a business-associate agreement to "establish the permitted and required uses and disclosures"[^45-c-f-r-164-504-e-2] of protected health information, along with safeguards, subcontractor flow-downs, and return-or-destruction terms. [^45-c-f-r-164-504-e-2] Once PHI is in scope, `Does the vendor sign a BAA?` is only the opening question. The real questions are whether the offered product is inside the BAA scope, which subprocessors touch PHI, what logs exist, and whether customer-specific artifacts can be deleted at the end.

Cross-border rules now make some vendor questions more concrete than they looked a year ago. The DOJ bulk-data rules define a vendor agreement broadly enough to include arrangements for goods or services, "including cloud-computing services"[^28-c-f-r-202-258]. [^28-c-f-r-202-258] The same regime uses risk-based verification duties for covered vendor relationships. [^28-c-f-r-202-1001-and-subpart-j] That does not make every AI tool a restricted transaction. It does mean vendor identity, ownership, location, and transfer path are legal facts in some data-heavy deployments, not just diligence preferences.

California privacy law points in the same direction. Cal. Civ. Code section 1798.100(d) and the CPPA regulations require service-provider and contractor terms that limit purpose, require equivalent privacy protection, and preserve oversight rights when personal data is being processed on the company's behalf. [^cal-civ-code-1798-100-d][^cal-code-regs-tit-11-7051] That is why a vendor answer like `we do not train on customer data` is not enough by itself. The legal issue is broader: limited purpose, no cross-customer use outside the contract, deletion or return, and enough visibility to tell whether the vendor is still inside those limits.

The notable absence is just as important. The source set did not surface a generally applicable AI-procurement statute telling buyers which diligence questions to ask in ordinary enterprise purchases. Perhaps that will come later for high-risk or public-sector use cases. Today the operative law is mostly processor law, sector law, and contract structure.

## What AI vendor questions matter most for training data and outputs? {#ai-vendor-training-data-questions}

**Short answer.** The most important AI vendor questions are about training rights, customer-data reuse, output ownership, portability, bias controls, validation, logs, deletion, and audit rights. Those topics matter more than a broad responsible AI attestation because they map to the data path and commercial risk.

The law firms are surprisingly aligned on substance. Morgan Lewis says "training data rights remain critical"[^morgan-lewis-what-s-new-and-what-s-next-navigati] and treats privacy procedures, data governance, and security as central diligence topics. [^morgan-lewis-what-s-new-and-what-s-next-navigati] Its earlier sourcing notes push the same way on ownership of inputs, outputs, analytics, and portability at termination. [^morgan-lewis-contracting-pointers-for-services-i][^morgan-lewis-contract-corner-ensuring-ip-provisi] That is a narrower and more useful frame than generic `responsible AI` diligence. It suggests that the commercial terms and the data path still do most of the legal work.

Cooley adds two useful points. First, the European Commission's model AI procurement clauses are not only for governments; Cooley treats them as instructive for private buyers too, especially around "AI ethics, liability, transparency and compliance"[^cooley-model-contractual-clauses-for-ai-procurem]. [^cooley-model-contractual-clauses-for-ai-procurem] Second, Cooley's state-law commentary treats diligence on "training data, cybersecurity and measures taken to prevent biased and discriminatory outputs"[^cooley-utah-colorado-pave-way-for-ai-specific-st] as part of vendor review. [^cooley-utah-colorado-pave-way-for-ai-specific-st] That pulls bias and validation into scope, but only when the use case justifies it.

Wilson Sonsini is perhaps the clearest on the off-the-shelf case. Its EU AI Act note says buyers should "carry out due diligence on the vendor"[^wilson-sonsini-europe-prepares-for-a-new-era-in] and, if the vendor says no personal data is used for training, should verify how the vendor ensures this in practice. [^wilson-sonsini-europe-prepares-for-a-new-era-in] Its playbook chapter then turns that into operational questions: source of training data, safeguards against bias, privacy controls, reuse of inputs and outputs, and treatment of personal data inside the model lifecycle. [^wilson-sonsini-l-suite-ai-playbook-chapter-7]

Outside the firms, the public questionnaires mostly confirm the same core. ACC's AI vendor diligence document asks about upstream AI dependencies, rights in training data, customer-data use for training, portability of trained models, validation, transparency, and audit rights. [^association-of-corporate-counsel-vendor-due-dili] HECVAT and AI-CAIQ push toward evidence, logs, deletion, and supply-chain controls. [^educause-higher-education-community-vendor-asses][^cloud-security-alliance-ai-consensus-assessments] The real disagreement is about format, not content. NIST says its AI RMF playbook is "neither a checklist nor set of steps to be followed in its entirety"[^nist-ai-rmf-playbook], while Google's VSAQ model favors self-adapting questionnaires that shrink when risk is low. [^nist-ai-rmf-playbook][^google-scalable-vendor-security-reviews] So the consensus is not `use a giant form`. It is `ask a small number of serious questions, then branch`.

## How should legal teams build an AI vendor questionnaire that branches by risk? {#branching-ai-vendor-questionnaire}

**Short answer.** Legal teams should make the AI vendor questionnaire executable: intake first, must-pass checks second, and conditional modules for protected health information, retrieval-augmented generation, fine-tuning, or high-impact use. That keeps low-risk purchases moving while preserving escalation for missing evidence or legal blockers.

The first consequence is that the minimum viable questionnaire is not generic procurement. If the tool will touch legal, customer, employee, or health data, the decisive questions are about rights and controls: training, retention, subprocessors, logs, location, portability, indemnity, and scope of contractual paper. [^morgan-lewis-what-s-new-and-what-s-next-navigati-2][^association-of-corporate-counsel-vendor-due-dili-2] A company that gets those wrong can have a beautifully drafted AI policy and still lack a usable legal basis for the deployment it wants.

The third consequence is that the best diligence artifact is executable. Google VSAQ's structure and AI-CAIQ's evidence fields point to the same design: intake first, must-pass conditions second, conditional modules after that, and an output that says more than `approved` or `rejected`. [^google-scalable-vendor-security-reviews-2][^cloud-security-alliance-ai-consensus-assessments-2] In practice that means the AI is not merely filling in a form. It is collecting clauses, mapping missing evidence, deciding which follow-up module is triggered by PHI, RAG, fine-tuning, or high-impact use, and escalating only the files that actually need human review.

The fifth consequence is that a public questionnaire can easily become accidental gatekeeping. NIST warns against mistaking governance material for a complete checklist, and GSA's generative AI acquisition guidance points buyers toward tailored questions and testbeds rather than one frozen form for every purchase. [^nist-ai-rmf-playbook-2][^gsa-gsa-releases-generative-ai-acquisition-resou] That suggests an important consequence for legal teams adopting a skills-file model. The file becomes most useful when it distinguishes must-pass failures from deferred questions. Otherwise it stops being a diligence tool and starts being a no.

## Why must AI vendor privacy promises be checked by product and endpoint? {#check-ai-vendor-privacy-promises}

**Short answer.** AI vendor privacy promises must be checked by product and endpoint because no-training language, retention settings, zero data retention, business associate agreement scope, and logs can differ across services. A usable diligence record ties each answer to the exact product, endpoint, deployment pattern, and evidence URL.

The second consequence is that vendor answers have to be product-specific. The large providers now publish much better privacy positions than they did in 2023, but the detail matters. OpenAI, Anthropic, Google Cloud, and Microsoft all distinguish, in different ways, between `not used for training`, retention needed to operate the service, zero-retention options, BAA scope, and product-specific logging. [^openai-data-controls-in-the-openai-platform][^anthropic-is-my-data-used-for-model-training][^google-cloud-service-specific-terms][^microsoft-data-privacy-and-security-for-azure-di] That means a one-line answer like `enterprise data is not used to train models` can be directionally true and still miss the actual issue. A useful skills file therefore records product name, endpoint, deployment pattern, and evidence URL for each material answer.

The fourth consequence is that `external AI vendor` is no longer a proxy for `unacceptable controls`. That is perhaps the source-set fact that cuts most against easy skepticism. Major vendors now publish DPAs, subprocessor lists, HIPAA pathways, and some form of no-training-by-default language for commercial products. [^openai-enterprise-privacy-at-openai][^anthropic-business-associate-agreements-baa-for][^google-cloud-vertex-ai-and-zero-data-retention][^microsoft-monitor-azure-openai-in-microsoft-foun] The dividing line is becoming less `third party versus not third party` and more `does this workflow, on this product, with these controls, fit the company's data and use case`.

## Which AI vendor diligence questions are still unsettled for legal teams? {#unsettled-ai-vendor-diligence-questions}

**Short answer.** The unsettled questions are whether a market-standard legal-department AI request for proposal exists, how much high-impact-use diligence belongs in the baseline file, and which popular questions actually predict failure. The current source set supports tiering more strongly than a single mandatory questionnaire.

The public-source record is still thin on one basic issue: whether there is a market-standard legal-department AI RFP. The research surfaced ACC's questionnaire, a California bar RFP, public-sector materials, and vendor-side templates, but not a settled private-market standard for legal teams. [^association-of-corporate-counsel-vendor-due-dili-3][^state-bar-of-california-request-for-proposal-leg] Perhaps that is why the better frame is a skills file rather than a canonical questionnaire. The standard seems to be emerging at the level of topics, not document form.

It is also unsettled how much `high-impact use` belongs in the baseline file. Cooley and Wilson Sonsini both pull bias, validation, and transparency into diligence, especially when regulated or consequential uses are involved. [^cooley-utah-colorado-pave-way-for-ai-specific-st-2][^wilson-sonsini-l-suite-ai-playbook-chapter-7-2] But the same source set suggests those are often conditional modules rather than universal opening questions. We think the honest reading is that a hiring tool, clinical support tool, or other high-impact system belongs on a longer branch than a drafting assistant inside legal ops.

Another open question is which popular questions actually predict failure. The materials support training rights, retention, deletion, logs, subprocessors, and portability as load-bearing. They are weaker support for broad questions like `Do you follow the NIST AI RMF?` or `Do you have a responsible AI policy?` Those may be useful maturity signals. They do not seem to do the legal work that the smaller set does. [^morgan-lewis-what-s-new-and-what-s-next-navigati-3][^nist-ai-rmf-playbook-3] That is an inference rather than a rule, but it is a strong one.

And there is a structural uncertainty in publishing the file itself. Once a public questionnaire exists, business teams may treat it as mandatory even for small vendors or pilot tools. The source set leans against that outcome, but perhaps not strongly enough to prevent it without explicit tiering. A skills file that does not mark `must-pass`, `context-dependent`, and `defer for pilot` may end up producing more process than diligence.



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-20. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^regulation-eu-2016-679-art-28]: **Regulation (EU) 2016/679, art. 28** — "sufficient guarantees" *Regulation (EU) 2016/679, art. 28.* <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

[^45-c-f-r-164-504-e-2]: **45 C.F.R. § 164.504(e)(2)** — "establish the permitted and required uses and disclosures" *45 C.F.R. § 164.504(e)(2).* <https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.504>

[^28-c-f-r-202-258]: **28 C.F.R. § 202.258** — "including cloud-computing services" *28 C.F.R. § 202.258.* <https://www.ecfr.gov/current/title-28/chapter-I/part-202/subpart-B/section-202.258>

[^28-c-f-r-202-1001-and-subpart-j]: **28 C.F.R. § 202.1001 and subpart J** — "§ 202.1001 Due diligence for restricted transactions." *28 C.F.R. § 202.1001 and subpart J.* <https://www.ecfr.gov/current/title-28/chapter-I/part-202/subpart-J/section-202.1001>

[^cal-civ-code-1798-100-d]: **Cal. Civ. Code § 1798.100(d)** — "A business that collects a consumer’s personal information and that sells that personal information to, or shares it with, a third party or that discloses it to a service provider or contractor for a business purpose shall enter into an agreement with the third party, service provider, or contractor" *Cal. Civ. Code § 1798.100(d).* <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.100.>

[^cal-code-regs-tit-11-7051]: **Cal. Code Regs. tit. 11, § 7051** — "Contract Requirements for Service Providers and Contractors." *Cal. Code Regs. tit. 11, § 7051.* <https://cppa.ca.gov/regulations/pdf/cppa_regs.pdf>

[^morgan-lewis-what-s-new-and-what-s-next-navigati]: **Morgan Lewis commentary** — "training data rights remain critical" *Morgan Lewis, What's New and What's Next: Navigating AI in Technology Transactions.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/01/whats-new-and-whats-next-navigating-ai-in-technology-transactions>

[^morgan-lewis-contracting-pointers-for-services-i]: **Morgan Lewis commentary** — "Broadly, responsibility for ensuring an AI tool does not violate applicable laws may fall on the party providing the dataset(s) that train the AI tool." *Morgan Lewis, Contracting Pointers for Services Incorporating the Use of AI.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2023/07/contract-corner-contracting-pointers-for-services-incorporating-the-use-of-ai>

[^morgan-lewis-contract-corner-ensuring-ip-provisi]: **Morgan Lewis, Contract Corner: Ensuring IP Provisions Are Fit for GenAI** — "it is important that contracts relating to the use of GenAI and its outputs address the ownership/licensing of such GenAI outputs in order to document the agreement of the parties in the absence of legislative protections." *Morgan Lewis, Contract Corner: Ensuring IP Provisions Are Fit for GenAI.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2024/06/contract-corner-ensuring-ip-provisions-are-fit-for-genai>

[^cooley-model-contractual-clauses-for-ai-procurem]: **Cooley commentary** — "AI ethics, liability, transparency and compliance" *Cooley, Model Contractual Clauses for AI Procurement in the EU: Key Takeaways for AI Companies.* <https://cdp.cooley.com/model-contractual-clauses-for-ai-procurement-in-the-eu-key-takeaways-for-ai-companies/>

[^cooley-utah-colorado-pave-way-for-ai-specific-st]: **Cooley, Utah, Colorado Pave Way for AI-Specific State Laws: Is Your Company R...** — "training data, cybersecurity and measures taken to prevent biased and discriminatory outputs" *Cooley, Utah, Colorado Pave Way for AI-Specific State Laws: Is Your Company Ready for the Impending Regulation Wave?.* <https://cdp.cooley.com/utah-colorado-pave-way-for-ai-specific-state-laws-is-your-company-ready-for-the-impending-regulation-wave/>

[^wilson-sonsini-europe-prepares-for-a-new-era-in]: **Wilson Sonsini, Europe Prepares for a New Era in AI Regulation** — "carry out due diligence on the vendor" *Wilson Sonsini, Europe Prepares for a New Era in AI Regulation.* <https://www.wsgr.com/en/insights/europe-prepares-for-a-new-era-in-ai-regulation.html>

[^wilson-sonsini-l-suite-ai-playbook-chapter-7]: **Wilson Sonsini commentary** — "The AI Act introduces a new risk-based legal framework for AI tools that will apply across all industry sectors." *Wilson Sonsini, L-Suite AI Playbook, Chapter 7.* <https://www.wsgr.com/a/web/cfNZmSk6EmSofy1AN67PfF/l-suite-ai-playbook-chapter-7.pdf>

[^association-of-corporate-counsel-vendor-due-dili]: **Association of Corporate Counsel, Vendor Due Diligence Questionnaire** — "This questionnaire will also provide Customer with a risk assessment of the Supplier AI Products and Services and proposed use cases in order to determine the appropriate and requisite terms that the Customer must include in its legal agreement with the Supplier" *Association of Corporate Counsel, Vendor Due Diligence Questionnaire.* <https://www.acc.com/sites/default/files/2024-08/AI---Vendor-Due-Diligence-Checklist-525861.1-.docx>

[^educause-higher-education-community-vendor-asses]: **EDUCAUSE, Higher Education Community Vendor Assessment Toolkit** — "The Higher Education Community Vendor Assessment Toolkit™ (HECVAT) is a tool designed to help college and university professionals more easily measure vendor risk." *EDUCAUSE, Higher Education Community Vendor Assessment Toolkit.* <https://www.educause.edu/higher-education-community-vendor-assessment-toolkit>

[^cloud-security-alliance-ai-consensus-assessments]: **Cloud Security Alliance, AI Consensus Assessments Initiative Questionnaire (AI-CAIQ) v1.0.2** — "The AI-CAIQ (AI Consensus Assessment Initiative Questionnaire) is a structured framework designed to help organizations self-assess and validate their adherence to AI-specific controls across critical domains such as governance, security, privacy, and operational resilience." *Cloud Security Alliance, AI Consensus Assessments Initiative Questionnaire (AI-CAIQ) v1.0.2.* <https://cloudsecurityalliance.org/artifacts/ai-consensus-assessments-initiative-questionnaire-ai-caiq>

[^nist-ai-rmf-playbook]: **NIST AI RMF Playbook** — "neither a checklist nor set of steps to be followed in its entirety" *NIST AI RMF Playbook.* <https://airc.nist.gov/airmf-resources/playbook/>

[^google-scalable-vendor-security-reviews]: **Google, Scalable vendor security reviews** — "We scale our efforts through automating much of the initial information gathering and triage portions of the vendor review process." *Google, Scalable vendor security reviews.* <https://opensource.googleblog.com/2016/03/scalable-vendor-security-reviews.html>

[^morgan-lewis-what-s-new-and-what-s-next-navigati-2]: **Morgan Lewis commentary** — "training data rights remain critical" *Morgan Lewis, What's New and What's Next: Navigating AI in Technology Transactions.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/01/whats-new-and-whats-next-navigating-ai-in-technology-transactions>

[^association-of-corporate-counsel-vendor-due-dili-2]: **Association of Corporate Counsel, Vendor Due Diligence Questionnaire** — "This questionnaire will also provide Customer with a risk assessment of the Supplier AI Products and Services and proposed use cases in order to determine the appropriate and requisite terms that the Customer must include in its legal agreement with the Supplier" *Association of Corporate Counsel, Vendor Due Diligence Questionnaire.* <https://www.acc.com/sites/default/files/2024-08/AI---Vendor-Due-Diligence-Checklist-525861.1-.docx>

[^google-scalable-vendor-security-reviews-2]: **Google, Scalable vendor security reviews** — "We scale our efforts through automating much of the initial information gathering and triage portions of the vendor review process." *Google, Scalable vendor security reviews.* <https://opensource.googleblog.com/2016/03/scalable-vendor-security-reviews.html>

[^cloud-security-alliance-ai-consensus-assessments-2]: **Cloud Security Alliance, AI Consensus Assessments Initiative Questionnaire (AI-CAIQ) v1.0.2** — "The AI-CAIQ (AI Consensus Assessment Initiative Questionnaire) is a structured framework designed to help organizations self-assess and validate their adherence to AI-specific controls across critical domains such as governance, security, privacy, and operational resilience." *Cloud Security Alliance, AI Consensus Assessments Initiative Questionnaire (AI-CAIQ) v1.0.2.* <https://cloudsecurityalliance.org/artifacts/ai-consensus-assessments-initiative-questionnaire-ai-caiq>

[^nist-ai-rmf-playbook-2]: **NIST AI RMF Playbook** — "neither a checklist nor set of steps to be followed in its entirety" *NIST AI RMF Playbook.* <https://airc.nist.gov/airmf-resources/playbook/>

[^gsa-gsa-releases-generative-ai-acquisition-resou]: **GSA, GSA releases generative AI acquisition resource guide for federal buyers** — "The guide includes considerations for the responsible acquisition of generative AI and introduces questions that contracting officers should ask to make informed procurement decisions." *GSA, GSA releases generative AI acquisition resource guide for federal buyers.* <https://www.gsa.gov/about-us/newsroom/news-releases/gsa-releases-generative-ai-acquisition-resource-gu-04292024>

[^openai-data-controls-in-the-openai-platform]: **OpenAI, Data controls in the OpenAI platform** — "As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in to share data with us)." *OpenAI, Data controls in the OpenAI platform.* <https://developers.openai.com/api/docs/guides/your-data>

[^anthropic-is-my-data-used-for-model-training]: **Anthropic, Is my data used for model training?** — "By default, we will not use your inputs or outputs from our commercial products (e.g. Claude for Work, Anthropic API, Claude Gov, etc.) to train our models." *Anthropic, Is my data used for model training?.* <https://privacy.anthropic.com/en/articles/7996868-i-want-to-opt-out-of-my-prompts-and-results-being-used-for-training-models>

[^google-cloud-service-specific-terms]: **Google Cloud, Service Specific Terms** — "Google will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction." *Google Cloud, Service Specific Terms.* <https://cloud.google.com/terms/service-terms>

[^microsoft-data-privacy-and-security-for-azure-di]: **Microsoft, Data, privacy, and security for Azure Direct Models in Microsoft Foundry** — "Your prompts (inputs) and completions (outputs), your embeddings, and your training data: - are NOT available to other customers. - are NOT available to OpenAI or other Azure Direct Model providers. - are NOT used by Azure Direct Model providers to improve their models or services." *Microsoft, Data, privacy, and security for Azure Direct Models in Microsoft Foundry.* <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy>

[^openai-enterprise-privacy-at-openai]: **OpenAI, Enterprise privacy at OpenAI** — "We do not train our models on your data by default" *OpenAI, Enterprise privacy at OpenAI.* <https://openai.com/enterprise-privacy/>

[^anthropic-business-associate-agreements-baa-for]: **Anthropic, Business Associate Agreements (BAA) for Commercial Products** — "For Claude Enterprise features to be covered under a BAA, an administrator must activate HIPAA compliance in the HIPAA-ready Claude Enterprise admin settings under ‘Data & Privacy’ and sign Anthropic's BAA." *Anthropic, Business Associate Agreements (BAA) for Commercial Products.* <https://privacy.anthropic.com/en/articles/8114513-will-anthropic-sign-a-business-associate-agreement-baa-and-if-so-for-which-products>

[^google-cloud-vertex-ai-and-zero-data-retention]: **Google Cloud, Vertex AI and zero data retention** — "Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction." *Google Cloud, Vertex AI and zero data retention.* <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention>

[^microsoft-monitor-azure-openai-in-microsoft-foun]: **Microsoft, Monitor Azure OpenAI in Microsoft Foundry Models** — "The Azure Monitor service collects and aggregates metrics and logs from every component of your system." *Microsoft, Monitor Azure OpenAI in Microsoft Foundry Models.* <https://learn.microsoft.com/en-us/azure/foundry-classic/openai/how-to/monitor-openai>

[^association-of-corporate-counsel-vendor-due-dili-3]: **Association of Corporate Counsel, Vendor Due Diligence Questionnaire** — "This questionnaire will also provide Customer with a risk assessment of the Supplier AI Products and Services and proposed use cases in order to determine the appropriate and requisite terms that the Customer must include in its legal agreement with the Supplier" *Association of Corporate Counsel, Vendor Due Diligence Questionnaire.* <https://www.acc.com/sites/default/files/2024-08/AI---Vendor-Due-Diligence-Checklist-525861.1-.docx>

[^state-bar-of-california-request-for-proposal-leg]: **State Bar of California, Request for Proposal: Legal Operations, Technology, ...** — "The State Bar, created in 1927 by the Legislature and adopted as a judicial branch agency by amendment to the California Constitution in 1960, is a public corporation within the judicial branch of state government." *State Bar of California, Request for Proposal: Legal Operations, Technology, and Artificial Intelligence Consultant.* <https://www.calbar.ca.gov/sites/default/files/portals/0/documents/rfp/2024/RFP-Legal-Operations-Technology-AI-Consultant.pdf>

[^cooley-utah-colorado-pave-way-for-ai-specific-st-2]: **Cooley, Utah, Colorado Pave Way for AI-Specific State Laws: Is Your Company R...** — "training data, cybersecurity and measures taken to prevent biased and discriminatory outputs" *Cooley, Utah, Colorado Pave Way for AI-Specific State Laws: Is Your Company Ready for the Impending Regulation Wave?.* <https://cdp.cooley.com/utah-colorado-pave-way-for-ai-specific-state-laws-is-your-company-ready-for-the-impending-regulation-wave/>

[^wilson-sonsini-l-suite-ai-playbook-chapter-7-2]: **Wilson Sonsini commentary** — "The AI Act introduces a new risk-based legal framework for AI tools that will apply across all industry sectors." *Wilson Sonsini, L-Suite AI Playbook, Chapter 7.* <https://www.wsgr.com/a/web/cfNZmSk6EmSofy1AN67PfF/l-suite-ai-playbook-chapter-7.pdf>

[^morgan-lewis-what-s-new-and-what-s-next-navigati-3]: **Morgan Lewis commentary** — "training data rights remain critical" *Morgan Lewis, What's New and What's Next: Navigating AI in Technology Transactions.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/01/whats-new-and-whats-next-navigating-ai-in-technology-transactions>

[^nist-ai-rmf-playbook-3]: **NIST AI RMF Playbook** — "neither a checklist nor set of steps to be followed in its entirety" *NIST AI RMF Playbook.* <https://airc.nist.gov/airmf-resources/playbook/>
