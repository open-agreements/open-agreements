---
type: Law Topic
title: >-
  Founder Separation and Stock Repurchase: How to Cleanly Document a Founder's
  Departure from a Delaware Startup
description: >-
  The document-by-document framework for a clean Delaware founder separation —
  resignation letter, board written consent, equity repurchase, stock-ledger and
  minute-book cleanup, IP and confidentiality survival, and the conditional
  stockholder consent — with links to the reviewer checklist and the template
  forms.
resource: 'https://openagreements.org/practice-guides/founder-separation/us'
timestamp: '2026-07-01'
tags:
  - founder-separation
---

# Founder Separation and Stock Repurchase: How to Cleanly Document a Founder's Departure from a Delaware Startup[^about]

The document-by-document framework for a clean Delaware founder separation — resignation letter, board written consent, equity repurchase, stock-ledger and minute-book cleanup, IP and confidentiality survival, and the conditional stockholder consent — with links to the reviewer checklist and the template forms.

When a cofounder leaves a Delaware startup, the work is documentation, not litigation. In the ordinary uncontested case the departure is a sequence of corporate instruments — a resignation, a board consent, an equity repurchase, and a records cleanup — executed cleanly so that the cap table, the stock ledger, and the minute book all tell the same story. Two ideas run through the whole process. First, the *Delaware General Corporation Law (DGCL)* supplies the **power** to act — the authority for the board and stockholders to consent, for officers and directors to leave their posts, and for the corporation to reacquire its own shares — but the operative repurchase **mechanics** (the exercise window, the price, the escrow, the vested-versus-unvested split) live in the founder's own *Restricted Stock Purchase Agreement (RSPA)*, which this pack assumes already exists and references rather than restates. Second, a few steps are conditional modules that only fire on specific facts, and one common founder misconception — that the board can remove a departing director — is simply wrong under Delaware law. This guide walks the documents in order. If you are reviewing executed documents, the [Board Consent Reviewer Checklist](/checklists/founder-separation/board-consent) and the [Stock Repurchase Agreement Reviewer Checklist](/checklists/founder-separation/stock-repurchase-agreement) track each document-level requirement with its force level and citations, and the board consent, resignation letter, and repurchase agreement templates give you drafting starting points.

## What documents does a clean Delaware founder separation need? {#document-inventory}

**Short answer.** A well-run separation produces a small, sequenced set of instruments rather than one contract. The always-required core is a **founder resignation letter** covering every officer and director seat, a **board written consent** that accepts the resignation and authorizes the cleanup, the **equity repurchase** paperwork (an election notice and/or a repurchase-and-cancellation agreement), and the **records update** — stock-ledger, cap-table, certificate-cancellation, and minute-book filing. A strongly recommended companion is the **IP and confidentiality survival confirmation**, cheap hygiene that closes a diligence question. Two further modules are conditional: a **stockholder written consent** (only when a stockholder act is actually required) and a **mutual release** rider (only for a negotiated, rather than mechanical, buyback). The load-bearing legal fact is that the DGCL grants the corporation the power to reacquire its own shares, while the repurchase terms come from the founder's RSPA [^q1-dgcl-160a].

The single most useful way to think about the pack is the *power-versus-mechanics* split. The DGCL is where the authority lives: the board and stockholders can act by written consent, an officer or director can resign, and the corporation *may purchase, redeem, receive, take or otherwise acquire* its own shares. But the DGCL is silent on *when* the company may repurchase this founder's unvested stock, at *what* price, and *how long* the window stays open. Those terms are private ordering set at issuance in the RSPA, and they vary from document to document — commonly a 60-, 90-, or 120-day window after termination, sometimes longer. So the repurchase notice and agreement must *reference and assume* an existing RSPA; they should not restate the vesting schedule, because the RSPA already governs it [^q1-dgcl-160a].

> [!CAUTION]
> **Drafting note.**
>
> Do not treat the resignation letter as ceremonial boilerplate folded into the board consent. It is a distinct, always-required instrument, and its explicit effective date starts the contractual repurchase-option clock in the founder's RSPA. An undated or informal resignation can leave the termination date a triable question and forfeit the company's repurchase right no matter what the statute allows [^q1-dgcl-160a].

## How does the board act on a founder's departure — and what can it not do? {#board-action}

**Short answer.** The board memorializes the separation in a **unanimous written consent**. Under DGCL § 141(f) the board may act without a meeting only if *all* directors then in office consent in writing or by electronic transmission, so the separation consent must be signed by every remaining director. That consent accepts the founder's resignation, removes the founder from any officer titles under § 142(b), and manages the seat the founder vacated. But there is a hard limit the board keeps hitting: the board **cannot remove a non-resigning director**. Removal of a director is a *stockholder* power under § 141(k). The board consent handles a *voluntary* director resignation and officer removal only; a *forced* director exit routes to the stockholder-consent module [^q2-dgcl-141f][^q2-dgcl-141k].

Because § 141(f) requires unanimity for action taken without a meeting, a board consent missing even one sitting director's signature is not a valid board act. On the officer side, § 142(b) confirms an officer may resign on written notice, and officer removal is handled as the bylaws or a board resolution provide — the DGCL does not itself supply a with-or-without-cause officer-removal standard (that is the § 141(k) rule for directors), so the bylaws and any officer agreement govern; recording the removal in the consent closes any lingering ambiguity about residual signing or banking authority. The seat the founder vacated is handled one of three mutually exclusive ways — reduce the authorized board size, fill the vacancy, or expressly leave the seat open pending a later appointment or the next election (common where the seat is designated by a class of stock or a voting agreement) — and a vacancy may be filled by a majority of the directors then in office under § 223, with § 142(e) supplying the parallel rule for a vacated office [^q2-dgcl-142b][^q2-dgcl-142e][^q2-dgcl-223].

"Any officer may resign at any time upon written notice to the corporation."[^q2-dgcl-142b]

"Any vacancy occurring in any office of the corporation by death, resignation, removal or otherwise, shall be filled as the bylaws provide."[^q2-dgcl-142e]

> [!NOTE]
> **Practice note.**
>
> The most common founder misconception is that a majority of the board can *remove* a cofounder from the board. It cannot. Director removal is reserved to the holders of a majority of the shares entitled to vote at an election of directors, so a forced board exit needs a stockholder written consent, not a board resolution. Treat this as a routing rule: voluntary resignation goes in the board consent; involuntary removal goes to the stockholders [^q2-dgcl-141k][^q2-dgcl-141f].

## How does the equity repurchase actually work? {#equity-repurchase}

**Short answer.** The repurchase runs on two tracks that meet at the founder's RSPA. The founder's resignation fixes the **termination date**, which starts the contractual repurchase-option window; under DGCL § 141(b) a director's resignation is effective on delivery unless it names a later date, so the effective date is set, not inferred. The DGCL then supplies the **power** to buy the shares back — § 160(a) lets the corporation acquire its own shares — but the *window, price, and vested/unvested split* come from the RSPA. For unvested shares reacquired at their nominal original price, this is mechanical. The live statutory constraint bites on a *cash buyback*: § 160(a)(1) forbids repurchasing shares for cash or property when the corporation's capital is impaired, and § 174 makes directors *jointly and severally liable* for up to six years for a wilful or negligent unlawful repurchase [^q3-dgcl-141b][^q3-dgcl-160a1][^q3-dgcl-174].

For the routine case — clawing back a departing founder's *unvested* restricted stock at the original purchase price under a strong RSPA — a unilateral **repurchase-election notice** sent within the RSPA window does the job. The notice must identify the governing agreement, the termination date, the number of unvested shares, the per-share and aggregate price, and the closing date. It should reference and assume the RSPA rather than restate the vesting schedule. Where the deal is instead a negotiated buyback — especially of *vested* shares, or at a premium — the parties should use a **stock repurchase and cancellation agreement** rather than the bare notice, because the transaction now has real consideration flowing and the capital-impairment limit is a genuine question [^q3-dgcl-160a1].

"A resignation is effective when the resignation is delivered unless the resignation specifies a later effective date or an effective date determined upon the happening of an event or events."[^q3-dgcl-141b]

> [!NOTE]
> **Practice note.**
>
> Before any *cash* buyback of vested shares, confirm the § 160 surplus position. A corporation may not repurchase its own shares for cash or property when its capital is impaired or when the repurchase would cause an impairment, and § 174 exposes the authorizing directors to joint and several liability for up to six years if it does. If surplus is in doubt, this is no longer a housekeeping matter — get counsel to run the surplus analysis before the board authorizes the payment [^q3-dgcl-160a1][^q3-dgcl-174].

## What corporate records must be updated after the repurchase closes? {#corporate-records}

**Short answer.** Once the repurchase closes, the company must record it in its formal books. Shares of Delaware stock are personal property transferable on the corporation's books under DGCL § 159, so the transfer is not real until the ledger reflects it. The company must cancel or take possession of the repurchased certificates (or make the book-entry transfer for uncertificated shares), update the **stock ledger**, and reflect the change on the cap table. Section 224 treats the stock ledger, books of account, and minute books as the corporation's formal records — which may be kept electronically so long as they convert to legible paper — and § 141(f) requires the board consent to be *filed with the minutes* [^q4-dgcl-159][^q4-dgcl-224][^q4-dgcl-141f].

The ledger update is the step most often skipped and the one diligence catches. A repurchase that closes on paper but never hits the stock ledger leaves the cap table wrong and the corporation's records internally inconsistent — exactly the kind of gap a later Section 220 books-and-records demand or an acquirer's diligence will surface. The certificate-cancellation instruction should also state the *disposition* of the reacquired shares: repurchased shares are not automatically retired, so the records must say whether they are cancelled and retired or held as treasury [^q4-dgcl-224][^q4-dgcl-159].

"The shares of stock in every corporation shall be deemed personal property and transferable as provided in Article 8 of subtitle I of Title 6."[^q4-dgcl-159]

> [!NOTE]
> **Practice note.**
>
> Assemble the executed consents, the repurchase notice, proof of payment, and the ledger and cap-table updates into the minute book as part of closing, not as an afterthought. Section 141(f) requires the board consent to be filed with the minutes, and § 224 frames the underlying records duty. A complete minute book answers a Section 220 demand or an acquirer's diligence request without a scramble [^q4-dgcl-141f][^q4-dgcl-224].

## Does the founder's IP and confidentiality obligation survive the departure? {#ip-survival}

**Short answer.** Usually yes, and by its own terms. A founder's *confidential-information-and-invention-assignment agreement (CIIAA/PIIA)* is drafted so that its confidentiality and assignment obligations survive the end of service — the founder does not un-assign the company's IP or regain the right to disclose its secrets simply by leaving. So the separation step here is *confirmatory*, not constitutive: a short written confirmation that the CIIAA/PIIA and confidentiality duties remain in force, that all company property and repositories have been returned, and that no release is intended as to those continuing obligations. This is hygiene that makes the survival explicit in the separation record, but it does not by itself create any new obligation [^q5-dgcl-224].

The confirmation is worth getting precisely because it is cheap and it closes a diligence question, but its scope must stay narrow. It confirms what the existing agreement already provides; it is not a vehicle to bolt on new post-employment restraints. This is a single-jurisdiction Delaware corporate-records guide and does not address the enforceability of restrictive covenants, which is a separate body of state employment law.

> [!NOTE]
> **Practice note.**
>
> Do not use the survival confirmation to create *new* post-separation restrictive covenants — a non-compete, an expanded non-solicit, or a broader confidentiality restraint. New covenants signed at separation raise consideration and enforceability questions that are governed by employment law, not the DGCL, and vary by state. Keep the confirmation confirmatory, and route any genuinely new restraint to counsel. This records-hygiene step draws its authority from private ordering in the CIIAA, not from any DGCL section, so it carries no statutory pull-quote — the corporate-records duty that frames the surrounding pack is § 224 [^q5-dgcl-224].

## When is a stockholder written consent required? {#stockholder-consent}

**Short answer.** Only when a *stockholder* act is genuinely required — this module is not part of the default uncontested pack. Under DGCL § 228(a) stockholders may act without a meeting by a written consent signed by the holders of at least the minimum number of votes that would be needed at a meeting. The paradigm trigger is a **forced director exit**: because § 141(k) makes director removal a stockholder power, a board consent cannot do it. Other triggers are amending a charter that fixes the board size, and satisfying a voting agreement or protective provision. If the consent is signed by less than all stockholders, § 228(e) requires *prompt notice* of the action to those who did not consent [^q6-dgcl-228a][^q6-dgcl-141k][^q6-dgcl-228e].

The decision to invoke this module is a routing question, not a default. In a clean, voluntary separation where the founder resigns every seat and the company simply reacquires unvested stock, no stockholder act is required at all and the pack stops at the board consent plus the records update. Reach for the stockholder consent only when the facts put a stockholder-reserved act on the table, and when you do, comply with the § 228(e) notice obligation to the non-consenting holders [^q6-dgcl-228a][^q6-dgcl-228e].

> [!NOTE]
> **Practice note.**
>
> Because director removal is a § 141(k) stockholder power, a board that tries to remove a non-resigning cofounder by board consent has done nothing effective. If the founder will not resign the board seat voluntarily, the exit needs a stockholder written consent under § 228, with prompt § 228(e) notice to any holders who did not sign. This is often the point where a matter stops being housekeeping and needs counsel [^q6-dgcl-141k][^q6-dgcl-228e].

## When does a founder separation stop being housekeeping and need counsel? {#when-to-get-counsel}

**Short answer.** A routine separation — a voluntary resignation and a mechanical repurchase of unvested shares at their original price under a strong RSPA — is documentation you can execute from a good template pack. Several fact patterns push it out of housekeeping and into counsel territory: a *cash buyback of vested shares* where the § 160 surplus position is uncertain (the § 174 six-year director-liability exposure is real); a *premium* buyback of vested shares that can trigger a 409A or fair-market-value reset and cheap-stock questions; a redemption large enough to raise *QSBS contamination* concerns under the qualified-small-business-stock rules for the whole cap table; a *contested, for-cause, or severance-bundled* departure; and a *community-property spouse* in a state like California, Texas, or Washington, where a spousal consent or waiver may be needed [^q7-dgcl-160a1][^q7-dgcl-174].

The common thread is that each of these moves the transaction away from a clean unilateral exercise of an existing right and toward a negotiated deal with tax, solvency, or contested-facts overtones. That is also where the optional *mutual release* rider belongs — a broad release of claims, with carve-outs for vested rights, indemnification, D&O coverage, and continuing equity-holder rights, changes the character of the matter from records hygiene to settlement, so it lives in the repurchase agreement only when the deal is genuinely negotiated. When any of these flags is present, the template pack is a starting point, not a substitute for advice.

> [!NOTE]
> **Practice note.**
>
> Treat these as escalation triggers, not edge cases: a cash buyback of vested shares with any doubt about § 160 surplus (§ 174 director liability); a premium vested-share buyback (409A / FMV reset); a large redemption that could contaminate QSBS for all holders; a contested or for-cause departure; and a community-property spouse in CA, TX, or WA. Any one of them means bring in corporate and tax counsel before the board authorizes the transaction [^q7-dgcl-160a1][^q7-dgcl-174].



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-07-01. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for Delaware (DGCL) coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship. CC BY 4.0. Cite as Steven Obiajulu, *Founder Separation and Stock Repurchase: How to Cleanly Document a Founder's Departure from a Delaware Startup*, OpenAgreements (last updated July 1, 2026), https://openagreements.org/practice-guides/founder-separation/us.

[^q1-dgcl-160a]: **DGCL — power to acquire the corporation's own shares, 8 Del. C. § 160(a)** — "Every corporation may purchase, redeem, receive, take or otherwise acquire, own and hold, sell, lend, exchange, transfer or otherwise dispose of, pledge, use and otherwise deal in and with its own shares" *8 Del. C. § 160(a).* <https://delcode.delaware.gov/title8/c001/sc05>

[^q2-dgcl-141f]: **DGCL — board action by unanimous written consent, 8 Del. C. § 141(f)** — "any action required or permitted to be taken at any meeting of the board of directors or of any committee thereof may be taken without a meeting if all members of the board or committee, as the case may be, consent thereto in writing, or by electronic transmission" *8 Del. C. § 141(f).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q2-dgcl-141k]: **DGCL — removal of a director is a stockholder power, 8 Del. C. § 141(k)** — "Any director or the entire board of directors may be removed, with or without cause, by the holders of a majority of the shares then entitled to vote at an election of directors" *8 Del. C. § 141(k).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q2-dgcl-142b]: **DGCL — officer resignation, 8 Del. C. § 142(b)** — "Any officer may resign at any time upon written notice to the corporation." *8 Del. C. § 142(b).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q2-dgcl-142e]: **DGCL — filling an officer vacancy, 8 Del. C. § 142(e)** — "Any vacancy occurring in any office of the corporation by death, resignation, removal or otherwise, shall be filled as the bylaws provide." *8 Del. C. § 142(e).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q2-dgcl-223]: **DGCL — filling a board vacancy, 8 Del. C. § 223(a)** — "may be filled by a majority of the directors then in office, although less than a quorum, or by a sole remaining director" *8 Del. C. § 223(a).* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^q3-dgcl-141b]: **DGCL — director resignation, effective date, 8 Del. C. § 141(b)** — "A resignation is effective when the resignation is delivered unless the resignation specifies a later effective date or an effective date determined upon the happening of an event or events." *8 Del. C. § 141(b).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q3-dgcl-160a1]: **DGCL — capital-impairment limit on a cash buyback, 8 Del. C. § 160(a)(1)** — "Purchase or redeem its own shares of capital stock for cash or other property when the capital of the corporation is impaired or when such purchase or redemption would cause any impairment of the capital of the corporation" *8 Del. C. § 160(a)(1).* <https://delcode.delaware.gov/title8/c001/sc05>

[^q3-dgcl-174]: **DGCL — director liability for an unlawful repurchase, 8 Del. C. § 174(a)** — "the directors under whose administration the same may happen shall be jointly and severally liable, at any time within 6 years after paying such unlawful dividend or after such unlawful stock purchase or redemption, to the corporation" *8 Del. C. § 174(a).* <https://delcode.delaware.gov/title8/c001/sc05>

[^q4-dgcl-159]: **DGCL — shares as transferable personal property, 8 Del. C. § 159** — "The shares of stock in every corporation shall be deemed personal property and transferable as provided in Article 8 of subtitle I of Title 6." *8 Del. C. § 159.* <https://delcode.delaware.gov/title8/c001/sc05>

[^q4-dgcl-224]: **DGCL — form of corporate records (stock ledger, minute books), 8 Del. C. § 224** — "in the regular course of its business, including its stock ledger, books of account, and minute books, may be kept on, or by means of, or be in the form of, any information storage device, method, or 1 or more electronic networks or databases" *8 Del. C. § 224.* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^q4-dgcl-141f]: **DGCL — board consent filed with the minutes, 8 Del. C. § 141(f)** — "any action required or permitted to be taken at any meeting of the board of directors or of any committee thereof may be taken without a meeting if all members of the board or committee, as the case may be, consent thereto in writing, or by electronic transmission" *8 Del. C. § 141(f).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q5-dgcl-224]: **DGCL — corporate records duty, 8 Del. C. § 224** — "in the regular course of its business, including its stock ledger, books of account, and minute books, may be kept on, or by means of, or be in the form of, any information storage device, method, or 1 or more electronic networks or databases" *8 Del. C. § 224.* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^q6-dgcl-228a]: **DGCL — stockholder action by written consent, 8 Del. C. § 228(a)** — "any action which may be taken at any annual or special meeting of such stockholders, may be taken without a meeting, without prior notice and without a vote, if a consent or consents, setting forth the action so taken, shall be signed by the holders of outstanding stock having not less than the minimum number of votes that would be necessary" *8 Del. C. § 228(a).* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^q6-dgcl-141k]: **DGCL — removal of a director is a stockholder power, 8 Del. C. § 141(k)** — "Any director or the entire board of directors may be removed, with or without cause, by the holders of a majority of the shares then entitled to vote at an election of directors" *8 Del. C. § 141(k).* <https://delcode.delaware.gov/title8/c001/sc04>

[^q6-dgcl-228e]: **DGCL — notice to non-consenting stockholders, 8 Del. C. § 228(e)** — "prompt notice of the taking of the action by consent shall be given to those stockholders or members as of the record date for the action by consent who have not consented and who would have been entitled to notice of the meeting if the action had been taken at a meeting" *8 Del. C. § 228(e).* <https://delcode.delaware.gov/title8/c001/sc07/index.html>

[^q7-dgcl-160a1]: **DGCL — capital-impairment limit on a cash buyback, 8 Del. C. § 160(a)(1)** — "Purchase or redeem its own shares of capital stock for cash or other property when the capital of the corporation is impaired or when such purchase or redemption would cause any impairment of the capital of the corporation" *8 Del. C. § 160(a)(1).* <https://delcode.delaware.gov/title8/c001/sc05>

[^q7-dgcl-174]: **DGCL — director liability for an unlawful repurchase, 8 Del. C. § 174(a)** — "the directors under whose administration the same may happen shall be jointly and severally liable, at any time within 6 years after paying such unlawful dividend or after such unlawful stock purchase or redemption, to the corporation" *8 Del. C. § 174(a).* <https://delcode.delaware.gov/title8/c001/sc05>
