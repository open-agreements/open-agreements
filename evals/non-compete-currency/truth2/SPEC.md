# Ground-truth labelling spec (shared by all family agents)

Source: ONLY the Markdown guides in practice-guides/non-compete/us/ (at commit 30b1281e)
Jurisdictions: the 50 states + district-of-columbia. Ignore american-samoa, cnmi, guam,
puerto-rico, virgin-islands, index.md, log.md, ftc-rule-status.md.

Hard rules
- Do NOT use the web, WebSearch, WebFetch, a browser, or your own legal knowledge to set a label.
  The label must be what the guide says. If the guide does not say it clearly, the item is AMBIGUOUS.
- "quote" must be copied VERBATIM from the guide file, character for character (markdown and
  footnote markers like [^x] included), one contiguous span of 40-400 characters, no ellipses.
  A script will reject any quote that is not an exact substring of the guide (after collapsing
  runs of whitespace to one space). Do not paraphrase inside the quote.
- The quote must by itself support the label. For numeric/date labels, the exact number or
  date string you put in "label" must appear inside the quote.
- Absence is not evidence: if a guide has no section on the question, OMIT the state entirely.
  Never label "none"/"no" because a guide is silent.
- Prefer marking AMBIGUOUS over forcing a label. Exceptions-riddled, split-authority, or
  "depends" answers are AMBIGUOUS unless the question's label set captures them.

Output: a JSON array written to the path given in your task, each element:
  {"family": "...", "state": "<file slug>", "label": <per family>, "quote": "...",
   "anchor": "<the {#anchor} section it came from, or null>", "note": "<one line, optional>"}
AMBIGUOUS items: label = "AMBIGUOUS" and note says why.

Finish by writing the file; reply with ONE line: the path and counts (labelled / ambiguous).
Do not summarize findings in your reply.
