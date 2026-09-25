import re,os,json
D=os.path.expanduser('~/Projects/open-agreements/practice-guides/non-compete/us/')
def norm(s): return re.sub(r'\s+',' ',s)
def L(dates,cites,summ): return {"effective_dates":dates,"citations":cites,"summary":summ}
items=[
("california",L(["January 1, 2024","January 1, 2026"],["Bus. & Prof. Code § 16600.5","Bus. & Prof. Code § 16600.1","Health and Safety Code section 1191"],"SB 699/AB 1076 expand void-noncompete liability; SB 351 bars PE physician noncompetes."),
 "Since January 1, 2024, two laws turned California's ban from a defense into an offensive weapon. Senate Bill 699 (section 16600.5) makes *entering into* or *attempting to enforce* a void non-compete a civil violation",
 ["for contracts under the new healthcare law that takes effect January 1, 2026. Senate Bill 351 (Health and Safety Code section 1191) bars a private equity group or hedge fund"],
 "AB 692 (§ 16608, stay-or-pay, Jan 1, 2026) not listed separately; same date."),
("colorado",L(["August 6, 2025"],["C.R.S. § 8-2-113"],"SB 25-083 voids non-competes for physicians, APRNs, dentists regardless of pay."),
 "- **August 6, 2025:** Senate Bill 25-083 voided non-competes for health-care providers and capped minority-owner sale-of-business covenants by formula",
 None,"HB 24-1324 (Aug 7, 2024, training-repayment) omitted as not a non-compete enforceability change."),
("florida",L(["July 1, 2025"],["Fla. Stat. § 542.41"],"CHOICE Act creates employer-favorable enforceable non-compete track for high earners."),
 "The CHOICE Act, effective July 1, 2025, created a second, even more employer-favorable track for high-earning *covered employees*",None,None),
("illinois",L(["January 1, 2025"],["820 ILCS 90/10"],"Non-competes unenforceable for mental-health professionals serving veterans and first responders."),
 "Any covenant not to compete or covenant not to solicit entered into after January 1, 2025 (the effective date of Public Act 103-915) shall not be enforceable with respect to the provision of mental health services to veterans and first responders",
 None,"Workplace Transparency Act (Jan 1, 2026) choice-of-law change excluded: tied to unlawful employment practices, not non-compete enforceability."),
("indiana",L(["July 1, 2025"],["Ind. Code § 25-22.5-5.5-2.3"],"SEA 475 voids new non-competes between physicians and hospitals or hospital systems."),
 "The 2025 amendment (Senate Enrolled Act 475) is the most sweeping. Effective July 1, 2025, a physician and a hospital, a parent company of a hospital, an affiliated manager of a hospital, or a hospital system may not enter a non-compete",None,None),
("louisiana",L(["January 1, 2025","August 1, 2026"],["La. R.S. 23:921(M)","La. R.S. 23:921(N)","La. R.S. 23:921(P)"],"Physician non-compete caps from signing; intern and apprentice non-competes barred."),
 "Act 273 of 2024 added physician-specific limits to La. R.S. 23:921, effective January 1, 2025.",
 ["Act 150 of 2026, enacting La. R.S. 23:921(P) effective August 1, 2026, bars non-competes for interns and apprentices outright"],None),
("maine",L(["July 13, 2026"],["§ 599-A"],"L.D. 2200 restricts non-competes for health-care practitioners entered or renewed after effective date."),
 "The 2026 healthcare development is now law. Governor Mills signed L.D. 2200 on April 15, 2026, and it applies to non-compete agreements entered into or renewed on or after its July 13, 2026 effective date",None,None),
("maryland",L(["July 1, 2025","October 1, 2026"],["§ 3-716(a)(1)(i)2","§ 3-716(a)(2)(i)3"],"Health-care employee ban (HB 1388) and licensed-architect ban (HB 1016) extend § 3-716."),
 "The statute voids covenants for licensed health-occupations employees who provide direct patient care and earn $350,000 or less, and that health care expansion applies only to agreements executed on or after July 1, 2025",
 ["Beginning October 1, 2026, § 3-716's void rule extends to a **licensed architect**"],
 "HB 1388 (2024) date given is its application date for health-care agreements; the veterinary expansion's effective date is not stated."),
("montana",L(["April 16, 2025","January 1, 2026"],["Mont. Code Ann. § 28-2-724"],"HB 198 and HB 620 extend health-care provider non-compete ban to nurses, PAs, physicians."),
 "HB 198 added naturopathic physicians, registered professional nurses, advanced practice registered nurses, and physician assistants for contracts made or renewed on or after April 16, 2025, and HB 620 added all physicians licensed under",
 ["HB 620 added all physicians licensed under Title 37, chapter 3 on a delayed effective date of January 1, 2026"],None),
("new-hampshire",L(["August 23, 2025"],["RSA 326-B:45-b"],"New statute voids geographic practice restrictions in APRN professional relationship contracts."),
 "Separate statutes reach physicians, nurses, advanced practice registered nurses, and podiatrists — the advanced-practice-registered-nurse statute effective August 23, 2025",None,None),
("oregon",L(["June 9, 2025"],["ORS 653.297","ORS 653.298"],"Non-competes restricting practice of medicine or nursing void for medical licensees, retroactively."),
 "The companion provision reaches agreements entered before, on, or after the June 9, 2025 effective date",None,None),
("pennsylvania",L(["January 1, 2025"],["Act 74 of 2024"],"Health-care practitioner non-competes over one year or after dismissal are void."),
 "The Fair Contracting for Health Care Practitioners Act (Act 74 of 2024), effective January 1, 2025, voids non-compete covenants longer than one year for covered practitioners",None,None),
("rhode-island",L(["June 17, 2024"],["R.I. Gen. Laws § 5-34-50"],"Non-competes against advanced practice registered nurses banned, sale-of-practice exception."),
 "a covenant made in connection with the sale of a practice that lasts no more than five years — and the APRN ban has applied since June 17, 2024, so a covenant against an APRN signed on or after that date is measured against it.",None,None),
("south-dakota",L(["July 1, 2026"],["House Bill 1180 (SDCL ch. 53-9)"],"New enforceable lane for departing-owner non-competes on ownership-interest transfers."),
 "Under House Bill 1180, which took effect July 1, 2026, the parties to a business entity's governing document, or to a contract for the purchase, sale, or transfer of an ownership interest in the entity, may agree that a departing owner not engage",
 None,"Covers departing owners rather than employees generally; included as a new enforceable-covenant regime."),
("tennessee",L(["July 1, 2026"],["Tenn. Code Ann. § 50-1-210","Tenn. Code Ann. § 50-1-211"],"Voids non-competes under $70,000 and adds rebuttable time-reasonableness presumptions."),
 "The headline change is the 2026 statute that, effective July 1, 2026, voids non-competes for employees earning under $70,000 and sets rebuttable time presumptions for the rest",None,None),
("texas",L(["September 1, 2025"],["Bus. & Com. Code § 15.50","Bus. & Com. Code § 15.501"],"SB 1318 adds physician good-cause rule and limits for dentists, nurses, PAs."),
 "SB 1318 extended a parallel set of limits to a broader group of health-care practitioners by enacting § 15.501, effective September 1, 2025",None,None),
("utah",L(["May 6, 2026"],["Utah Code § 34-51-201"],"Bans healthcare-worker and veterinarian non-competes entered on or after effective date."),
 "Treat the May 6, 2026 healthcare and veterinarian provisions as the current rule, not pending legislation; they are codified in the Post-Employment Restrictions Act and took effect on that date",None,None),
("virginia",L(["July 1, 2025","July 1, 2026"],["Va. Code § 40.1-28.7:8"],"Low-wage ban extended to FLSA non-exempt workers; health-care ban and severance rule added."),
 "Effective July 1, 2025, a ‘low-wage employee’ also includes an employee who, regardless of average weekly earnings, is entitled to overtime compensation under the provisions of the Fair Labor Standards Act",
 ["It implements the SB 128 categorical ban, effective July 1, 2026, for persons licensed, registered, or certified by the Board of Medicine, Nursing, Counseling, Optometry, Psychology, or Social Work",
  "For agreements entered into, amended, or renewed on or after July 1, 2026, a non-compete is unenforceable after a discharge without cause unless the employer provides severance benefits"],None),
("washington",L(["June 6, 2024","June 30, 2027"],["chapter 49.62 RCW"],"SSB 5935 amends non-compete statute; ESHB 1155 near-total ban effective 2027."),
 "Covenants entered into now are governed by chapter 49.62 RCW as amended by Substitute Senate Bill 5935, effective June 6, 2024 [^ssb5935-amendments]. On June 30, 2027, Engrossed Substitute House Bill 1155 replaces that conditional regime with a near-total ban",None,None),
("wyoming",L(["July 1, 2025"],["Wyo. Stat. § 1-23-108"],"SF 107 voids most non-competes prospectively, with enumerated exceptions and physician rules."),
 "**July 1, 2025:** The new statute took effect for contracts entered into on or after that date.",None,None),
]
amb=[
("arkansas","The physician ban was added by the 2025 amendment. The statute defines physician by reference to the Arkansas Medical Practices Act and osteopathy licensing provisions","Guide says 2025 amendment added physician ban (Ark. Code Ann. § 4-75-101) but gives no effective date."),
("iowa","H.F. 2254 is enacted 2026 law of limited reach. It directs the Board of Regents to adopt a policy barring the University of Iowa Hospitals and Clinics from including noncompetes in employment contracts with listed clinical roles","Enacted 2026 UIHC clinical non-compete law; guide gives only 'the effective date of this Act', no day."),
]
out=[];bad=0
def anchor(txt,pos):
    body_end=txt.find('\n[^about]:')
    if pos>body_end>0: return None
    hs=[m for m in re.finditer(r'\{#([a-z0-9-]+)\}',txt[:pos])]
    return hs[-1].group(1) if hs else None
def check(txt,q):
    n=norm(txt); nq=norm(q)
    i=n.find(nq)
    return i
for s,lab,q,extra,note in items:
    txt=open(D+s+'.md').read(); n=norm(txt)
    for qq in [q]+(extra or []):
        if n.find(norm(qq))<0 or not(40<=len(qq)<=400): print('BAD',s,len(qq),qq[:60]); bad+=1
    allq=' '.join([q]+(extra or []))
    for d in lab['effective_dates']:
        if d not in allq: print('DATE MISSING',s,d); bad+=1
    pos=txt.find(q[:30])
    e={"family":"recency","state":s,"label":lab,"quote":q,"anchor":anchor(txt,pos)}
    if extra: e["quotes"]=extra
    if note: e["note"]=note
    out.append(e)
for s,q,note in amb:
    txt=open(D+s+'.md').read()
    if norm(txt).find(norm(q))<0 or not(40<=len(q)<=400): print('BAD',s); bad+=1
    out.append({"family":"recency","state":s,"label":"AMBIGUOUS","quote":q,"anchor":anchor(txt,txt.find(q[:30])),"note":note})
print('bad',bad,len(out))
json.dump(out,open('../recency.json','w'),indent=1,ensure_ascii=False)
for e in out: print(e['state'],e['anchor'])
