import type { AgentPendingApproval, AgentPendingToolCall } from "@/stores/use-agent-store";

export type AgentRuntimePhase = "idle" | "running" | "tool" | "approval";

export function summarizeAgentRuntime({
    sending,
    waiting,
    pendingTools,
    pendingApprovals,
}: {
    sending: boolean;
    waiting: boolean;
    pendingTools: AgentPendingToolCall[];
    pendingApprovals: AgentPendingApproval[];
}) {
    const pendingApprovalCount = pendingApprovals.length;
    const pendingToolCount = pendingTools.length;
    const queueCount = pendingApprovalCount + pendingToolCount;
    const phase: AgentRuntimePhase = pendingApprovalCount ? "approval" : pendingToolCount ? "tool" : sending || waiting ? "running" : "idle";
    return { phase, pendingApprovalCount, pendingToolCount, queueCount };
}
