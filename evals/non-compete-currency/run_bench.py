#!/usr/bin/env python3
"""Run the OA non-compete benchmark: 51 jurisdictions x 3 conditions.

Conditions
  cold    : no reference material
  oa      : the state's own Open Agreements practice guide in context
  control : a DIFFERENT state's guide in context, same question (negative control)

The control is the load-bearing check. If `oa` beats `cold` because the model is
reading, `control` should fall back toward `cold`. If `control` also scores high,
the guide is not what is doing the work and the `oa` result means nothing.

Usage: python3 run_bench.py [--limit N] [--out runs.jsonl]
"""
import json, sys, pathlib
from concurrent.futures import ThreadPoolExecutor
import bench_lib as b

HERE = pathlib.Path(__file__).parent

def control_partner(slug, all_states):
    """Deterministic wrong-state pairing: the next state alphabetically."""
    i = all_states.index(slug)
    return all_states[(i + 1) % len(all_states)]

def main():
    out = pathlib.Path(sys.argv[sys.argv.index("--out")+1]) if "--out" in sys.argv else HERE/"runs"/"runs.jsonl"
    sts = b.states()
    if "--limit" in sys.argv:
        sts = sts[:int(sys.argv[sys.argv.index("--limit")+1])]
    jobs = []
    for s in sts:
        jobs.append((s, "cold", None))
        jobs.append((s, "oa", s))
        jobs.append((s, "control", control_partner(s, b.states())))

    def work(job):
        state, cond, ctx = job
        try:
            text, usage = b.call(b.build_messages(state, ctx))
            return {"state": state, "condition": cond, "context_state": ctx,
                    "raw": text, "parsed": b.parse(text), "usage": usage, "error": None}
        except Exception as e:
            return {"state": state, "condition": cond, "context_state": ctx,
                    "raw": None, "parsed": None, "usage": None, "error": f"{type(e).__name__}: {e}"}

    import time
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(work, jobs))
    print(f"wall clock: {time.time()-t0:.1f}s")

    out.write_text("\n".join(json.dumps(r, sort_keys=True) for r in results) + "\n")
    errs = sum(1 for r in results if r["error"])
    it = sum(r["usage"]["input_tokens"] for r in results if r["usage"])
    ot = sum(r["usage"]["output_tokens"] for r in results if r["usage"])
    th = sum(r["usage"].get("thinking_tokens", 0) for r in results if r["usage"])
    # Price is not hardcoded: look up the model's list price and multiply.
    print(f"model: {b.PROVIDER}/{b.MODEL}")
    print(f"wrote {len(results)} runs to {out} ({errs} errors)")
    print(f"tokens: {it:,} in / {ot:,} out / {th:,} thinking")

if __name__ == "__main__":
    main()
