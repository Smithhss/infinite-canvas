import { expect, test } from "bun:test";

import { AGENT_CLAUDE_MCP_COMMAND, AGENT_CLI_COMMAND } from "../src/lib/agent/plugin-commands";
import { AGENT_INTEGRATION_TARGETS, resolveAgentIntegrationMode, resolveAgentIntegrationPhase } from "../src/lib/agent/agent-integration-targets";

test("Agent integration targets keep the LibTV-style matrix without duplicate ids", () => {
    expect(AGENT_INTEGRATION_TARGETS.map((target) => target.id)).toEqual(["codex", "claude-code", "claude", "openclaw", "hermes", "codebuddy"]);
    expect(new Set(AGENT_INTEGRATION_TARGETS.map((target) => target.id)).size).toBe(AGENT_INTEGRATION_TARGETS.length);
});

test("available targets expose a command for every advertised mode", () => {
    for (const target of AGENT_INTEGRATION_TARGETS.filter((item) => item.status === "available")) {
        expect(target.modes.length).toBeGreaterThan(0);
        for (const mode of target.modes) {
            expect(Boolean(target.commands[mode] || target.commandKeys?.[mode])).toBe(true);
        }
    }
});

test("available targets keep their existing executable commands and prompt", () => {
    const codex = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "codex")!;
    const claudeCode = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "claude-code")!;
    expect(codex.commands.cli).toBe(AGENT_CLI_COMMAND);
    expect(codex.commandKeys?.plugin).toBe("agent.connect.installPrompt");
    expect(claudeCode.commands.mcp).toBe(AGENT_CLAUDE_MCP_COMMAND);
});

test("planned targets never expose executable commands or capabilities", () => {
    for (const target of AGENT_INTEGRATION_TARGETS.filter((item) => item.status === "planned")) {
        expect(Object.keys(target.commands)).toHaveLength(0);
        expect(target.commandKeys).toBeUndefined();
        expect(target.capabilities).toEqual([]);
    }
});

test("switching targets falls back to the first supported mode", () => {
    const codex = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "codex")!;
    const claudeCode = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "claude-code")!;
    expect(resolveAgentIntegrationMode(codex, "cli")).toBe("cli");
    expect(resolveAgentIntegrationMode(codex, "mcp")).toBe("plugin");
    expect(resolveAgentIntegrationMode(claudeCode, "plugin")).toBe("mcp");
});

test("target phases never reuse Codex or global connection state for planned targets", () => {
    const codex = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "codex")!;
    const claudeCode = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "claude-code")!;
    const planned = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "openclaw")!;
    expect(resolveAgentIntegrationPhase(codex, "installed")).toBe("installed");
    expect(resolveAgentIntegrationPhase(claudeCode, "installed")).toBe("not-detected");
    expect(resolveAgentIntegrationPhase(claudeCode, "connected")).toBe("connected");
    expect(resolveAgentIntegrationPhase(planned, "connected")).toBe("planned");
});

test("capability groups cover navigation, assets, prompts and generation tools", () => {
    const capabilities = AGENT_INTEGRATION_TARGETS.find((target) => target.id === "codex")!.capabilities;
    expect(capabilities).toEqual(expect.arrayContaining(["site:navigate", "assets:read/write", "prompts:read", "generation:read/write", "workbench:read/write"]));
});
