import { expect, test } from "bun:test";

import { AGENT_PROVIDERS, agentProviderCapabilities } from "../src/lib/agent/agent-provider";

test("agent providers expose only implemented capabilities", () => {
    expect(AGENT_PROVIDERS).toEqual(["codex", "claude"]);
    expect(agentProviderCapabilities("codex")).toEqual({ model: true, reasoning: true, permission: true, attachments: true, skills: true, history: true, imageReferences: true, messageLabel: "Codex" });
    expect(agentProviderCapabilities("claude")).toEqual({ model: false, reasoning: false, permission: false, attachments: false, skills: false, history: true, imageReferences: false, messageLabel: "Claude" });
});
