import type { AgentPendingApproval, AgentPendingToolCall, AgentPendingUserInput } from "@/stores/use-agent-store";

export type AgentRuntimePhase = "idle" | "running" | "tool" | "user-input" | "approval";

export function summarizeAgentRuntime({
    sending,
    waiting,
    pendingTools,
    pendingApprovals,
    pendingUserInputs,
}: {
    sending: boolean;
    waiting: boolean;
    pendingTools: AgentPendingToolCall[];
    pendingApprovals: AgentPendingApproval[];
    pendingUserInputs: AgentPendingUserInput[];
}) {
    const pendingApprovalCount = pendingApprovals.length;
    const pendingUserInputCount = pendingUserInputs.length;
    const pendingToolCount = pendingTools.length;
    const queueCount = pendingApprovalCount + pendingUserInputCount + pendingToolCount;
    const phase: AgentRuntimePhase = pendingUserInputCount ? "user-input" : pendingApprovalCount ? "approval" : pendingToolCount ? "tool" : sending || waiting ? "running" : "idle";
    return { phase, pendingApprovalCount, pendingUserInputCount, pendingToolCount, queueCount };
}
