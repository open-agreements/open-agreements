import json,re,os
D=os.path.expanduser('~/Projects/open-agreements/practice-guides/non-compete/us/')
CN='court-narrowing'
R=[
('alabama','narrow','"If a contractually specified restraint is overly broad or unreasonable in its duration, a court may void the restraint in part and reform it to preserve the protectable interest or interests."',CN,'Statutory reformation of overbroad duration within a valid § 8-1-190(b) category.'),
('alaska','narrow','**Short answer.** Often yes, through reasonable alteration, but only if the covenant can be made enforceable and the employer proves it was drafted in good faith',CN,'Reasonable-alteration rule, conditioned on good faith.'),
('arizona','narrow','Arizona follows a strict blue-pencil rule: a court may eliminate a grammatically severable unreasonable term, but it may not add language or rewrite the covenant to make it reasonable.',CN,'Strict blue pencil only (strike severable terms); counts as narrow per label definition.'),
('arkansas','narrow','If the restrictions are unreasonable, the court must reform the covenant as needed and enforce it under the reformed terms',CN,'Mandatory reformation under § 4-75-101 for post-Act covenants.'),
('california','AMBIGUOUS','California treats a conventional employee non-compete as void rather than reforming it.','employee-non-compete-enforceability','State voids nearly all employee non-competes; question not well-posed.'),
('colorado','narrow','Colorado courts have discretion to blue-pencil an overbroad covenant but are not required to, and parties cannot contractually force a court to rewrite one',CN,'Discretionary blue pencil.'),
('connecticut','AMBIGUOUS','whether a court will narrow an overbroad employee covenant remains unsettled',CN,'Guide says the narrowing question is unsettled.'),
('delaware','AMBIGUOUS','Delaware courts retain equitable discretion, but recent Chancery and Supreme Court decisions warn that overbroad covenants may fall rather than be rewritten',CN,'Discretion retained but modern trend refuses blue-pencil; guide frames answer as "usually not".'),
('district-of-columbia','narrow','The District of Columbia Court of Appeals has formally adopted the doctrine of equitable reformation to modify an overbroad restrictive covenant',CN,'Equitable reformation (narrowing only) under Steiner.'),
('florida','narrow','**Short answer.** Yes — reformation is mandatory. If a restraint is overbroad, overlong, or otherwise broader than necessary, section 542.335 directs the court to *modify the restraint and grant only the relief reasonably necessary*',CN,'Mandatory statutory modification.'),
('georgia','narrow','provided, however, that a court may modify a covenant that is otherwise void and unenforceable so long as the modification does not render the covenant more restrictive with regard to the employee than as originally drafted by the parties',CN,'Discretionary GRCA modification.'),
('hawaii','AMBIGUOUS','they do not supply a broad rule that courts will rewrite any overbroad employee non-compete into an enforceable one',CN,'Guide says sources do not establish a narrowing rule either way.'),
('idaho','narrow','Idaho Code § 44-2703 says a court shall limit or modify[^idaho-44-2703-mandatory-modification] an unreasonable covenant and enforce it as limited or modified.',CN,'Mandatory statutory modification, limited to what can be done simply and accurately.'),
('illinois','narrow','**Short answer.** Sometimes, but it is discretionary and far from guaranteed. The IFWA permits reformation yet warns that extensive judicial rewriting may be against public policy',CN,'Discretionary reformation under IFWA § 35.'),
('indiana','narrow','Indiana\'s blue-pencil doctrine is a strict eraser: a court may strike grammatically divisible unreasonable language, but it cannot add, change, or rearrange terms to save a covenant',CN,'Strict blue pencil only; counts as narrow per label definition.'),
('iowa','narrow','Iowa rejected a strict all-or-nothing approach and allows partial enforcement to the extent reasonably necessary to protect legitimate interests, unless the facts show bad faith or oppression',CN,'Partial enforcement absent bad faith (Ehlers).'),
('kansas','narrow','Kansas courts have long used their equitable power to reduce an overbroad restraint and enforce it as reduced, rather than striking the whole covenant',CN,'Common-law equitable reduction.'),
('kentucky','narrow','Kentucky is a reformation jurisdiction: its courts have a blue-pencil power to reform or amend overly broad restrictions',CN,'Discretionary reformation.'),
('louisiana','AMBIGUOUS','A court will not add or substitute language to save a defective covenant; at most it may strike an offending portion under a severability clause and enforce what independently complies with the statute',CN,'Striking available only where the contract has a severability clause; turns on contract clause.'),
('maine','AMBIGUOUS','whether a court will rewrite an overbroad covenant as drafted is unsettled',CN,'Guide says the reformation question is unsettled; Maine reviews as applied.'),
('maryland','narrow','Maryland courts blue-pencil rather than rewrite. A court may strike an offending, severable portion of a covenant and enforce what remains',CN,'Blue pencil of severable portions; counts as narrow per label definition.'),
('massachusetts','narrow','"A court may, in its discretion, reform or otherwise revise a noncompetition agreement so as to render it valid and enforceable to the extent necessary to protect the applicable legitimate business interests."',CN,'Discretionary statutory reformation (§ 24L).'),
('michigan','narrow','MCL 445.774a expressly lets a court limit a covenant it finds unreasonable and enforce it as limited, so Michigan is a statutory blue-pencil state',CN,'Discretionary statutory limitation.'),
('minnesota','AMBIGUOUS','Usually no, for agreements entered into on or after July 1, 2023. Minn. Stat. § 181.988 makes covered covenants not to compete void and unenforceable','employee-non-compete-enforceability','State voids nearly all employee non-competes signed after July 1, 2023; question not well-posed.'),
('mississippi','narrow','Mississippi follows an equitable-reformation approach: rather than voiding an overbroad covenant outright, its courts will enforce the agreement to the extent it is reasonable',CN,'Equitable reformation, discretionary.'),
('missouri','narrow','Missouri courts have authority to refuse to enforce unreasonable terms or to modify an overbroad covenant to make it reasonable, yet modification is discretionary',CN,'Discretionary modification.'),
('montana','void','Montana courts construe restrictive covenants strictly and void an overbroad restraint outright rather than narrowing it into a lawful one','trade-secrets-severance','No court-narrowing section; answer from trade-secrets-severance drafting note.'),
('nebraska','void','Nebraska rejects blue-pencil rewriting and generally enforces the covenant as written or not at all',CN,'No blue pencil for ordinary employment covenants.'),
('nevada','narrow','NRS 613.195(6) directs the court to revise and enforce an overbroad but consideration-supported covenant',CN,'Mandatory statutory revision.'),
('new-hampshire','narrow','New Hampshire courts have power to reform overbroad covenants, but bad-faith presentation can defeat that remedy',CN,'Reformation conditioned on good faith.'),
('new-jersey','narrow','*Solari* abandoned the old void-per-se rule in favor of total or partial enforcement to the extent reasonable, so New Jersey courts narrow overbroad covenants',CN,'Partial enforcement under Solari.'),
('new-mexico','AMBIGUOUS','*KidsKare* upheld modification because the parties\' agreement expressly authorized amendment of an unenforceable provision and enforcement to the maximum reasonable extent',CN,'Narrowing authority is contract-based only; court declined to decide default rule.'),
('new-york','narrow','New York rejects a per se rule voiding every overbroad covenant, yet a court will rewrite one to a reasonable scope only when the employer acted in good faith and did not overreach',CN,'Discretionary partial enforcement (BDO).'),
('north-carolina','narrow','"North Carolina has adopted the ‘strict blue pencil doctrine’ under which a court cannot rewrite a faulty covenant not to compete but may enforce divisible and reasonable portions of the covenant while striking the unenforceable portions."',CN,'Strict blue pencil only; counts as narrow per label definition.'),
('north-dakota','AMBIGUOUS','**Short answer.** No. North Dakota law makes a contract that restrains a lawful profession, trade, or business to that extent void','employee-non-compete-enforceability','State voids nearly all employee non-competes; question not well-posed.'),
('ohio','narrow','*Raimonde* abandoned strict blue-penciling and lets Ohio courts enforce an overbroad covenant only to the extent reasonable, but reformation is discretionary',CN,'Discretionary reformation (Raimonde).'),
('oklahoma','AMBIGUOUS','Oklahoma treats a conventional employee non-compete as void rather than reforming it','employee-non-compete-enforceability','State voids nearly all employee non-competes; question not well-posed.'),
('oregon','AMBIGUOUS','The statute expressly severs only the portion of a term beyond 12 months; the older voidable regime described in *Bernard v. S.B., Inc.* was superseded by the 2021 amendments','void-vs-voidable','Post-2022 non-conforming covenant is void, but statute severs over-length duration; mixed answer.'),
('pennsylvania','narrow','A Pennsylvania court of equity may enforce only the reasonable portions of an overbroad covenant, yet it will scrutinize the restraint closely',CN,'Discretionary partial enforcement.'),
('rhode-island','narrow','*Durapin* adopted partial enforcement rather than an all-or-nothing or mechanical blue-pencil rule, absent bad faith or deliberate overreaching',CN,'Partial enforcement absent bad faith.'),
('south-carolina','void','South Carolina is a strict no-blue-pencil, no-reformation jurisdiction: a court will not rewrite an unreasonable covenant, and the agreement must stand or fall on its own terms',CN,'Only pre-drafted step-down alternatives survive.'),
('south-dakota','AMBIGUOUS','**Short answer.** Sometimes. South Dakota recognizes partial enforcement, but that does not let a drafter ignore the statute; the court modifies only to conform the covenant to statutory limits','overbroad-covenants','"Sometimes"; the partial-enforcement authority cited is a sale-of-business case, not an employee covenant.'),
('tennessee','narrow','Tennessee follows the *rule of reasonableness* rather than the strict blue-pencil rule, so a court may modify an unreasonable covenant to make it reasonable instead of striking it',CN,'Discretionary modification; oppressive covenants voided.'),
('texas','narrow','**Short answer.** Yes, reformation is mandatory. If a covenant is ancillary to an otherwise enforceable agreement but its limits are unreasonable, the court shall reform it to the minimum reasonable restraint',CN,'Mandatory reformation under § 15.51(c).'),
('utah','AMBIGUOUS','Probably not for the duration problem, and the broader reformation question is unsettled.',CN,'Guide says the question is unsettled.'),
('vermont','AMBIGUOUS','**Short answer.** Genuinely mixed. The Vermont Supreme Court will not *make* a contract for the parties',CN,'Guide describes split signals.'),
('virginia','void','Virginia courts strictly construe restrictive covenants, and a clear overbreadth problem can make the covenant unenforceable rather than narrowed by the court',CN,'No blue pencil.'),
('washington','narrow','Washington courts have long enforced a covenant only to the extent it is reasonable, yet RCW 49.62.080 makes the employer pay the $5,000 penalty whenever a court reforms or partially enforces one',CN,'Reformation available but triggers statutory penalty.'),
('west-virginia','AMBIGUOUS','*Reddy* allows tailoring only after a covenant is facially reasonable and the employer proves legitimate interests.',CN,'Facially overbroad covenants void; minor overbreadth may be tailored; turns on degree.'),
('wisconsin','void','"Any covenant, described in this section, imposing an unreasonable restraint is illegal, void and unenforceable even as to any part of the covenant or performance that would be a reasonable restraint."',CN,'§ 103.465 forbids narrowing.'),
('wyoming','void','The court held that the entire agreement was void because the duration and geographic terms were unreasonable.',CN,'Wyoming Supreme Court will not rewrite overbroad covenant.'),
]
ws=lambda s:re.sub(r'\s+',' ',s)
out=[];bad=[]
for st,lab,q,a,n in R:
    t=ws(open(D+st+'.md').read())
    ok= ws(q) in t and 40<=len(q)<=400 and ('{#'+a+'}') in t
    if not ok: bad.append((st,len(q),ws(q) in t))
    out.append({"family":"narrowing","state":st,"label":lab,"quote":q,"anchor":a,"note":n})
print(bad,len(out))
json.dump(out,open('truth2/narrowing.json','w'),ensure_ascii=False,indent=1)
from collections import Counter;print(Counter(o['label'] for o in out))
