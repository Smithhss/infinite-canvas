import type { CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";

export type AgentCanvasSummary = {
    nodeCount: number;
    connectionCount: number;
    selectedNodeCount: number;
};

export type AgentSuggestionKey =
    | "agent.connect.exampleCreateFlow"
    | "agent.connect.exampleCreateGrid"
    | "agent.connect.exampleCreateStoryboard"
    | "agent.connect.exampleSelectedPrompts"
    | "agent.connect.exampleSelectedFlow"
    | "agent.connect.exampleSelectedDescribe"
    | "agent.connect.exampleReviewFlow"
    | "agent.connect.exampleFindGaps"
    | "agent.connect.exampleGenerateVariants"
    | "agent.connect.exampleOrganize"
    | "agent.connect.exampleConnectFlow"
    | "agent.connect.exampleRead";

export function summarizeAgentCanvas(snapshot: CanvasAgentSnapshot | null | undefined): AgentCanvasSummary {
    return {
        nodeCount: snapshot?.nodes.length ?? 0,
        connectionCount: snapshot?.connections.length ?? 0,
        selectedNodeCount: snapshot?.selectedNodeIds.length ?? 0,
    };
}

export function getAgentSuggestionKeys({ nodeCount, connectionCount, selectedNodeCount }: AgentCanvasSummary): AgentSuggestionKey[] {
    if (selectedNodeCount > 0) {
        return ["agent.connect.exampleSelectedPrompts", "agent.connect.exampleSelectedFlow", "agent.connect.exampleSelectedDescribe"];
    }
    if (nodeCount === 0) {
        return ["agent.connect.exampleCreateFlow", "agent.connect.exampleCreateGrid", "agent.connect.exampleCreateStoryboard"];
    }
    if (connectionCount > 0) {
        return ["agent.connect.exampleReviewFlow", "agent.connect.exampleFindGaps", "agent.connect.exampleGenerateVariants"];
    }
    return ["agent.connect.exampleOrganize", "agent.connect.exampleConnectFlow", "agent.connect.exampleRead"];
}
