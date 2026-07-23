import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { checkPlugin } from "./sync_claude_marketplace_plugin.mjs";

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Claude marketplace plugin allowlist", () => {
  it("rejects an unexpected root .mcp.json", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "open-agreements-plugin-"));
    temporaryDirectories.push(fixtureRoot);
    cpSync("plugins/open-agreements", fixtureRoot, { recursive: true });
    writeFileSync(join(fixtureRoot, ".mcp.json"), "{}\n");

    expect(() => checkPlugin(fixtureRoot)).toThrow(/forbidden MCP configuration \.mcp\.json/);
  });
});
