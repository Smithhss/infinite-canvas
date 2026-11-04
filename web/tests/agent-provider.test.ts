import { expect, test } from "bun:test";

import { AGENT_PROVIDERS, agentProviderCapabilities } from "../src/lib/agent/agent-provider";

test("agent providers expose only implemented capabilities", () => {
    expect(AGENT_PROVIDERS).toEqual(["codex", "claude"]);
    expect(agentProviderCapabilities("codex")).toEqual({ model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" });
    expect(agentProviderCapabilities("claude")).toEqual({ model: true, reasoning: false, permission: true, attachments: false, skills: true, history: true, imageReferences: false, messageLabel: "Claude" });
});
