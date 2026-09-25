#!/usr/bin/env python3
"""Draw the independent answer-key audit sample (plan step 2).

Frame: every retained truth2.jsonl item outside the excluded families, REGARDLESS of whether
cold and oa agreed, so the audit estimates answer-key accuracy rather than re-checking only
the items the headline rests on. Stratified by family (fixed allocation below), seeded.
Usage: python3 sample_audit.py  -> audit_sample.json
"""
import json, random, pathlib
from longtail import truth, EXCLUDED_FAMILIES

HERE = pathlib.Path(__file__).parent
SEED = 20260925
ALLOC = {"consideration": 8, "recency": 6, "duration": 3, "threshold": 3, "choice_of_law": 3, "notice": 2}

def main():
    frame = [t for t in truth() if t["family"] not in EXCLUDED_FAMILIES]
    rng = random.Random(SEED)
    pick = []
    for fam, k in ALLOC.items():
        pool = sorted((t for t in frame if t["family"] == fam), key=lambda t: t["id"])
        pick += rng.sample(pool, min(k, len(pool)))
    out = {"seed": SEED, "frame_size": len(frame), "allocation": ALLOC,
           "items": [{"id": t["id"], "family": t["family"], "state": t["state"], "oa_label": t["label"]} for t in pick]}
    (HERE / "audit_sample.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"frame {len(frame)}; sampled {len(pick)}: {[t['id'] for t in pick]}")

if __name__ == "__main__":
    main()
