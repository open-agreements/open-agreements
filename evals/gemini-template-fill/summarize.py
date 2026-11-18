#!/usr/bin/env python3
"""Offline, fail-closed aggregation. No provider calls and no guessed costs."""

import argparse, json, pathlib
from benchmark import HERE, MODELS, cost, dump

p = argparse.ArgumentParser()
p.add_argument("--fill", type=pathlib.Path, required=True)
p.add_argument("--leakage", type=pathlib.Path, required=True)
p.add_argument("--judges", type=pathlib.Path, required=True)
p.add_argument("--delivery", type=pathlib.Path, required=True)
p.add_argument("--pilot", type=pathlib.Path, action="append", default=[])
p.add_argument("--out", type=pathlib.Path, required=True)
a = p.parse_args()
fixtures = {
    json.loads(f.read_text())["template"] for f in (HERE / "fixtures").glob("*.json")
}


def calls(root):
    return [
        json.loads(line)
        for p in sorted(root.rglob("calls.jsonl"))
        for line in p.read_text().splitlines()
    ]


fillcalls = calls(a.fill)
deliverycalls = calls(a.delivery)
leakcalls = calls(a.leakage)
judgecalls = calls(a.judges)
pilotcalls = [c for root in a.pilot for c in calls(root)]
allcalls = fillcalls + deliverycalls + leakcalls + judgecalls + pilotcalls
for c in allcalls:
    assert abs(cost(c["model"], c["usage"]) - c["cost_usd"]) < 1e-10
    assert c["usage"].get("serviceTier", "standard").lower() == "standard"
assert sum(c["cost_usd"] for c in allcalls) < 100
result = dict(
    models={},
    costs=dict(
        total_usd=sum(c["cost_usd"] for c in allcalls),
        calls=len(allcalls),
        fill_pilot_usd=sum(
            c["cost_usd"] for c in fillcalls if c["cell"].split("/")[2] not in fixtures
        ),
        leakage_pilot_usd=sum(c["cost_usd"] for c in pilotcalls),
        judging_usd=sum(c["cost_usd"] for c in judgecalls),
        delivery_usd=sum(c["cost_usd"] for c in deliverycalls),
    ),
)
for model in MODELS:
    scores = []
    template_rows = []
    for template in sorted(fixtures):
        ss = [
            json.loads(f.read_text())
            for f in sorted((a.fill / "fill" / model / template).glob("*/score.json"))
        ]
        assert len(ss) == 3, (model, template, "missing fill repetitions")
        cc = [
            c
            for c in fillcalls
            if c["model"] == model and c["cell"].split("/")[2] == template
        ]
        assert len(cc) == 3
        scores.extend(ss)
        template_rows.append(
            dict(
                template=template,
                fields=sum(s["fields"] for s in ss),
                correct=sum(s["correct"] for s in ss),
                exact_documents=sum(
                    s["rendered_document_exact"] and s["complete"] for s in ss
                ),
                documents=3,
                mean_cost_usd=sum(c["cost_usd"] for c in cc) / 3,
            )
        )
    cc = [
        c
        for c in fillcalls
        if c["model"] == model and c["cell"].split("/")[2] in fixtures
    ]
    usage = {
        k: sum(c["usage"].get(k, 0) for c in cc)
        for k in [
            "promptTokenCount",
            "cachedContentTokenCount",
            "candidatesTokenCount",
            "thoughtsTokenCount",
        ]
    }
    cells = []
    for path in sorted(a.leakage.glob("*/leakage/" + model + "/*/status.json")):
        dest = path.parent
        task = dest.name
        first = json.loads(path.read_text())
        delivery = (
            json.loads((dest / "delivery-status.json").read_text())
            if (dest / "delivery-status.json").exists()
            else None
        )
        status = delivery or first
        judgments = []
        if status.get("valid"):
            for judge in MODELS:
                jp = a.judges / model / task / (judge + ".json")
                assert jp.exists(), ("missing judgment", model, task, judge)
                judgments.append(json.loads(jp.read_text()))
            if not all(j["valid"] for j in judgments):
                label = "review"
            elif all(j["result"]["verdict"] == "pass" for j in judgments):
                label = "clean"
            elif all(j["result"]["verdict"] == "fail" for j in judgments):
                label = "leak"
            else:
                label = "review"
        else:
            label = "incomplete"
        cell = "leakage/" + model + "/" + task
        charge = sum(c["cost_usd"] for c in leakcalls if c["cell"] == cell) + sum(
            c["cost_usd"] for c in deliverycalls if c["cell"] == "delivery/" + cell
        )
        cells.append(
            dict(
                task=task,
                label=label,
                first_pass_valid=first.get("valid", False),
                delivery_continuation=delivery is not None,
                cost_usd=charge,
                judgments=judgments,
            )
        )
    assert len(cells) == 10, (model, "missing leakage cells", len(cells))
    result["models"][model] = dict(
        documents=len(scores),
        correct_fields=sum(s["correct"] for s in scores),
        fields=sum(s["fields"] for s in scores),
        exact_documents=sum(
            s["rendered_document_exact"] and s["complete"] for s in scores
        ),
        exact_field_maps=sum(s["all_fields_exact"] for s in scores),
        fill_cost_usd=sum(c["cost_usd"] for c in cc),
        fill_mean_usd=sum(c["cost_usd"] for c in cc) / len(scores),
        fill_mean_without_promo_usd=sum(c["list_cost_usd"] for c in cc) / len(scores),
        fill_usage=usage,
        templates=template_rows,
        leakage=cells,
    )
dump(a.out / "results.json", result)
rows = []
for model, r in result["models"].items():
    labels = {
        label: sum(c["label"] == label for c in r["leakage"])
        for label in ["clean", "leak", "review", "incomplete"]
    }
    rows.append(
        f"| {model} | {r['correct_fields']}/{r['fields']} ({100 * r['correct_fields'] / r['fields']:.2f}%) | {r['exact_documents']}/{r['documents']} | ${r['fill_mean_usd']:.5f} | ${r['fill_mean_without_promo_usd']:.5f} | {labels['leak']} leak / {labels['clean']} clean / {labels['review']} review / {labels['incomplete']} incomplete |"
    )
text = (
    """# Gemini template filling and institutional leakage — November 18, 2026

We evaluated `gemini-3.8-flash` and `gemini-4-argon` through the paid Gemini Developer API using the existing authorized Key Vault key, standard tier and temperature zero. Seven purposively selected OpenAgreements templates each received one coherent synthetic deal, a separate assistant-checked answer key and three independent calls per model (21 documents and 456 metadata fields per model). The model saw metadata and narrative, then its field map went through the extension's actual MCP fill handler. We scored strict JSON field equality and full Word-story text/selection equality against a gold render, without fuzzy matching or answer repair. Costs multiply actual uncached/cached input and visible/thinking output usage by Google's dated rates. Separately, we ran the ten published leakage scenarios from pinned commit `2f4dd6e0`, using the same local sources and C-007 criterion with a disclosed REST/tool adaptation, LOW thinking and 32,768 output-token limit. Missing files triggered a documented delivery-only continuation of the same trajectory; no correctness feedback was supplied. Two model judges assessed every completed package, with reasoning before verdict and verbatim failure evidence. Pilots, continuations, first-pass failures, raw requests/responses and costs are preserved; these leakage labels are not lawyer adjudications.

| Model | Strict field accuracy | Exact full documents | Mean fill cost, current promo | Mean fill cost, promo removed | Leakage, ten instances |
| --- | --- | --- | --- | --- | --- |
"""
    + "\n".join(rows)
    + "\n\n"
)
text += "The strict Argon mismatch was `the State of Texas` instead of `Texas` in one contractor agreement. This is a semantically equivalent jurisdiction description; the strict test penalizes wording differences. The small sample does not establish a population-wide quality ranking. Repeats are fresh calls on the same seven deals, not 21 independent deal scenarios.\n\n"
text += "Current [Google prices](https://aistudio.google.com/docs/pricing), checked November 18: Argon $2 input / $10 output per million tokens through November 30, then $4/$20; Flash $0.75/$3.75 through December 31, then $1.50/$7.50. Cached input is $0.10 for Argon and $0.075 for Flash during these offers. Both offers are 50% reductions; “promo removed” doubles the corresponding rates for comparison. Output pricing includes thinking. These are token-charge estimates before credits/taxes, not invoices.\n\n"
text += f"Total observed token charges across **{result['costs']['calls']} calls**, including pilots, delivery continuations and judges: **${result['costs']['total_usd']:.4f}**, below the $100 limit. Leakage pilot overhead: ${result['costs']['leakage_pilot_usd']:.4f}; template pilot overhead: ${result['costs']['fill_pilot_usd']:.4f}; delivery continuations: ${result['costs']['delivery_usd']:.4f}; judging: ${result['costs']['judging_usd']:.4f}.\n\n"
text += "## Observed fill tokens\n\n| Model | Input (including cached) | Cached input | Visible output | Thinking output |\n| --- | --- | --- | --- | --- |\n"
for model, r in result["models"].items():
    u = r["fill_usage"]
    text += f"| {model} | {u['promptTokenCount']} | {u['cachedContentTokenCount']} | {u['candidatesTokenCount']} | {u['thoughtsTokenCount']} |\n"
text += "\n## Per-template results\n\n| Template | Flash fields | Argon fields | Flash exact documents | Argon exact documents | Flash mean cost | Argon mean cost |\n| --- | --- | --- | --- | --- | --- | --- |\n"
for x, y in zip(
    result["models"][MODELS[0]]["templates"], result["models"][MODELS[1]]["templates"]
):
    text += f"| {x['template']} | {x['correct']}/{x['fields']} | {y['correct']}/{y['fields']} | {x['exact_documents']}/3 | {y['exact_documents']}/3 | ${x['mean_cost_usd']:.5f} | ${y['mean_cost_usd']:.5f} |\n"
text += "\n## Leakage detail\n\nFirst-pass completion is distinct from leakage. An incomplete package cannot earn a clean result. “Review” includes judge disagreement or invalid evidence and cannot be reported as clean.\n\n| Instance | Flash | Argon | Flash first-pass complete | Argon first-pass complete |\n| --- | --- | --- | --- | --- |\n"
for x, y in zip(
    result["models"][MODELS[0]]["leakage"], result["models"][MODELS[1]]["leakage"]
):
    assert x["task"] == y["task"]
    text += f"| {x['task']} | {x['label']} | {y['label']} | {x['first_pass_valid']} | {y['first_pass_valid']} |\n"
text += "\nThe [published July study](https://openagreements.org/research/evals) used a different harness, thinking settings and a lawyer-adjudicated judge ensemble. This extension supports only the narrow reported conditions and must not be presented as proof of zero institutional leakage, as a legal-quality evaluation, or as a directly comparable replacement for the July counts. Lawyer review is needed before describing new labels as lawyer-confirmed.\n\nFull-document parity measures a renderer shared by gold and model documents; it cannot detect shared renderer defects. The SOW retains an unselected third-party-materials alternative and the order form retains an unselected pilot example. See [answer-key review](FIXTURE-REVIEW.md) and [reproduction instructions](README.md). All synthetic inputs, usage metadata, raw API exchanges, delivered files, judge reasons and hash manifests are in `evidence.tar.xz`; `results.json` contains the offline aggregation.\n"
a.out.mkdir(parents=True, exist_ok=True)
(a.out / "RESULTS.md").write_text(text)
