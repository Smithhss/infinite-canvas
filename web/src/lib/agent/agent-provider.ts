export type AgentProvider = "codex" | "claude";

export const AGENT_PROVIDERS = ["codex", "claude"] as const satisfies AgentProvider[];

/** Claude SDK currently receives text only; it does not share Codex's history, model, permission or attachment contracts. */
export function agentProviderCapabilities(provider: AgentProvider) {
    if (provider === "claude") {
        return { model: false, reasoning: false, permission: false, attachments: false, skills: false, history: false, imageReferences: false, messageLabel: "Claude" };
    }
    return { model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" };
}
