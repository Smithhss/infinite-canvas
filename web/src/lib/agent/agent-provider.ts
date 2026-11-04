import { isFeatureEnabled } from "@/constant/feature-flags";

export type AgentProvider = "codex" | "claude";

export const AGENT_PROVIDERS = ["codex", "claude"] as const satisfies AgentProvider[];

/** Resolve the visible provider without trusting a stored Claude choice when its feature flag is off. */
export function activeAgentProvider(provider: AgentProvider) {
    return isFeatureEnabled("agentProviderSwitch") ? provider : "codex";
}

/** Claude shares native models, Skills, local history, and SDK permissions, but not Codex-only reasoning or attachment contracts. */
export function agentProviderCapabilities(provider: AgentProvider) {
    if (provider === "claude") {
        return { model: true, reasoning: false, permission: true, attachments: false, skills: true, history: true, imageReferences: false, messageLabel: "Claude" };
    }
    return { model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" };
}
