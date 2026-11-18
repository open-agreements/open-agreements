#!/usr/bin/env python3
"""Recompute accuracy and costs from recorded data without any model calls."""

import argparse, json, pathlib
from benchmark import HERE, MODELS, cost, docx_parts, sha

p = argparse.ArgumentParser()
p.add_argument("evidence", type=pathlib.Path)
a = p.parse_args()
root = a.evidence
manifest = json.loads((root / "fixtures-manifest.json").read_text())
fixtures = {}
for item in manifest:
    path = HERE / "fixtures" / (item["template"] + ".json")
    assert sha(path.read_bytes()) == item["fixture_sha256"]
    fixtures[item["template"]] = json.loads(path.read_text())
for model in MODELS:
    correct = fields = exact = 0
    for template, f in fixtures.items():
        gold = docx_parts(root / "gold" / template / "gold.docx")
        assert gold == json.loads(
            (root / "gold" / template / "stories.json").read_text()
        )
        for rep in range(1, 4):
            dest = root / "fill" / model / template / str(rep)
            output = json.loads((dest / "output.json").read_text())
            values = json.loads(output["text"])
            expected = f["expected"]
            wrong = {
                k
                for k, v in expected.items()
                if k not in values or type(values[k]) is not type(v) or values[k] != v
            }
            score = json.loads((dest / "score.json").read_text())
            assert score["correct"] == len(expected) - len(wrong)
            rendered = docx_parts(dest / "generated.docx")
            assert rendered == json.loads((dest / "stories.json").read_text())
            assert (rendered == gold) == score["rendered_document_exact"]
            correct += len(expected) - len(wrong)
            fields += len(expected)
            exact += int(rendered == gold and output["finishReason"] == "STOP")
    cc = [json.loads(l) for l in (root / "calls.jsonl").read_text().splitlines()]
    cc = [c for c in cc if c["model"] == model and c["cell"].split("/")[2] in fixtures]
    assert len(cc) == 21
    for c in cc:
        assert abs(cost(model, c["usage"]) - c["cost_usd"]) < 1e-10
        raw = json.loads((root / c["response_file"]).read_text())
        assert raw["usageMetadata"] == c["usage"]
    print(
        f"{model}: {correct}/{fields} fields, {exact}/21 documents, ${sum(c['cost_usd'] for c in cc) / 21:.8f} per document"
    )
