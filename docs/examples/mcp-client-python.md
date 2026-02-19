# MCP Client Example (Python + httpx)

Minimal streamable HTTP flow for OpenAgreements hosted MCP.

## Requirements
- Python 3.10+
- `pip install httpx`

## Example

```python
import json
import httpx

MCP_URL = "https://openagreements.ai/api/mcp"


def parse_tool_envelope(result: dict) -> dict:
    """OpenAgreements tool results return one JSON envelope as text."""
    text_block = result["content"][0]["text"]
    envelope = json.loads(text_block)
    if not envelope["ok"]:
        err = envelope["error"]
        raise RuntimeError(f"{err['code']}: {err['message']}")
    return envelope


def rpc(client: httpx.Client, id_: int, method: str, params: dict | None = None) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "id": id_,
        "method": method,
        "params": params or {},
    }
    r = client.post(MCP_URL, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


with httpx.Client() as client:
    init = rpc(client, 1, "initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "python-example", "version": "1.0.0"},
    })
    print("Initialized:", init["result"]["serverInfo"])

    list_resp = rpc(client, 2, "tools/call", {
        "name": "list_templates",
        "arguments": {"mode": "compact"},
    })
    list_env = parse_tool_envelope(list_resp["result"])
    templates = list_env["data"]["templates"]
    template_id = templates[0]["template_id"]
    print("First template:", template_id)

    get_resp = rpc(client, 3, "tools/call", {
        "name": "get_template",
        "arguments": {"template_id": template_id},
    })
    get_env = parse_tool_envelope(get_resp["result"])
    print("Template fields:", len(get_env["data"]["template"]["fields"]))

    fill_resp = rpc(client, 4, "tools/call", {
        "name": "fill_template",
        "arguments": {
            "template": template_id,
            "values": {"company_name": "Acme Corp"},
            "return_mode": "url",
        },
    })
    fill_env = parse_tool_envelope(fill_resp["result"])
    print("Download URL:", fill_env["data"]["download_url"])
```

## Notes
- `return_mode` supports `url` (default), `base64_docx`, and `mcp_resource`.
- Error envelopes are machine-readable with stable `error.code` values.
