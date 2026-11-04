export type AgentProvider = "codex" | "claude";

export const AGENT_PROVIDERS = ["codex", "claude"] as const satisfies AgentProvider[];

/** Claude shares native models and local history, but not Codex-only reasoning or attachment contracts. */
export function agentProviderCapabilities(provider: AgentProvider) {
    if (provider === "claude") {
        return { model: true, reasoning: false, permission: false, attachments: false, skills: false, history: true, imageReferences: false, messageLabel: "Claude" };
    }
    return { model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" };
}
