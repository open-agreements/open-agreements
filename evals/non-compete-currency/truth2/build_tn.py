import json, re, os
G=os.path.expanduser('~/Projects/open-agreements/practice-guides/non-compete/us/')
T="threshold"; N="notice"
items=[
(T,"colorado",130014,"the highly compensated worker threshold — $130,014 in 2026","highly-compensated-threshold",None),
(T,"district-of-columbia",162164,"As of January 1, 2026, the District's Department of Employment Services puts the figures at $162,164 for most employees","covered-employee","Non-medical employees; medical specialists $270,274."),
(T,"illinois",75000,"A non-compete is void unless the employee's actual or expected annualized earnings exceed $75,000","earnings-thresholds","Rises to $80,000 on Jan 1, 2027; $75,000 in force in 2026."),
(T,"oregon",119541,"the labor agency publishes the figure annually, and for 2026 the amount the employee's pay must exceed is $119,541","salary-threshold",None),
(T,"washington",126858.83,"Only when annualized earnings exceed the inflation-adjusted threshold, which is $126,858.83 for 2026.","earnings-threshold","Guide gives cents; independent-contractor threshold is $317,147.09."),
(T,"virginia",78364.52,"For 2026, the wage threshold is less than $1,507.01 per week, or about $78,364.52 per year.","protected-workers","Low-wage-employee ban; guide annualizes the weekly figure ('about')."),
(T,"tennessee",70000,"makes a non-compete void against any employee earning less than $70,000 a year","employee-non-compete-enforceability","Statute effective July 1, 2026."),
(T,"maine","AMBIGUOUS","Foley reports that Maine updated its threshold from $60,240 in 2024 to $62,600 in 2025","protected-workers","Threshold is 400% of FPL; guide gives only 2024/2025 figures, none for 2026."),
(T,"maryland","AMBIGUOUS","The wage line is keyed to the State minimum wage in § 3-413, which has been $15.00 per hour since January 1, 2024, so the covered ceiling is $22.50 per hour","statutory-voids","Formula (150% of state minimum wage), hourly only; $350,000 figure applies only to health care workers."),
(T,"new-hampshire","AMBIGUOUS","The threshold is less than or equal to 200 percent of the federal minimum wage, currently $14.50 per hour while the federal minimum wage remains $7.25 per hour","low-wage-employees","Hourly formula only; no annual dollar figure."),
(T,"rhode-island","AMBIGUOUS","The statute defines it as an employee whose average annual earnings are not more than 250 percent of the federal poverty level for individuals","employee-non-compete-enforceability","Formula (250% of FPL) with no dollar figure; also nonexempt-status test."),
(N,"colorado",{"days":14,"kind":"unspecified"},"before a prospective worker accepts the job, or at least fourteen days before the covenant or new consideration takes effect for a current worker","notice-requirements","14 days applies to current workers; applicants get notice before accepting the offer."),
(N,"district-of-columbia",{"days":14,"kind":"unspecified"},"The employer must also deliver the non-compete provision in writing at least 14 days before the employee starts work, or at least 14 days before a current employee must sign","highly-compensated-exception",None),
(N,"illinois",{"days":14,"kind":"calendar"},"provides a copy of the covenant at least 14 calendar days before employment begins or otherwise gives the employee at least 14 calendar days to review it","notice-requirement",None),
(N,"maine",{"days":3,"kind":"business"},"Second, the employer must provide the agreement at least 3 business days before the required signing date.","notice-timing","Plus pre-offer disclosure of the requirement."),
(N,"massachusetts",{"days":10,"kind":"business"},"be delivered by the earlier of a formal offer or 10 business days before the start date","formation-notice","New hires: earlier of formal offer or 10 business days; mid-employment: 10 business days' notice before effect."),
(N,"oregon","AMBIGUOUS","in a written employment offer received by the employee at least two weeks before the first day of the employee's employment","valid-requirements","Guide states 'two weeks', not a day count; alternative bona fide advancement route."),
(N,"florida","AMBIGUOUS","To qualify, the employer must advise the worker of the right to counsel, give at least seven days' written notice","choice-act-high-earners","Seven days applies only to CHOICE Act covered non-competes for high earners, not Florida non-competes generally."),
]
out=[];bad=0
for fam,st,lab,q,anc,note in items:
    txt=open(G+st+'.md').read(); norm=lambda s: re.sub(r'\s+',' ',s)
    ok=norm(q) in norm(txt) and 40<=len(q)<=400
    # verify anchor exists and quote under it
    if anc: ok = ok and ('{#'+anc+'}') in txt
    if not ok: print("BAD",st,fam,anc); bad+=1
    d={"family":fam,"state":st,"label":lab,"quote":q,"anchor":anc}
    if note: d["note"]=note
    out.append(d)
json.dump(out,open('threshold_notice.json','w'),indent=1,ensure_ascii=False)
print(len(out),bad)
