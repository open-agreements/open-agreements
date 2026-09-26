#!/usr/bin/env python3
"""Score runs.jsonl against ground truth. Deterministic; no LLM judge.

Metrics
  void_acc  : binary "is an ordinary-employee non-compete void as a general matter",
              scored on all 51 jurisdictions.
  cite_acc  : does the answer name the controlling statute, scored format-agnostically
              on the 26 states with a dedicated non-compete statute.
  date_acc  : effective date of the controlling rule, on the states where one is stated.

Usage: python3 score_bench.py [runs.jsonl]  |  python3 score_bench.py --selftest
"""
import json, re, sys, pathlib
import bench_lib as b

HERE = pathlib.Path(__file__).parent
CIT = json.load(open(HERE/"truth_citations.json"))
CIT = {k: v for k, v in CIT.items() if not k.startswith("_")}

def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def norm_date(s):
    s = (s or "").strip().lower().replace(",", "")
    m = re.match(r"([a-z]+)\s+(\d{1,2})\s+(\d{4})", s)
    return f"{m.group(1)[:3]}{int(m.group(2))}{m.group(3)}" if m else norm(s)

def score_one(state, parsed):
    """Return dict of metric -> True/False/None (None = not applicable)."""
    r = {"void": None, "cite": None, "date": None}
    if not isinstance(parsed, dict) or not isinstance(parsed.get("void_general"), bool):
        # unparseable answer OR a parseable refusal ({"error": ...}) counts as wrong
        # on every applicable metric. bool(None) is False, which is the right answer
        # in 44/51 states, so a refusal must never reach the comparison below.
        r["void"] = False
        if state in CIT: r["cite"] = False
        if state in CIT and CIT[state].get("effective"): r["date"] = False
        return r
    r["void"] = bool(parsed.get("void_general")) == (state in b.VOID_STATES)
    if state in CIT:
        r["cite"] = norm(CIT[state]["section"]) in norm(parsed.get("statute"))
        eff = CIT[state].get("effective")
        if eff:
            r["date"] = norm_date(parsed.get("effective_date")) == norm_date(eff)
    return r

def selftest():
    """Negative control on the scorer itself: it must be able to return False."""
    cases = [
        # (state, parsed, expected void/cite/date)
        ("wyoming", {"void_general": True,  "statute": "Wyo. Stat. § 1-23-108(a)", "effective_date": "July 1, 2025"},  (True, True, True)),
        ("wyoming", {"void_general": True,  "statute": "Wyoming Statute 1-23-108", "effective_date": "July 1, 2025"},  (True, True, True)),   # format-agnostic
        ("wyoming", {"void_general": False, "statute": "none",                     "effective_date": "n/a"},           (False, False, False)), # all wrong
        ("wyoming", {"void_general": True,  "statute": "Wyo. Stat. § 1-23-108",    "effective_date": "July 1, 2023"},  (True, True, False)),  # date wrong only
        ("texas",   {"void_general": False, "statute": "Tex. Bus. & Com. Code § 15.50", "effective_date": "n/a"},      (True, True, None)),   # no date truth
        ("alaska",  {"error": "The reference material covers Arizona, not Alaska."},                                    (False, None, None)),  # refusal is wrong, not "not void"
        ("texas",   {"void_general": True,  "statute": "Tex. Bus. & Com. Code § 15.50", "effective_date": "n/a"},      (False, True, None)),  # void wrong only
        ("alaska",  {"void_general": False, "statute": "none",                     "effective_date": "n/a"},           (True, None, None)),   # not in cite set
        ("wyoming", None,                                                                                              (False, False, False)), # unparseable
    ]
    ok = True
    for state, parsed, exp in cases:
        got = score_one(state, parsed)
        g = (got["void"], got["cite"], got["date"])
        flag = "ok " if g == exp else "FAIL"
        if g != exp: ok = False
        print(f"  {flag} {state:8} got={g} expected={exp}")
    print("selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1

def main():
    path = HERE/"runs"/"runs.jsonl"
    for a in sys.argv[1:]:
        if not a.startswith("--"): path = pathlib.Path(a)
    runs = [json.loads(l) for l in open(path)]
    agg = {}
    for r in runs:
        s = score_one(r["state"], r["parsed"])
        vk = "void_v" if r["state"] in b.VOID_STATES else "void_n"
        d = agg.setdefault(r["condition"], {"void_v":[0,0], "void_n":[0,0], "cite":[0,0], "date":[0,0], "err":0, "refuse":0})
        if r.get("error"): d["err"] += 1
        p = r["parsed"]
        if not isinstance(p, dict) or not isinstance(p.get("void_general"), bool): d["refuse"] += 1
        for k, v in ((vk, s["void"]), ("cite", s["cite"]), ("date", s["date"])):
            if v is not None:
                d[k][1] += 1
                d[k][0] += 1 if v else 0
    nv = len(b.VOID_STATES); nn = len(b.states()) - nv
    print(f"{'condition':10} {'void states':>12} {'non-void':>12} {'citation':>12} {'eff. date':>12}  refusals  errors")
    def f(pair):
        n,t = pair
        return f"{n}/{t} {100*n/t:3.0f}%" if t else "   n/a"
    print(f"{'baseline*':10} {f([0,nv]):>12} {f([nn,nn]):>12} {'':>12} {'':>12}")
    for cond in ("cold","oa","control"):
        if cond not in agg: continue
        d = agg[cond]
        print(f"{cond:10} {f(d['void_v']):>12} {f(d['void_n']):>12} {f(d['cite']):>12} {f(d['date']):>12}  {d['refuse']:>8}  {d['err']:>6}")
    print("* baseline = always answer 'not void'")
    # per-state citation detail for the post
    print("\nper-state citation (cold -> oa):")
    by = {(r['state'],r['condition']): r for r in runs}
    for st in sorted(CIT):
        c = score_one(st, by.get((st,'cold'),{}).get('parsed'))['cite']
        o = score_one(st, by.get((st,'oa'),{}).get('parsed'))['cite']
        if c is not None:
            got = (by.get((st,'cold'),{}).get('parsed') or {}).get('statute','')
            print(f"  {st:22} cold={'Y' if c else 'n'} oa={'Y' if o else 'n'}  cold_said={str(got)[:52]}")

def gate():
    """Every hand-curated citation section and effective date must appear verbatim in the
    state's pinned guide. Returns non-zero on any miss, so a stale or invented key fails."""
    import re
    bad = 0
    for st, c in sorted(CIT.items()):
        g = re.sub(r"\s+", " ", b.guide(st))
        for field in ("section", "effective"):
            v = c.get(field)
            if v and v not in g:
                print(f"  MISS {st}.{field} = {v!r}"); bad += 1
    print(f"citation gate: {len(CIT)} states, {bad} misses, guide_ref {b.GUIDE_REF[:12]}")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else gate() if "--gate" in sys.argv else (main() or 0))
