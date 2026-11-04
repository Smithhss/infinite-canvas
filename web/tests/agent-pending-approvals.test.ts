import { expect, test } from "bun:test";

import { recoverPendingApprovals } from "../src/lib/agent/agent-pending-approvals";
import type { AgentPendingApproval } from "../src/stores/use-agent-store";

const claudeApproval = { requestId: "claude-1", method: "claude/permission", provider: "claude", threadId: "claude-session", turnId: "claude-turn" } as AgentPendingApproval;
const codexApproval = { requestId: "codex-1", method: "item/fileChange/requestApproval", threadId: "codex-thread" } as AgentPendingApproval;

test("reconnect prefers a pending Claude approval over the Codex workspace thread", () => {
    expect(recoverPendingApprovals([codexApproval, claudeApproval], "codex-thread", false)).toEqual({
        threadId: "claude-session",
        turnId: "claude-turn",
        agent: "claude",
        pendingApprovals: [claudeApproval],
    });
});

test("reconnect keeps Codex approvals scoped to the Codex thread", () => {
    expect(recoverPendingApprovals([codexApproval, { ...codexApproval, requestId: "other", threadId: "other-thread" }], "codex-thread", true)).toEqual({
        threadId: "codex-thread",
        turnId: "",
        agent: "codex",
        pendingApprovals: [codexApproval],
    });
    expect(recoverPendingApprovals([codexApproval], "codex-thread", false).pendingApprovals).toEqual([]);
});
