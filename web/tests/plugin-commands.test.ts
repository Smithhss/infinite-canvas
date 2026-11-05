import { expect, test } from "bun:test";

import { AGENT_CLAUDE_MCP_COMMAND, AGENT_CLI_COMMAND, AGENT_PLUGIN_INSTALL_COMMAND } from "../src/lib/agent/plugin-commands";

test("Codex plugin installation keeps the local marketplace flow", () => {
    expect(AGENT_PLUGIN_INSTALL_COMMAND).toContain("codex plugin marketplace add ~/plugins/infinite-canvas");
    expect(AGENT_PLUGIN_INSTALL_COMMAND).toContain("codex plugin add infinite-canvas@infinite-canvas-local");
});

test("Claude Code uses a user-scope MCP registration", () => {
    expect(AGENT_CLAUDE_MCP_COMMAND).toContain("claude mcp add --scope user");
    expect(AGENT_CLAUDE_MCP_COMMAND).toContain("infinite-canvas");
    expect(AGENT_CLAUDE_MCP_COMMAND).toContain("@smithhsiiiii/canvas-agent@latest mcp");
});

test("CLI remains the standalone local Agent entry", () => {
    expect(AGENT_CLI_COMMAND).toBe("npx -y @smithhsiiiii/canvas-agent@latest");
});
