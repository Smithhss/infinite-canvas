import { AGENT_CLAUDE_MCP_COMMAND, AGENT_CLI_COMMAND } from "@/lib/agent/plugin-commands";
import type { AgentSetupPhase } from "@/lib/agent/agent-setup";

export type AgentIntegrationMode = "plugin" | "cli" | "mcp";
export type AgentIntegrationStatus = "available" | "planned";

export type AgentIntegrationTarget = {
    id: string;
    label: string;
    descriptionKey: string;
    status: AgentIntegrationStatus;
    modes: AgentIntegrationMode[];
    commands: Partial<Record<AgentIntegrationMode, string>>;
    commandKeys?: Partial<Record<AgentIntegrationMode, string>>;
    source?: string;
    capabilities: string[];
};

const LOCAL_CANVAS_CAPABILITIES = ["site:navigate", "project:read", "canvas:read/write", "assets:read/write", "prompts:read", "generation:read/write", "workbench:read/write"];

export type AgentIntegrationPhase = AgentSetupPhase | "planned";

export const AGENT_INTEGRATION_TARGETS: AgentIntegrationTarget[] = [
    {
        id: "codex",
        label: "Codex",
        descriptionKey: "pluginHub.codexDescription",
        status: "available",
        modes: ["plugin", "cli"],
        commands: {
            cli: AGENT_CLI_COMMAND,
        },
        commandKeys: { plugin: "agent.connect.installPrompt" },
        source: "Smithhss/infinite-canvas + @smithhsiiiii/canvas-agent",
        capabilities: LOCAL_CANVAS_CAPABILITIES,
    },
    {
        id: "claude-code",
        label: "Claude Code",
        descriptionKey: "pluginHub.claudeCodeDescription",
        status: "available",
        modes: ["mcp"],
        commands: { mcp: AGENT_CLAUDE_MCP_COMMAND },
        source: "@smithhsiiiii/canvas-agent via npm",
        capabilities: LOCAL_CANVAS_CAPABILITIES,
    },
    {
        id: "claude",
        label: "Claude",
        descriptionKey: "pluginHub.claudePluginDescription",
        status: "planned",
        modes: ["mcp"],
        commands: {},
        capabilities: [],
    },
    {
        id: "openclaw",
        label: "OpenClaw",
        descriptionKey: "pluginHub.openClawDescription",
        status: "planned",
        modes: ["mcp"],
        commands: {},
        capabilities: [],
    },
    {
        id: "hermes",
        label: "Hermes",
        descriptionKey: "pluginHub.hermesDescription",
        status: "planned",
        modes: ["mcp"],
        commands: {},
        capabilities: [],
    },
    {
        id: "codebuddy",
        label: "CodeBuddy",
        descriptionKey: "pluginHub.codeBuddyDescription",
        status: "planned",
        modes: ["mcp"],
        commands: {},
        capabilities: [],
    },
];

export function resolveAgentIntegrationMode(target: AgentIntegrationTarget, requested?: AgentIntegrationMode) {
    if (requested && target.modes.includes(requested)) return requested;
    return target.modes[0];
}

export function resolveAgentIntegrationPhase(target: AgentIntegrationTarget, phase: AgentSetupPhase): AgentIntegrationPhase {
    if (target.status === "planned") return "planned";
    if (target.id !== "codex" && phase === "installed") return "not-detected";
    return phase;
}
