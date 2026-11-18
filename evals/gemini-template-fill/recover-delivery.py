#!/usr/bin/env python3
"""Continue the same trajectory after an objective missing-file check.
No content/correctness feedback or alternate answer selection. Preserve first pass.
"""

import argparse, json, pathlib, re
from benchmark import API, dump

p = argparse.ArgumentParser()
p.add_argument("--runs", type=pathlib.Path, required=True)
p.add_argument("--out", type=pathlib.Path, required=True)
p.add_argument("--budget", type=float, default=10)
p.add_argument("--cell-regex")
a = p.parse_args()
a.runs = a.runs.resolve()
api = API(a.out.resolve(), a.budget)
for status_path in sorted(a.runs.glob("*/leakage/*/*/status.json")):
    first = json.loads(status_path.read_text())
    dest = status_path.parent
    agent = dest.parent.name
    task = dest.name
    if a.cell_regex and not re.search(a.cell_regex, agent + "/" + task):
        continue
    if first.get("valid") or (dest / "delivery-status.json").exists():
        continue
    shard = status_path.parents[3]
    config = json.loads((shard / "leakage-inputs" / task / "task.json").read_text())
    expected = set(config["deliverables"])
    cell = f"leakage/{agent}/{task}"
    ledger = [json.loads(l) for l in (shard / "calls.jsonl").read_text().splitlines()]
    last = [e for e in ledger if e["cell"] == cell][-1]
    response_path = shard / last["response_file"]
    response = json.loads(response_path.read_text())
    request = json.loads(
        response_path.with_name(
            response_path.name.replace(".response.", ".request.")
        ).read_text()
    )
    request["contents"].append(response["candidates"][0]["content"])
    missing = sorted(f for f in expected if not (dest / f).exists())
    request["contents"].append(
        dict(
            role="user",
            parts=[
                dict(
                    text="Filesystem verification found these requested files missing: "
                    + ", ".join("output/" + f for f in missing)
                    + ". Save the missing Markdown deliverables with the write tool. No document content has been evaluated or corrected. Complete delivery of the original task."
                )
            ],
        )
    )
    request["generationConfig"] = dict(
        temperature=0, maxOutputTokens=32768, thinkingConfig=dict(thinkingLevel="LOW")
    )
    request["toolConfig"] = dict(
        functionCallingConfig=dict(mode="ANY", allowedFunctionNames=["write"])
    )
    error = None
    turns = 0
    for turn in range(8):
        turns = turn + 1
        try:
            r = api.call(agent, request, "delivery/" + cell)
        except Exception as e:
            error = str(e)
            break
        candidate = r.get("candidates", [{}])[0]
        content = candidate.get("content", {})
        calls = [
            p["functionCall"] for p in content.get("parts", []) if "functionCall" in p
        ]
        request["contents"].append(content)
        if not calls:
            error = "No write call returned"
            break
        results = []
        for call in calls:
            args = call.get("args", {})
            name = pathlib.PurePosixPath(args.get("path", "")).name
            if (
                call["name"] == "write"
                and name in expected
                and isinstance(args.get("content"), str)
                and not (dest / name).exists()
            ):
                (dest / name).write_text(args["content"])
                result = "Written output/" + name
            else:
                result = (
                    "ERROR: use write with a requested filename and Markdown content"
                )
            fr = dict(name=call["name"], response=dict(result=result))
            if call.get("id"):
                fr["id"] = call["id"]
            results.append(dict(functionResponse=fr))
        request["contents"].append(dict(role="user", parts=results))
        missing = sorted(f for f in expected if not (dest / f).exists())
        if not missing:
            break
    missing = sorted(f for f in expected if not (dest / f).exists())
    dump(
        dest / "delivery-status.json",
        dict(
            valid=not missing and not error,
            missing=missing,
            error=error,
            continuation_turns=turns,
            first_pass=first,
            delivery_protocol="Same trajectory, objective missing-file feedback, write-only tool choice; no content feedback",
        ),
    )
