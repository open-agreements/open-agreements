import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { checkPlugin, skillSpecs } from "./sync_claude_marketplace_plugin.mjs";

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

  it("allowlists the quality card of every skill that carries one", () => {
    // The allowlist is opt-in, so an artifact added to a skill source is
    // published to npm (via the broad `skills/` entry) while silently missing
    // from the plugin until someone lists it here.
    for (const spec of skillSpecs) {
      if (!existsSync(join(spec.source, "quality-card.json"))) continue;
      expect(spec.files).toContain("quality-card.json");
    }
  });
});
