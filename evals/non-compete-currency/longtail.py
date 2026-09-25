#!/usr/bin/env python3
"""Long-tail benchmark: the questions practitioners get paid for.

Families (truth from gate_truth2.py -> truth2.jsonl):
  narrowing      will a court narrow an overbroad covenant, or void it?     narrow|void
  consideration  is continued employment alone enough consideration?       yes|no
  choice_of_law  does a statute bar imposing another state's law/forum?    yes|no
  duration       statutory cap / presumption, months                       int
  threshold      minimum earnings in force for 2026, dollars                int
  notice         advance-notice period, days                               int
  recency        statutes effective >= 2024-01-01, effective dates          dates

Same three conditions as run_bench.py: cold / oa (own guide) / control (next
state's guide). Scoring is deterministic; a refusal or missing field is wrong.

Usage:
  python3 longtail.py run   [--limit N]      -> longtail_runs.jsonl
  python3 longtail.py score [--selftest]
"""
import json, re, sys, time, pathlib
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import bench_lib as b
from datetime import datetime

def norm_date(s):
    """Canonical YYYY-MM-DD for 'July 1, 2025', 'Jul. 1 2025', '2025-07-01', '07/01/2025'; else None."""
    s = re.sub(r"\s+", " ", str(s or "").replace(",", " ").replace(".", " ")).strip()
    s = re.sub(r"(?i)\bsept\b", "Sep", s)
    for fmt in ("%B %d %Y", "%b %d %Y", "%Y-%m-%d", "%m/%d/%Y"):
        try: return datetime.strptime(s, fmt).date().isoformat()
        except ValueError: pass
    return None

HERE = pathlib.Path(__file__).parent
RUNS = pathlib.Path(sys.argv[sys.argv.index("--runs") + 1]) if "--runs" in sys.argv else HERE / "runs" / "longtail_runs.jsonl"
# --cold-only: skip oa/control (used to probe larger models' parametric knowledge cheaply)
AS_OF = "Answer as of September 2026, for an agreement signed today."

Q = {
 "narrowing": ("If an employee non-compete in {s} is overbroad (for example, an unreasonable duration or "
               "geographic scope), may a court narrow it — by blue-penciling or by reformation — and enforce a "
               "reasonable version, or must the court refuse to enforce the covenant entirely?",
               '{{"answer": "narrow" or "void"}}'),
 "consideration": ("In {s}, is continued at-will employment, by itself, sufficient consideration to support a "
                   "non-compete that an existing employee signs after employment has already begun?",
                   '{{"answer": "yes" or "no"}}'),
 "choice_of_law": ("Does {s} law prohibit an employer from requiring an employee who primarily lives and works in "
                   "{s} to agree, as a condition of employment, that another state's law or forum will govern a "
                   "non-compete?", '{{"answer": "yes" or "no"}}'),
 "duration": ("Does a {s} statute set a maximum, or a presumptively reasonable, duration for an ordinary "
              "employee's post-employment non-compete? If so, give it in months.",
              '{{"months": <integer, or null if no statute sets one>}}'),
 "threshold": ("What minimum annual earnings must an employee have for an employee non-compete to be enforceable "
               "against them in {s}? Give the dollar figure in force in 2026.",
               '{{"dollars": <integer, or null if there is no earnings threshold>}}'),
 "notice": ("How many days in advance must an employer in {s} give an employee or applicant the non-compete "
            "before it is signed or before employment starts?",
            '{{"days": <integer, or null if no fixed advance-notice period>}}'),
 "recency": ("Has {s} enacted a statute, effective on or after January 1, 2024, that changes when non-competes "
             "are enforceable for any class of workers (including profession-specific rules)? If yes, give the "
             "effective date of each such statute.",
             '{{"enacted": true or false, "effective_dates": ["Month D, YYYY", ...]}}'),
}

def prompt(family, target, ctx):
    q, fmt = Q[family]
    body = (f"{q.format(s=b.pretty(target))} {AS_OF}\n\n"
            f"Respond with ONLY a JSON object, no prose:\n{fmt.format()}")
    if ctx is None:
        return body
    return (f"Reference material:\n\n<practice_guide>\n{b.guide(ctx)}\n</practice_guide>\n\n"
            f"Using the reference material above where it applies, answer: {body}")

# Excluded from every published aggregate: narrow/void is ill-posed for strict blue-pencil
# states and near-ban states (see review_drops.json "_narrowing"). Items are still run and shown.
EXCLUDED_FAMILIES = {"narrowing"}

def truth():
    return [json.loads(l) for l in open(HERE / "truth2.jsonl") if l.strip()]

def partner(slug):
    s = b.states(); return s[(s.index(slug) + 1) % len(s)]

def run():
    items = truth()
    if "--limit" in sys.argv:
        items = items[:int(sys.argv[sys.argv.index("--limit") + 1])]
    jobs = [(it, c, x) for it in items
            for c, x in (("cold", None), ("oa", it["state"]), ("control", partner(it["state"])))
            if c == "cold" or "--cold-only" not in sys.argv]
    def work(j):
        it, cond, ctx = j
        rec = {"id": it["id"], "family": it["family"], "state": it["state"], "condition": cond,
               "context_state": ctx, "raw": None, "parsed": None, "usage": None, "error": None}
        for attempt in range(3):
            try:
                text, usage = b.call(prompt(it["family"], it["state"], ctx), max_tokens=16384)
                rec.update(raw=text, parsed=b.parse(text), usage=usage, error=None)
                break
            except Exception as e:
                rec["error"] = f"{type(e).__name__}: {e}"; time.sleep(2 * (attempt + 1))
        return rec
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(work, jobs))
    RUNS.write_text("\n".join(json.dumps(r, sort_keys=True) for r in res) + "\n")
    it_ = sum(r["usage"]["input_tokens"] for r in res if r["usage"])
    ot = sum(r["usage"]["output_tokens"] + r["usage"].get("thinking_tokens", 0) for r in res if r["usage"])
    print(f"model {b.PROVIDER}/{b.MODEL}: {len(res)} calls in {time.time()-t0:.1f}s, "
          f"{sum(1 for r in res if r['error'])} errors, {it_:,} in / {ot:,} out tokens")

def as_int(v):
    if isinstance(v, bool) or v is None: return None
    if isinstance(v, (int, float)): return int(round(v))
    m = re.search(r"\d[\d,]*", str(v))
    return int(m.group(0).replace(",", "")) if m else None

def score_one(family, label, p):
    """True/False. Refusal, missing field, or wrong type is False."""
    if not isinstance(p, dict): return False
    if family in ("narrowing", "consideration", "choice_of_law"):
        return str(p.get("answer", "")).strip().lower() == label
    if family == "duration":  return as_int(p.get("months")) == label
    if family == "threshold":
        # +/-1%: tight enough that last year's inflation-indexed figure (usually 2-4% lower) fails
        got = as_int(p.get("dollars")); return got is not None and abs(got - label) <= 0.01 * label
    if family == "notice":    return as_int(p.get("days")) == label["days"]
    if family == "recency":
        if p.get("enacted") is not True: return False
        want = {norm_date(d) for d in label["effective_dates"]} - {None}
        got = {norm_date(d) for d in (p.get("effective_dates") or []) if isinstance(d, str)} - {None}
        return bool(want & got)
    raise ValueError(family)

def selftest():
    cases = [
        ("narrowing", "void", {"answer": "Void"}, True),
        ("narrowing", "void", {"answer": "narrow"}, False),
        ("narrowing", "void", {"error": "reference covers another state"}, False),
        ("duration", 24, {"months": 24}, True),
        ("duration", 24, {"months": None}, False),
        ("threshold", 123394, {"dollars": "$123,394"}, True),
        ("threshold", 123394, {"dollars": 116593}, False),
        ("threshold", 126858.83, {"dollars": 123394}, False),   # prior year's WA figure must fail
        ("threshold", 78364.52, {"dollars": 78364}, True),
        ("notice", {"days": 14, "kind": "calendar"}, {"days": 14}, True),
        ("notice", {"days": 14, "kind": "calendar"}, {"days": 10}, False),
        ("recency", {"effective_dates": ["July 1, 2025"]}, {"enacted": True, "effective_dates": ["2025-07-01"]}, True),
        ("recency", {"effective_dates": ["July 1, 2025"]}, {"enacted": True, "effective_dates": ["July 1, 2024"]}, False),
        ("recency", {"effective_dates": ["July 1, 2025"]}, {"enacted": False, "effective_dates": ["July 1, 2025"]}, False),
        ("recency", {"effective_dates": ["July 1, 2025"]}, "not json", False),
        ("recency", {"effective_dates": ["July 1, 2025"]}, {"enacted": True, "effective_dates": ["2025"]}, False),  # year only
        ("recency", {"effective_dates": ["Sept. 1, 2025"]}, {"enacted": True, "effective_dates": ["September 1, 2025"]}, True),
    ]
    bad = 0
    for fam, lab, p, want in cases:
        got = score_one(fam, lab, p)
        print(f"  {'ok ' if got == want else 'BAD'} {fam:13} want={want!s:5} got={got!s:5} {p}")
        bad += got != want
    print("selftest:", "PASS" if not bad else f"FAIL ({bad})")
    return 1 if bad else 0

def score():
    lab = {t["id"]: t["label"] for t in truth()}
    runs = [r for r in map(json.loads, open(RUNS)) if r["id"] in lab]   # retained items only
    fams = list(Q)
    tab = {}
    for r in runs:
        ok = score_one(r["family"], lab[r["id"]], r["parsed"])
        c = tab.setdefault((r["family"], r["condition"]), [0, 0]); c[0] += ok; c[1] += 1
    # majority-label baseline for enum families: what "always guess the common answer" scores
    base = {}
    for f in ("narrowing", "consideration", "choice_of_law"):
        labs = [t["label"] for t in truth() if t["family"] == f]
        if labs:
            v, n = Counter(labs).most_common(1)[0]; base[f] = f"{n}/{len(labs)} ('{v}')"
    def cell(k):
        n, t = tab.get(k, (0, 0)); return f"{n}/{t} {100*n/t:3.0f}%" if t else "-"
    print(f"runs: {RUNS.name}")
    print(f"{'family':14} {'n':>3} {'cold':>11} {'oa':>11} {'control':>11}   majority baseline")
    tot = {c: [0, 0] for c in ("cold", "oa", "control")}
    for f in fams:
        n = tab.get((f, "cold"), (0, 0))[1]
        if not n: continue
        tag = " (excluded)" if f in EXCLUDED_FAMILIES else ""
        print(f"{f+tag:14} {n:>3} {cell((f,'cold')):>11} {cell((f,'oa')):>11} {cell((f,'control')):>11}   {base.get(f,'')}")
    print("(no overall aggregate: narrowing is excluded as ill-posed, and families differ in kind)")
    refuse = Counter(r["condition"] for r in runs if not isinstance(r["parsed"], dict)
                     or "error" in r["parsed"])
    print("refusals / unparseable:", dict(refuse))
    if "--detail" in sys.argv:
        by = {(r["id"], r["condition"]): r for r in runs}
        for t in truth():
            c = by[(t["id"], "cold")]; o = by[(t["id"], "oa")]
            cs, os_ = score_one(t["family"], t["label"], c["parsed"]), score_one(t["family"], t["label"], o["parsed"])
            if cs != os_ or not os_:
                print(f"  {t['id']:32} truth={json.dumps(t['label'])[:60]:60} cold={'Y' if cs else 'n'} "
                      f"oa={'Y' if os_ else 'n'} | cold={json.dumps(c['parsed'])[:70]} | oa={json.dumps(o['parsed'])[:70]}")

def recency_outcome(label, p):
    """Why a recency answer passed or failed: pass | enacted_false | no_matching_date | refusal."""
    if not isinstance(p, dict) or "enacted" not in p: return "refusal"
    if p.get("enacted") is not True: return "enacted_false"
    return "pass" if score_one("recency", label, p) else "no_matching_date"

def recency_breakdown(runs, lab):
    out = {}
    for r in runs:
        if r["family"] != "recency": continue
        k = recency_outcome(lab[r["id"]], r["parsed"])
        out.setdefault(r["condition"], Counter())[k] += 1
    return {c: dict(v) for c, v in out.items()}

def always_true_comparator(items):
    """A model that always says enacted=true and gives the single most common keyed date."""
    dates = Counter(norm_date(d) for t in items for d in t["label"]["effective_dates"])
    top, _ = dates.most_common(1)[0]
    hits = sum(1 for t in items if top in {norm_date(d) for d in t["label"]["effective_dates"]})
    return {"date": top, "passes": hits, "of": len(items)}

def results():
    """Freeze every publishable number into results.json (the single source for report + thread)."""
    import hashlib
    sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
    T = truth(); lab = {t["id"]: t["label"] for t in T}
    files = {"gemini-3.5-flash-lite": HERE / "runs" / "longtail_runs.jsonl",
             "gemini-3.8-flash": HERE / "runs" / "lt_cold_gemini-3.8-flash.jsonl",
             "gemini-3.1-pro-preview": HERE / "runs" / "lt_cold_gemini-3.1-pro-preview.jsonl"}
    out = {"guide_repo": "open-agreements", "guide_dir": b.GUIDE_DIR, "guide_ref": b.GUIDE_REF,
           "run_date": "2026-09-23", "temperature": 0, "max_output_tokens": 16384, "api": "Gemini generateContent v1beta",
           "threshold_tolerance": "±1% of keyed dollars", "excluded_families": sorted(EXCLUDED_FAMILIES),
           "truth_sha256": sha(HERE / "truth2.jsonl"), "retained_ids": sorted(lab),
           "guide_sha256": {s: hashlib.sha256(b.guide(s).encode()).hexdigest() for s in b.states()},
           "exclusions": {k: v for k, v in json.loads((HERE / "review_drops.json").read_text()).items()},
           "models": {}}
    for model, f in files.items():
        runs = [json.loads(x) for x in open(f)]
        runs = [r for r in runs if r["id"] in lab]
        cells = {}
        for r in runs:
            c = cells.setdefault(r["family"], {}).setdefault(r["condition"], [0, 0])
            c[0] += score_one(r["family"], lab[r["id"]], r["parsed"]); c[1] += 1
        thr = {r["state"]: (r["parsed"] or {}).get("dollars") for r in runs
               if r["family"] == "threshold" and r["condition"] == "cold"}
        out["models"][model] = {"runs_file": str(f.relative_to(HERE)), "runs_sha256": sha(f), "cells": cells,
                                "recency_breakdown": recency_breakdown(runs, lab),
                                "threshold_cold_answers": thr,
                                "threshold_cold_passed": sorted(r["state"] for r in runs if r["family"] == "threshold"
                                    and r["condition"] == "cold" and score_one("threshold", lab[r["id"]], r["parsed"]))}
    out["recency_always_true_comparator"] = always_true_comparator([t for t in T if t["family"] == "recency"])
    out["threshold_key"] = {t["state"]: t["label"] for t in T if t["family"] == "threshold"}
    p = HERE / "results.json"
    p.write_text(json.dumps(out, indent=1, sort_keys=True) + "\n")
    (HERE / "RESULTS.md").write_text(render_results_md(out, sha(p)))
    print(f"wrote {p.name} sha256={sha(p)} and RESULTS.md")

def render_results_md(r, digest):
    """Human-readable view of results.json. Generated, never hand-edited."""
    M = list(r["models"]); fams = ["threshold", "recency", "consideration", "duration", "choice_of_law", "notice"]
    def cell(m, f, c):
        x = r["models"][m]["cells"].get(f, {}).get(c); return f"{x[0]}/{x[1]}" if x else "–"
    L = ["# Results (generated by `python3 longtail.py results`; do not edit)", "",
         f"results.json sha256 `{digest}` · guides at open-agreements `{r['guide_ref']}` · run {r['run_date']} · temperature {r['temperature']} · no web or tools", "",
         "Correct answers per family. `cold` = no context; `oa` = the state's OpenAgreements guide; `control` = the next state's guide.",
         f"Excluded from all aggregates: {', '.join(r['excluded_families'])} (ill-posed). No overall score is reported.", "",
         "| family | " + " | ".join(f"{m} cold" for m in M) + f" | {M[0]} oa | {M[0]} control |",
         "|---|" + "---|" * (len(M) + 2)]
    for f in fams:
        L.append(f"| {f} | " + " | ".join(cell(m, f, "cold") for m in M) + f" | {cell(M[0], f, 'oa')} | {cell(M[0], f, 'control')} |")
    L += ["", "## Recency outcomes (cold unless noted)", "",
          "All recency items are positive: every keyed state enacted a qualifying statute. `enacted_false` = the model said no such statute exists.", "",
          "| model | condition | pass | enacted_false | no_matching_date | refusal |", "|---|---|---|---|---|---|"]
    for m in M:
        for c, v in sorted(r["models"][m]["recency_breakdown"].items()):
            L.append(f"| {m} | {c} | {v.get('pass',0)} | {v.get('enacted_false',0)} | {v.get('no_matching_date',0)} | {v.get('refusal',0)} |")
    a = r["recency_always_true_comparator"]
    L += ["", f"Comparator: always answering enacted=true with {a['date']} passes {a['passes']}/{a['of']}.", "",
          "## 2026 thresholds: keyed value vs cold answers", "",
          "| state | key | " + " | ".join(M) + " |", "|---|---|" + "---|" * len(M)]
    for s, k in sorted(r["threshold_key"].items()):
        L.append(f"| {s} | {k} | " + " | ".join(str(r['models'][m]['threshold_cold_answers'].get(s)) for m in M) + " |")
    L += ["", "## Exclusions", ""] + [f"- `{k}`: {v}" for k, v in sorted(r["exclusions"].items())]
    return "\n".join(L) + "\n"

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "run": run()
    elif cmd == "results": results()
    elif cmd == "score": sys.exit(selftest() if "--selftest" in sys.argv else (score() or 0))
    else: print(__doc__)
