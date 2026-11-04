import type { AgentPendingToolCall } from "@/stores/use-agent-store";

export function enqueuePendingTool(queue: AgentPendingToolCall[], tool: AgentPendingToolCall) {
    const index = queue.findIndex((item) => item.requestId === tool.requestId);
    if (index === -1) return [...queue, tool];
    const next = [...queue];
    next[index] = tool;
    return next;
}

export function removePendingTool(queue: AgentPendingToolCall[], requestId: string) {
    return queue.filter((item) => item.requestId !== requestId);
}
