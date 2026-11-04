import type { AgentPendingApproval, AgentPendingToolCall } from "@/stores/use-agent-store";

export type AgentRuntimePhase = "idle" | "running" | "tool" | "approval";

export function summarizeAgentRuntime({
    sending,
    waiting,
    pendingTool,
    pendingApprovals,
}: {
    sending: boolean;
    waiting: boolean;
    pendingTool: AgentPendingToolCall | null;
    pendingApprovals: AgentPendingApproval[];
}) {
    const pendingApprovalCount = pendingApprovals.length;
    const pendingToolCount = pendingTool ? 1 : 0;
    const queueCount = pendingApprovalCount + pendingToolCount;
    const phase: AgentRuntimePhase = pendingApprovalCount ? "approval" : pendingTool ? "tool" : sending || waiting ? "running" : "idle";
    return { phase, pendingApprovalCount, pendingToolCount, queueCount };
}
