---
type: Practice Note
title: Which YC SAFE should I use?
description: >-
  A founder-and-investor guide to choosing among Y Combinator's post-money SAFE
  forms — valuation cap vs discount vs uncapped MFN, what the blanks mean, the
  pro-rata side letter, and the securities and QSBS questions.
resource: >-
  https://openagreements.org/practice-guides/startup-financing/which-yc-safe-to-use
timestamp: '2026-06-24'
tags:
  - startup-financing
  - which-yc-safe-to-use
---

# Which YC SAFE should I use?[^about]

A founder-and-investor guide to choosing among Y Combinator's post-money SAFE forms — valuation cap vs discount vs uncapped MFN, what the blanks mean, the pro-rata side letter, and the securities and QSBS questions.

## Which YC SAFE form should I use? {#which-yc-safe-form}

**Short answer.** For most early rounds the answer is the post-money SAFE with a valuation cap and no discount — it is what most of the market uses and what Carta calls the standard pre-seed instrument. Y Combinator ships three current US post-money forms (valuation-cap-only, discount-only, and an uncapped MFN form) plus an optional Pro Rata Side Letter; a cap-and-discount form was a fourth YC form that YC retired in 2021. You fill in blanks but otherwise should not edit the form.

Start from what the market actually does. Carta reports that the cap-only structure is "the standard pre-seed instrument"[^carta-cap-no-discount-standard], and the distribution backs that up: across Carta data, "62% are capped only"[^carta-structure-split], with a smaller share carrying both a cap and a discount and very few carrying a discount alone. [^carta-cap-no-discount-standard][^carta-structure-split] The uncapped, no-discount form is at the other extreme — "extremely rare, just 1%"[^crunchbase-uncapped-rare] of SAFEs — so unless an investor specifically wants to defer pricing entirely, the cap-only form is the default a founder will encounter and should expect. [^crunchbase-uncapped-rare]

The shape of YC's current menu reflects the same lesson. YC once shipped a combined valuation-cap-and-discount form and retired it in 2021, noting that "We did not encounter situations where the combo safe was the preferred choice"[^yc-combo-form-retired]. [^yc-combo-form-retired] What remains is three post-money forms — cap-only, discount-only, and uncapped MFN — plus the Pro Rata Side Letter. Picking the form is the first-order decision; the rest is filling in numbers.

One discipline applies to all of them: do not rewrite the document. The SAFE itself recites that the parties have not modified the form "except to fill in blanks and bracketed terms"[^yc-no-modification], and that representation is part of why the instrument is fast and predictable to sign. [^yc-no-modification] If a deal needs bespoke terms, that is usually a signal to move to a priced round, not to redline the SAFE.

## How does a post-money SAFE convert, and whose ownership does it dilute? {#post-money-mechanics}

**Short answer.** A post-money SAFE fixes the investor's price by reference to the valuation cap, so the investor can see their ownership at signing — but dilution from later SAFEs and the option pool falls on the founders, not on earlier SAFE investors. Governing law is a fill-in-the-blank, usually the company's state of incorporation (typically Delaware), and is a secondary dimension here.

The word post-money describes when the investor's ownership is measured. The form defines the conversion price by reference to the cap: the Safe Price is "the Post-Money Valuation Cap divided by the Company Capitalization"[^yc-safe-price-definition], and that capitalization is measured to include the other SAFEs and convertibles outstanding. [^yc-safe-price-definition] The practical consequence for an investor is that ownership is largely knowable at signing rather than something the next round reveals.

It helps to know which kind of SAFE you are holding, because the name describes when ownership is measured. YC's original SAFE was standardized on a pre-money basis, which made dilution hard to calculate: working out an investor's percentage meant solving a recursive loop across the other SAFEs and a hypothetical future option pool. YC moved to post-money in 2018 specifically so ownership is knowable up front. As the User Guide puts it, the biggest advantage of the post-money form is that "the amount of ownership sold is immediately transparent and calculable"[^yc-post-money-ownership-transparent] for both the founder and the investor. [^yc-post-money-ownership-transparent] The practical tell is the defined term: a current YC SAFE is the post-money form and uses the Post-Money Valuation Cap; if a document instead refers to a pre-money valuation, it is the legacy form.

The flip side falls on the founders. Because the post-money SAFE locks the investor's percentage against a defined capitalization, additional SAFEs raised later and the new option pool dilute the founders rather than the earlier SAFE holders. A founder who stacks several post-money SAFEs at different caps should model the cumulative founder dilution before signing the next one, because each new instrument that converts is carved out of the founders' stake, not shared back across the prior investors.

A short illustrative example shows how the stacking adds up — these figures are arithmetic, not a source claim. Suppose a founder raises 500,000 dollars from an angel on a 10,000,000 dollar post-money cap, a SAFE the company negotiates on its own terms rather than YC's standard deal; that investor converts to about 5 percent (0.5M divided by 10.0M). A few months later the founder tops up with another 500,000 dollars on a 12,500,000 dollar post-money cap; that investor converts to about 4 percent (0.5M divided by 12.5M). Together the two SAFEs are roughly 9 percent, and both slices come out of the founders' stake rather than out of the first investor's fixed percentage. The more SAFEs a founder stacks, the larger the cumulative carve-out grows, which is why modeling the running total before signing the next SAFE matters. To put your own amounts and caps through this same arithmetic, try our [SAFE dilution calculator](/tools/safe-dilution-calculator).

YC's own standard deal is a concrete example of these forms in use, and of why the cap is the number to watch. YC invests "$125,000 on a post-money safe in return for 7% of your company"[^yc-deal-fixed-7-percent] — a fixed 7 percent, which is the same math as a post-money valuation cap of about 1.79 million dollars (125,000 divided by 0.07) — and invests the remaining 375,000 dollars on "an uncapped safe with a Most Favored Nation"[^yc-deal-uncapped-mfn] provision, which carries no cap of its own and instead takes the most favorable terms — typically the lowest cap — among the SAFEs the company issues before its next priced round. [^yc-deal-fixed-7-percent][^yc-deal-uncapped-mfn] That uncapped piece is exactly the case the calculator above does not model: until a cap is set, there is no single number to convert against.

Governing law is a secondary dimension and is simply a blank to complete. The form provides that all rights and obligations will be "governed by the laws of the State of [Governing Law Jurisdiction]"[^yc-governing-law-blank], which companies typically fill in with their state of incorporation — most often Delaware. [^yc-governing-law-blank] It is worth getting right, but it rarely drives the form-selection decision.

## What do the blanks mean — valuation cap, amount, and discount rate? {#filling-the-blanks}

**Short answer.** The valuation cap blank sets the maximum price at which the SAFE converts; the purchase amount is the money actually invested. The most error-prone blank is the discount form's Discount Rate, which is inverted — you enter 100 minus your headline discount (a 20% discount is entered as 80%).

The cap form is the simplest to complete. Its single headline term is the "Post-Money Valuation Cap"[^yc-valuation-cap-blank], a dollar figure that sets the maximum price at which the SAFE converts; the purchase amount is a separate blank for the money actually wired. [^yc-valuation-cap-blank] For calibration, Carta reports that in 2025, median post-money caps sat "around $10 million for rounds in the $250,000 to $1 million range"[^carta-median-caps] and around $15 million for rounds in the $1 million to $2.5 million range — useful reference points, not targets. [^carta-median-caps]

The discount form has the blank that trips people up. The headline term is the "[100 minus the discount]%"[^yc-discount-rate-blank], meaning the number you type is the complement of the discount you negotiated, not the discount itself. [^yc-discount-rate-blank] YC's User Guide spells out the arithmetic: the Discount Rate "100 minus the discount percent"[^yc-discount-rate-worked], so a 20% discount is entered as 80%. [^yc-discount-rate-worked] Entering 20 where the form wants 80 is a common and expensive mistake, so it is worth a second read before signing.

## When does a SAFE convert, and what if there is never a priced round? {#conversion-and-outcomes}

**Short answer.** A SAFE resolves on one of three defined events: an Equity Financing (a priced round), a Liquidity Event (an acquisition or IPO), or a Dissolution Event (a wind-down). The priced round is the normal path — the SAFE automatically converts into preferred stock. Because a SAFE has no maturity date, it does not expire or come due if a priced round never happens; it simply stays outstanding until a trigger occurs. This is how the instrument is designed, which is why an investor should understand the triggers before signing.

A SAFE resolves on one of three defined events: an Equity Financing, which is a priced round; a Liquidity Event, such as an acquisition or IPO; or a Dissolution Event, which is a wind-down. Knowing the three is most of what an investor needs to understand about how a SAFE ends. The first of them is the normal, happy path — if a priced round happens before the SAFE terminates, on the initial closing of that round "this Safe will automatically convert"[^yc-equity-financing-conversion] into shares of preferred stock. [^yc-equity-financing-conversion]

Equity Financing deserves a closer look because it is the outcome the instrument is built around. On that priced round the SAFE converts with no separate negotiation and no election required, and it is where the cap and the post-money mechanics discussed above do their work.

A Liquidity Event is the other positive exit. If the company is acquired or goes public before any priced round, the investor takes the greater of two amounts: the money back (the Cash-Out Amount, equal to the Purchase Amount) or the as-converted share they would hold if the SAFE had converted to common stock at the cap. The investor keeps whichever is larger, so an early sale does not strand the investment.

That leaves the case founders and investors most often ask about: what if there is never a priced round? Because a SAFE has no maturity date, it does not expire or come due — it simply stays outstanding until a trigger occurs. If the company ultimately winds down, the Dissolution Event clause governs: the investor is entitled "to receive a portion of Proceeds equal to the Cash-Out Amount"[^yc-dissolution-cash-out], which is essentially their money back, subject to the liquidation priority — that is, behind the company's creditors. [^yc-dissolution-cash-out] This is an understanding point rather than a warning: it is simply how the instrument is designed, and it is why a SAFE investor should know the triggers before investing.

## What about pro-rata rights and MFN? {#pro-rata-and-mfn}

**Short answer.** The post-money SAFE has no built-in pro-rata right — YC moved it to an optional Pro Rata Side Letter that only works with cap-bearing forms. The valuation-cap SAFE also has no MFN; that is the separate uncapped-MFN form, under which the investor can upgrade to a later, better-termed SAFE.

Pro-rata rights are no longer inside the SAFE. YC split them into a separate Pro Rata Side Letter, under which the investor gets the right to "purchase its pro rata share of Standard Preferred Stock being sold in the Equity Financing"[^yc-pro-rata-right] — that is, to keep its percentage by buying into the priced round. [^yc-pro-rata-right] A founder deciding whether to grant it should treat it as a deliberate, separate term rather than a default. One mechanical constraint matters: the User Guide states the side letter "can only be used with forms of the safe that have a Post-Money Valuation Cap"[^yc-pro-rata-cap-only], so it does not pair with the uncapped MFN form. [^yc-pro-rata-cap-only]

MFN is also not a feature of the cap form — it is the whole point of the uncapped MFN form. Under that form, if the company later issues a better-termed convertible, the company agrees to "amend and restate this instrument to be identical to the instrument(s) evidencing the Subsequent Convertible Securities"[^yc-mfn-mechanics], letting the early investor upgrade to the later, better terms. [^yc-mfn-mechanics] That is why the uncapped MFN form is mostly used for friendly, very early money that is content to ride later pricing rather than negotiate its own cap.

## What a SAFE is: the securities and QSBS questions {#securities-and-tax}

**Short answer.** The SAFE is a deliberately simple, founder-friendly way to raise early capital — its whole design is to keep an early round fast and cheap. The one thing to understand before signing is what it is: a security and a contractual right to receive equity later, not a current ownership stake. The YC form is also drafted to reach for qualified small business stock treatment under §1202, though the IRS has issued no guidance confirming a SAFE is stock, and whether the five-year clock starts at purchase or at conversion is unsettled — a question 2025's OBBBA changes made more consequential. This is general information, not tax advice; confirm §1202 treatment with a qualified tax advisor.

A SAFE is worth understanding before you sign one. The SEC reminds investors that SAFEs "do not represent a current equity stake in the company in which you are investing"[^sec-not-current-equity-stake] — a SAFE is a contractual right to receive equity later, on defined triggers, rather than stock you hold today. [^sec-not-current-equity-stake] That structure is exactly what keeps the instrument lightweight and fast for founders, and it is also what makes the tax question below genuinely open.

On the tax side, the YC form is drafted to reach for qualified small business stock benefits. Its tax clause states the instrument is "intended to be characterized as stock, and more particularly as common stock for purposes of Sections 304, 305, 306, 354, 368, 1036 and 1202"[^yc-qsbs-intent] of the Internal Revenue Code. [^yc-qsbs-intent] But intent in a form is not the same as a settled answer. Commentators note that "The IRS has yet to provide any guidance on whether a SAFE will be considered"[^pkf-no-irs-guidance] stock for these purposes. [^pkf-no-irs-guidance]

The stakes of that open question are concrete: the answer determines when the §1202 holding-period clock starts. If a SAFE is treated as stock, "the investor's five-year required holding period will start when the investment is made"[^pkf-holding-period-clock]; if not, the clock may not start until conversion into preferred stock at the priced round, potentially years later. [^pkf-holding-period-clock] The 2025 OBBBA expansion of §1202 makes the difference more valuable still. As amended, the statute grants a tiered exclusion — 50% at three years, 75% at four, and 100% at five — for "qualified small business stock acquired after the applicable date and held for at least 3 years"[^irc-1202a-tiered-exclusion], and it defines that applicable date as "the date of the enactment of this paragraph"[^irc-1202a-applicable-date] — July 4, 2025, when OBBBA became law. [^irc-1202a-tiered-exclusion][^irc-1202a-applicable-date][^mintz-obbba-effective-date] So where the holding period begins can decide whether the new tiered exclusion is available at all. None of this is tax advice; it is general information, and a founder or investor relying on §1202 treatment should confirm it with a qualified tax advisor.

## Stepping back: is a SAFE the right instrument, or should you use a convertible note? {#safe-vs-convertible-note}

**Short answer.** A SAFE and a convertible note both let a startup raise now and set the price later, but a SAFE is deliberately simpler because it is not debt. A convertible note is a loan: it carries interest and a maturity date that the parties must later extend or renegotiate. A SAFE has neither, which keeps an early round fast and cheap — so for most founders raising early capital, a SAFE is the better default. A note mainly earns its keep when an investor specifically wants debt protections like interest and a fixed maturity date.

Both instruments solve the same problem: raise money now, fix the price later. The difference is debt. A convertible note is a loan, so it carries interest and a maturity date, and as that date approaches the parties have to extend it, renegotiate it, or convert it. A SAFE strips those features out. YC's User Guide frames the payoff directly — because a SAFE has no expiration or maturity date, there is "no time or money spent dealing with extending maturity dates, revising interest rates"[^yc-safe-no-maturity-no-interest] or the like. [^yc-safe-no-maturity-no-interest]

The tradeoff is worth understanding, not fearing. Because a SAFE has no maturity, it does not come due: it resolves only when a defined trigger happens — a priced round, a sale, or a wind-down, as the conversion section above describes. A note's debt features mainly earn their keep when an investor wants downside protection, such as the ability to call the loan if no round materializes. For the typical founder raising a quick early round, that protection is rarely worth the added complexity — the SAFE's simplicity is the feature, not a gap.

For most founders, then, a SAFE is the better starting point than a note, and the real decision is the one this guide is built around: which YC SAFE to use.



[^about]: By Steven Obiajulu, J.D. Published by [openagreements.org](https://openagreements.org). Last reviewed 2026-06-24. License: CC BY 4.0. Steven Obiajulu, J.D. edits this topic article for US (Delaware-governed by default) coverage. It synthesizes legal sources and is not legal advice. This article is for informational purposes only and does not create an attorney-client relationship.

[^carta-cap-no-discount-standard]: **Carta, State of Pre-Seed: 2025 in review** — "The post-money SAFE with a valuation cap but no discount continues to be the standard pre-seed instrument." *Carta, State of Pre-Seed: 2025 in review (Feb. 19, 2026).* <https://carta.com/data/state-of-pre-seed-2025/>

[^carta-structure-split]: **Crunchbase News, Why Founders Should Think Twice Before Raising On A SAFE** — "62% are capped only, 29% offer both a cap and a discount, and just 9% offer a discount alone" *Crunchbase News, Why Founders Should Think Twice Before Raising On A SAFE (citing Carta Jan.-Sep. 2024 data).* <https://news.crunchbase.com/venture/startup-funding-safes-kong-michelman/>

[^crunchbase-uncapped-rare]: **Crunchbase News, Why Founders Should Think Twice Before Raising On A SAFE** — "Uncapped, no-discount SAFEs are now extremely rare, just 1%" *Crunchbase News, Why Founders Should Think Twice Before Raising On A SAFE (citing Carta).* <https://news.crunchbase.com/venture/startup-funding-safes-kong-michelman/>

[^yc-combo-form-retired]: **Y Combinator, Post-Money Safe User Guide** — "We did not encounter situations where the combo safe was the preferred choice." *Y Combinator, Post-Money Safe User Guide, Version History (v1.1, Aug. 28, 2021).* <https://www.ycombinator.com/documents>

[^yc-no-modification]: **Y Combinator Post-Money SAFE** — "neither one has modified the form, except to fill in blanks and bracketed terms" *Y Combinator Post-Money SAFE (the form's closing representation).* <https://www.ycombinator.com/documents>

[^yc-safe-price-definition]: **Y Combinator Post-Money SAFE (Valuation Cap)** — "‘Safe Price’ means the price per share equal to the Post-Money Valuation Cap divided by the Company Capitalization" *Y Combinator Post-Money SAFE (Valuation Cap), § 2 (Safe Price).* <https://www.ycombinator.com/documents>

[^yc-post-money-ownership-transparent]: **Y Combinator, Post-Money Safe User Guide** — "the biggest advantage of the post-money safe is that the amount of ownership sold is immediately transparent and calculable for both the founder and the investor" *Y Combinator, Post-Money Safe User Guide.* <https://www.ycombinator.com/documents>

[^yc-deal-fixed-7-percent]: **Y Combinator, The Standard Deal** — "We invest $125,000 on a post-money safe in return for 7% of your company" *Y Combinator, The Standard Deal.* <https://www.ycombinator.com/deal>

[^yc-deal-uncapped-mfn]: **Y Combinator, The Standard Deal** — "We invest $375,000 on an uncapped safe with a Most Favored Nation" *Y Combinator, The Standard Deal.* <https://www.ycombinator.com/deal>

[^yc-governing-law-blank]: **Y Combinator Post-Money SAFE (Valuation Cap)** — "All rights and obligations hereunder will be governed by the laws of the State of [Governing Law Jurisdiction]" *Y Combinator Post-Money SAFE (Valuation Cap), governing-law clause.* <https://www.ycombinator.com/documents>

[^yc-valuation-cap-blank]: **Y Combinator Post-Money SAFE (Valuation Cap)** — "‘Post-Money Valuation Cap’ is $[" *Y Combinator Post-Money SAFE (Valuation Cap), headline term.* <https://www.ycombinator.com/documents>

[^carta-median-caps]: **Carta, State of Pre-Seed: 2025 in review** — "median val caps on post-money SAFEs hovered around $10 million for rounds in the $250,000 to $1 million range and $15 million for rounds in the $1 million to $2.5 million range" *Carta, State of Pre-Seed: 2025 in review (Feb. 19, 2026).* <https://carta.com/data/state-of-pre-seed-2025/>

[^yc-discount-rate-blank]: **Y Combinator Post-Money SAFE (Discount, no Valuation Cap)** — "The ‘Discount Rate’ is [100 minus the discount]%" *Y Combinator Post-Money SAFE (Discount, no Valuation Cap), headline term.* <https://www.ycombinator.com/documents>

[^yc-discount-rate-worked]: **Y Combinator, Post-Money Safe User Guide** — "is equal to 100 minus the discount percent" *Y Combinator, Post-Money Safe User Guide, Appendix I.* <https://www.ycombinator.com/documents>

[^yc-equity-financing-conversion]: **Y Combinator Post-Money SAFE (Valuation Cap)** — "If there is an Equity Financing before the termination of this Safe, on the initial closing of such Equity Financing, this Safe will automatically convert" *Y Combinator Post-Money SAFE (Valuation Cap), § 1(a) (Equity Financing).* <https://www.ycombinator.com/documents>

[^yc-dissolution-cash-out]: **Y Combinator Post-Money SAFE (Valuation Cap)** — "the Investor will automatically be entitled (subject to the liquidation priority set forth in Section 1(d) below) to receive a portion of Proceeds equal to the Cash-Out Amount" *Y Combinator Post-Money SAFE (Valuation Cap), § 1(c) (Dissolution Event).* <https://www.ycombinator.com/documents>

[^yc-pro-rata-right]: **Y Combinator Pro Rata Side Letter** — "The Investor shall have the right to purchase its pro rata share of Standard Preferred Stock being sold in the Equity Financing" *Y Combinator Pro Rata Side Letter.* <https://www.ycombinator.com/documents>

[^yc-pro-rata-cap-only]: **Y Combinator, Post-Money Safe User Guide** — "The pro rata side letter can only be used with forms of the safe that have a Post-Money Valuation Cap" *Y Combinator, Post-Money Safe User Guide, Pro Rata Rights.* <https://www.ycombinator.com/documents>

[^yc-mfn-mechanics]: **Y Combinator Post-Money SAFE (Uncapped MFN)** — "the Company agrees to amend and restate this instrument to be identical to the instrument(s) evidencing the Subsequent Convertible Securities" *Y Combinator Post-Money SAFE (Uncapped MFN), § 3 (MFN Amendment Provision).* <https://www.ycombinator.com/documents>

[^sec-not-current-equity-stake]: **SEC Office of Investor Education and Advocacy, Investor Bulletin: Be Cautious of SAFEs in Crowdfunding** — "do not represent a current equity stake in the company in which you are investing" *SEC Office of Investor Education and Advocacy, Investor Bulletin: Be Cautious of SAFEs in Crowdfunding.* <https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins-52>

[^yc-qsbs-intent]: **Y Combinator Post-Money SAFE** — "intended to be characterized as stock, and more particularly as common stock for purposes of Sections 304, 305, 306, 354, 368, 1036 and 1202" *Y Combinator Post-Money SAFE, Miscellaneous (tax characterization).* <https://www.ycombinator.com/documents>

[^pkf-no-irs-guidance]: **PKF O'Connor Davies, SAFEs and the Section 1202 Exclusion** — "The IRS has yet to provide any guidance on whether a SAFE will be considered" *PKF O'Connor Davies, SAFEs and the Section 1202 Exclusion.* <https://www.pkfod.com/wp-content/uploads/2021/08/SAFEs-and-the-Section-1202-Exclusion-2.pdf>

[^pkf-holding-period-clock]: **PKF O'Connor Davies, SAFEs and the Section 1202 Exclusion** — "If a SAFE is considered ‘stock’ for Section 1202 purposes, the investor's five-year required holding period will start when the investment is made" *PKF O'Connor Davies, SAFEs and the Section 1202 Exclusion.* <https://www.pkfod.com/wp-content/uploads/2021/08/SAFEs-and-the-Section-1202-Exclusion-2.pdf>

[^irc-1202a-tiered-exclusion]: **26 U.S.C. § 1202(a) — Partial exclusion for gain from certain small business stock** — "the applicable percentage of any gain from the sale or exchange of qualified small business stock acquired after the applicable date and held for at least 3 years" *26 U.S.C. § 1202(a)(1)(B), (a)(5) (as amended by Pub. L. 119-21, § 70431).* <https://www.law.cornell.edu/uscode/text/26/1202#:~:text=the%20applicable%20percentage%20of%20any,for%20at%20least%203%20years>

[^irc-1202a-applicable-date]: **26 U.S.C. § 1202(a) — Partial exclusion for gain from certain small business stock** — "The term applicable date means the date of the enactment of this paragraph" *26 U.S.C. § 1202(a)(6)(A) (as amended by Pub. L. 119-21, § 70431).* <https://www.law.cornell.edu/uscode/text/26/1202#:~:text=The%20term%20applicable%20date%20means,the%20enactment%20of%20this%20paragraph>

[^mintz-obbba-effective-date]: **Mintz, QSBS Benefits Expanded Under One Big Beautiful Bill Act** — "The expanded QSBS tax benefits under the OBBBA apply to QSBS issued or acquired after July 4, 2025" *Mintz, QSBS Benefits Expanded Under One Big Beautiful Bill Act.* <https://www.mintz.com/insights-center/viewpoints/2906/2025-07-09-qsbs-benefits-expanded-under-one-big-beautiful-bill-act>

[^yc-safe-no-maturity-no-interest]: **Y Combinator, Post-Money Safe User Guide** — "Because a safe has no expiration or maturity date, there will be no time or money spent dealing with extending maturity dates, revising interest rates or the like" *Y Combinator, Post-Money Safe User Guide.* <https://www.ycombinator.com/documents>
