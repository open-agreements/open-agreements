# Change: Add OpenAgreements repository for open-source legal template filling

## Why
Standard agreements (NDAs, cloud terms, PSAs) are slow to draft and easy to drift from approved language. A TypeScript CLI that fills DOCX templates with simple variable substitution gives a fast, consistent way to generate high-quality agreements. Many valuable standard forms (NVCA model documents, etc.) cannot be redistributed — the two-tier architecture (templates + recipes) solves this by hosting transformation instructions rather than copyrighted content.

## What Changes
- TypeScript CLI (`open-agreements`) with Commander.js
- **Two-tier architecture**: hosted templates (CC BY 4.0) + recipes (non-redistributable sources like NVCA)
- DOCX template rendering via `docx-templates` (MIT) — shared by both tiers
- **Recipe engine** for non-redistributable documents: DOCX cleaning (footnote/note removal via PizZip + fast-xml-parser) + cross-run placeholder patching + verification
- Zod validation pipeline (template metadata, recipe metadata, license compliance, output structure)
- Agent-agnostic skill architecture via ToolCommandAdapter pattern (Claude Code adapter for v1)
- 3 initial CC BY 4.0 templates: Common Paper Mutual NDA, Bonterms Mutual NDA, Common Paper Cloud Service Agreement
- NVCA financing document recipes (Voting Agreement, Stock Purchase Agreement, Investors' Rights Agreement, ROFR/Co-Sale Agreement, Certificate of Incorporation, + 2 optional)
- CI guardrails to prevent CC BY-ND license violations and copyrighted content in recipe directories

## Impact
- Affected specs: New capability `open-agreements` (templates + recipes)
- Affected code: New repository
- Dependencies: docx-templates, PizZip, fast-xml-parser, Zod, Commander.js, AdmZip
