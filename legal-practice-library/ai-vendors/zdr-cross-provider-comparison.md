---
type: Practice Note
title: Cross-provider zero-data-retention commitments
description: >-
  How zero data retention works in AI provider contracts, what ZDR covers, and
  which gaps legal teams should check before using AI tools.
resource: >-
  https://openagreements.org/practice-guides/ai-vendors/zdr-cross-provider-comparison
timestamp: '2026-04-20'
tags:
  - ai-vendors
  - zdr-cross-provider-comparison
---

# Cross-provider zero-data-retention commitments[^about]

How zero data retention works in AI provider contracts, what ZDR covers, and which gaps legal teams should check before using AI tools.

## What does zero data retention mean in AI provider contracts? {#what-zero-data-retention-means}

**Short answer.** It depends, because zero data retention is a contract path rather than a legal term with one settled meaning. Counsel should separate no training promises from no stored prompts, outputs, classifier signals, and abuse artifacts.

There is almost no primary law on the phrase zero data retention itself. No statute, regulation, or reported case in the source set defines it across model providers. The governing text is mostly contract: services agreements, DPAs, help-center commitments, approval workflows, and in healthcare-adjacent settings, BAAs or addenda. That is why the comparison looks less like a compliance chart and more like a contract matrix. [^openai-services-agreement][^google-cloud-service-specific-terms][^xai-terms-of-service-enterprise]

The regulated-workflow angle appears in how vendors gate sensitive use. OpenAI's healthcare addendum does not define ZDR abstractly; it ties PHI handling to an endpoint "eligible for Zero Retention"[^openai-healthcare-addendum-and-baa]. Anthropic's BAA materials do something similar. Claude Code via API is "Eligible only with ZDR enabled (for qualified accounts)"[^anthropic-privacy-center-business-associate-agre]. The consequence is that ZDR often functions as a gateway condition for higher-sensitivity deployments, not as a freestanding legal category. [^openai-healthcare-addendum-and-baa][^anthropic-privacy-center-business-associate-agre]

The next distinction is more important than it sounds: no training is not the same thing as no retention. Google says it "will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction"[^google-cloud-service-specific-terms]. OpenAI says it "will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees"[^openai-services-agreement]. Both are meaningful. Neither one, by itself, answers whether prompts, outputs, classifier signals, or abuse-monitoring artifacts are stored. That second question is where the real ZDR differences begin. [^google-cloud-service-specific-terms][^openai-services-agreement][^anthropic-privacy-center-i-have-a-zero-data-rete][^xai-docs-faq-xai-api-security]

Perhaps the cleanest positive-law-adjacent point is that even the most aggressive vendor promises remain subordinate to law, abuse prevention, and safety carveouts. OpenAI's services agreement preserves use to provide the service, comply with law, enforce policies, and prevent abuse. xAI's enterprise terms preserve legal and safety-compliance holdbacks. Anthropic's public retention page keeps longer retention for flagged misuse and legal requirements. So the legal baseline is not zero means zero. It is closer to zero means a narrower contractual data path, subject to explicit exceptions. [^openai-services-agreement][^xai-terms-of-service-enterprise][^anthropic-privacy-center-how-long-do-you-store-m]

## Which AI providers offer zero data retention for legal workflows? {#which-ai-providers-offer-zdr}

**Short answer.** It depends, because each provider ties zero data retention to different products, approvals, and feature limits. The practical comparison is which layer still stores prompts, outputs, history, logs, tool traffic, or cached data.

The comparison that matters is not who says enterprise privacy most often. It is which layer of the stack still stores data. [^google-ai-for-developers-zero-data-retention-in]

The first consequence is that zero often means a smaller product. xAI's public ZDR disables server-side conversation history. Anthropic's ZDR does not follow all the way into code execution or MCP connector exchanges. Google cannot disable retention for some grounding and stateful features because those features depend on retaining something. Companies that buy stricter non-retention promises often give up convenience, statefulness, or managed debugging at the same time. [^xai-docs-faq-xai-api-security-2][^anthropic-docs-mcp-connector]"there is no way to disable the storage of this information"[^google-ai-for-developers-zero-data-retention-in]

The fourth consequence is that OpenAI is the hardest provider in this set to summarize from public materials alone. The public record supports real zero-retention lanes. It also supports a healthcare and enterprise gating story. What it does not yet provide, at least in the source set, is the same single-page baseline-versus-ZDR matrix that Google and xAI now publish. That does not make OpenAI weaker on contract. It makes diligence more dependent on the paper behind the sales process. [^openai-healthcare-addendum-and-baa-2][^openai-help-center-sharing-feedback-evaluation-a][^openai-help-center-openai-compliance-platform-fo]

The last consequence is economic, even though the economics are mostly hidden. Public docs across the set describe approval gates, account-team involvement, or enterprise-only access. They do not supply a reliable market schedule for ZDR pricing or minimum annual spend. So the market is already structured like an enterprise feature market, even where the exact threshold remains offstage. [^anthropic-privacy-center-i-have-a-zero-data-rete-2][^google-cloud-abuse-monitoring][^openai-help-center-what-is-chatgpt-business][^xai-docs-faq-xai-api-security-2][^microsoft-learn-limited-access-for-azure-direct]

## Can cloud platforms change AI zero data retention risk? {#cloud-platform-zdr-risk}

**Short answer.** Yes, cloud platforms can materially change the retention analysis even when the underlying model is the same. Azure and Bedrock can limit native provider access while customer-side logging, caching, files, and stored features still create persistence.

The second consequence is that native-vendor comparison is only part of the problem. Azure and Bedrock are not just reseller channels. They change the retention story. Azure isolates prompts and completions from OpenAI, then overlays Microsoft's own abuse-monitoring rules. Bedrock goes further at the provider layer. AWS says it doesn't store or log your prompts and completions and that model providers do not get access to them. For some legal teams, that architectural separation could matter more than whether the underlying model vendor offers native ZDR on direct sale. [^microsoft-learn-data-privacy-and-security-for-az-2][^amazon-bedrock-user-guide-data-protection-2]

The third consequence is that provider-side minimization and customer-side persistence can move in opposite directions. Google's ZDR materials still preserve caches, files, and session state in some paths. Bedrock offers invocation logging and prompt caching. Microsoft documents stored features explicitly. So a stronger provider-side ZDR term does not necessarily mean a smaller total data footprint. It can mean the durable record moved from the provider to the customer or the cloud intermediary. For some companies that is the point. For others it just changes where retention risk sits. [^google-cloud-vertex-ai-and-zero-data-retention-2][^google-ai-for-developers-zero-data-retention-in-2][^amazon-bedrock-user-guide-prompt-caching-for-fas-2][^amazon-bedrock-user-guide-monitor-model-invocati-2][^microsoft-learn-data-privacy-and-security-for-az-2]

## What should in-house counsel ask AI vendors about zero data retention? {#what-to-ask-ai-vendors-about-zdr}

**Short answer.** Ask about data rights, storage, training, safety review, telemetry, outputs, and the exact enterprise path where zero data retention applies. The public firm commentary supports diligence questions, not a clean spend or approval taxonomy.

The firms in the source set are more aligned than they first look. Morgan Lewis is the most direct on the underlying contracting problem. Its December 11, 2025 note frames AI contracting as allocating rights to data the tool processes, generates, and uses to train, test, or improve the model. That is the right frame for ZDR too. The dispute is rarely only about training. It is also about storage, inspection, derived telemetry, and operational reuse. [^morgan-lewis-key-concepts-in-ai-contracting-data]

Cooley's May 8, 2025 AI governance materials make the diligence point more operational. The slide deck tells buyers to ask about retention of data, retained training rights, confidentiality commitments, ownership of outputs, and the difference between enterprise and individual terms. That lines up almost exactly with the provider record here. Self-serve products and enterprise or API products often sit on materially different retention regimes, even when the marketing language is similar. [^cooley-ai-talks-ai-governance-financial-services][^openai-help-center-what-is-chatgpt-business-2][^anthropic-privacy-center-i-have-a-zero-data-rete-3][^xai-docs-faq-xai-api-security-3]

Wilson Sonsini is narrower, but still useful. Its AI playbook tells buyers to assess whether the tool will reuse personal data to train the vendor's model and to pin roles and responsibilities down in the DPA. That is not a full ZDR framework. Still, it captures a common failure mode: companies collapse training rights, storage, safety review, and processor-controller allocation into one generic privacy discussion. The public vendor terms do not collapse them. They split them. [^wilson-sonsini-l-suite-ai-playbook-chapter-7][^google-cloud-vertex-ai-and-zero-data-retention-3][^anthropic-privacy-center-how-long-do-you-store-m-3]

Fisher Phillips is less specific on vendor matrices, but the emphasis is consistent: the market problem is knowing which vendor questions matter. That may sound basic. It is not. The public material in this area is still much better on scope and carveouts than it is on price, minimum commitment, or approval thresholds. No firm source in this directory supplies a dependable public spend matrix for who gets ZDR, at what contract value, or on what turnaround. [^fisher-phillips-full-court-press-david-o-sacks-n][^morgan-lewis-key-concepts-in-ai-contracting-data][^cooley-ai-talks-ai-governance-financial-services]

That absence is itself a useful conclusion. The firms agree on what to diligence. They do not support a clean public taxonomy that says one provider grants ZDR cheaply, another only at high spend, and a third only for regulated workloads. The public record is still thinner than the market probably wants. [^orrick-the-eu-ai-act-6-steps-to-take-before-2-au][^fisher-phillips-full-court-press-david-o-sacks-n]

## What AI zero data retention gaps remain unresolved? {#unresolved-zdr-gaps}

**Short answer.** Unclear, because the market has not converged on whether zero data retention covers only inference traffic or every derivative and adjacent workflow record. The open issues are classifier results, sanitized logs, tool traffic, subprocessors, de-identified data, and feature-specific storage.

- 
- 
- 
- 
- 



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-20. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^openai-services-agreement]: **OpenAI, Services Agreement** — "will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees" *OpenAI, Services Agreement.* <https://openai.com/policies/services-agreement/>

[^google-cloud-service-specific-terms]: **Google Cloud, Service Specific Terms** — "will not use Customer Data to train or fine-tune any AI/ML models without Customer's prior permission or instruction" *Google Cloud, Service Specific Terms.* <https://cloud.google.com/terms/service-terms>

[^xai-terms-of-service-enterprise]: **xAI, Terms of Service - Enterprise** — "Customer acknowledges that no xAI intellectual property rights are assigned or transferred to Customer hereunder. Customer is obtaining only a limited right to access and use the Services during the Subscription Term of this Agreement." *xAI, Terms of Service - Enterprise.* <https://x.ai/legal/terms-of-service-enterprise>

[^openai-healthcare-addendum-and-baa]: **OpenAI, Healthcare Addendum and BAA** — "eligible for Zero Retention" *OpenAI, Healthcare Addendum and BAA.* <https://cdn.openai.com/osa/healthcare-addendum.pdf>

[^anthropic-privacy-center-business-associate-agre]: **Anthropic Privacy Center, Business Associate Agreements (BAA) for Commercial Customers** — "Eligible only with ZDR enabled (for qualified accounts)" *Anthropic Privacy Center, Business Associate Agreements (BAA) for Commercial Customers.* <https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers>

[^anthropic-privacy-center-i-have-a-zero-data-rete]: **Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?** — "the only products to which zero data retention applies are eligible Anthropic APIs, and Anthropic products that use your Commercial organization API key (including Claude Code)." *Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?.* <https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to>

[^xai-docs-faq-xai-api-security]: **xAI Docs, FAQ - xAI API Security** — "xAI never trains on your API inputs or outputs without your explicit permission." *xAI Docs, FAQ - xAI API Security.* <https://docs.x.ai/developers/faq/security>

[^anthropic-privacy-center-how-long-do-you-store-m]: **Anthropic Privacy Center, How long do you store my organization's data?** — "For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation" *Anthropic Privacy Center, How long do you store my organization's data?.* <https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data>

[^google-ai-for-developers-zero-data-retention-in]: **Google AI for Developers, Zero data retention in the Gemini Developer API** — "there is no way to disable the storage of this information" *Google AI for Developers, Zero data retention in the Gemini Developer API.* <https://ai.google.dev/gemini-api/docs/zdr>

[^xai-docs-faq-xai-api-security-2]: **xAI Docs, FAQ - xAI API Security** — "xAI never trains on your API inputs or outputs without your explicit permission." *xAI Docs, FAQ - xAI API Security.* <https://docs.x.ai/developers/faq/security>

[^anthropic-docs-mcp-connector]: **Anthropic Docs, MCP connector** — "Claude's Model Context Protocol (MCP) connector feature enables you to connect to remote MCP servers directly from the Messages API without a separate MCP client." *Anthropic Docs, MCP connector.* <https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector>

[^openai-healthcare-addendum-and-baa-2]: **OpenAI, Healthcare Addendum and BAA** — "eligible for Zero Retention" *OpenAI, Healthcare Addendum and BAA.* <https://cdn.openai.com/osa/healthcare-addendum.pdf>

[^openai-help-center-sharing-feedback-evaluation-a]: **OpenAI Help Center, Sharing feedback, evaluation and fine-tuning data, and API inputs and outputs with OpenAI** — "By default, we don’t use any inputs or outputs from our products for business users, including ChatGPT Business, ChatGPT Enterprise, and the API, to improve our models." *OpenAI Help Center, Sharing feedback, evaluation and fine-tuning data, and API inputs and outputs with OpenAI.* <https://help.openai.com/en/articles/10306912-sharing-feedback-evaluation-and-fine-tuning-data-and-api-inputs-and-outputs-with-openai>

[^openai-help-center-openai-compliance-platform-fo]: **OpenAI Help Center, OpenAI Compliance Platform for Enterprise and Edu Customers** — "The Compliance Platform provides access to logs and metadata from your ChatGPT workspace that you can connect with your eDiscovery, DLP, or SIEM tools." *OpenAI Help Center, OpenAI Compliance Platform for Enterprise and Edu Customers.* <https://help.openai.com/en/articles/9261474-openai-compliance-platform-for-enterprise-and-edu-customers>

[^anthropic-privacy-center-i-have-a-zero-data-rete-2]: **Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?** — "the only products to which zero data retention applies are eligible Anthropic APIs, and Anthropic products that use your Commercial organization API key (including Claude Code)." *Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?.* <https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to>

[^google-cloud-abuse-monitoring]: **Google Cloud, Abuse monitoring** — "Google uses automated safety classifiers to detect potential abuse and violations." *Google Cloud, Abuse monitoring.* <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/abuse-monitoring>

[^openai-help-center-what-is-chatgpt-business]: **OpenAI Help Center, What is ChatGPT Business?** — "ChatGPT Business is a self-serve plan designed for organizations that want a shared ChatGPT workspace for their teams." *OpenAI Help Center, What is ChatGPT Business?.* <https://help.openai.com/en/articles/8792828-what-is-chatgpt-business>

[^microsoft-learn-limited-access-for-azure-direct]: **Microsoft Learn, Limited access for Azure Direct Models** — "certain Azure Direct Models (or versions of them) are designated as Limited Access Services, and access and use are subject to eligibility criteria determined by Microsoft." *Microsoft Learn, Limited access for Azure Direct Models.* <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/limited-access>

[^microsoft-learn-data-privacy-and-security-for-az-2]: **Microsoft Learn, Data, privacy, and security for Azure Direct Models in Microsoft Foundry** — "Your prompts (inputs) and completions (outputs), your embeddings, and your training data: - are NOT available to other customers. - are NOT available to OpenAI or other Azure Direct Model providers. - are NOT used by Azure Direct Model providers to improve their models or services." *Microsoft Learn, Data, privacy, and security for Azure Direct Models in Microsoft Foundry.* <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy>

[^amazon-bedrock-user-guide-data-protection-2]: **Amazon Bedrock User Guide, Data protection** — "We strongly recommend that you never put confidential or sensitive information, such as your customers' email addresses, into tags or free-form text fields such as a Name field." *Amazon Bedrock User Guide, Data protection.* <https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html>

[^google-cloud-vertex-ai-and-zero-data-retention-2]: **Google Cloud, Vertex AI and zero data retention** — "Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction." *Google Cloud, Vertex AI and zero data retention.* <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention>

[^google-ai-for-developers-zero-data-retention-in-2]: **Google AI for Developers, Zero data retention in the Gemini Developer API** — "there is no way to disable the storage of this information" *Google AI for Developers, Zero data retention in the Gemini Developer API.* <https://ai.google.dev/gemini-api/docs/zdr>

[^amazon-bedrock-user-guide-prompt-caching-for-fas-2]: **Amazon Bedrock User Guide, Prompt caching for faster model inference** — "Prompt caching is an optional feature that you can use with supported models on Amazon Bedrock to reduce inference response latency and input token costs." *Amazon Bedrock User Guide, Prompt caching for faster model inference.* <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html>

[^amazon-bedrock-user-guide-monitor-model-invocati-2]: **Amazon Bedrock User Guide, Monitor model invocation using CloudWatch Logs and Amazon S3** — "You can use model invocation logging to collect invocation logs, model input data, and model output data for all invocations in your AWS account used in Amazon Bedrock in a Region." *Amazon Bedrock User Guide, Monitor model invocation using CloudWatch Logs and Amazon S3.* <https://docs.aws.amazon.com/bedrock/latest/userguide/model-invocation-logging.html>

[^morgan-lewis-key-concepts-in-ai-contracting-data]: **Morgan Lewis commentary** — "One of the key concepts in contracting for generative AI (GenAI) is allocating rights to data that the GenAI tool processes and generates, as well as any data used to train, test, and improve the underlying AI model." *Morgan Lewis, Key Concepts in AI Contracting: Data Rights and Restrictions.* <https://www.morganlewis.com/blogs/sourcingatmorganlewis/2025/12/key-concepts-in-ai-contracting-data-rights-and-restrictions>

[^cooley-ai-talks-ai-governance-financial-services]: **Cooley commentary** — "Imposes obligations on both developers and deployers of AI: documentation, disclosure, risk analysis, governance" *Cooley, AI Talks: AI Governance & Financial Services.* <https://www.cooley.com/-/media/cooley/event-material/5in5---ai-governance-and-financial-services-presentation.pdf>

[^openai-help-center-what-is-chatgpt-business-2]: **OpenAI Help Center, What is ChatGPT Business?** — "ChatGPT Business is a self-serve plan designed for organizations that want a shared ChatGPT workspace for their teams." *OpenAI Help Center, What is ChatGPT Business?.* <https://help.openai.com/en/articles/8792828-what-is-chatgpt-business>

[^anthropic-privacy-center-i-have-a-zero-data-rete-3]: **Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?** — "the only products to which zero data retention applies are eligible Anthropic APIs, and Anthropic products that use your Commercial organization API key (including Claude Code)." *Anthropic Privacy Center, I have a zero data retention agreement with Anthropic. What products does it apply to?.* <https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to>

[^xai-docs-faq-xai-api-security-3]: **xAI Docs, FAQ - xAI API Security** — "xAI never trains on your API inputs or outputs without your explicit permission." *xAI Docs, FAQ - xAI API Security.* <https://docs.x.ai/developers/faq/security>

[^wilson-sonsini-l-suite-ai-playbook-chapter-7]: **Wilson Sonsini commentary** — "The AI Act introduces a new risk-based legal framework for AI tools that will apply across all industry sectors." *Wilson Sonsini, L-Suite AI Playbook, Chapter 7.* <https://www.wsgr.com/a/web/cfNZmSk6EmSofy1AN67PfF/l-suite-ai-playbook-chapter-7.pdf>

[^google-cloud-vertex-ai-and-zero-data-retention-3]: **Google Cloud, Vertex AI and zero data retention** — "Google won't use your data to train or fine-tune any AI/ML models without your prior permission or instruction." *Google Cloud, Vertex AI and zero data retention.* <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention>

[^anthropic-privacy-center-how-long-do-you-store-m-3]: **Anthropic Privacy Center, How long do you store my organization's data?** — "For Anthropic API users, we automatically delete inputs and outputs on our backend within 30 days of receipt or generation" *Anthropic Privacy Center, How long do you store my organization's data?.* <https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data>

[^fisher-phillips-full-court-press-david-o-sacks-n]: **Fisher Phillips / Full Court Press commentary** — "President Donald Trump’s appointment of David O. Sacks as the new ‘AI and Crypto Czar’ signals a major shift in how the federal government plans to approach artificial intelligence (AI) and its role in the workplace." *Fisher Phillips / Full Court Press, David O. Sacks Named Artificial Intelligence and Crypto Czar: What Employers Need to Know About a New Era of AI Oversight.* <https://www.fisherphillips.com/a/web/6QimoZsu3t1iXLvdq9jxe/meneghello.pdf>

[^orrick-the-eu-ai-act-6-steps-to-take-before-2-au]: **Orrick commentary** — "The AI Act affects a wide range of operators along the AI value chain, including providers, deployers, importers, distributors and product manufacturers. The obligations vary depending on an organization’s role." *Orrick, The EU AI Act: 6 Steps to Take Before 2 August 2026.* <https://www.orrick.com/en/Insights/2025/11/The-EU-AI-Act-6-Steps-to-Take-Before-2-August-2026>
