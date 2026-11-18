"""Exploratory multi-memo fill challenge, scored on changed fields."""

import concurrent.futures
import json
from pathlib import Path

from benchmark import API, HERE, MODELS, bridge, docx_parts, dump

CASES = {
    "common-paper-order-form": (
        (
            "Approved commercial revision: the pilot is extended by 15 days from the original duration. "
            "The per-user fee is 15% below the original, with no cents displayed if the result is whole. "
            "The seat ceiling is reduced by one fifth. Keep the original capacity wording. "
            "Fixed renewal escalation replaces the discretionary cap: use a fixed 3% and clear the cap."
        ),
        {
            "pilot_period": "45 days",
            "fees": "$34",
            "use_limitations": "Up to 40 active users",
            "fee_may_increase": False,
            "fee_will_increase": True,
            "fee_increase_max_percent": "",
            "fee_increase_percent": "3",
        },
    ),
    "common-paper-statement-of-work": (
        (
            "Approved change order: add 24 hours of testing at $137.50 per hour, then credit $725 against "
            "the combined fixed fee. Keep the fee wording, including 'fixed fee'. Extend the end date by "
            "17 calendar days. Increase the rejection window by half and halve the resubmission window, "
            "rounding upward to the next whole day."
        ),
        {
            "fee_description": "$20,575 fixed fee",
            "custom_end_date": "March 17, 2027",
            "rejection_period_value": "15",
            "resubmission_period_value": "3",
        },
    ),
    "openagreements-board-consent-safe": (
        (
            "The board approved these adjustments: remove $125,000 of the initial capacity and add three "
            "new subscriptions of $84,500 each. A proposed $50,000 add-on was rejected. Move the effective "
            "date 13 calendar days later. The first director signs two days before effectiveness and "
            "the second one day before it."
        ),
        {
            "purchase_amount": "878,500",
            "effective_date": "December 3, 2026",
            "board_members": [
                {"name": "Mira Patel", "signing_date": "December 1, 2026"},
                {"name": "Leah Torres", "signing_date": "December 2, 2026"},
            ],
        },
    ),
    "openagreements-employment-offer-letter": (
        (
            "Approved HR revision: start 21 calendar days after the original start date. The offer "
            "expires ten calendar days before the new start date. Increase the original salary by "
            "7.5%, then round it to the nearest $500, keeping the original payment cadence and wording. "
            "Increase the option share count by one sixth, keeping its other terms and wording. "
            "A hiring manager suggested moving the job to California, but HR rejected that change."
        ),
        {
            "start_date": "December 28, 2026",
            "offer_expiration_date": "December 18, 2026",
            "base_salary": "$156,000 per year, paid semi-monthly",
            "equity_terms": "Subject to board approval, an option to purchase 14,000 shares, vesting over four years with a one-year cliff.",
        },
    ),
}


def run(out, model, template):
    amendment, changes = CASES[template]
    fixture = json.loads((HERE / "fixtures" / (template + ".json")).read_text())
    expected = fixture["expected"] | changes
    dest = out / model / template
    dest.mkdir(parents=True, exist_ok=False)
    metadata = bridge("get_template", template_id=template)["template"]
    bridge(
        "fill_template",
        template=template,
        values=expected,
        output_path=str(dest / "gold.docx"),
    )
    prompt = (
        "Fill every metadata field as a JSON object. The initial memo is followed by an approved "
        "revision. Apply only approved changes, calculate derived values, and carry forward unchanged "
        "terms. Use the original formatting for values and empty strings for inactive alternatives. "
        "Use Month D, YYYY for dates.\nMetadata: "
        + json.dumps(metadata)
        + "\nInitial memo: "
        + fixture["deal"]
        + "\nRevision: "
        + amendment
    )
    api = API(dest, 2)
    response = api.call(
        model,
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json",
            },
        },
        "reconcile",
    )
    candidate = response["candidates"][0]
    try:
        actual = json.loads(
            "".join(
                part.get("text", "")
                for part in candidate["content"]["parts"]
                if not part.get("thought")
            )
        )
    except (ValueError, KeyError):
        actual = {}
    changed_correct = sum(
        key in actual and type(actual[key]) is type(value) and actual[key] == value
        for key, value in changes.items()
    )
    exact_doc = False
    if actual:
        bridge(
            "fill_template",
            template=template,
            values=actual,
            output_path=str(dest / "actual.docx"),
        )
        exact_doc = docx_parts(dest / "actual.docx") == docx_parts(dest / "gold.docx")
    return {
        "model": model,
        "template": template,
        "changed_correct": changed_correct,
        "changed_total": len(changes),
        "expected": expected,
        "actual": actual,
        "exact_document": exact_doc,
        "usage": response["usageMetadata"],
        "cost_usd": api.spent,
    }


if __name__ == "__main__":
    import sys

    out = Path(sys.argv[1]).resolve()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        jobs = [
            pool.submit(run, out, model, template)
            for model in MODELS
            for template in CASES
        ]
        dump(out / "results.json", [job.result() for job in jobs])
