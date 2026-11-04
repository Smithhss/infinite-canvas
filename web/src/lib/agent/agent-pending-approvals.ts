import type { AgentPendingApproval } from "@/stores/use-agent-store";

/** 重连时优先恢复仍在等待的 Claude 原生审批，不能先按 Codex 线程过滤。 */
export function recoverPendingApprovals(pendingApprovals: AgentPendingApproval[], codexThreadId: string, codexBusy: boolean) {
    const claudeApprovals = pendingApprovals.filter((item) => item.provider === "claude");
    if (claudeApprovals.length) {
        const threadId = claudeApprovals.find((item) => item.threadId)?.threadId || codexThreadId;
        return {
            threadId,
            turnId: claudeApprovals.find((item) => item.turnId)?.turnId || "",
            agent: "claude" as const,
            pendingApprovals: claudeApprovals.filter((item) => !item.threadId || item.threadId === threadId),
        };
    }
    const defaults = pendingApprovals.filter((item) => item.provider !== "claude" && (!item.threadId || item.threadId === codexThreadId));
    return {
        threadId: codexThreadId,
        turnId: "",
        agent: codexBusy ? "codex" as const : undefined,
        pendingApprovals: codexBusy ? defaults : [],
    };
}
