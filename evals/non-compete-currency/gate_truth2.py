#!/usr/bin/env python3
"""Gate the long-tail ground truth proposed by labelling agents.

Agent output is a lead, not a fact. An item survives only if:
  - its state is one of the 51 benchmark jurisdictions,
  - every quote is an exact substring of that state's guide (whitespace-collapsed),
  - numeric / date labels appear inside the quote in a recognised surface form,
  - it is not AMBIGUOUS, and its label is in the family's label set.
Enum labels (yes/no, narrow/void) cannot be verified mechanically; they are listed
for human review with their quote (`--review`).

Usage: python3 gate_truth2.py [--review] [--selftest]
Writes truth2.jsonl (surviving items) and prints rejections with reasons.
"""
import json, re, sys, pathlib
import bench_lib as b

HERE = pathlib.Path(__file__).parent
SRC = HERE / "truth2"
OUT = HERE / "truth2.jsonl"

WORDS = {1:"one",2:"two",3:"three",4:"four",5:"five",6:"six",7:"seven",8:"eight",9:"nine",
         10:"ten",12:"twelve",14:"fourteen",15:"fifteen",18:"eighteen",20:"twenty",
         24:"twenty-four",30:"thirty",36:"thirty-six",60:"sixty",90:"ninety"}
ENUMS = {"narrowing": {"narrow","void"}, "consideration": {"yes","no"}, "choice_of_law": {"yes","no"}}

def ws(s): return re.sub(r"\s+", " ", s).strip()

def number_forms(n):
    f = {str(n), f"{n:,}"}
    if n in WORDS: f |= {WORDS[n], WORDS[n].capitalize()}
    return f

def in_quote(forms, quote):
    return any(re.search(rf"(?<![\d,]){re.escape(x)}(?![\d])", quote) for x in forms)

def check(item, guide_text):
    """Return (ok, reason)."""
    fam, st, lab = item.get("family"), item.get("state"), item.get("label")
    if st not in b.states(): return False, f"unknown state {st!r}"
    if lab == "AMBIGUOUS": return False, "ambiguous"
    quotes = [item.get("quote") or ""] + list(item.get("quotes") or [])
    g = ws(guide_text)
    for q in quotes:
        if len(ws(q)) < 20: return False, "quote too short"
        if ws(q) not in g: return False, f"quote not in guide: {ws(q)[:70]!r}"
    joined = " ".join(ws(q) for q in quotes)
    if fam in ENUMS:
        return (lab in ENUMS[fam], "ok" if lab in ENUMS[fam] else f"bad label {lab!r}")
    if fam == "duration":
        if not isinstance(lab, int): return False, "duration label not int"
        forms = number_forms(lab)
        if lab % 12 == 0: forms |= number_forms(lab // 12)   # "two years"
        return (in_quote(forms, joined), "ok" if in_quote(forms, joined) else f"{lab} months not in quote")
    if fam == "threshold":
        if not isinstance(lab, (int, float)) or isinstance(lab, bool): return False, "threshold label not a number"
        forms = {f"${lab:,.2f}"} | ({f"${int(lab):,}"} if float(lab).is_integer() else set())
        # no trailing digits/cents: "$126,858" must not match inside "$126,858.83"
        ok = any(re.search(re.escape(f) + r"(?![\d]|[.,]\d)", joined) for f in forms)
        return ok, "ok" if ok else f"{forms} not in quote"
    if fam == "notice":
        d = lab.get("days") if isinstance(lab, dict) else None
        if not isinstance(d, int): return False, "notice days not int"
        ok = in_quote(number_forms(d), joined)
        return ok, "ok" if ok else f"{d} days not in quote"
    if fam == "recency":
        dates = lab.get("effective_dates") if isinstance(lab, dict) else None
        if not dates: return False, "no effective dates"
        miss = [d for d in dates if ws(d) not in joined]
        return (not miss, "ok" if not miss else f"dates not in quote: {miss}")
    return False, f"unknown family {fam!r}"

def selftest():
    g = ("Colorado voids non-competes for contracts on or after August 10, 2022, and caps notice at 14 days. "
         "For Washington the threshold is $126,858.83 for 2026.")
    cases = [
        ({"family":"recency","state":"colorado","label":{"effective_dates":["August 10, 2022"]},
          "quote":"voids non-competes for contracts on or after August 10, 2022"}, True),
        ({"family":"recency","state":"colorado","label":{"effective_dates":["August 10, 2023"]},
          "quote":"voids non-competes for contracts on or after August 10, 2022"}, False),   # date not in quote
        ({"family":"recency","state":"colorado","label":{"effective_dates":["August 10, 2022"]},
          "quote":"voids noncompetes for contracts on or after August 10, 2022"}, False),    # paraphrased quote
        ({"family":"notice","state":"colorado","label":{"days":14},"quote":"and caps notice at 14 days."}, True),
        ({"family":"notice","state":"colorado","label":{"days":4},"quote":"and caps notice at 14 days."}, False),  # 4 inside 14
        ({"family":"narrowing","state":"colorado","label":"AMBIGUOUS","quote":"and caps notice at 14 days."}, False),
        ({"family":"narrowing","state":"atlantis","label":"void","quote":"and caps notice at 14 days."}, False),
        ({"family":"threshold","state":"colorado","label":126858.83,"quote":"the threshold is $126,858.83 for 2026"}, True),
        ({"family":"threshold","state":"colorado","label":126858,"quote":"the threshold is $126,858.83 for 2026"}, False),
    ]
    bad = 0
    for item, want in cases:
        got, why = check(item, g)
        print(f"  {'ok ' if got == want else 'BAD'} want={want!s:5} got={got!s:5} {why}")
        bad += got != want
    print("selftest:", "PASS" if not bad else f"FAIL ({bad})")
    return 1 if bad else 0

def main():
    items, keep, rej = [], [], []
    for f in sorted(SRC.glob("*.json")):
        for it in json.loads(f.read_text()):
            it["_src"] = f.name
            items.append(it)
    for it in items:
        ok, why = check(it, b.guide(it["state"]) if it.get("state") in b.states() else "")
        (keep if ok else rej).append((it, why))
    keep_ids = {f"{i['family']}:{i['state']}" for i, _ in keep}
    drops = {k: v for k, v in json.loads((HERE / "review_drops.json").read_text()).items() if not k.startswith("_")}
    seen = set(); out = []
    for it, _ in keep:
        if f"{it['family']}:{it['state']}" in drops:
            rej.append((it, "human review: " + drops[f"{it['family']}:{it['state']}"])); continue
        key = (it["family"], it["state"])
        if key in seen:
            rej.append((it, "duplicate family/state")); continue
        seen.add(key)
        out.append({"id": f"{it['family']}:{it['state']}", "family": it["family"],
                    "state": it["state"], "label": it["label"]})
    OUT.write_text("\n".join(json.dumps(o, sort_keys=True) for o in out) + "\n")
    fams = sorted({i.get("family") for i in items})
    print(f"{'family':15} {'proposed':>8} {'kept':>5} {'ambig':>6} {'rejected':>9}")
    for fm in fams:
        p = [i for i in items if i.get("family") == fm]
        k = [o for o in out if o["family"] == fm]
        a = [i for i,w in rej if i.get("family") == fm and w == "ambiguous"]
        print(f"{fm:15} {len(p):>8} {len(k):>5} {len(a):>6} {len(p)-len(k)-len(a):>9}")
    stale = [d for d in drops if d not in keep_ids]
    if stale: print("  WARNING review_drops entries matching no kept item:", stale)
    for it, why in rej:
        if why != "ambiguous":
            print(f"  REJECT {it.get('family')}:{it.get('state')}  {why}")
    if "--review" in sys.argv:
        for it, _ in keep:
            if it["family"] in ENUMS:
                print(f"\n[{it['family']}:{it['state']}] = {it['label']}\n   {ws(it['quote'])[:400]}")
    print(f"wrote {len(out)} items to {OUT}")

if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else (main() or 0))
