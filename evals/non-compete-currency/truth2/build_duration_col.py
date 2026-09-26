import json, re, os
G = os.path.expanduser("~/Projects/open-agreements/practice-guides/non-compete/us/")
OUT = "truth2/duration_col.json"
D, C = "duration", "choice_of_law"
items = [
 (D,"alabama",24,"The employee exception presumes a restraint of two years or less to be reasonable.\n\n\"Restraints of two years or less are presumed to be reasonable.\"","extended-for-breach","Ala. Code 8-1-190(b)(4) presumption"),
 (D,"arkansas",24,"Two years is presumptively reasonable under the statute, unless the particular facts clearly show that two years is unreasonable","duration-limits",None),
 (D,"georgia",24,"For an ordinary former employee, the dividing line is two years, measured from the date the relationship ends.","duration-limits","O.C.G.A. 13-8-57(b) presumption"),
 (D,"louisiana",24,"Named parishes and no more than two years. An employee non-compete must identify the specific parishes or municipalities where it applies and may not run longer than two years from the end of employment","duration-limits","La. R.S. 23:921(C) cap"),
 (D,"massachusetts",12,"The restricted period may not exceed 12 months from the end of employment, unless the employee breached a fiduciary duty or unlawfully took employer property","duration-limits","2-year extension only on misconduct"),
 (D,"oregon",12,"No more than 12 months from termination. ORS 653.295(3) caps the term at 12 months after the employee's termination","duration-limits",None),
 (D,"south-dakota",24,"For employees, the core drafting limits are two years or less, a specified county, first- or second-class municipality, or other specified area","employee-non-compete-enforceability","SDCL 53-9-11 cap"),
 (D,"tennessee",24,"a court presumes a restraint is unreasonable in time if it runs longer than the period set for the relevant relationship: two years for a former employee or independent contractor","duration-limits","2026 statute; agreements on/after July 1, 2026; rebuttable presumption"),
 (D,"utah",12,"One year. For non-competes entered on or after May 10, 2016, an employer and employee may not agree to a post-employment restriction longer than one year from separation","duration-limits",None),
 (D,"washington",18,"Eighteen months is the practical ceiling. A court or arbitrator must presume that any non-compete longer than eighteen months after termination is unreasonable and unenforceable","duration-limits","RCW 49.62.020 rebuttable presumption"),
 (D,"florida","AMBIGUOUS","Against a former employee, a restraint of six months or less is presumed reasonable and one longer than two years is presumed unreasonable.","duration-limits","Two presumptions (6 months reasonable, >2 years unreasonable); unclear which number answers"),
 (D,"idaho","AMBIGUOUS","Eighteen months or less is the statutory safe-harbor term. Idaho Code § 44-2704 presumes an eighteen-month-or-shorter postemployment term reasonable","duration-limits","Idaho statute governs key employees/key independent contractors, not all ordinary employees"),
 (D,"district-of-columbia","AMBIGUOUS","cap the post-employment term — 365 calendar days for a non-medical employee","highly-compensated-exception","Cap is stated in days (365) and applies only to highly compensated employees; others barred entirely"),
 (C,"california","yes","\"An employer shall not require an employee who primarily resides and works in California, as a condition of employment, to agree to a provision that would do either of the following:","choice-of-law","Lab. Code 925"),
 (C,"colorado","yes","No, for a Colorado-based worker. If the worker primarily resided and worked in Colorado at termination, Colorado law governs the covenant's enforceability and the worker cannot be required to litigate enforceability outside Colorado, regardless of any contrary contract clause","choice-of-law",None),
 (C,"louisiana","yes","No. A choice-of-forum or choice-of-law clause in a Louisiana employee's contract is null and void unless the employee ratifies it after the dispute has already arisen","choice-of-law","La. R.S. 23:921(A)(2)"),
 (C,"massachusetts","yes","Section 24L makes a choice-of-law provision unenforceable, where it would have the effect of avoiding the statute, for an employee who has been a Massachusetts resident or employed in Massachusetts for at least 30 days before leaving","choice-of-law",None),
 (C,"minnesota","yes","The statute prohibits requiring a Minnesota-resident-and-worker employee, as a condition of employment, to agree to out-of-state adjudication or to a clause that would deprive the employee of Minnesota substantive protection","choice-of-law-venue","Minn. Stat. 181.988; voidable at employee's request"),
 (C,"washington","yes","No. For a Washington-based worker, a provision requiring out-of-state adjudication, depriving the worker of the Act's protections, or applying another state's law is void and unenforceable","choice-of-law","RCW 49.62.050"),
 (C,"oregon","yes","ORS 15.320(3) applies Oregon law to a contract of employment for services rendered primarily in Oregon by an Oregon resident, so an out-of-state choice-of-law clause does not carry a non-compete around ORS 653.295 for that employee.","choice-of-law-and-fees","Statute mandates Oregon law (law only, not forum)"),
 (C,"new-york","no","And the pending S4641A bill would go further and void choice-of-law and venue clauses used to avoid the statute for workers who reside or work in New York — pending only, not law","choice-of-law","Only case-law public-policy exception (Brown & Brown); statutory bar is pending bill only"),
 (C,"alabama","AMBIGUOUS","Therefore, this article shall govern and shall be applied instead of any foreign laws that might otherwise be applicable in those instances when the application of those foreign laws would violate a fundamental public policy expressed in this article.","choice-of-law","Statutory public-policy override conditioned on conflict; not a flat bar on requiring the clause"),
 (C,"illinois","AMBIGUOUS","it voids a unilateral clause applying non-Illinois law or requiring an out-of-state venue to the extent it diminishes an Illinois employee's rights related to an unlawful employment practice","choice-of-law","WTA bar limited to unlawful-employment-practice claims, not non-compete enforcement generally"),
 (C,"north-carolina","AMBIGUOUS","Section 22B-3 reaches forum and arbitration provisions; it does not by itself void an out-of-state choice-of-law clause.","out-of-state-employers","Statute voids out-of-state forum clauses in NC contracts but not choice-of-law"),
 (C,"idaho","AMBIGUOUS","Idaho Code § 29-110 voids those restrictions as Idaho public policy, and *Off-Spec Solutions* applied that policy to require Idaho arbitration","choice-of-law-forum","General tribunal-access statute, not a non-compete choice-of-law rule; 'often no'"),
 (C,"new-mexico","AMBIGUOUS","Outside the health-care statute, the provided New Mexico source set does not contain a non-compete-specific choice-of-law rule.","choice-of-law","Statutory bar only for health-care practitioners; guide hedges on source set for others"),
 (C,"florida","AMBIGUOUS","the CHOICE Act even applies to a covered employee whose primary place of work is Florida *regardless of any applicable choice of law provisions*","choice-of-law-multistate","CHOICE Act override favors enforcement for high earners; not an employee-protective bar"),
 (C,"indiana","AMBIGUOUS","Indiana generally honors a forum or choice-of-law clause, but a contract for the improvement of Indiana real estate may not be made subject to another state's law","choice-of-law-and-fees","Statutory bar only for construction contracts; guide does not expressly say no employment bar"),
 (C,"texas","AMBIGUOUS","Sometimes for forum, rarely to escape Texas policy. Texas courts will enforce a mandatory forum-selection clause through mandamus","choice-of-law-forum","Case-law public-policy override; guide does not state whether any statutory bar exists"),
 (C,"oklahoma","AMBIGUOUS","An Oklahoma court will not apply a contractually chosen foreign law if doing so would violate Oklahoma public policy","choice-of-law","Case-law public-policy override; forum clauses enforced; no statement on statutory bar"),
 (C,"wisconsin","AMBIGUOUS","Wisconsin courts refuse to enforce a choice-of-law clause that would apply another state's more permissive covenant law in place of § 103.465, because doing so would violate Wisconsin's fundamental public policy.","choice-of-law","Case-law override, not a statute barring the clause"),
 (C,"georgia","AMBIGUOUS","Georgia law remains the touchstone, so a Georgia court must first determine whether a covenant complies with the GRCA","choice-of-law","Case-law (Motorsports) override, not a statutory bar"),
]
def norm(s): return re.sub(r"\s+"," ",s).strip()
out=[]; bad=[]
for fam,st,lab,q,anc,note in items:
    text=norm(open(G+st+".md").read()); qn=norm(q)
    ok = qn in text and 40<=len(qn)<=400
    if fam==D and lab!="AMBIGUOUS" and not re.search(r"\b(\d+|one|two|eighteen|twelve)\b", qn, re.I): ok=False
    if not ok: bad.append((st,fam,len(qn)))
    if anc and ("{#%s}"%anc) not in text: bad.append((st,"anchor",anc))
    e={"family":fam,"state":st,"label":lab,"quote":q,"anchor":anc}
    if note: e["note"]=note
    out.append(e)
print("BAD",bad)
json.dump(out,open(OUT,"w"),indent=1,ensure_ascii=False)
lab=sum(1 for e in out if e["label"]!="AMBIGUOUS"); print(len(out),lab,len(out)-lab)
