import { expect, test } from "bun:test";

import { AGENT_PROVIDERS, agentProviderCapabilities, agentProviderSupportsImageType } from "../src/lib/agent/agent-provider";

test("agent providers expose only implemented capabilities", () => {
    expect(AGENT_PROVIDERS).toEqual(["codex", "claude"]);
    expect(agentProviderCapabilities("codex")).toEqual({ model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" });
    expect(agentProviderCapabilities("claude")).toEqual({ model: true, reasoning: false, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Claude" });
});

test("Claude only claims the image formats exposed by its native image blocks", () => {
    for (const type of ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]) {
        expect(agentProviderSupportsImageType("claude", type)).toBe(true);
    }
    expect(agentProviderSupportsImageType("claude", "image/svg+xml")).toBe(false);
    expect(agentProviderSupportsImageType("codex", "image/svg+xml")).toBe(true);
});
