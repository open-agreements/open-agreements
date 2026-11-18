# Leakage evidence and review queue

These are paired model judgments, not lawyer adjudications. Every fail quote is checked against the exact delivered file. A disagreement or any non-verbatim judge quote stays in review; no judges were rerolled. Both judges are Gemini-family models (including self-judging), which limits independence. Full delivered documents and transcripts remain in the owner’s local audit archive because the task fixture repository is private. Only the published original and variants 01–09 were used.

## gemini-3.8-flash / three-state-offer-restrictive-covenant-package

Recorded classification: **leak**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**frank-rivera-restrictive-covenant-agreement.md**

> Customer Non-Solicitation
> 
> Duration
> : None (Ineligible under C.R.S. § 8-2-113(2)(d); annualized compensation below the statutory threshold of $78,008.40)

This text provides drafting commentary, statutory threshold calculations, and an explanation of why a restriction was omitted directly inside an operative agreement file.

**frank-rivera-restrictive-covenant-agreement.md**

> Non-Competition
> 
> Duration
> : None (Ineligible under C.R.S. § 8-2-113(2)(b); annualized compensation below the statutory threshold of $130,014)

This text includes statutory threshold explanations and commentary justifying the omission of the non-compete covenant inside the agreement body.

## gemini-3.8-flash / leakage-variant-01-washington-illinois-georgia

Recorded classification: **clean**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **pass**; evidence validation: valid.
- gemini-4-argon: **pass**; evidence validation: valid.

Both judges found no placement failure. This is not a lawyer-confirmed clean label.

## gemini-3.8-flash / leakage-variant-02-minnesota-florida-ohio

Recorded classification: **review**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **pass**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**greg-paulsen-restrictive-covenant-agreement.md**

> The parties acknowledge and agree that, in accordance with the standards of *Raimonde v. Van Vlerah*, 42 Ohio St. 2d 21 (1975), each covenant is reasonable in time, territory, and scope, is no greater than required for the protection of Employer's legitimate business interests, does not impose undue hardship on Employee, and is not injurious to the public.

Includes court enforceability standards and formal legal case citation within the operative agreement recitals.

**greg-paulsen-restrictive-covenant-agreement.md**

> If Employee is an existing at-will employee, Employer's continuation of Employee's at-will employment is exchanged for Employee's assent to the covenants, which constitutes valid and sufficient consideration under Ohio law pursuant to *Lake Land Employment Group of Akron, LLC v. Columber*, 101 Ohio St. 3d 242 (2004).

Includes legal justification, enforceability analysis, and case citations discussing consideration inside the agreement terms.

## gemini-3.8-flash / leakage-variant-03-massachusetts-nevada-virginia

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**whitney-lam-restrictive-covenant-agreement.md**

> > **ⓘ Virginia statutory gate — Low-Wage Threshold (Average Weekly Earnings): $1,507.01 per week**  
> > _Reference only — not part of this agreement._  
> > $1,507.01 per week ($78,364.52 annualized) is the 2026 low-wage threshold published by the Virginia Department of Workforce Development and Advancement under Va. Code § 40.1-28.7:8. An employee earning an annualized base salary of $61,000 earns approximately $1,173.08 per week, falling squarely within the statutory definition of a protected "low-wage employee." Under Va. Code § 40.1-28.7:8(B), employers are prohibited from entering into, enforcing, or threatening to enforce a covenant not to compete against any low-wage employee.

Includes an explicit threshold calculation and non-operative advisory/reference commentary directly in the agreement body.

**whitney-lam-restrictive-covenant-agreement.md**

> Because Employee is a protected low-wage employee under Va. Code § 40.1-28.7:8, and consistent with Virginia law treating employee non-solicitation covenants as unenforceable covenants not to compete when applied to protected workers, no employee non-solicitation restriction is imposed on Employee, and "None" is specified in Cover Terms.

Contains explanatory legal analysis and justification for why a restriction was omitted, which belongs in rationale.md or client-email.md rather than an operative agreement body.

## gemini-3.8-flash / leakage-variant-04-oregon-louisiana-north-carolina

Recorded classification: **clean**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **pass**; evidence validation: valid.
- gemini-4-argon: **pass**; evidence validation: valid.

Both judges found no placement failure. This is not a lawyer-confirmed clean label.

## gemini-3.8-flash / leakage-variant-05-tennessee-arizona-new-jersey

Recorded classification: **review**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **pass**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**colin-reyes-restrictive-covenant-agreement.md**

> Duration
> : None (Inapplicable pursuant to Tenn. Code Ann. § 50-1-211)

Includes an explanatory legal rationale/statutory citation explaining why the non-competition covenant was omitted in the agreement body/cover terms.

**colin-reyes-restrictive-covenant-agreement.md**

> Notwithstanding any other provision of this agreement, the non-compete restriction in this agreement does not apply to, and is void against, Employee if Employee's annualized compensation is less than $70,000. For this purpose, annualized compensation includes wages, salary, commissions, nondiscretionary bonuses, and other remuneration, and for an hourly employee is calculated by multiplying the hourly rate by forty and multiplying the product by fifty-two.

Contains explicit statutory threshold calculations and enforceability carve-out explanations directly in the agreement body.

## gemini-3.8-flash / leakage-variant-06-oklahoma-north-dakota-new-york

Recorded classification: **clean**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **pass**; evidence validation: valid.
- gemini-4-argon: **pass**; evidence validation: valid.

Both judges found no placement failure. This is not a lawyer-confirmed clean label.

## gemini-3.8-flash / leakage-variant-07-maine-wisconsin-michigan

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**molly-cormier-restrictive-covenant-agreement.md**

> > **ⓘ Maine statutory gate — Non-Compete Wage Floor: 400% of the federal poverty level**
> > _Reference only — not part of this agreement._
> >
> > Maine bans a non-compete for an employee earning wages at or below 400% of the federal poverty level (26 M.R.S. § 599-A(3)). In accordance with Maine law, because Employee's annualized base compensation of $52,000 is below the statutory wage floor, no non-competition covenant is imposed under this agreement.

This is non-operative drafting commentary, an advisory explanation, and a statutory threshold calculation explaining why a restriction was omitted, which belongs in client-email.md or rationale.md rather than the agreement body.

**molly-cormier-restrictive-covenant-agreement.md**

> Duration
> : Not Applicable (statutory wage-floor exclusion under 26 M.R.S. § 599-A(3))

Explains the legal rationale for omitting the non-compete duration in the Cover Terms of the agreement.

## gemini-3.8-flash / leakage-variant-08-new-hampshire-alabama-utah

Recorded classification: **leak**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**tyler-boudreau-restrictive-covenant-agreement.md**

> Because Employee earns an hourly rate of $14.00, which is less than or equal to 200 percent of the federal minimum wage of $7.25 per hour ($14.50 per hour), Employer imposes no post-employment non-competition restriction on Employee, and the duration in Cover Terms is specified as None.

This sentence includes a threshold calculation and drafting explanation for why the covenant was omitted, which constitutes advisory drafting rationale that belongs in client-email.md or rationale.md rather than operative agreement text.

**tyler-boudreau-restrictive-covenant-agreement.md**

> Because Employee earns an hourly rate of $14.00, which is less than or equal to 200 percent of the federal minimum wage of $7.25 per hour ($14.50 per hour), Employer imposes no post-employment non-investment restriction on Employee, and the duration in Cover Terms is specified as None.

This sentence contains legal threshold calculations and commentary explaining the omission of the restriction within the body of the signed agreement.

## gemini-3.8-flash / leakage-variant-09-maryland-indiana-missouri

Recorded classification: **leak**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**keisha-boone-restrictive-covenant-agreement.md**

> Because Employee's hourly wage of $21.00 per hour is equal to or less than 150% of the Maryland minimum wage rate (which is $22.50 per hour based on the $15.00 per hour State minimum wage), any post-employment non-competition covenant is null, void, and excluded from this agreement pursuant to Md. Code Ann., Lab. & Empl. § 3-716.

This text contains threshold calculations and an explanatory justification for why a restriction was omitted, which constitutes legal analysis/commentary that belongs in rationale.md or client-email.md rather than an operative agreement body.

**carlos-rueda-restrictive-covenant-agreement.md**

> This covenant is intended to fall within the safe harbor of Mo. Rev. Stat. § 431.202.

This sentence provides statutory drafting rationale/commentary on legal enforceability strategy directly in the covenant text.

## gemini-4-argon / three-state-offer-restrictive-covenant-package

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**frank-rivera-restrictive-covenant-agreement.md**

> Not applicable (omitted in accordance with C.R.S. § 8-2-113 because this position's annualized cash compensation of $72,000 is below the 2026 Colorado Highly Compensated Worker Threshold of $130,014)

Includes threshold calculations and legal explanation in the agreement body of why a restriction was omitted.

**frank-rivera-restrictive-covenant-agreement.md**

> Employer and Employee expressly acknowledge that because Employee's annualized cash compensation ($72,000 per year) is below Colorado's 2026 statutory earnings thresholds for post-employment non-competition covenants ($130,014) and customer non-solicitation covenants ($78,008.40) under C.R.S. § 8-2-113(2)(b) and (2)(d), this agreement does not include, present, or impose any post-employment covenant not to compete or post-employment covenant not to solicit or deal with customers.

Includes statutory threshold calculations and an advisory legal explanation of why provisions were omitted directly in the operative agreement text.

## gemini-4-argon / leakage-variant-01-washington-illinois-georgia

Recorded classification: **review**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: **FAILED — requires review**.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**sara-lindqvist-restrictive-covenant-agreement.md**

> Not applicable (omitted because Employee's annualized earnings at hire are below the 2026 Washington statutory earnings threshold of $126,858.83 under RCW 49.62.020(1)(b) and RCW 49.62.040; additionally, all Washington employee noncompetition covenants become void on June 30, 2027 pursuant to ESHB 1155, ch. 149, Laws of 2026)

Includes statutory threshold calculations and advisory legal explanations for why a non-competition restriction was omitted directly inside the agreement cover terms.

**marcus-bell-restrictive-covenant-agreement.md**

> Not applicable (omitted because Employee's annualized rate of earnings of $68,000 per year does not exceed the $75,000 per year statutory threshold required for a covenant not to compete under the Illinois Freedom to Work Act, 820 ILCS 90/10(a))

Explains why a restriction was omitted citing threshold calculations inside the agreement.

## gemini-4-argon / leakage-variant-02-minnesota-florida-ohio

Recorded classification: **leak**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**greg-paulsen-restrictive-covenant-agreement.md**

> The parties acknowledge that each covenant is narrowly tailored to Employee's Customer Success Manager role under the three-part reasonableness standard of *Raimonde v. Van Vlerah*, 42 Ohio St. 2d 21 (1975)—specifically, that each covenant is no greater than is required for the protection of Employer's legitimate business interests, does not impose undue hardship on Employee's ability to earn a livelihood, and is not injurious to the public.

Incorporates judicial case law citations and court-enforceability analysis directly into the agreement recitals.

**greg-paulsen-restrictive-covenant-agreement.md**

> Employer's continuation of Employee's at-will employment relationship also constitutes sufficient consideration under *Lake Land Employment Group of Akron, LLC v. Columber*, 101 Ohio St. 3d 242, 2004-Ohio-786).

Includes case law citation and legal enforceability analysis regarding at-will consideration in the contract body.

## gemini-4-argon / leakage-variant-03-massachusetts-nevada-virginia

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**whitney-lam-restrictive-covenant-agreement.md**

> Not applicable — Omitted pursuant to Va. Code § 40.1-28.7:8 (see *Sentry Force Security, LLC v. Barrera*, Record No. 1405-24-4 (Va. Ct. App. Jan. 27, 2026)). Because Employee's average weekly earnings ($1,173.08 per week) are below the 2026 Virginia statutory low-wage threshold ($1,507.01 per week), no post-employment employee non-solicitation or no-hire restriction applies to Employee.

This text contains explanatory commentary, case law analysis/citation, and wage threshold calculations explaining why the restriction was omitted, which belongs in rationale/email rather than the operative agreement.

**whitney-lam-restrictive-covenant-agreement.md**

> Not applicable — Excluded by Statute (Va. Code § 40.1-28.7:8(B)). Because Employee's compensation ($61,000 per year / $1,173.08 per week) is below the 2026 Virginia average weekly wage threshold of $1,507.01 per week ($78,364.52 per year), Employer does not enter into, and will never enforce or threaten to enforce, any post-employment covenant not to compete against Employee.

This entry includes threshold math calculations and advisory explanations justifying why a non-compete covenant is omitted from the contract.

## gemini-4-argon / leakage-variant-04-oregon-louisiana-north-carolina

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**jerome-baptiste-restrictive-covenant-agreement.md**

> Duration
> : Not applicable (omitted pursuant to La. R.S. 23:921(A)(1) and (C))

This text provides an advisory explanation of why a restriction was omitted rather than operative contractual terms.

**hannah-voss-restrictive-covenant-agreement.md**

> (which threshold is $119,541 for 2026)

This includes an advisory threshold calculation directly in the operative agreement text.

## gemini-4-argon / leakage-variant-05-tennessee-arizona-new-jersey

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**colin-reyes-restrictive-covenant-agreement.md**

> Duration
> : Not applicable (omitted pursuant to Tenn. Code Ann. § 50-1-211, effective July 1, 2026, which prohibits requesting, requiring, or enforcing a non-compete agreement where annualized compensation is less than $70,000)

Includes statutory threshold calculations and drafting rationale explaining why a non-compete restriction was omitted directly within the operative agreement's Cover Terms.

**colin-reyes-restrictive-covenant-agreement.md**

> Duration
> : Not applicable (omitted to avoid operating as a de facto non-compete under Tenn. Code Ann. §§ 50-1-210 and 50-1-211)

Provides legal drafting explanation and commentary explaining why a restriction was omitted rather than operative contractual terms.

## gemini-4-argon / leakage-variant-06-oklahoma-north-dakota-new-york

Recorded classification: **leak**. First-pass complete: True. Delivery continuation: False.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**sonja-larsen-restrictive-covenant-agreement.md**

> Although North Dakota law does not mandate a statutory own-time invention carve-out, as a matter of contract the assignment above does not apply to, and Covered Inventions do not include, any invention that Employee develops entirely on Employee's own time without using Employer's equipment, supplies, facilities, or Trade Secret information

Contains advisory legal explanation of state statutory requirements and drafting commentary explaining why the provision was included as a matter of contract.

**sonja-larsen-restrictive-covenant-agreement.md**

> In accordance with North Dakota law (*Warner & Co. v. Solberg*), this covenant is narrowly drawn to penalize only active solicitation or influence of Covered Employees with whom Employee actually worked or whom Employee supervised

Contains court enforceability analysis, legal rationale, and case citations within the operative contract body.

## gemini-4-argon / leakage-variant-07-maine-wisconsin-michigan

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**molly-cormier-restrictive-covenant-agreement.md**

> Status
> : Not Applicable / Omitted Pursuant to Maine Law (26 M.R.S. § 599-A(3)(A) prohibits requiring or permitting a non-compete agreement for an employee earning wages at or below 400% of the federal poverty level; accordingly, no post-employment non-compete or non-investment covenant is included in this agreement, and Employer's Protected Interests are protected through the confidentiality, invention assignment, and non-solicitation covenants herein as contemplated by 26 M.R.S. § 599-A(2)).

This text provides legal commentary and an advisory explanation of why a non-competition covenant was omitted pursuant to Maine statutory salary threshold calculations (400% of FPL), rather than maintaining strictly operative contract text.

**molly-cormier-restrictive-covenant-agreement.md**

> Not Applicable / Omitted Pursuant to Maine Law (26 M.R.S. § 599-A(3)(A) prohibits requiring or permitting a non-compete agreement for an employee earning wages at or below 400% of the federal poverty level; accordingly, no post-employment non-compete or non-investment covenant is included in this agreement, and Employer's Protected Interests are protected through the confidentiality, invention assignment, and non-solicitation covenants herein as contemplated by 26 M.R.S. § 599-A(2)).

This text in the Cover Terms of a signed agreement explains why the non-compete restriction was omitted and discusses the statutory wage threshold under Maine law, which belongs in the rationale or client email rather than the operative contract.

## gemini-4-argon / leakage-variant-08-new-hampshire-alabama-utah

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**tyler-boudreau-restrictive-covenant-agreement.md**

> Pursuant to N.H. RSA 275:70-a, because Employee's base hourly rate is at or below two hundred percent (200%) of the federal minimum wage (currently $14.50 per hour), Employer does not require Employee to enter into, and this agreement does not impose, any post-employment noncompete agreement restricting Employee from performing work for another employer for a specified period of time, working in a specified geographical area, or performing work for another employer that is similar to Employee's work for Employer after termination of employment.

Includes statutory threshold calculations and an advisory legal explanation explaining why a non-compete restriction was omitted.

**marcus-whitfield-restrictive-covenant-agreement.md**

> To ensure compliance with Alabama law requiring an existing employer-employee relationship at the time restrictive covenants are executed (see Ala. Code § 8-1-190(b)(4)–(5) and *Pitney Bowes, Inc. v. Berney Office Solutions*), the parties acknowledge that while this agreement was provided to Employee with the offer of employment for advance review, Employee and Employer are executing and dating this agreement on or after the first day of Employee's active employment relationship with Employer (September 28, 2026).

Contains court-enforceability case law analysis and drafting commentary explaining why the execution timing was structured in this manner.

## gemini-4-argon / leakage-variant-09-maryland-indiana-missouri

Recorded classification: **leak**. First-pass complete: False. Delivery continuation: True.

- gemini-3.8-flash: **fail**; evidence validation: valid.
- gemini-4-argon: **fail**; evidence validation: valid.

Selected judge evidence (the complete evidence list is in `results.json`):

**keisha-boone-restrictive-covenant-agreement.md**

> Not applicable / Omitted pursuant to Md. Code, Lab. & Empl. § 3-716 (which voids post-employment noncompete and conflict-of-interest provisions for employees earning equal to or less than 150% of the Maryland State minimum wage rate, currently $22.50 per hour).

Includes threshold calculations and an explanatory justification for why the covenant was omitted directly in the operative agreement text.

**blake-emerson-restrictive-covenant-agreement.md**

> Consistent with Indiana law (*Heraeus Medical, LLC v. Zimmer, Inc.*), this covenant applies solely to Covered Employees (employees with whom Employee worked or whom Employee supervised during the 12-month lookback period and who possess Confidential Information, Trade Secrets, customer goodwill, or specialized value) and does not apply to Employer's workforce at large.

Injects case citation and legal enforceability analysis directly into an operative non-solicitation covenant.

## Assistant review notes

Spot-checks confirmed clear placement failures in the original Colorado package (wage-threshold reasons in Cover Terms), variant 03 Virginia package (a “Reference only — not part of this agreement” legal-analysis block inside the agreement), variant 08 New Hampshire package (employee-specific wage arithmetic), and variant 09 Maryland package (wage-threshold explanations). These checks support the review queue; they do not replace lawyer adjudication of all cells.

The two Flash review cells concern Ohio case-law recitals and Tennessee statutory compensation exclusions, where the judges disagree about the operative/advisory boundary. The Argon variant 01 judges both voted fail, but one supplied at least one quote that does not exactly occur in the artifact, so that cell remains in review despite other apparently strong evidence. No post hoc quote repair or majority coercion was applied.
