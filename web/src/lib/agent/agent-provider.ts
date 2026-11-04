import { isFeatureEnabled } from "@/constant/feature-flags";

export type AgentProvider = "codex" | "claude";

export const AGENT_PROVIDERS = ["codex", "claude"] as const satisfies AgentProvider[];
const CLAUDE_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/jpg", "image/png", "image/webp"]);

/** Resolve the visible provider without trusting a stored Claude choice when its feature flag is off. */
export function activeAgentProvider(provider: AgentProvider) {
    return isFeatureEnabled("agentProviderSwitch") ? provider : "codex";
}

/** Claude shares native models, Skills, local history, SDK permissions, and image inputs, but not Codex reasoning. */
export function agentProviderCapabilities(provider: AgentProvider) {
    if (provider === "claude") {
        return { model: true, reasoning: false, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Claude" };
    }
    return { model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" };
}

/** Claude 只接受 SDK 原生图片块支持的格式，Codex 保持原有图片输入范围。 */
export function agentProviderSupportsImageType(provider: AgentProvider, type: string) {
    return provider !== "claude" || CLAUDE_IMAGE_TYPES.has(type.toLowerCase());
}
