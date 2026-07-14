---
type: Practice Guide
title: Vendor lock-in risk in AI service agreements
description: >-
  Legal and technical AI vendor lock-in risks, including prompts, fine-tunes,
  embeddings, audit logs, residency terms, and portability rights.
resource: 'https://openagreements.org/practice-guides/ai-vendors/vendor-lock-in-risk'
timestamp: '2026-04-20'
tags:
  - ai-vendors
  - vendor-lock-in-risk
---

# Vendor lock-in risk in AI service agreements[^about]

Legal and technical AI vendor lock-in risks, including prompts, fine-tunes, embeddings, audit logs, residency terms, and portability rights.

## What legal rights help companies escape AI vendor lock-in? {#legal-rights-ai-vendor-lock-in}

**Short answer.** The best legal lever is usually the EU Data Act for cloud-style services, while GDPR portability only helps with personal data. In the United States, counsel should treat portability as a negotiated contract and architecture issue unless a specific statute applies.

Perhaps the closest thing to an anti-lock-in statute for AI services is not an AI statute at all. It is Chapter VI of Regulation (EU) 2023/2854, the Data Act. Article 23 requires providers of data processing services to remove "commercial, technical, contractual and organisational obstacles"[^regulation-eu-2023-2854-art-23] to switching. Article 25 requires exportable data and digital assets to move without undue delay and within a transition period that may not exceed 30 calendar days. Article 29 adds that, from January 12, 2027, providers shall not impose any switching charges. [^regulation-eu-2023-2854-art-23]

That regime was drafted for `data processing services`, not foundation-model APIs as such. Still, the practical fit is obvious enough. Many enterprise AI products are sold as managed cloud services, even when the model is the visible surface. In that setting, the strongest present legal argument against technical and contractual lock-in comes through cloud-switching law rather than model law. [^regulation-eu-2023-2854-art-23][^hogan-lovells-eu-data-act-series-part-7-easy-swi][^alston-bird-the-data-act-switching-requirements]

GDPR Article 20 does something narrower. It gives the data subject a right to receive personal data in a "structured, commonly used and machine-readable format"[^regulation-eu-2016-679-art-20-1] and to transmit those data to another controller without hindrance. [^regulation-eu-2016-679-art-20-1] That matters where an AI deployment processes customer or employee personal data. It does not create a general enterprise right to port prompt libraries, system instructions, evaluation history, ranking models, vector indexes, or fine-tuning deltas just because they sit inside an AI product.

The rest is mostly contract and system design. In the source set, there is no U.S. federal analogue that plays the same role as the Data Act, and no reported appellate decision squarely answers whether prompts, embeddings, or fine-tuned artifacts must be made portable absent express contract language. That is why public vendor commitments and law-firm commentary do so much of the practical work here.

RPC is the most direct. Its June 10, 2025 procurement checklist says AI sourcing often requires significant onboarding and fine-tuning, and states flatly that "vendor lock-in is a risk that is heightened when procuring AI due to its complexity"[^rpc-procuring-ai-commercial-considerations-check]. RPC's companion piece on AI-as-a-service then treats exit as a knowledge-transfer and interoperability problem, not just a termination-right problem. [^rpc-procuring-ai-commercial-considerations-check][^rpc-ai-as-a-service-key-issues]

DLA Piper comes at the same issue from one layer lower in the stack. Its 2023 piece says the "typical procurement and due diligence process should now be adjusted"[^dla-piper-before-creating-or-acquiring-a-technol] for generative AI. [^dla-piper-before-creating-or-acquiring-a-technol] The point is not only that the direct vendor's paper matters. The upstream model's terms, restrictions on competitive use, ownership language around generated material, and internal AI policies can all become hidden switching costs.

Alston & Bird and Hogan Lovells supply the stronger legal analogy. Alston's September 2025 note reads the Data Act as requiring cloud contracts to support switching within a 30-day transition and to specify the data and digital assets that move on exit. [^alston-bird-the-data-act-switching-requirements] Hogan Lovells emphasizes the same statutory purpose in slightly broader terms: removing "commercial, technical, contractual and organizational obstacles"[^hogan-lovells-eu-data-act-series-part-7-easy-swi] and enabling even simultaneous use of multiple providers. [^hogan-lovells-eu-data-act-series-part-7-easy-swi][^hogan-lovells-the-month-in-5-bytes-october]

There is not much real disagreement across these firms. The disagreement, if any, is about where to look first. RPC emphasizes onboarding knowledge and interoperability. DLA Piper emphasizes the upstream vendor chain. Alston and Hogan emphasize statutory switching mechanics. Together they point to the same conclusion: AI lock-in usually arrives through technical dependency that the contract merely ratifies.

- Perhaps the first unresolved issue is coverage. The EU Data Act clearly reaches `data processing services`, but it is still not fully tested how neatly that category maps onto foundation-model APIs sold through different commercial forms. The better the AI product looks like managed cloud infrastructure, the stronger the analogy appears. The more bespoke the arrangement, the less certain that fit becomes. [^regulation-eu-2023-2854-art-23][^hogan-lovells-eu-data-act-series-part-7-easy-swi]

## Can prompts and fine-tuned AI models move to another vendor? {#prompts-fine-tunes-ai-vendor-portability}

**Short answer.** Usually no; text prompts may export, but behavior, custom model artifacts, and evaluation baselines may not move cleanly. Ownership language does not by itself create operational portability.

The contract can be portable while the system is not. Prompt libraries export as text. What often fails to travel is the behavior those prompts assume. Provider documentation still reflects model-specific conventions around tool use, message structure, or reasoning scaffolds. Abstraction frameworks help with the common denominator, but they also acknowledge provider-specific fields and integrations. The result is that prompt engineering can start to look less like `customer data` and more like application logic. A provider switch may therefore preserve the words while still requiring retuning, regression testing, and new eval baselines. [^anthropic-docs-features-overview][^deepseek-r1-model-card][^langchain-docs-models][^llamaindex-docs-available-llm-integrations]

Fine-tunes split into two markets. OpenAI and Anthropic are customer-favorable on ownership of inputs and outputs and on not training on customer content by default. That matters, but it is not the same as promising export of the resulting custom model weights or a portable fine-tuning artifact. In the source set, Google's public documentation is friendlier to export for some model artifacts, Azure exposes downloadable artifacts for open models in its catalog, and AWS is the clearest on the open-weight path because Bedrock supports import of customized open-source models in hosted form. [^openai-openai-services-agreement][^anthropic-commercial-terms-of-service][^google-cloud-export-model-artifacts-for-inferenc][^microsoft-learn-explore-microsoft-foundry-models][^aws-docs-use-custom-model-import-to-import-a-cus] The consequence is that a closed-provider custom model can be `yours` in the ordinary commercial sense while still not being portable in the operational sense.

- Prompt portability is also still contested in practice. One side says frontier models are now similar enough that most prompt assets move with limited revision, especially when the workload stays near ordinary chat, tools, and retrieval. The other side points to provider-specific tool semantics, reasoning scaffolds, and safety behavior that make heavily optimized systems much harder to move than a text export suggests. We think both are true at different depths of integration. [^langchain-docs-chat-model-integrations][^llamaindex-docs-available-llm-integrations][^deepseek-r1-model-card]

## Why do retrieval systems make AI vendor switching more expensive? {#retrieval-systems-ai-vendor-switching}

**Short answer.** RAG lock-in usually comes from embeddings, chunking, metadata, reranking, guardrails, and evaluation history rather than the raw corpus. Migration often means re-embedding and retesting retrieval quality.

RAG lock-in is usually embedding lock-in plus evaluation lock-in. The raw corpus is rarely the hard part. The hard part is the combination of chunking, metadata, embedding space, reranking, guardrails, and evaluation history built around one stack. Google currently documents 3072-dimensional Gemini text embeddings. AWS Bedrock knowledge-base materials list different supported embedding models and dimensions across providers and regions. [^google-cloud-get-text-embeddings][^aws-docs-supported-models-and-regions-for-amazon] A migration can therefore mean re-embedding the corpus, changing vector-store assumptions, and revalidating retrieval quality. Companies that kept raw corpora, chunking logic, and eval sets outside the managed retrieval layer still face work. Companies that did not face a much more expensive kind of work.

## Can AI residency and audit logs create vendor lock-in? {#ai-residency-audit-logs-vendor-lock-in}

**Short answer.** Yes. Residency commitments and audit-log exports can narrow the replacement vendor set even when they look like compliance features.

Residency can become a lock-in term even when no one calls it that. OpenAI now distinguishes between storage residency and inference residency for business customers. Anthropic exposes supported regional controls, but not every product path or feature set carries the same geography promise. AWS, Google, and Azure offer broader regional deployment patterns, but those patterns can move the dependence upward from the model vendor to the cloud vendor. [^openai-help-center-data-residency-and-inference][^anthropic-docs-pricing-and-data-residency-notes][^aws-docs-data-protection-amazon-bedrock][^microsoft-learn-data-privacy-and-security-for-az] The practical effect is that a compliance-approved design can narrow the substitute set before price or capability enters the analysis.

Observability does not travel cleanly either. OpenAI exposes audit-log and admin APIs. Anthropic offers usage and cost history. Google, Azure, and AWS all publish some mix of audit logs, billing export, CloudTrail, Activity Log, or Log Analytics pathways. [^openai-api-reference-audit-logs-and-admin-endpoi][^anthropic-docs-usage-and-cost-api][^google-cloud-vertex-ai-audit-logging-information][^microsoft-learn-activity-log-in-azure-monitor][^aws-docs-monitor-amazon-bedrock-api-calls-using] That is real portability, but only of one layer. It does not recreate provider-side moderation outcomes, workspace analytics semantics, evaluation history, or the exact way the original platform rendered and classified activity. Historical visibility moves. System behavior usually does not.

## Do open models and abstraction layers prevent AI vendor lock-in? {#open-models-abstraction-ai-vendor-lock-in}

**Short answer.** They can improve leverage, but they do not eliminate switching cost. The company still needs portable artifacts, evaluations, routing rules, and governance outside the vendor boundary.

Open models improve the exit option without making it free. Meta, Mistral, and DeepSeek are now credible enough to matter in negotiations and emergency planning. [^meta-llama][^mistral-ai-docs-api-access-with-ai-studio-server][^deepseek-v3-2-model-materials] But an open model becomes a true exit only if the company preserved the surrounding assets outside the provider boundary: source corpus, prompt assets, tokenizer assumptions, safety settings, evaluation data, and deployable model artifacts. Otherwise the lock-in has not disappeared. It has moved from the service agreement to hosting, tuning, and governance work.

Abstraction layers change the location of dependence more than they erase it. LangChain and LlamaIndex are right that a common interface lowers direct API switching cost. Box's multi-model AI posture shows the same idea at the application layer: keep the content and governance layer stable and let the inference provider vary. [^langchain-docs-langchain-overview][^llamaindex-docs-using-llms][^box-box-ai][^box-developer-docs-supported-ai-models] That is a meaningful reduction in one kind of lock-in. It is not the same thing as zero lock-in. The dependency often moves upward into routing rules, provider adapters, tracing, message schemas, and evaluation harnesses.

- Open-weight models may reduce bargaining asymmetry without eliminating total switching cost. They preserve a more credible exit path where weights and artifacts are preserved. They also shift cost into hosting, safety review, monitoring, and regional deployment. That looks less like `no lock-in` and more like a different lock-in curve. [^aws-docs-use-custom-model-import-to-import-a-cus-2][^meta-llama][^mistral-ai-docs-api-access-with-ai-studio-server][^deepseek-r1-model-card-2]
- The last open question is whether abstraction should be understood as lower lock-in or relocated lock-in. It probably depends on what was scarce in the first place. If the bottleneck was a single model API, a neutral orchestration layer can help a lot. If the bottleneck becomes one framework's tracing, routing, and eval conventions, the dependency has not disappeared. It has changed address. [^langchain-docs-langchain-overview][^llamaindex-docs-using-llms][^box-box-ai]



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-04-20. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Federal + multi-state coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *Vendor lock-in risk in AI service agreements*, OpenAgreements (last updated April 20, 2026), https://openagreements.org/practice-guides/ai-vendors/vendor-lock-in-risk.

[^regulation-eu-2023-2854-art-23]: **Regulation (EU) 2023/2854, art. 23** — "commercial, technical, contractual and organisational obstacles" *Regulation (EU) 2023/2854, art. 23.* <https://eur-lex.europa.eu/eli/reg/2023/2854/oj/eng>

[^hogan-lovells-eu-data-act-series-part-7-easy-swi]: **Hogan Lovells commentary** — "commercial, technical, contractual and organizational obstacles" *Hogan Lovells, EU Data Act Series (part 7): Easy switching between data processing services (SaaS, IaaS, PaaS…).* <https://www.hoganlovells.com/en/publications/eu-data-act-series-part-7-easy-switching-between-data-processing-services-saas-iaas-paas>

[^alston-bird-the-data-act-switching-requirements]: **Alston & Bird commentary** — "The purpose of the Data Act is to promote the EU’s digital economy by making data more accessible and usable, as well as by increasing fairness and competition." *Alston & Bird, The Data Act: Switching Requirements for Cloud Services Providers.* <https://www.alston.com/en/insights/publications/2025/09/eu-data-act-switching-requirements-cloud-services>

[^regulation-eu-2016-679-art-20-1]: **Regulation (EU) 2016/679, art. 20(1)** — "structured, commonly used and machine-readable format" *Regulation (EU) 2016/679, art. 20(1).* <https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng>

[^rpc-procuring-ai-commercial-considerations-check]: **RPC commentary** — "vendor lock-in is a risk that is heightened when procuring AI due to its complexity" *RPC, Procuring AI – commercial considerations checklist.* <https://www.rpclegal.com/thinking/artificial-intelligence/ai-guide/procuring-ai-commercial-considerations-checklist/>

[^rpc-ai-as-a-service-key-issues]: **RPC commentary** — "Artificial Intelligence-as-a-Service (AIaaS), in the same vein as Software-as-a-Service and Infrastructure-as-a-Service, refers to cloud-based tools that allow businesses to gain access to an AI model hosted by a third party provider." *RPC, AI-as-a-service – key issues.* <https://www.rpclegal.com/thinking/artificial-intelligence/ai-guide/ai-as-a-service-key-issues/>

[^dla-piper-before-creating-or-acquiring-a-technol]: **DLA Piper commentary** — "typical procurement and due diligence process should now be adjusted" *DLA Piper, Before creating or acquiring a technology solution that is generated by AI, consider your contract terms.* <https://www.dlapiper.com/en-us/insights/publications/ai-outlook/2023/before-creating-or-acquiring-a-technology-solution-that-is-generated-by-ai>

[^hogan-lovells-the-month-in-5-bytes-october]: **Hogan Lovells commentary** — "Under the AI Act, the provider is required to report any serious incident to the market surveillance authorities of the Member States where that incident occurred." *Hogan Lovells, The month in 5 bytes | October.* <https://digital-client-solutions.hoganlovells.com/resources/digital-transformation-academy/monthly-bytes/the-month-in-5-bytes-october>

[^anthropic-docs-features-overview]: **Anthropic Docs, Features overview** — "Generally available (GA) | Feature is stable, fully supported, and recommended for production use." *Anthropic Docs, Features overview.* <https://docs.anthropic.com/en/docs/build-with-claude/overview>

[^deepseek-r1-model-card]: **DeepSeek-R1 model card** — "DeepSeek-R1 series support commercial use, allow for any modifications and derivative works, including, but not limited to, distillation for training other LLMs." *DeepSeek-R1 model card.* <https://huggingface.co/deepseek-ai/DeepSeek-R1>

[^langchain-docs-models]: **LangChain Docs, Models** — "LangChain supports all major model providers through dedicated integration packages. Each provider package implements the same standard interface, so you can swap providers without rewriting application logic." *LangChain Docs, Models.* <https://docs.langchain.com/oss/python/langchain/models>

[^llamaindex-docs-available-llm-integrations]: **LlamaIndex Docs, Available LLM integrations** — "We support integrations with OpenAI, Anthropic, Google, Hugging Face, and more." *LlamaIndex Docs, Available LLM integrations.* <https://developers.llamaindex.ai/python/framework/module_guides/models/llms/modules/>

[^openai-openai-services-agreement]: **OpenAI, OpenAI Services Agreement** — "As between Customer and OpenAI, to the extent permitted by applicable law, Customer: (a) retains all ownership rights in Input; and (b) owns all Output." *OpenAI, OpenAI Services Agreement.* <https://openai.com/policies/services-agreement/>

[^anthropic-commercial-terms-of-service]: **Anthropic, Commercial Terms of Service** — "Customer acknowledges, and must notify its Users, that factual assertions in Outputs should not be relied upon without independently checking their accuracy, as they may be false, incomplete, misleading or not reflective of recent events or information." *Anthropic, Commercial Terms of Service.* <https://www.anthropic.com/legal/commercial-terms>

[^google-cloud-export-model-artifacts-for-inferenc]: **Google Cloud, Export model artifacts for inference and explanation** — "To use one of these prebuilt containers, you must save your model as one or more model artifacts that comply with the requirements of the prebuilt container." *Google Cloud, Export model artifacts for inference and explanation.* <https://docs.cloud.google.com/vertex-ai/docs/training/exporting-model-artifacts>

[^microsoft-learn-explore-microsoft-foundry-models]: **Microsoft Learn, Explore Microsoft Foundry Models in Azure Machine Learning** — "Models from providers other than Microsoft are Non-Microsoft Products as defined in Microsoft Product Terms and are subject to the terms provided with the models." *Microsoft Learn, Explore Microsoft Foundry Models in Azure Machine Learning.* <https://learn.microsoft.com/en-us/azure/machine-learning/foundry-models-overview>

[^aws-docs-use-custom-model-import-to-import-a-cus]: **AWS Docs, Use Custom model import to import a customized open-source model into Amazon Bedrock** — "You can create a custom model in Amazon Bedrock by using the Amazon Bedrock Custom Model Import feature to import Foundation Models that you have customized in other environments, such as Amazon SageMaker AI." *AWS Docs, Use Custom model import to import a customized open-source model into Amazon Bedrock.* <https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization-import-model.html>

[^langchain-docs-chat-model-integrations]: **LangChain Docs, Chat model integrations** — "Chat models are language models that use a sequence of messages as inputs and return messages as outputs ." *LangChain Docs, Chat model integrations.* <https://docs.langchain.com/oss/python/integrations/chat>

[^google-cloud-get-text-embeddings]: **Google Cloud, Get text embeddings** — "Dense vector embedding models use deep-learning methods similar to the ones used by large language models." *Google Cloud, Get text embeddings.* <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings>

[^aws-docs-supported-models-and-regions-for-amazon]: **AWS Docs, Supported models and Regions for Amazon Bedrock knowledge bases** — "Amazon Bedrock Knowledge Bases also supports the use of inference profiles for parsing data or when generating responses." *AWS Docs, Supported models and Regions for Amazon Bedrock knowledge bases.* <https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html>

[^openai-help-center-data-residency-and-inference]: **OpenAI Help Center, Data residency and inference residency for ChatGPT** — "Data residency for ChatGPT allows customers to keep their customer content stored at rest in a specific geographic region." *OpenAI Help Center, Data residency and inference residency for ChatGPT.* <https://help.openai.com/en/articles/9903489-data-residency-and-inference-residency-for-chatgpt>

[^anthropic-docs-pricing-and-data-residency-notes]: **Anthropic Docs, Pricing and data residency notes** — "For Claude Opus 4.7, Claude Opus 4.6, and newer models, specifying US-only inference via the inference_geo parameter incurs a 1.1x multiplier on all token pricing categories, including input tokens, output tokens, cache writes, and cache reads." *Anthropic Docs, Pricing and data residency notes.* <https://docs.anthropic.com/en/docs/about-claude/pricing>

[^aws-docs-data-protection-amazon-bedrock]: **AWS Docs, Data protection - Amazon Bedrock** — "We strongly recommend that you never put confidential or sensitive information, such as your customers' email addresses, into tags or free-form text fields such as a Name field." *AWS Docs, Data protection - Amazon Bedrock.* <https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html>

[^microsoft-learn-data-privacy-and-security-for-az]: **Microsoft Learn, Data, privacy, and security for Azure Direct Models in Microsoft Foundry** — "Your prompts (inputs) and completions (outputs), your embeddings, and your training data: - are NOT available to other customers. - are NOT available to OpenAI or other Azure Direct Model providers. - are NOT used by Azure Direct Model providers to improve their models or services." *Microsoft Learn, Data, privacy, and security for Azure Direct Models in Microsoft Foundry.* <https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy>

[^openai-api-reference-audit-logs-and-admin-endpoi]: **OpenAI API Reference, audit logs and admin endpoints** — "OpenAI recommends logging request IDs in production deployments for more efficient troubleshooting with our support team, should the need arise." *OpenAI API Reference, audit logs and admin endpoints.* <https://developers.openai.com/api/reference/>

[^anthropic-docs-usage-and-cost-api]: **Anthropic Docs, Usage and Cost API** — "The Usage & Cost Admin API provides programmatic and granular access to historical API usage and cost data for your organization." *Anthropic Docs, Usage and Cost API.* <https://platform.claude.com/docs/en/build-with-claude/usage-cost-api>

[^google-cloud-vertex-ai-audit-logging-information]: **Google Cloud, Vertex AI audit logging information** — "Admin Activity audit logs are always enabled; you can't disable them." *Google Cloud, Vertex AI audit logging information.* <https://docs.cloud.google.com/vertex-ai/docs/general/audit-logging>

[^microsoft-learn-activity-log-in-azure-monitor]: **Microsoft Learn, Activity log in Azure Monitor** — "Azure Monitor activity logs record management operations on your Azure resources." *Microsoft Learn, Activity log in Azure Monitor.* <https://learn.microsoft.com/en-us/azure/azure-monitor/platform/activity-log>

[^aws-docs-monitor-amazon-bedrock-api-calls-using]: **AWS Docs, Monitor Amazon Bedrock API calls using CloudTrail** — "Amazon Bedrock is integrated with AWS CloudTrail, a service that provides a record of actions taken by a user, role, or an AWS service in Amazon Bedrock." *AWS Docs, Monitor Amazon Bedrock API calls using CloudTrail.* <https://docs.aws.amazon.com/bedrock/latest/userguide/logging-using-cloudtrail.html>

[^meta-llama]: **Meta, Llama** — "The open-source AI models you can fine-tune, distill and deploy anywhere." *Meta, Llama.* <https://llama.meta.com/>

[^mistral-ai-docs-api-access-with-ai-studio-server]: **Mistral AI Docs, API Access with AI Studio - Serverless / Other Options** — "Studio gives you programmatic access to Mistral models for text generation, agents, data processing, and more." *Mistral AI Docs, API Access with AI Studio - Serverless / Other Options.* <https://docs.mistral.ai/deployment/ai-studio>

[^deepseek-v3-2-model-materials]: **DeepSeek-V3.2 model materials** — "The output parsing function included in the code is designed to handle well-formatted strings only. It does not attempt to correct or recover from malformed output that the model might occasionally generate. It is not suitable for production use without robust error handling." *DeepSeek-V3.2 model materials.* <https://huggingface.co/deepseek-ai/DeepSeek-V3.2>

[^langchain-docs-langchain-overview]: **LangChain Docs, LangChain overview** — "LangChain standardizes how you interact with models so that you can seamlessly swap providers and avoid lock-in." *LangChain Docs, LangChain overview.* <https://docs.langchain.com/oss/python/langchain/overview>

[^llamaindex-docs-using-llms]: **LlamaIndex Docs, Using LLMs** — "LlamaIndex provides a unified interface for defining LLM modules, whether it’s from OpenAI, Hugging Face, or LangChain, so that you don’t have to write the boilerplate code of defining the LLM interface yourself." *LlamaIndex Docs, Using LLMs.* <https://developers.llamaindex.ai/python/framework/module_guides/models/llms/>

[^box-box-ai]: **Box, Box AI** — "Rely on Box’s existing security and privacy for your most sensitive content generated by Box AI." *Box, Box AI.* <https://www.box.com/ai>

[^box-developer-docs-supported-ai-models]: **Box Developer Docs, Supported AI models** — "Customer-enabled models | Require activation by Box admins in the Admin Console or a request to Box. Some models may be subject to additional terms or pricing." *Box Developer Docs, Supported AI models.* <https://developer.box.com/guides/box-ai/ai-models>

[^aws-docs-use-custom-model-import-to-import-a-cus-2]: **AWS Docs, Use Custom model import to import a customized open-source model into Amazon Bedrock** — "You can create a custom model in Amazon Bedrock by using the Amazon Bedrock Custom Model Import feature to import Foundation Models that you have customized in other environments, such as Amazon SageMaker AI." *AWS Docs, Use Custom model import to import a customized open-source model into Amazon Bedrock.* <https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization-import-model.html>

[^deepseek-r1-model-card-2]: **DeepSeek-R1 model card** — "DeepSeek-R1 series support commercial use, allow for any modifications and derivative works, including, but not limited to, distillation for training other LLMs." *DeepSeek-R1 model card.* <https://huggingface.co/deepseek-ai/DeepSeek-R1>
