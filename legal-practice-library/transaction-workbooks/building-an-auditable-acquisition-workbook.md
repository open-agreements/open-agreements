---
type: Practice Guide
title: How to build an acquisition financial model that can explain and test itself
description: >-
  A practical guide to building an auditable acquisition financial model in
  Excel, with sources and uses, closing funds flow, a cap table, cash-flow
  forecasts, provenance, and checks that can fail.
resource: >-
  https://openagreements.org/practice-guides/transaction-workbooks/building-an-auditable-acquisition-workbook
timestamp: '2026-08-31'
tags:
  - transaction-workbooks
  - building-an-auditable-acquisition-workbook
---

# How to build an acquisition financial model that can explain and test itself[^about]

A practical guide to building an auditable acquisition financial model in Excel, with sources and uses, closing funds flow, a cap table, cash-flow forecasts, provenance, and checks that can fail.

## What is an acquisition financial model? {#what-is-an-acquisition-financial-model}

**Short answer.** An acquisition financial model is an Excel workbook or spreadsheet that connects the purchase price, transaction financing, closing payments, ownership, and post-closing cash generation. Its job is not merely to produce an answer. It should let a reviewer trace that answer back to the inputs, sources, and formulas that produced it. [^icaew-audience-design]

For an entrepreneurship-through-acquisition buyer, the model usually sits between an initial underwriting model and the final closing mechanics. It should show what the buyer expects to pay, how the transaction will be funded, what must move at closing, who owns what afterward, and whether the business is expected to have enough liquidity to operate and service debt.

This guide uses **Acquisition Financial Model** as the public name because it describes the artifact and matches common search language. **Workbook** remains the precise file-level term for an `.xlsx` containing several related worksheets. **Spreadsheet** is a useful plain-language synonym. ETA is an intended audience, not part of the product name.

## What are sources and uses in an acquisition model? {#what-are-sources-and-uses}

**Short answer.** Sources and uses is the transaction-capitalization bridge. Uses show how much capital the acquisition requires; sources show where that capital comes from. Total sources should equal total uses. [^sba-sources-and-uses]

Typical uses include purchase consideration, debt payoff, transaction expenses, and required cash at closing. Typical sources include acquisition debt, buyer equity, seller financing, and rollover equity. The schedule answers a financing question: how is the transaction funded?

The SBA's business-plan guidance reflects the same basic discipline: identify the funding required and explain how it will be used. That guidance is not an acquisition-model standard, but it illustrates why sources and uses belong together. [^sba-sources-and-uses]

## What is a closing funds flow? {#what-is-closing-funds-flow}

**Short answer.** A closing funds flow is a point-in-time execution schedule showing the amounts that must move at closing, the payor and recipient for each payment, and the payment's purpose. It is not an ordinary operating cash-flow forecast. [^sec-closing-flow]

The schedule may include purchase consideration, debt payoff, transaction expenses, escrows, holdbacks, and other closing payments. It should reconcile to the applicable uses, but it serves a different purpose: the closing funds flow organizes execution; sources and uses explains capitalization.

The filed transaction document cited here defines a dated flow-of-funds memorandum as a distinct closing instrument. It also separately identifies a supplemental sources-and-uses schedule. That separation supports using different worksheet names for different jobs. [^sec-closing-flow]

## What is an operating cash-flow forecast? {#what-is-an-operating-cash-flow-forecast}

**Short answer.** An operating cash-flow forecast projects recurring liquidity after closing, usually by month or year. It should show revenue, operating expenses, debt service, and the resulting change in cash over time. [^sba-financial-projections]

This forecast answers a time-series question that neither the closing funds flow nor sources and uses answers: can the acquired business generate enough cash to operate and meet its obligations after the transaction? The U.S. Small Business Administration includes projected income statements, balance sheets, and cash-flow statements among the financial projections used in business planning. [^sba-financial-projections]

For readability, call the worksheet **Operating Cash Flow Forecast**. The label **Funds Flow (Monthly)** invites readers to confuse recurring operations with the closing payment schedule.

## What is a cap table, and why include one? {#what-is-a-cap-table}

**Short answer.** In this model, a capitalization table, or cap table, shows who owns the company before and after the transaction. Including a dedicated cap-table worksheet makes ownership changes visible and gives the ownership check an independent, reviewable home. Public-company filings likewise use ownership tables to present holders and percentages, although their disclosure purpose is different. [^sec-ownership-table]

A simple acquisition model can use neutral holders such as **Party A** and **Party B** and show pre-transaction and post-transaction percentages. The total in each column should equal 100%. Separate ownership-and-returns calculations may then link to the post-transaction column instead of re-entering percentages.

The public example uses fictional parties and synthetic figures. It demonstrates the structure without publishing a client's identity or economics. A real model may need additional rows for rollover sellers, management equity, option pools, preferred interests, or contingent issuance.

## Why define each economic input only once? {#why-define-inputs-once}

**Short answer.** Defining each economic input once prevents two cells from silently becoming competing sources of truth. Every schedule that needs the value should link to the same named input or canonical input cell. [^icaew-inputs-once]

Duplicate inputs create a review problem: two cells can begin with the same number, then diverge after one is updated. A single input section makes changes deliberate and allows the workbook to distinguish entered assumptions from derived results.

ICAEW's Twenty principles for good spreadsheet practice supports the same architecture from the formula side: do not embed changeable values in formulas, and calculate a value once before referring back to it. [^icaew-inputs-once]

## What makes an acquisition model source-aware? {#what-makes-inputs-source-aware}

**Short answer.** A source-aware model associates each input with a stable source identifier, status, unit, and explanatory note. It distinguishes confirmed, estimated, derived, and unresolved values so a later communication cannot silently rewrite the provenance of an earlier assumption. [^aqua-provenance]

Use one source identifier for each communication or document. A sender's name is not enough: two messages from the same person can contain different facts or supersede one another. The model should preserve which message, agreement, lender quote, diligence response, or calculation supports each value.

The UK government's AQuA Book calls for documented assumptions and data, logs of inputs and decisions, and records of verification and validation. That discipline makes handoff easier because a reviewer can filter unresolved inputs and trace a changed output to the assumption that moved. [^aqua-provenance]

## How should the workbook be organized? {#how-should-the-workbook-be-organized}

**Short answer.** Use a fixed, reader-oriented order: Read Me, Inputs, Sources & Uses, Closing Funds Flow, Operating Cash Flow Forecast, Cap Table, Ownership & Returns, and Checks. Each worksheet should answer one recognizable question. [^icaew-structure]

The structure moves from instructions and assumptions to transaction mechanics, operating performance, ownership, returns, and verification. Related worksheets can link to one another, but each input should still originate in one place.

Do not create temporary worksheets and then rename or relocate them during generation. Build the final topology directly. A deterministic sheet order makes structural snapshots meaningful and reduces formula-rewrite risk during refactors.

## How should formulas be written for reviewability? {#how-should-formulas-be-written}

**Short answer.** Prefer short, consistent formulas that link to canonical inputs and clearly labeled totals. Calculate a result once, then reference it wherever else it is needed. [^icaew-formulas]

Long formulas assembled through manual coordinate arithmetic are hard to inspect in Python and hard to audit in Excel. Builder code should use named records and small formula helpers, while presentation helpers handle cell placement and styles. This is an abstraction over repetitive mechanics, not a new financial language.

ICAEW's spreadsheet principles emphasize simple formulas, avoiding fixed values inside formulas, and calculating a value once before referring to that result elsewhere. [^icaew-formulas]

## How do you know the workbook checks are reliable? {#how-do-you-know-checks-are-real}

**Short answer.** Put every check formula beside a human-readable assertion, inspect the workbook's calculated results, and run negative controls that intentionally violate each material assertion. A green check is evidence only if the relevant failure makes it turn red. [^icaew-review]

A formula can compare a value with itself, depend on the same defective formula twice, or return `PASS` regardless of the condition it claims to test. Classify each assertion as an independent check or a consistency check so reviewers understand what evidence it provides.

ICAEW's spreadsheet-review guidance treats review of business logic and assumptions as distinct from review of formulas and construction. A trustworthy verification process needs both. [^icaew-review]

## What are negative controls in a financial model? {#what-are-negative-controls}

**Short answer.** A negative control deliberately breaks one workbook invariant and confirms that the corresponding check fails. It tests the detector, not merely the unmodified model. [^aqua-verification]

Examples include changing a source without changing uses, breaking the pre- or post-transaction ownership total, removing an input's source identifier, or making monthly operating cash flow negative. Each mutation should fail the intended assertion independently of the displayed check cell.

Negative controls should operate on temporary copies. They should never alter the user's source file or delivered workbook.

## Why recalculate the XLSX outside the Python writer? {#why-recalculate-the-xlsx}

**Short answer.** Writing formula text into an XLSX package is not the same as calculating it. The delivered workbook should be recalculated and inspected in the spreadsheet engine used for review so formula errors and engine differences are visible. [^microsoft-recalculation]

The generator can store deterministic formula caches for testing, but those caches do not prove that Excel or another spreadsheet engine agrees. Microsoft describes calculation as the process that computes formulas and displays their resulting values. [^microsoft-recalculation]

Verification should also scan calculated cells for errors such as `#REF!`, `#DIV/0!`, `#VALUE!`, and `#NAME?`. Inspect the exact file intended for delivery, not an earlier copy with the same name.

## What should a deterministic structural snapshot cover? {#what-should-a-structural-snapshot-cover}

**Short answer.** At minimum, snapshot the sheet order, key formulas, formula-error scan, and all-checks-pass result. When refactoring a mature builder, compare recalculated workbooks cell by cell before removing the temporary compatibility fixture. [^icaew-regression-review]

The snapshot is not a substitute for financial review. It is a regression tool that catches accidental changes in workbook topology and formulas. Pair it with negative controls, which answer a different question: whether the checks detect known failures.

Once a behavior-preserving refactor has been accepted and the new architecture is the only implementation, delete one-off comparison fixtures that require maintaining two builders. Keep the durable structural snapshot and behavioral controls.

## What does the free Excel example include? {#what-does-the-free-example-include}

**Short answer.** The downloadable example includes synthetic inputs, sources and uses, closing funds flow, a monthly operating cash-flow forecast, a neutral Party A and Party B cap table, ownership-and-returns calculations, and declared checks. It contains no client information or payment instructions. [^public-example-workbook]

The example is intended for inspection and adaptation. Its fictional values are not market terms, and its formulas do not determine whether a transaction is advisable. Replace every synthetic assumption with authorized, independently reviewed inputs for the specific transaction.

Download the [free acquisition financial model Excel workbook](/tools/acquisition-financial-model), or use the same page to install the skill pack and inspect its scripts.



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-08-31. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Entrepreneurship through acquisition coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *How to build an acquisition financial model that can explain and test itself*, OpenAgreements (last updated August 31, 2026), https://openagreements.org/practice-guides/transaction-workbooks/building-an-auditable-acquisition-workbook.

[^icaew-audience-design]: **ICAEW, Twenty principles for good spreadsheet practice** — "If a spreadsheet is intended to be understood and used by others, the design should facilitate this." *Institute of Chartered Accountants in England and Wales, Twenty principles for good spreadsheet practice (2024).* <https://www.icaew.com/technical/technology/excel-community/excel-community-articles/2023/welcome-to-the-excel-community-20p>

[^sba-sources-and-uses]: **U.S. Small Business Administration, Plan your business** — "Give a detailed description of how you’ll use your funds." *U.S. Small Business Administration, Write your business plan, Funding request.* <https://www.sba.gov/counseling/plan-your-business/>

[^sec-closing-flow]: **Village Super Market, Inc., Credit Agreement exhibit** — "‘Flow of Funds Memorandum’ shall mean that certain Flow of Funds Memorandum, dated as of the date hereof by and among Lender, Fund Investor, Investment Fund, Borrower, Leverage Lender and certain other parties thereto." *Village Super Market, Inc., Current Report (Form 8-K), Exhibit 10.1, Credit Agreement (filed Dec. 29, 2025).* <https://www.sec.gov/Archives/edgar/data/103595/000010359525000024/vlgea-20251219ex101.htm#:~:text=%E2%80%9CFlow%20of%20Funds%20Memorandum%E2%80%9D%20shall,and%20certain%20other%20parties%20thereto.>

[^sba-financial-projections]: **U.S. Small Business Administration, Write your business plan** — "Provide a prospective financial outlook for the next five years." *U.S. Small Business Administration, Plan your business, Financial projections.* <https://www.sba.gov/counseling/plan-your-business/>

[^sec-ownership-table]: **Filed acquisition agreement, capitalization provision** — "Company Capitalization Table sets forth the capitalization of Company upon completion of the Equity Pre-Closing Transactions immediately before Closing." *Acquisition Agreement, Section 3.2(b), filed as Exhibit 2.1 (2026).* <https://www.sec.gov/Archives/edgar/data/1289340/000149315226033396/ex2-1.htm#:~:text=Company%20Capitalization%20Table%20sets%20forth,Pre%2DClosing%20Transactions%20immediately%20before%20Closing.>

[^icaew-inputs-once]: **ICAEW, Twenty principles for good spreadsheet practice** — "Perform a calculation once and then refer back to that calculation." *Institute of Chartered Accountants in England and Wales, Twenty principles for good spreadsheet practice (2024).* <https://www.icaew.com/technical/technology/excel-community/excel-community-articles/2023/welcome-to-the-excel-community-20p>

[^aqua-provenance]: **UK Government, The AQuA Book** — "All analysis shall have user documentation, even if the only user is the analyst leading the analysis." *UK Government Analysis Function, The AQuA Book, §§ 2, 8.3 (2025 edition).* <https://www.gov.uk/guidance/the-aqua-book>

[^icaew-structure]: **ICAEW, Twenty principles for good spreadsheet practice** — "Separate and clearly identify inputs, workings and outputs." *Institute of Chartered Accountants in England and Wales, Twenty principles for good spreadsheet practice (2024).* <https://www.icaew.com/technical/technology/excel-community/excel-community-articles/2023/welcome-to-the-excel-community-20p>

[^icaew-formulas]: **ICAEW, Twenty principles for good spreadsheet practice** — "Keep formulae as short and simple as practicable." *Institute of Chartered Accountants in England and Wales, Twenty principles for good spreadsheet practice (2024).* <https://www.icaew.com/technical/technology/excel-community/excel-community-articles/2023/welcome-to-the-excel-community-20p>

[^icaew-review]: **ICAEW, How to Review a Spreadsheet** — "Different approaches are needed to review the business logic and assumptions in a spreadsheet versus the formulas and construction of it – neither alone is sufficient." *Institute of Chartered Accountants in England and Wales, How to Review a Spreadsheet, at 5.* <https://www.icaew.com/-/media/corporate/files/technical/technology/excel/how-to-review-a-spreadsheet-report.ashx>

[^aqua-verification]: **UK Government, The AQuA Book** — "All analysis shall have user documentation, even if the only user is the analyst leading the analysis." *UK Government Analysis Function, The AQuA Book, §§ 2, 8.3 (2025 edition).* <https://www.gov.uk/guidance/the-aqua-book>

[^microsoft-recalculation]: **Microsoft Support, Change formula recalculation, iteration, or precision in Excel** — "Calculation is the process of computing formulas and then displaying the results as values in the cells that contain the formulas." *Microsoft Support, Change formula recalculation, iteration, or precision in Excel.* <https://support.microsoft.com/en-US/Excel/change-formula-recalculation-iteration-or-precision-in-excel>

[^icaew-regression-review]: **ICAEW, How to Review a Spreadsheet** — "Different approaches are needed to review the business logic and assumptions in a spreadsheet versus the formulas and construction of it – neither alone is sufficient." *Institute of Chartered Accountants in England and Wales, How to Review a Spreadsheet, at 5.* <https://www.icaew.com/-/media/corporate/files/technical/technology/excel/how-to-review-a-spreadsheet-report.ashx>

[^public-example-workbook]: **OpenAgreements synthetic acquisition financial model** — "This workbook is an illustrative modeling aid. Confirm legal, tax, accounting, valuation, financing, and wire details with appropriate advisers." *OpenAgreements, Synthetic Acquisition Financial Model example (2026).* <https://openagreements.org/downloads/acquisition-financial-model-example.xlsx>
