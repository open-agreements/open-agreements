"""Shared config + API client for the Open Agreements non-compete benchmark."""
import json, os, pathlib, re, subprocess, urllib.request

# Inside the open-agreements repo this file lives at evals/non-compete-currency/, so the repo
# root is two levels up; OA_REPO overrides (e.g. when run from a scratch copy).
_here_root = pathlib.Path(__file__).resolve().parents[2]
OA_REPO = pathlib.Path(os.environ.get("OA_REPO") or (_here_root if (_here_root / "practice-guides").is_dir()
                                                      else pathlib.Path.home() / "Projects/open-agreements"))
GUIDE_DIR = "practice-guides/non-compete/us"
# Guides are read from a pinned commit, never the live working tree: the corpus is
# updated daily and the 2026-09-23 runs used this commit (#877 on 09-24 rewrote 39 guides).
GUIDE_REF = os.environ.get("BENCH_GUIDE_REF", "30b1281ef738e7df8351ac09bd310ceb19e83610")
HERE = pathlib.Path(__file__).parent
# Provider is chosen by BENCH_PROVIDER (default gemini: cheapest key we hold).
PROVIDER = os.environ.get("BENCH_PROVIDER", "gemini")
MODELS = {"gemini": "gemini-3.5-flash-lite", "anthropic": "claude-haiku-4-5-20251001"}
MODEL = os.environ.get("BENCH_MODEL", MODELS[PROVIDER])
KEY_ENV = {"gemini": "GEMINI_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}

EXCLUDE = {"american-samoa","cnmi","guam","puerto-rico","virgin-islands","index","log","ftc-rule-status"}
VOID_STATES = {"california","colorado","district-of-columbia","minnesota",
               "north-dakota","oklahoma","wyoming"}

_git_cache = {}
def _git(*args):
    if args not in _git_cache:
        _git_cache[args] = subprocess.run(["git", "-C", str(OA_REPO), *args],
                                          capture_output=True, text=True, check=True).stdout
    return _git_cache[args]

def states():
    names = _git("ls-tree", "--name-only", f"{GUIDE_REF}:{GUIDE_DIR}").split()
    return sorted(n[:-3] for n in names if n.endswith(".md") and n[:-3] not in EXCLUDE)

def pretty(slug):
    return "District of Columbia" if slug == "district-of-columbia" else slug.replace("-", " ").title()

def guide(slug):
    return _git("show", f"{GUIDE_REF}:{GUIDE_DIR}/{slug}.md")

_key = None
def api_key():
    """Read the provider key from the environment once; never print it."""
    global _key
    if _key is None:
        _key = os.environ.get(KEY_ENV[PROVIDER])
        if not _key:
            raise SystemExit(f"set {KEY_ENV[PROVIDER]} to run models (scoring needs no key)")
    return _key

QUESTION = """For {state}, answer as of September 2026:

1. Is a post-employment non-compete against an ordinary rank-and-file employee void or unenforceable as a general matter (setting aside sale-of-business and narrow statutory exceptions)?
2. What is the controlling state non-compete statute, if the state has a dedicated one?
3. What is the effective date of that controlling rule, if a specific date applies?

Respond with ONLY a JSON object, no prose:
{{"void_general": true or false, "statute": "<citation, or 'none'>", "effective_date": "<Month D, YYYY, or 'n/a'>"}}"""

def build_messages(target, context_slug):
    q = QUESTION.format(state=pretty(target))
    if context_slug is None:
        return q
    return (f"Reference material:\n\n<practice_guide>\n{guide(context_slug)}\n</practice_guide>\n\n"
            f"Using the reference material above where it applies, {q}")

def call(prompt, max_tokens=2048):
    """Return (text, usage) with usage normalised to input/output/thinking tokens.

    max_tokens is generous because Gemini 3.x thinking tokens count against it;
    a tight cap truncates the JSON and would score as a model error."""
    if PROVIDER == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0,
                                     "responseMimeType": "application/json"}}
        headers = {"content-type": "application/json", "x-goog-api-key": api_key()}
    else:
        url = "https://api.anthropic.com/v1/messages"
        body = {"model": MODEL, "max_tokens": max_tokens, "temperature": 0,
                "messages": [{"role": "user", "content": prompt}]}
        headers = {"content-type": "application/json", "anthropic-version": "2023-06-01",
                   "x-api-key": api_key()}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    if PROVIDER == "gemini":
        u = d.get("usageMetadata", {})
        parts = d["candidates"][0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        return text, {"input_tokens": u.get("promptTokenCount", 0),
                      "output_tokens": u.get("candidatesTokenCount", 0),
                      "thinking_tokens": u.get("thoughtsTokenCount", 0),
                      "finish_reason": d["candidates"][0].get("finishReason")}
    return d["content"][0]["text"], {"input_tokens": d["usage"]["input_tokens"],
                                     "output_tokens": d["usage"]["output_tokens"],
                                     "thinking_tokens": 0, "finish_reason": d.get("stop_reason")}

def parse(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m: return None
    try: return json.loads(m.group(0))
    except Exception: return None
