import { expect, test } from "bun:test";

import enUS from "../src/i18n/locales/en-US";
import zhCN from "../src/i18n/locales/zh-CN";
import { getAgentSetupChecks, resolveAgentSetupPhase } from "../src/lib/agent/agent-setup";
import { getAgentSuggestionKeys, summarizeAgentCanvas } from "../src/lib/agent/agent-suggestions";
import type { CanvasAgentSnapshot } from "../src/lib/canvas/canvas-agent-ops";
import type { AgentConversationState } from "../src/stores/use-agent-store";

const idleConversation: AgentConversationState = { revision: 0, conversationId: "", threadId: "", status: "idle", mcpStatuses: {} };

function setupInput(patch: Partial<Parameters<typeof resolveAgentSetupPhase>[0]> = {}) {
    return {
        connected: false,
        enabled: false,
        connectError: "",
        conversationStatus: idleConversation.status,
        mcpStatuses: idleConversation.mcpStatuses,
        pluginDetected: false,
        tokenPresent: false,
        ...patch,
    };
}

test("setup phase follows the strongest available connection signal", () => {
    expect(resolveAgentSetupPhase(setupInput())).toBe("not-detected");
    expect(resolveAgentSetupPhase(setupInput({ pluginDetected: true }))).toBe("installed");
    expect(resolveAgentSetupPhase(setupInput({ enabled: true }))).toBe("connecting");
    expect(resolveAgentSetupPhase(setupInput({ connected: true }))).toBe("connected");
    expect(resolveAgentSetupPhase(setupInput({ connected: true, mcpStatuses: { canvas: { status: "starting" } } }))).toBe("mcp-starting");
    expect(resolveAgentSetupPhase(setupInput({ connectError: "offline" }))).toBe("failed");
});

test("failed setup highlights plugin, Agent, and token checks", () => {
    const checks = getAgentSetupChecks(setupInput({ connectError: "offline" }));
    expect(checks).toEqual([
        { key: "plugin", state: "attention" },
        { key: "webAgent", state: "attention" },
        { key: "mcp", state: "idle" },
        { key: "token", state: "attention" },
    ]);
});

test("connected setup surfaces MCP failures", () => {
    const checks = getAgentSetupChecks(setupInput({ connected: true, pluginDetected: true, tokenPresent: true, mcpStatuses: { canvas: { status: "failed", error: "boom" } } }));
    expect(checks.find((item) => item.key === "mcp")).toEqual({ key: "mcp", state: "attention" });
});

test("connection errors distinguish Token and MCP failures", () => {
    const tokenChecks = getAgentSetupChecks(setupInput({ pluginDetected: true, tokenPresent: true, connectError: "401 invalid token" }));
    expect(tokenChecks.find((item) => item.key === "token")).toEqual({ key: "token", state: "attention" });

    const mcpChecks = getAgentSetupChecks(setupInput({ pluginDetected: true, tokenPresent: true, connectError: "MCP failed" }));
    expect(mcpChecks.find((item) => item.key === "mcp")).toEqual({ key: "mcp", state: "attention" });
});

test("suggestions follow the current canvas state", () => {
    expect(getAgentSuggestionKeys({ nodeCount: 0, connectionCount: 0, selectedNodeCount: 0 })).toEqual([
        "agent.connect.exampleCreateFlow",
        "agent.connect.exampleCreateGrid",
        "agent.connect.exampleCreateStoryboard",
        "agent.connect.exampleCreateShotPlan",
    ]);
    expect(getAgentSuggestionKeys({ nodeCount: 4, connectionCount: 0, selectedNodeCount: 2 })).toEqual([
        "agent.connect.exampleSelectedPrompts",
        "agent.connect.exampleSelectedFlow",
        "agent.connect.exampleSelectedDescribe",
        "agent.connect.exampleSelectedStoryboard",
    ]);
    expect(getAgentSuggestionKeys({ nodeCount: 4, connectionCount: 3, selectedNodeCount: 0 })).toEqual([
        "agent.connect.exampleReviewFlow",
        "agent.connect.exampleFindGaps",
        "agent.connect.exampleGenerateVariants",
        "agent.connect.exampleReviewDependencies",
    ]);
    expect(getAgentSuggestionKeys({ nodeCount: 4, connectionCount: 0, selectedNodeCount: 0 })).toEqual([
        "agent.connect.exampleOrganize",
        "agent.connect.exampleConnectFlow",
        "agent.connect.exampleRead",
        "agent.connect.exampleOrganizeGroups",
    ]);
});

test("canvas summary only depends on stable counts", () => {
    expect(summarizeAgentCanvas(null)).toEqual({ nodeCount: 0, connectionCount: 0, selectedNodeCount: 0 });
    expect(summarizeAgentCanvas({ nodes: [{ id: "a" }], connections: [{ id: "c" }], selectedNodeIds: ["a"] } as CanvasAgentSnapshot)).toEqual({ nodeCount: 1, connectionCount: 1, selectedNodeCount: 1 });
});

test("Chinese and English onboarding expose the same copy", () => {
    const zhKeys = Object.keys(zhCN.agent.connect).sort();
    const enKeys = Object.keys(enUS.agent.connect).sort();
    expect(enKeys).toEqual(zhKeys);
    for (const key of zhKeys) {
        expect(zhCN.agent.connect[key as keyof typeof zhCN.agent.connect]).not.toBe("");
        expect(enUS.agent.connect[key as keyof typeof enUS.agent.connect]).not.toBe("");
    }
    expect(Object.keys(enUS.agent.workspace).sort()).toEqual(Object.keys(zhCN.agent.workspace).sort());
    expect(Object.keys(enUS.agent.scenePreset).sort()).toEqual(Object.keys(zhCN.agent.scenePreset).sort());
    expect(Object.keys(enUS.agent.runtimeStatus).sort()).toEqual(Object.keys(zhCN.agent.runtimeStatus).sort());
    expect(Object.keys(enUS.agent.provider).sort()).toEqual(Object.keys(zhCN.agent.provider).sort());
});
