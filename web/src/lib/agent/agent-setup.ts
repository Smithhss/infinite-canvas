import type { AgentConversationState } from "@/stores/use-agent-store";

export const AGENT_PLUGIN_DETECTED_STORAGE_KEY = "canvas-agent-plugin-detected";

export type AgentSetupPhase = "not-detected" | "installed" | "connecting" | "mcp-starting" | "connected" | "failed";
export type AgentSetupCheckKey = "plugin" | "webAgent" | "mcp" | "token";
export type AgentSetupCheckState = "ready" | "waiting" | "attention" | "idle";

type AgentSetupInput = {
    connected: boolean;
    enabled: boolean;
    connectError: string;
    conversationStatus: AgentConversationState["status"];
    mcpStatuses: AgentConversationState["mcpStatuses"];
    pluginDetected: boolean;
    tokenPresent: boolean;
};

export function readAgentPluginDetected() {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AGENT_PLUGIN_DETECTED_STORAGE_KEY) === "1";
}

export function rememberAgentPluginDetected() {
    if (typeof window !== "undefined") window.localStorage.setItem(AGENT_PLUGIN_DETECTED_STORAGE_KEY, "1");
}

export function resolveAgentSetupPhase({ connected, enabled, connectError, conversationStatus, mcpStatuses, pluginDetected }: AgentSetupInput): AgentSetupPhase {
    const mcpStarting = Object.values(mcpStatuses).some((item) => item.status === "starting");
    if (connected) return conversationStatus === "preparing" || mcpStarting ? "mcp-starting" : "connected";
    if (connectError) return "failed";
    if (conversationStatus === "preparing" || mcpStarting) return "mcp-starting";
    if (enabled) return "connecting";
    if (pluginDetected) return "installed";
    return "not-detected";
}

export function getAgentSetupChecks(input: AgentSetupInput): Array<{ key: AgentSetupCheckKey; state: AgentSetupCheckState }> {
    const mcpItems = Object.values(input.mcpStatuses);
    const mcpFailed = mcpItems.some((item) => item.status === "failed" || item.status === "cancelled");
    const mcpStarting = mcpItems.some((item) => item.status === "starting");
    const error = input.connectError.toLowerCase();
    const tokenError = /token|令牌|鉴权|401|403/.test(error);
    const mcpError = /mcp/.test(error);

    return [
        {
            key: "plugin",
            state: input.pluginDetected || input.connected ? "ready" : input.connectError ? "attention" : "idle",
        },
        {
            key: "webAgent",
            state: input.connected ? "ready" : input.connectError ? "attention" : input.enabled ? "waiting" : "idle",
        },
        {
            key: "mcp",
            state: !input.connected
                ? mcpError
                    ? "attention"
                    : "idle"
                : mcpFailed
                  ? "attention"
                  : mcpStarting || input.conversationStatus === "preparing"
                    ? "waiting"
                    : input.conversationStatus === "ready" || input.conversationStatus === "warning" || input.conversationStatus === "running"
                      ? "ready"
                      : "waiting",
        },
        {
            key: "token",
            state: !input.tokenPresent || tokenError ? "attention" : input.connected || input.enabled || input.tokenPresent ? "ready" : "idle",
        },
    ];
}
