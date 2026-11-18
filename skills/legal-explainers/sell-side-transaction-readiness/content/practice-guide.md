# Preparing a Small Business for Sale in the United States: Data Room Index and Pre-Sale Fixes[^about]

Getting a small U.S. business ready for a buyer's due diligence: a data room folder index keyed to the free OpenAgreements due diligence request list, the common gaps to fix before going to market with the fix for each, and the public-record searches a seller can run before a buyer does.

## How should a seller organize a data room for a buyer's due diligence? {#data-room-index}

**Short answer.** A seller's data room can be organized to follow the structure of the buyer's due diligence request list, with its files and folders matching the list's sections. [^ss-orrick-follow-request-list] Numbered folders and consistent file names let a document be cross-referenced later, in follow-up questions and in the disclosure schedules. [^ss-orrick-number-folders]

This guide's method gives each numbered request one sub-folder and one answer, which makes the room easier to review and easier to answer from. The index below follows sections A to O of the free [OpenAgreements due diligence request list](/templates/openagreements-due-diligence-request-list), whose own foldering instruction asks for materials organized to match its sections, with a sub-folder for each request. Each row is one top-level folder. The request list asks for one response per request: Provided, Does Not Exist, Not Applicable, or Privileged / Withheld, each with a short basis. A small company will answer many requests *Does Not Exist* or *Not Applicable*; a folder holding that answer and a one-line reason closes the request, while an empty folder with no answer draws a follow-up question.

### Building the index with an AI tool

Two prompts turn the request list into a working index. The first needs only the buyer's request list. The second reads the posted files, so it belongs in a tool the company has cleared for confidential documents.

Prompt 1, folder tree and response sheet:

```text
Below is a buyer's due diligence request list. Build a data room index from it.
1. Make one numbered top-level folder per section, in the list's order (01, 02, 03 ...), named after the section.
2. Inside each folder, make one sub-folder per numbered request, named with the request number and a short label (for example: A.1 Certificate of incorporation).
3. Output the folder tree as plain text.
4. Then output a response sheet as a table with these columns: Request no. | Folder | Request text | Response | Basis | File names.
   Leave Response, Basis and File names blank. Response will be one of: Provided, Does Not Exist, Not Applicable, Privileged / Withheld.
Do not add, drop or merge requests. Flag any request that is ambiguous.

[Paste the request list here]
```

Prompt 2, check the posted files:

```text
Below are (1) the response sheet for our data room and (2) the files posted in each request's folder. For each request:
1. Check that each posted agreement is signed by every party, dated, and complete, with no missing pages and with every exhibit or schedule it refers to.
2. Check that the file answers the request as written, including the period the request covers.
3. Mark any request answered Provided with no file, and any folder with files but no response.
List the gaps as a table: Request no. | File | Gap | What would close it.
Do not decide whether a gap matters legally; list it.

[Attach the response sheet and the files here]
```

Some data room providers use AI tools to redact personal data before a buyer gets access, and a person still decides what each gap a model flags means for the deal. [^ss-orrick-ai-redaction][^ss-foley-ai-limit]

With the index built, the next step is the [reverse-diligence searches](#reverse-diligence) further down this page, which show the seller what a buyer will find in public records.

| Folder | What a small company may not have | Request-list section | Documents usually expected |
| --- | --- | --- | --- |
| 01 Corporate | An LLC posts its operating agreement and member consents in place of bylaws and board minutes. Minutes are often missing for early years, which is a gap for counsel to fix before launch. | [A. Corporate organization, authority and governance](/templates/openagreements-due-diligence-request-list#section-a-corporate-organization) | Certificate of incorporation or formation and every amendment; bylaws or operating agreement; board minutes and written consents; stockholder or member consents; good standing certificates from the home state and each state where the company is qualified; current officer, director or manager list |
| 02 Ownership and cap table | A company with one or two owners usually has no options, SAFEs or 409A reports. A one-page ownership schedule tied to the ledger, with those requests marked *Not Applicable*, answers the section. | [B. Capitalization and securities](/templates/openagreements-due-diligence-request-list#section-b-capitalization) | Cap table as of a recent month-end; stock or membership ledger; option, warrant, SAFE and convertible-note ledgers; equity plan and grant forms; 83(b) elections with proof of filing; 409A reports; stockholder, voting and buy-sell agreements |
| 03 Subsidiaries and affiliates | Most small companies are one entity. The usual gap is a sister company owned by the same owner that holds the lease, the domain, the trucks or the employees. | [C. Subsidiaries and affiliates](/templates/openagreements-due-diligence-request-list#section-c-subsidiaries) | Organization chart with ownership percentages; formation documents and good standing for each subsidiary; intercompany agreements for services, IP, leases or loans |
| 04 Financial and tax | Request D.1 asks for audited statements, which most small companies do not have. Reviewed, compiled or internal statements go here, with the audit marked *Does Not Exist* and a reconciliation of the books to each year's tax return. | [D. Financial and tax](/templates/openagreements-due-diligence-request-list#section-d-financial-and-tax) | Annual financial statements for three years and year-to-date; federal returns for six years; state and local returns; sales-tax registrations by state; tax audit and notice correspondence; any tax-sharing or tax-indemnity agreements; support for each add-back |
| 05 Debt and liens | UCC filings for loans that were paid off but never terminated still show up in a buyer's search. A payoff letter or termination statement for each one belongs in this folder. | [E. Indebtedness, liens and security interests](/templates/openagreements-due-diligence-request-list#section-e-indebtedness) | Loan and credit agreements, including SBA loans and merchant cash advances; equipment loans and finance leases; guarantees, including the owner's personal guarantees; letters of credit; a recent UCC search with lien releases; lender consents needed for a sale |
| 06 Material contracts | The list asks for the top 20 customers and suppliers; a company with fewer posts them all. The folder also holds a one-page summary of each handshake relationship, accepted online terms and recurring purchase orders, with any doubt about whether a contract was formed flagged for counsel. | [F. Material contracts](/templates/openagreements-due-diligence-request-list#section-f-material-contracts) | Top customer and supplier contracts; contracts above the materiality threshold; contracts with exclusivity, most-favored-nation or non-compete terms; contracts with change-of-control or anti-assignment terms; distributor and sales-rep agreements; settlements with continuing obligations; standard customer terms and NDA |
| 07 Property | Vehicles and equipment titled to the owner, and a lease the owner signed personally, surface here and belong on the fix list below. | [G. Real and personal property](/templates/openagreements-due-diligence-request-list#section-g-property) | Deeds and title reports for owned real estate; leases, subleases and landlord correspondence; equipment and vehicle schedule with titles; equipment leases; coworking or virtual-office agreements |
| 08 Intellectual property | A typical small company has no patents, one or no federal trademark, and a few domains. The usual gaps are missing assignments from founders and contractors and domains or accounts registered to a personal email. | [H. Intellectual property](/templates/openagreements-due-diligence-request-list#section-h-intellectual-property) | Patent, trademark, copyright and domain schedules; signed invention-assignment or confidentiality agreements from every founder, employee and contractor who built the product, code, content or brand; inbound and outbound IP and software licenses marked for consent terms |
| 09 Privacy and security | The short version is the website privacy notice, the payment-processor and email-platform terms, and a written note on any incident or the absence of one. | [I. Privacy and cybersecurity](/templates/openagreements-due-diligence-request-list#section-i-privacy-cybersecurity) | Privacy notice, terms of use and cookie policy; security and incident-response policies; data map and data processing agreements with key vendors; incident history and any breach notices; privacy-law compliance records |
| 10 Employees and contractors | Small companies often lack written contractor agreements and a classification review. Payroll through a PEO is answered with the PEO agreement and its benefit plan summaries. | [J. Employment, compensation and benefits](/templates/openagreements-due-diligence-request-list#section-j-employment) | Organization chart with pay; offer letters and employment agreements; contractor agreements; benefit plans and Form 5500 filings; employee and contractor classification review; any union or labor matters; severance and retention arrangements |
| 11 Litigation | Audit response letters exist only where there is an audit; that request is usually *Does Not Exist*. Demand letters, chargeback disputes and agency notices belong on the schedule. | [K. Litigation, disputes and investigations](/templates/openagreements-due-diligence-request-list#section-k-litigation) | Schedule of pending and threatened claims; settlements with continuing obligations; orders and judgments; agency correspondence; audit response letters from outside counsel |
| 12 Permits and compliance | The core is the business license, sales-tax permit and any trade, professional, health or transport licenses, each marked with whether it transfers to a buyer or must be reissued. | [L. Compliance with laws, permits and licenses](/templates/openagreements-due-diligence-request-list#section-l-compliance) | Schedule of licenses, permits and registrations with expiry dates; routine regulatory filings; compliance policies and training records; any prior investigations |
| 13 Insurance | Loss runs from the broker answer the claims-history request. Many small companies carry no D&O policy, which is a *Does Not Exist* answer. | [M. Insurance](/templates/openagreements-due-diligence-request-list#section-m-insurance) | Policy schedule (general liability, property, auto, workers' compensation, cyber, professional, D&O); claims history for each policy; tail coverage and renewal terms for claims-made policies |
| 14 Related parties | Common items are a building the owner leases to the company, family members on payroll, a shared vehicle and an owner loan. Each needs written terms. | [N. Related-party transactions](/templates/openagreements-due-diligence-request-list#section-n-related-party) | Schedule of dealings with owners, officers, family members and affiliates; loans to or from insiders; pass-through accounts |
| 15 Environmental | An office or online business answers with the one-paragraph written confirmation that request O.5 describes. Shops, garages, manufacturers and dry cleaners usually need the Phase I report. | [O. Environmental](/templates/openagreements-due-diligence-request-list#section-o-environmental) | Environmental permits and any notices of violation; Phase I and Phase II site assessments; agency correspondence; hazardous-materials records |

When a rider in the request list applies, it adds folders after 15: the tech and SaaS, life sciences, healthcare provider and cross-border riders are sections P to S of the same list.

### Take-away folder tree

The same index as a folder tree, with one sub-folder per request, ready to copy into a data room or a shared drive. The [spreadsheet version (CSV)](/downloads/sell-side-data-room-index.csv) lists all 80 requests in sections A to O with blank response, basis and file columns.

```text
01 Corporate/
├── A.1 Certificate of incorporation and amendments/
├── A.2 Bylaws or operating agreement/
├── A.3 Board minutes and written consents/
├── A.4 Stockholder or member minutes and consents/
├── A.5 Good standing certificates/
├── A.6 Officers and directors/
└── A.7 Beneficial ownership filings/
02 Ownership and cap table/
├── B.1 Cap table/
├── B.2 Stock, option, warrant, SAFE and note ledgers/
├── B.3 Equity plan and grant forms/
├── B.4 83(b) elections/
├── B.5 409A valuations/
├── B.6 Stockholder and voting agreements/
└── B.7 SAFE and note terms/
03 Subsidiaries and affiliates/
├── C.1 Organization chart/
├── C.2 Subsidiary formation documents/
└── C.3 Intercompany agreements/
04 Financial and tax/
├── D.1 Financial statements/
├── D.2 Federal tax returns/
├── D.3 State and local tax returns/
├── D.4 Tax audits and notices/
├── D.5 Tax-sharing and indemnity agreements/
├── D.6 Sales-tax nexus and registrations/
└── D.7 Tax authority correspondence/
05 Debt and liens/
├── E.1 Loan and credit agreements/
├── E.2 Guarantees and letters of credit/
├── E.3 UCC searches and lien releases/
└── E.4 Lender consents/
06 Material contracts/
├── F.1 Contracts over the threshold/
├── F.2 Top customer contracts/
├── F.3 Top supplier contracts/
├── F.4 Exclusivity, MFN and non-compete terms/
├── F.5 Change-of-control and anti-assignment terms/
├── F.6 Distribution and sales-rep agreements/
├── F.7 Partnerships and joint ventures/
├── F.8 Settlements with ongoing obligations/
└── F.9 Standard forms/
07 Property/
├── G.1 Owned real property/
├── G.2 Real property leases/
├── G.3 Equipment and vehicles/
├── G.4 Equipment leases/
└── G.5 Coworking or virtual office/
08 Intellectual property/
├── H.1 Patents/
├── H.2 Trademarks/
├── H.3 Copyrights/
├── H.4 Domain names/
├── H.5 Invention assignment agreements/
└── H.6 IP and software licenses/
09 Privacy and security/
├── I.1 Privacy notice and terms/
├── I.2 Security policies/
├── I.3 Data map and processor agreements/
├── I.4 Security incidents/
└── I.5 Privacy-law compliance/
10 Employees and contractors/
├── J.1 Organization chart and pay/
├── J.2 Employment and contractor agreements/
├── J.3 Benefit plans and Form 5500s/
├── J.4 Equity plan (see B.3)/
├── J.5 Worker classification/
├── J.6 Labor and union matters/
└── J.7 Severance and retention/
11 Litigation/
├── K.1 Claims schedule/
├── K.2 Settlements/
├── K.3 Orders and judgments/
├── K.4 Agency correspondence/
└── K.5 Audit response letters/
12 Permits and compliance/
├── L.1 Licenses and permits/
├── L.2 Regulatory filings/
├── L.3 Compliance program/
└── L.4 Prior investigations/
13 Insurance/
├── M.1 Insurance policies/
├── M.2 Claims history/
└── M.3 Tail coverage/
14 Related parties/
├── N.1 Related-party dealings/
├── N.2 Insider loans/
└── N.3 Pass-through arrangements/
15 Environmental/
├── O.1 Environmental permits and notices/
├── O.2 Site assessments/
├── O.3 Environmental agency correspondence/
├── O.4 Hazardous materials/
└── O.5 No-operations confirmation/
```

An annotated index, listing what each folder holds and what is still missing, also matters on the buyer's side: without one, reviewers duplicate work and important documents go unreviewed. [^ss-lowenstein-annotated-index]

## Which gaps should a seller fix before putting the business up for sale? {#fix-before-market}

**Short answer.** Setting up the data room before the sale process starts lets the seller find and fix gaps before a buyer's due diligence finds them. [^ss-orrick-rectify] Most of the gaps below are fixed with a signature, a filing or a reconciliation; a transfer of copyright ownership other than by operation of law, for example, needs a writing signed by the owner of the rights or its authorized agent. [^ss-usc-17-204]

| Gap | Why a buyer cares | Fix | Folder |
| --- | --- | --- | --- |
| Unsigned IP assignments from founders, employees or contractors | Copyright starts with the work's author. [^ss-usc-17-201a] An employee's work within the scope of employment is a work made for hire, which the employer owns unless the parties agreed otherwise in a signed writing; a contractor's work qualifies only within nine listed categories and with a signed work-made-for-hire agreement. [^ss-usc-17-101-commissioned] [^ss-usc-17-201b] Outside those cases, a transfer of copyright ownership other than by operation of law needs a writing signed by the owner. [^ss-usc-17-204] Patents and patent applications are assigned by an instrument in writing. [^ss-usc-35-261] | For copyright, a signed confirmatory assignment to the company from each person whose work the company does not already own as a work made for hire or by an earlier signed assignment: founders, contractors and other non-employees, and employees whose work fell outside the scope of their employment. For inventions, a signed assignment from every inventor, employees included, unless an effective written assignment is already on file | 08 |
| Contracts that need consent to a sale | An asset sale assigns contracts, which typically triggers anti-assignment clauses, [^ss-potomac-asset-anti-assignment] and a stock sale can still trigger change-of-control clauses. [^ss-potomac-stock-change-of-control] | A list of every material contract stating whether it has an anti-assignment or change-of-control clause, whether that clause needs consent or only notice, any termination window, and what termination would cost [^ss-potomac-pre-market-audit] | 06 |
| A cap table that does not tie to the stock ledger | For a Delaware corporation, the stock ledger is the only evidence of which stockholders may vote in person or by proxy at a stockholder meeting. [^ss-dgcl-219c] Stock issued without authority is void. [^ss-staar-void-stock] A defective issuance can be ratified under section 204. [^ss-dgcl-204a] | A cap table reconciled line by line to the ledger, board consents and grant agreements, with any defective issuance ratified before launch | 02 |
| Personal assets the business uses | Domains, accounts, vehicles, equipment and leases titled to the owner personally need their own ownership and transfer review, separate from the company's assets. | Each domain, social account, phone number, vehicle, piece of equipment and lease held in the owner's name, either moved into the company or scheduled to transfer at closing | 07, 08 |
| Expired or soon-to-expire permits and licenses | A buyer checks that each permit the business needs is current and whether it transfers or must be reissued to the new owner. | Each permit renewed, with a schedule showing its expiry date and whether it transfers or the buyer must reapply | 12 |
| An entity that is not in good standing | A Delaware corporation's charter becomes void after a year of unpaid franchise tax unless the Secretary of State has granted more time, [^ss-del-510-void] and a good standing certificate reports status only as of the day it is issued. [^ss-del-status-certificate] | Back taxes paid and annual reports filed, with the charter revived under section 312 where it has become void, [^ss-del-312-revival] qualification in each state whose law requires it for the company's activities there (Delaware, for example, requires it before a corporation formed elsewhere does business through offices or agents located in Delaware, subject to statutory exemptions), [^ss-del-371-foreign-qualification] [^ss-del-373-qualification-exemptions] and a fresh certificate dated close to launch | 01 |
| Old UCC liens from paid-off loans | Under Delaware's UCC, an ordinary financing statement generally stays effective for five years after filing. [^ss-ucc-9-515a] Once no obligation is secured and the lender has no commitment to lend or give further value, a lender that receives the debtor's signed demand must send or file a termination statement within 20 days. [^ss-ucc-9-513c] | A signed demand for a termination statement on each loan that is paid off with no remaining credit line or commitment, and a payoff letter for each loan still open | 05 |
| Unsigned, undated or expired contracts | Buyers expect contracts in the data room to be fully executed, dated, current and unexpired. [^ss-orrick-executed-contracts] | Fully signed and dated copies, with renewals or amendments for anything expired | 06 |
| Books that do not tie to tax returns, or unsupported add-backs | The price usually rests on adjusted earnings, so each number the seller cannot support becomes a price discussion. | A yearly reconciliation of the books to the tax return, and a document behind each add-back such as owner pay or a one-time cost | 04 |
| Undocumented dealings with the owner or family | A buyer will want to know which arrangements continue after closing and on what terms. | A written lease, loan or services agreement on market terms for each arrangement that continues, and a clean end for each that does not | 14 |

For each required consent, buyers expect the seller to have a view on how likely the consent is, what it will cost, and the alternative if the counterparty refuses. [^ss-debevoise-consents] A gap that cannot be fixed before signing is explained and listed in the disclosure schedules rather than left for the buyer to find.

The Delaware rules in this table are examples. Many small businesses are LLCs or corporations formed in their home state, and for them the same checks run against that state's law and records: the home-state entity registry for status and filings, the LLC operating agreement and member consents in place of a stock ledger and board minutes, and the home state's own rules on annual reports, reinstatement and fixing past approvals. The IP, consent, permit and lien checks belong in an LLC's readiness review too. The lien timing described above is drawn from Delaware's version of the UCC. [^ss-ucc-9-515a][^ss-ucc-9-513c] Where to search for liens is covered in the [reverse-diligence searches](#reverse-diligence).

## Which reverse-diligence searches can a seller run before a buyer does? {#reverse-diligence}

**Short answer.** A seller can run the same lien, litigation and registry searches a buyer's counsel will run, and fix or explain what turns up before the first request arrives. [^ss-aba-searches][^ss-pacer-federal-records] Each database covers only its own records, so a no-result search is bounded by the database, names, places and dates searched. [^ss-uspto-trademark-limit][^ss-uspto-assignment-limit][^ss-copyright-limit]

Reverse diligence means running a buyer's public-record searches on the seller's own business first. These are searches a buyer's counsel runs early in diligence; run by the seller, they show what the buyer will see, in time to file a termination statement, renew a registration or prepare an explanation.

Some of these searches are open to anyone on a public website, and some sit behind a login, a fee or a clerk. The USPTO's trademark database is public notice to anyone searching, [^ss-uspto-public-database] and the Copyright Office catalog is online. [^ss-copyright-limit] PACER needs a registered account [^ss-pacer-account] and charges by the page, [^ss-pacer-fees] and a certified good standing certificate carries a state fee. [^ss-del-status-certificate-search] State court access varies by court, and some records come only through the clerk's office. A person or an AI tool with web access can run the open searches and save each result; the searches behind a login, a fee or a clerk need a person.

| Search | Where | What it shows the seller | Limit |
| --- | --- | --- | --- |
| Entity status | The secretary of state or other registry in the state of formation and each state of qualification | Legal name, entity type, formation date, current status, registered agent and filing history. A good standing certificate states status as of the day it is issued; Delaware charges $50 for a short-form certificate. [^ss-del-status-certificate-search] | Registries differ: California's Secretary of State does not collect ownership information. [^ss-california-entity-limit] |
| UCC liens | Under the UCC as Delaware enacts it, the law of the state where the debtor is located generally governs perfection, [^ss-ucc-9-301-1] and a corporation, LLC or other registered organization formed under state law is located in its state of formation. [^ss-ucc-9-307e] The central search is therefore through that state's UCC filing office or statewide index; in Delaware it is the Secretary of State. [^ss-ucc-9-501a] A sole proprietor is located at the owner's principal residence, and another organization at its place of business or, with several, its chief executive office. [^ss-ucc-9-307b] Under the same statute, fixture filings and filings on timber or as-extracted collateral go in the real-property records instead, so premises with fixtures also need a search of the local real-property records. [^ss-ucc-9-501a] | Each unlapsed financing statement on file in the office searched that names the company as debtor, with its filing date and contents. [^ss-ucc-9-523c] | The report covers filings that designate the debtor searched, so prior and assumed names need separate searches. Lapsed filings appear only if the request asks for them. [^ss-ucc-9-523c] |
| Trademarks | USPTO trademark search | Federal applications and registrations for the company's names and brands, and who owns them of record | Federal filings only; common-law marks of others do not appear. [^ss-uspto-trademark-limit] |
| Patents and IP assignments | USPTO patent and assignment records | Patents and applications naming the company or its founders, and recorded assignments | Recording an assignment is ministerial; it does not establish that the assignment is valid. [^ss-uspto-assignment-limit] |
| Copyrights | U.S. Copyright Office public catalog | Registrations for software, content and other works by title, author or claimant | The online catalog covers 1978 to the present. [^ss-copyright-limit] |
| Federal court cases | PACER, by court or through the PACER Case Locator's nationwide index | Federal cases naming the company or its owners as a party. [^ss-pacer-federal-records] [^ss-pacer-case-locator] | Federal courts only. Access costs $0.10 a page, [^ss-pacer-fees] and fees are waived for a quarter with $30 or less in charges. [^ss-pacer-fee-waiver] |
| State court cases | The court system of each state and county where the company operates | Contract, collection, employment and injury suits, judgments and liens | Coverage and online access vary by state and county; some need an in-person or clerk search. |

Each result is worth saving with the date, the exact name searched and the database, so the seller can answer the buyer's question with the same record the buyer will pull. Prior names and assumed names get their own searches.

## How should a seller record each issue, its fix and its disclosure? {#readiness-items}

**Short answer.** Each issue belongs in one record that states what the documents show, the seller's response, who owns it, and where it will be disclosed, since hints or partial disclosures may not neutralize a false representation when a seller is actively concealing the truth. [^ss-mayer-red-flags] In *Paragon Metals v. Smith*, the Delaware Supreme Court held that a buyer could justifiably rely on the seller CEO's representations despite imperfect due diligence, because the CEO concealed customer-loss information and answered untruthfully when pressed. [^ss-mayer-paragon-holding]

A consistent issue record has these fields:

| Field | Content |
| --- | --- |
| Readiness item | Neutral description tied to the asset, obligation, record or process |
| Evidence | Seller documents, official records, third-party sources, management statements, contradictions, and evidence that could not be reached |
| Why a buyer will ask | The deal consequence: ownership, transferability, continuity, value, liability, consent, payoff, disclosure or timing |
| Seller response | Evidence retrieval, record correction, an assignment or consent, a written explanation, a revised transaction scope, or referral to counsel |
| Priority and timing | Before launch, before the indication of interest, before exclusivity, before signing, or before closing |
| Owner | Owner or executive, finance, operations, broker, deal counsel, specialist counsel, accountant or technical reviewer |
| Disclosure path | Data room folder, bidder-response record, disclosure-schedule entry, transaction-document item, or internal-only remediation note |

The same record also captures strengths the evidence supports: a documented operating history, recurring revenue backed by customer records, transferable contracts, registered or well-documented IP, a clean entity and ownership record, repeatable procedures and a credible transition plan. A strength is stated with the same evidence and limits as a problem.

## What should a seller-side readiness review produce? {#seller-deliverables}

**Short answer.** Starting sell-side diligence early makes the purchase agreement's disclosure schedules easier to prepare, so a readiness review is built to feed them. [^ss-debevoise-disclosure] The review's outputs are an issues list, a remediation tracker, a data room index, a public-search log, disclosure-schedule support and a record of bidder questions and approved answers. The seller and its counsel still prepare the disclosure schedules themselves; a readiness report supports that work and does not replace it. [^ss-debevoise-disclosure]

The standard deliverables are:

1. **Executive readiness profile.** Supported strengths, priority readiness
items, likely deal consequences and the next decisions.
2. **Business and asset schedule.** Entity, ownership, key assets, IP, domains,
contracts, people, permits, debt, financial records and what is being sold.
3. **Remediation tracker.** Item, evidence, owner, action, deadline, dependency,
status and proof of completion.
4. **Public-search log.** Successful searches, no-record results, failed or
blocked attempts, search terms, saved records and fees.
5. **Data room index and disclosure map.** Folders keyed to the request list,
completeness and signature checks, likely disclosure categories and points
for counsel.
6. **Bidder-response record.** Approved factual answers with links to the
evidence, approval status, earlier versions and grouped duplicate questions.
7. **Specialist questions.** Matters needing legal, tax, accounting,
regulatory, employment, benefits, environmental or technical review, and
searches or filings that need credentials, fees or outside action.

Private remediation analysis stays separate from materials meant for bidders.
Publication, contact with third parties, paid records, filings and acting for
the seller each need the seller's express authorization.

## What does a seller-side readiness review cover at each stage of a sale? {#readiness-review-purpose}

**Short answer.** A seller-side readiness review checks that the company's records, including its structure chart, ownership records, books and records, filings, board minutes and governing documents, are accurate and current before buyers ask for them. [^ss-white-case-records] For a Delaware corporation, those records include the stock ledger, books of account and minute books. [^sell-side-dgcl-224]

The review changes with the stage of the sale and the evidence available:

| Stage | Available evidence | Output |
| --- | --- | --- |
| Public-information preview | Seller marketing materials and lawful public sources | Preliminary observations, a public-search log and a focused request list, with stated search limits |
| Seller-supported readiness review | Seller documents, management interviews, system exports and public records | Readiness report, issues list, data room index, bidder-question preparation and matters for counsel |
| Active-process update | Current data room, draft transaction documents, bidder requests and updated seller evidence | Updated issues and response lists, disclosure support and open signing items |

The scope follows the size and complexity of the business, the deal, the expected buyer process and the records available. The core subjects are ownership and authority, the assets and relationships that transfer, financial records, IP and data rights, consents, debt and liens, filings and corrective actions.

## How can a readiness review keep seller statements separate from verified facts? {#evidence-status}

**Short answer.** A readiness review labels the source and verification status of each material statement, because an official record proves only what its office records: a recorded patent assignment, for example, is not a USPTO finding that the assignment is valid. [^ss-uspto-assignment-evidence]

Each material statement carries its source class and verification status. The seller gets credit for strengths the record supports, while gaps and contradictions stay visible and actionable. A failed search, a database that could not be reached, and an official no-record result are different facts and get different labels.

The source classes are:

- **Seller document:** an agreement, ledger, filing copy, policy, system export,
correspondence or other record supplied by the seller.
- **Seller assertion:** an oral or written management statement that has not
been independently corroborated.
- **Official public record:** a record retrieved from the responsible
government office or official registry.
- **Third-party public source:** a marketplace listing, website, archived page,
news report, directory or other nonofficial source.
- **Reviewer inference:** a conclusion drawn from identified evidence rather
than stated in it.

For each material item, the log records the exact target searched, source and URL, jurisdiction or database, query or identifier, search date, result, limitation, saved evidence and next action. The statuses are **verified**, **seller-asserted**, **contradictory**, **incomplete**, **not searched**, **access restricted** and **fee or authorization required**. Labels such as *clear*, *clean* or *no issue* overstate a result unless the evidence and scope support that exact statement. These are reporting conventions for this guide, not legal findings.



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last updated 2026-11-14. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for United States coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. Source excerpts and linked materials belong to their owners. CC BY 4.0. Cite as Steven Obiajulu, *Preparing a Small Business for Sale in the United States: Data Room Index and Pre-Sale Fixes*, OpenAgreements (last updated November 14, 2026), https://openagreements.org/practice-guides/sell-side-transaction-readiness/us.

[^ss-orrick-follow-request-list]: **Orrick — Tech Exit Series: Preparing a Data Room** — "If a prospective buyer has provided a list of questions, consider structuring your files and folders to follow the structure of these questions." *Orrick, Tech Exit Series — Preparing a Data Room (Aug. 14, 2024).* <https://www.orrick.com/en/Insights/2024/08/Tech-Exit-Series-Preparing-a-Data-Room>

[^ss-orrick-number-folders]: **Orrick — Tech Exit Series: Preparing a Data Room** — "Label and number folders and subfolders so that documents or groups of documents can be easily cross referenced later." *Orrick, Tech Exit Series — Preparing a Data Room (Aug. 14, 2024).* <https://www.orrick.com/en/Insights/2024/08/Tech-Exit-Series-Preparing-a-Data-Room>

[^ss-orrick-ai-redaction]: **Orrick — Tech Exit Series: Preparing a Data Room** — "Some data room providers leverage artificial intelligence tools that automatically redact personal data, saving the time and expense of having to manually redact documents." *Orrick, Tech Exit Series — Preparing a Data Room (Aug. 14, 2024).* <https://www.orrick.com/en/Insights/2024/08/Tech-Exit-Series-Preparing-a-Data-Room>

[^ss-foley-ai-limit]: **Foley & Lardner — What Cross-Border M&A Teaches About the Limits of Legal AI** — "The model surfaces everything, which means a person still has to decide what everything means." *Foley & Lardner, What Cross-Border M&A Teaches About the Limits of Legal AI (June 8, 2026).* <https://www.foley.com/insights/publications/2026/06/what-cross-border-ma-teaches-about-the-limits-of-legal-ai/>

[^ss-lowenstein-annotated-index]: **Lowenstein Sandler — M&A due diligence: A primer on transactions involving private sellers** — "Failing to create an annotated index often leads to confusion, duplicate review and, in the worst case scenario, important documents not being reviewed." *Matt Savare, Bryan Sterba & Freeman Lewin, M&A due diligence: A primer on transactions involving private sellers, Thomson Reuters Expert Analysis (Feb. 25, 2020).* <https://www.lowenstein.com/media/5542/20200225-westlaw-ma-due-diligence-savare-sterba.pdf>

[^ss-orrick-rectify]: **Orrick — Tech Exit Series: Preparing a Data Room** — "This allows you to identify and rectify issues before a potential buyer carries out due diligence." *Orrick, Tech Exit Series — Preparing a Data Room (Aug. 14, 2024).* <https://www.orrick.com/en/Insights/2024/08/Tech-Exit-Series-Preparing-a-Data-Room>

[^ss-usc-17-204]: **17 U.S.C. § 204 — Execution of transfers of copyright ownership** — "A transfer of copyright ownership, other than by operation of law, is not valid unless an instrument of conveyance, or a note or memorandum of the transfer, is in writing and signed by the owner of the rights conveyed or such owner's duly authorized agent." *17 U.S.C. § 204(a).* <https://www.govinfo.gov/content/pkg/USCODE-2023-title17/html/USCODE-2023-title17-chap2-sec204.htm>

[^ss-usc-17-201a]: **17 U.S.C. § 201(a) — Initial ownership** — "Copyright in a work protected under this title vests initially in the author or authors of the work." *17 U.S.C. § 201(a).* <https://www.copyright.gov/title17/92chap2.html>

[^ss-usc-17-101-commissioned]: **17 U.S.C. § 101 — Definitions (work made for hire)** — "A ‘work made for hire’ is— (1) a work prepared by an employee within the scope of his or her employment; or (2) a work specially ordered or commissioned for use as a contribution to a collective work, as a part of a motion picture or other audiovisual work, as a translation, as a supplementary work, as a compilation, as an instructional text, as a test, as answer material for a test, or as an atlas, if the parties expressly agree in a written instrument signed by them that the work shall be considered a work made for hire." *17 U.S.C. § 101 (definition of work made for hire).* <https://www.govinfo.gov/content/pkg/USCODE-2023-title17/html/USCODE-2023-title17-chap1-sec101.htm>

[^ss-usc-17-201b]: **17 U.S.C. § 201(b) — Works made for hire** — "In the case of a work made for hire, the employer or other person for whom the work was prepared is considered the author for purposes of this title, and, unless the parties have expressly agreed otherwise in a written instrument signed by them, owns all of the rights comprised in the copyright." *17 U.S.C. § 201(b).* <https://www.copyright.gov/title17/92chap2.html>

[^ss-usc-35-261]: **35 U.S.C. § 261 — Ownership; assignment** — "Applications for patent, patents, or any interest therein, shall be assignable in law by an instrument in writing." *35 U.S.C. § 261.* <https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title35-section261&num=0&edition=prelim>

[^ss-potomac-asset-anti-assignment]: **Potomac Law Group — The Change of Control Problem Nobody Owns in M&A Until It's Too Late** — "In an asset purchase, the buyer acquires contracts by assignment, which typically triggers any anti-assignment clause and may require the counterparty’s consent to assignment as a matter of contract law." *Laurent Campo, The Change of Control Problem Nobody Owns in M&A Until It's Too Late, Potomac Law Group (Feb. 19, 2026).* <https://www.potomaclaw.com/news-Change-of-Control-Problem-Nobody-Owns-in-M-and-A-Until-Its-Too-Late>

[^ss-potomac-stock-change-of-control]: **Potomac Law Group — The Change of Control Problem Nobody Owns in M&A Until It's Too Late** — "But stock purchases and reverse triangular mergers can still trigger change of control provisions, particularly those capturing indirect ownership changes." *Laurent Campo, The Change of Control Problem Nobody Owns in M&A Until It's Too Late, Potomac Law Group (Feb. 19, 2026).* <https://www.potomaclaw.com/news-Change-of-Control-Problem-Nobody-Owns-in-M-and-A-Until-Its-Too-Late>

[^ss-potomac-pre-market-audit]: **Potomac Law Group — The Change of Control Problem Nobody Owns in M&A Until It's Too Late** — "The pre-market audit should identify, for each material contract: whether a change of control provision exists, whether it requires consent or merely notice, what standard governs the counterparty’s right to act, whether the counterparty has a defined window in which to exercise a termination right, and what the economic consequences of termination would be." *Laurent Campo, The Change of Control Problem Nobody Owns in M&A Until It's Too Late, Potomac Law Group (Feb. 19, 2026).* <https://www.potomaclaw.com/news-Change-of-Control-Problem-Nobody-Owns-in-M-and-A-Until-Its-Too-Late>

[^ss-dgcl-219c]: **8 Del. C. § 219(c) — The stock ledger as the only evidence of stockholders** — "The stock ledger shall be the only evidence as to who are the stockholders entitled by this section to examine the list required by this section or to vote in person or by proxy at any meeting of stockholders." *8 Del. C. § 219(c) (2026).* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^ss-staar-void-stock]: **STAAR Surgical Co. v. Waggoner, 588 A.2d 1130 (Del. 1991)** — "Stock issued without authority of law is void and a nullity." *Staar Surgical Co. v. Waggoner, 588 A.2d 1130 (Del. 1991).* <https://www.courtlistener.com/opinion/2177391/staar-surgical-co-v-waggoner/#:~:text=Stock%20issued%20without%20authority%20of,is%20void%20and%20a%20nullity.>

[^ss-dgcl-204a]: **8 Del. C. § 204(a) — Ratification of defective corporate acts and stock** — "(a) Subject to subsection (f) of this section, no defective corporate act or putative stock shall be void or voidable solely as a result of a failure of authorization if ratified as provided in this section or validated by the Court of Chancery in a proceeding brought under § 205 of this title." *8 Del. C. § 204(a) (2026).* <https://delcode.delaware.gov/title8/c001/sc06/index.html>

[^ss-del-510-void]: **8 Del. C. § 510 — Failure to pay franchise tax or file a complete annual report; charter void** — "If any corporation, accepting the Constitution of this State and coming under Chapter 1 of this title, or any corporation which has heretofore filed or may hereafter file a certificate of incorporation under said chapter, neglects or refuses for 1 year to pay the State any franchise tax or taxes, which has or have been, or shall be assessed against it, or which it is required to pay under this chapter, or shall neglect or refuse to file a complete annual franchise tax report, the charter of the corporation shall be void, and all powers conferred by law upon the corporation are declared inoperative, unless the Secretary of State, for good cause shown, shall have given further time for payment of the tax or taxes or the completion of an annual franchise tax report, in which case a certificate thereof shall be filed in the office of the Secretary of State stating the reason therefor." *8 Del. C. § 510 (2026).* <https://delcode.delaware.gov/title8/c005/index.html>

[^ss-del-status-certificate]: **Delaware Division of Corporations, Accessing Corporate Information** — "The fee is $50.00 per certificate for a short form certificate of status (includes the name of the entity and the status at the time the certificate is issued) or $175.00 for a Long Form certificate of Good Standing (states all documents that have been filed, including the dates and times and any name changes that occurred along with the status at the time the certificate is issued)." *Del. Div. of Corps., Accessing Corporate Information (accessed Oct. 5, 2026).* <https://corp.delaware.gov/directweb/?vm=r>

[^ss-del-312-revival]: **8 Del. C. § 312(b) — Revival of a forfeited or void certificate of incorporation** — "(b) Any corporation whose certificate of incorporation has become forfeited or void pursuant to this title may at any time procure a revival of its certificate of incorporation, together with all the rights, franchises, privileges and immunities and subject to all of its duties, debts and liabilities which had been secured or imposed by its original certificate of incorporation and all amendments thereto, by complying with the requirements of this section. Notwithstanding the foregoing, this section shall not be applicable to a corporation whose certificate of incorporation has been revoked or forfeited pursuant to § 284 of this title." *8 Del. C. § 312(b) (2026).* <https://delcode.delaware.gov/title8/c001/sc12/index.html>

[^ss-del-371-foreign-qualification]: **8 Del. C. § 371(b) — Qualification of a foreign corporation to do business in Delaware** — "(b) No foreign corporation shall do any business in this State, through or by branch offices, agents or representatives located in this State, until it shall have paid to the Secretary of State of this State for the use of this State, $80, and shall have filed in the office of the Secretary of State: (1) A certificate, as of a date not earlier than 6 months prior to the filing date, issued by an authorized officer of the jurisdiction of its incorporation evidencing its corporate existence." *8 Del. C. § 371(b)(1) (2026).* <https://delcode.delaware.gov/title8/c001/sc16/index.html>

[^ss-del-373-qualification-exemptions]: **8 Del. C. § 373(a) — Foreign corporations not required to qualify** — "(a) No foreign corporation shall be required to comply with §§ 371 and 372 of this title, under any of the following conditions: (1) If it is in the mail order or a similar business, merely receiving orders by mail or otherwise in pursuance of letters, circulars, catalogs or other forms of advertising, or solicitation, accepting the orders outside this State, and filling them with goods shipped into this State; (2) If it employs salespersons, either resident or traveling, to solicit orders in this State, either by display of samples or otherwise (whether or not maintaining sales offices in this State), all orders being subject to approval at the offices of the corporation without this State, and all goods applicable to the orders being shipped in pursuance thereof from without this State to the vendee or to the seller or such seller’s agent for delivery to the vendee, and if any samples kept within this State are for display or advertising purposes only, and no sales, repairs or replacements are made from stock on hand in this State; (3) If it sells, by contract consummated outside this State, and agrees, by the contract, to deliver into this State, machinery, plants or equipment, the construction, erection or installation of which within this State requires the supervision of technical engineers or skilled employees performing services not generally available, and as a part of the contract of sale agrees to furnish such services, and such services only, to the vendee at the time of construction, erection or installation; (4) If its business operations within this State, although not falling within the terms of paragraphs (a)(1), (2) and (3) of this section or any of them, are nevertheless wholly interstate in character;" *8 Del. C. § 373(a)(1)–(4) (2026).* <https://delcode.delaware.gov/title8/c001/sc16/index.html>

[^ss-ucc-9-515a]: **6 Del. C. § 9-515(a) — Duration of a financing statement** — "(a) Five-year effectiveness. — Except as otherwise provided in subsections (b), (e), (f), and (g), a filed financing statement is effective for a period of five years after the date of filing. (b) Public-finance or manufactured-home transaction. — Except as otherwise provided in subsections (e), (f), and (g), an initial financing statement filed in connection with a public-finance transaction or manufactured-home transaction is effective for a period of 30 years after the date of filing if it indicates that it is filed in connection with a public-finance transaction or manufactured-home transaction." *6 Del. C. § 9-515(a)-(b).* <https://delcode.delaware.gov/title6/c009/sc05/index.html>

[^ss-ucc-9-513c]: **6 Del. C. § 9-513(c) — Termination statement on the debtor's demand** — "(c) Other collateral. — In cases not governed by subsection (a), within 20 days after a secured party receives a signed demand from a debtor, the secured party shall cause the secured party of record for a financing statement to send to the debtor a termination statement for the financing statement or file the termination statement in the filing office if: (1) except in the case of a financing statement covering accounts or chattel paper that has been sold or goods that are the subject of a consignment, there is no obligation secured by the collateral covered by the financing statement and no commitment to make an advance, incur an obligation, or otherwise give value; (2) the financing statement covers accounts or chattel paper that has been sold but as to which the account debtor or other person obligated has discharged its obligation; (3) the financing statement covers goods that were the subject of a consignment to the debtor but are not in the debtor’s possession; or" *6 Del. C. § 9-513(c).* <https://delcode.delaware.gov/title6/c009/sc05/index.html>

[^ss-orrick-executed-contracts]: **Orrick — Tech Exit Series: Preparing a Data Room** — "Ensure that all contracts and agreements provided are fully executed, dated, up to date and not expired." *Orrick, Tech Exit Series — Preparing a Data Room (Aug. 14, 2024).* <https://www.orrick.com/en/Insights/2024/08/Tech-Exit-Series-Preparing-a-Data-Room>

[^ss-debevoise-consents]: **Debevoise & Plimpton — Ready, Set, Sell: 10 Things to Consider Before Starting a Sale Process** — "If any third party consents are required, sellers will be expected to have a view on the likelihood of receiving those consents, the potential cost of obtaining consent, and alternatives if consent cannot be obtained." *Debevoise & Plimpton, Ready, Set, Sell: 10 Things to Consider Before Starting a Sale Process (Nov. 2023).* <https://www.debevoise.com/insights/publications/2023/11/ready-set-sell>

[^ss-aba-searches]: **American Bar Association — Mergers & Acquisitions Code Set** — "Time reviewing documents, attending management presentations, preparing due diligence questionnaire, setting up data room, negotiating due diligence reliance letters, and conducting other due diligence searches (e.g., liens, litigation, background checks, etc.)." *American Bar Association, Mergers & Acquisitions Code Set (accessed Sept. 3, 2026).* <https://www.americanbar.org/groups/litigation/resources/uniform-task-based-management-system/mergers-acquisitions-code-set/>

[^ss-pacer-federal-records]: **PACER — Public Access to Court Electronic Records** — "The Public Access to Court Electronic Records (PACER) service provides electronic public access to federal court records." *Administrative Office of the U.S. Courts, PACER (accessed Nov. 14, 2026).* <https://pacer.uscourts.gov/>

[^ss-uspto-trademark-limit]: **U.S. Patent and Trademark Office — Why register your trademark?** — "Common law rights Results in the USPTO’s search database are limited to federal trademark applications and registrations and do not include the trademarks of other parties who may have trademark rights but no federal registration." *U.S. Patent and Trademark Office, Why register your trademark? (published Mar. 31, 2021).* <https://www.uspto.gov/trademarks/basics/why-register-your-trademark>

[^ss-uspto-assignment-limit]: **USPTO Manual of Patent Examining Procedure § 301** — "It should be noted that recording of the assignment is merely a ministerial act; it is not an Office determination of the validity of the assignment document or the effect of the assignment document on the ownership of the patent property." *USPTO, Manual of Patent Examining Procedure § 301 (Apr. 2026).* <https://www.uspto.gov/web/offices/pac/mpep/s301.html>

[^ss-copyright-limit]: **U.S. Copyright Office Circular 22 — How to Investigate the Copyright Status of a Work** — "The online catalog contains entries from 1978 to the present." *U.S. Copyright Office, Circular 22, How to Investigate the Copyright Status of a Work (rev. May 2026).* <https://www.copyright.gov/circs/circ22.pdf>

[^ss-uspto-public-database]: **U.S. Patent and Trademark Office — Why register your trademark?** — "This provides public notice to anyone searching for similar trademarks." *U.S. Patent and Trademark Office, Why register your trademark? (published Mar. 31, 2021).* <https://www.uspto.gov/trademarks/basics/why-register-your-trademark>

[^ss-pacer-account]: **PACER — Public Access to Court Electronic Records** — "Register for a PACER account to begin searching for or filing federal court records online." *Administrative Office of the U.S. Courts, PACER (accessed Nov. 14, 2026).* <https://pacer.uscourts.gov/>

[^ss-pacer-fees]: **PACER — Public Access to Court Electronic Records** — "Access to case information costs $0.10 per page." *Administrative Office of the U.S. Courts, PACER (accessed Nov. 14, 2026).* <https://pacer.uscourts.gov/>

[^ss-del-status-certificate-search]: **Delaware Division of Corporations, Accessing Corporate Information** — "The fee is $50.00 per certificate for a short form certificate of status (includes the name of the entity and the status at the time the certificate is issued) or $175.00 for a Long Form certificate of Good Standing (states all documents that have been filed, including the dates and times and any name changes that occurred along with the status at the time the certificate is issued)." *Del. Div. of Corps., Accessing Corporate Information (accessed Oct. 5, 2026).* <https://corp.delaware.gov/directweb/?vm=r>

[^ss-california-entity-limit]: **California Secretary of State — Business Entity Records** — "Please note that the Secretary of State does not: - Collect ownership information for business entities and would not have records of this information." *California Secretary of State, Business Entity Records (accessed Sept. 3, 2026).* <https://www.sos.ca.gov/administration/public-records-act-requests/business-entity-records>

[^ss-ucc-9-301-1]: **6 Del. C. § 9-301(1) — Law governing perfection: debtor's location** — "(1) Except as otherwise provided in this section, while a debtor is located in a jurisdiction, the local law of that jurisdiction governs perfection, the effect of perfection or nonperfection, and the priority of a security interest in collateral." *6 Del. C. § 9-301(1).* <https://delcode.delaware.gov/title6/c009/sc03/index.html>

[^ss-ucc-9-307e]: **6 Del. C. § 9-307(e) — Location of a registered organization** — "A registered organization that is organized under the law of a State is located in that State." *6 Del. C. § 9-307(e).* <https://delcode.delaware.gov/title6/c009/sc03/index.html>

[^ss-ucc-9-501a]: **6 Del. C. § 9-501 — Filing office** — "(a) Filing offices. — Except as otherwise provided in subsection (b), if the local law of this State governs perfection of a security interest or agricultural lien, the office in which to file a financing statement to perfect the security interest or agricultural lien is: (1) the office designated for the filing or recording of a record of a mortgage on the related real property, if: (A) the collateral is as-extracted collateral or timber to be cut; or (B) the financing statement is filed as a fixture filing and the collateral is goods that are or are to become fixtures; or (2) the office of the Secretary of State, in all other cases, including a case in which the collateral is goods that are or are to become fixtures and the financing statement is not filed as a fixture filing." *6 Del. C. § 9-501(a) (2026) (U.C.C. § 9-501).* <https://delcode.delaware.gov/title6/c009/sc05/index.html>

[^ss-ucc-9-307b]: **6 Del. C. § 9-307(b) — Debtor's location: general rules** — "Except as otherwise provided in this section, the following rules determine a debtor’s location: (1) A debtor who is an individual is located at the individual’s principal residence. (2) A debtor that is an organization and has only one place of business is located at its place of business. (3) A debtor that is an organization and has more than one place of business is located at its chief executive office." *6 Del. C. § 9-307(b).* <https://delcode.delaware.gov/title6/c009/sc03/index.html>

[^ss-ucc-9-523c]: **6 Del. C. § 9-523(c) — Information from the filing office** — "(c) Communication of requested information. — The filing office shall communicate or otherwise make available in a record the following information to any person that requests it: (1) whether there is on file on a date and time specified by the filing office, but not a date earlier than three business days before the filing office receives the request, any financing statement that: (A) designates a particular debtor; (B) has not lapsed under Section 9-515 with respect to all secured parties of record; and (C) if the request so states, has lapsed under Section 9-515 and a record of which is maintained by the filing office under Section 9-522(a); (2) the date and time of filing of each financing statement; and (3) the information provided in each financing statement." *6 Del. C. § 9-523(c).* <https://delcode.delaware.gov/title6/c009/sc05/index.html>

[^ss-pacer-case-locator]: **PACER — Public Access to Court Electronic Records** — "If you cannot locate a case when searching a federal court’s case records by case number or party name, try using the PACER Case Locator. This will generate a listing of nationwide court locations and case numbers where a party is involved in federal litigation." *Administrative Office of the U.S. Courts, PACER (accessed Nov. 14, 2026).* <https://pacer.uscourts.gov/>

[^ss-pacer-fee-waiver]: **PACER — Public Access to Court Electronic Records** — "NOTE: If you accrue $30 or less of charges in a quarter, fees are waived for that period." *Administrative Office of the U.S. Courts, PACER (accessed Nov. 14, 2026).* <https://pacer.uscourts.gov/>

[^ss-mayer-red-flags]: **Mayer Brown — Delaware Law Alert: Are Hints Disclosures?** — "Smith1 is a pointed reminder for M&A dealmakers: hints, partial disclosures, or due diligence ‘red flags’ may not neutralize false contractual representations when the seller is actively concealing the truth." *Mayer Brown, Delaware Law Alert: Are Hints Disclosures? (July 15, 2026).* <https://www.mayerbrown.com/en/insights/publications/2026/07/delaware-law-alert-are-hints-disclosures-delaware-supreme-court-revives-m-and-a-fraud-claim-despite-buyers-red-flags>

[^ss-mayer-paragon-holding]: **Mayer Brown — Delaware Law Alert: Are Hints Disclosures?** — "In reversing a trial court opinion, the Delaware Supreme Court held that the buyer could justifiably rely on the CEO’s representations despite imperfect due diligence because the CEO concealed critical customer-loss information and responded untruthfully when pressed." *Mayer Brown, Delaware Law Alert: Are Hints Disclosures? (July 15, 2026).* <https://www.mayerbrown.com/en/insights/publications/2026/07/delaware-law-alert-are-hints-disclosures-delaware-supreme-court-revives-m-and-a-fraud-claim-despite-buyers-red-flags>

[^ss-debevoise-disclosure]: **Debevoise & Plimpton — Ready, Set, Sell: 10 Things to Consider Before Starting a Sale Process** — "An early start on sell-side diligence also facilitates preparation of the disclosure schedules to the purchase agreement." *Debevoise & Plimpton, Ready, Set, Sell: 10 Things to Consider Before Starting a Sale Process (Nov. 2023).* <https://www.debevoise.com/insights/publications/2023/11/ready-set-sell>

[^ss-white-case-records]: **White & Case — 5 things management teams need to know about preparing for exit by their private equity owners** — "Resources should also be dedicated to ensuring that corporate information and records (such as the corporate structure chart, records of ownership, company books and records, company filings, board minutes and governing documents) are accurate and up-to-date, and that robust internal policies that could be requested as part of due diligence are in place." *White & Case, 5 things management teams need to know about preparing for exit by their private equity owners (accessed Sept. 3, 2026).* <https://www.whitecase.com/insight-alert/5-things-management-teams-need-know-about-preparing-exit-their-private-equity-owners>

[^sell-side-dgcl-224]: **Delaware General Corporation Law — corporate records** — "Any records administered by or on behalf of the corporation in the regular course of its business, including its stock ledger, books of account, and minute books, may be kept on, or by means of, or be in the form of, any information storage device, method, or 1 or more electronic networks or databases (including 1 or more distributed electronic networks or databases), provided that the records so kept can be converted into clearly legible paper form within a reasonable time, and, with respect to the stock ledger, that the records so kept (i) can be used to prepare the list of stockholders specified in §§ 219 and 220 of this title, (ii) record the information specified in §§ 156, 159, 217(a) and 218 of this title, and (iii) record transfers of stock as governed by Article 8 of subtitle I of Title 6." *8 Del. C. § 224.* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^ss-uspto-assignment-evidence]: **USPTO Manual of Patent Examining Procedure § 301** — "It should be noted that recording of the assignment is merely a ministerial act; it is not an Office determination of the validity of the assignment document or the effect of the assignment document on the ownership of the patent property." *USPTO, Manual of Patent Examining Procedure § 301 (Apr. 2026).* <https://www.uspto.gov/web/offices/pac/mpep/s301.html>
