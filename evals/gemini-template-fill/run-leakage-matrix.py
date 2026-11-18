#!/usr/bin/env python3
"""Run the fixed ten-instance matrix as independently budgeted subprocesses."""

import argparse, concurrent.futures, pathlib, subprocess, sys

p = argparse.ArgumentParser()
p.add_argument("--out", type=pathlib.Path, required=True)
p.add_argument("--source-repo", type=pathlib.Path, required=True)
p.add_argument("--input-cache", type=pathlib.Path)
p.add_argument("--workers", type=int, default=4)
p.add_argument("--budget-per-instance", type=float, default=3)
a = p.parse_args()
a.out = a.out.resolve()
a.out.mkdir(parents=True, exist_ok=True)
script = pathlib.Path(__file__).with_name("benchmark.py")


def run(i):
    out = a.out / f"{i:02d}"
    out.mkdir(exist_ok=True)
    if a.input_cache and not (out / "leakage-inputs").exists():
        (out / "leakage-inputs").symlink_to(
            a.input_cache.resolve(), target_is_directory=True
        )
    pattern = (
        "^three-state-offer-restrictive-covenant-package$"
        if i == 0
        else f"^leakage-variant-{i:02d}-"
    )
    with (out / "console.log").open("a") as log:
        r = subprocess.run(
            [
                sys.executable,
                str(script),
                "leakage",
                "--out",
                str(out),
                "--budget",
                str(a.budget_per_instance),
                "--source-repo",
                str(a.source_repo.resolve()),
                "--task-regex",
                pattern,
            ],
            stdout=log,
            stderr=subprocess.STDOUT,
        )
    print(f"instance {i}: exit {r.returncode}", flush=True)
    return r.returncode


with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as ex:
    codes = list(ex.map(run, range(10)))
raise SystemExit(max(codes))
