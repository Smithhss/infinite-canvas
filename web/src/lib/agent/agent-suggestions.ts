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
    | "agent.connect.exampleCreateShotPlan"
    | "agent.connect.exampleSelectedPrompts"
    | "agent.connect.exampleSelectedFlow"
    | "agent.connect.exampleSelectedDescribe"
    | "agent.connect.exampleSelectedStoryboard"
    | "agent.connect.exampleReviewFlow"
    | "agent.connect.exampleFindGaps"
    | "agent.connect.exampleGenerateVariants"
    | "agent.connect.exampleReviewDependencies"
    | "agent.connect.exampleOrganize"
    | "agent.connect.exampleConnectFlow"
    | "agent.connect.exampleRead"
    | "agent.connect.exampleOrganizeGroups";

export type AgentScenePresetKey =
    | "agent.scenePreset.scriptOriginal"
    | "agent.scenePreset.scriptAdaptation"
    | "agent.scenePreset.director";

export const AGENT_SCENE_PRESET_KEYS = [
    "agent.scenePreset.scriptOriginal",
    "agent.scenePreset.scriptAdaptation",
    "agent.scenePreset.director",
] as const satisfies AgentScenePresetKey[];

export function summarizeAgentCanvas(snapshot: CanvasAgentSnapshot | null | undefined): AgentCanvasSummary {
    return {
        nodeCount: snapshot?.nodes.length ?? 0,
        connectionCount: snapshot?.connections.length ?? 0,
        selectedNodeCount: snapshot?.selectedNodeIds.length ?? 0,
    };
}

export function getAgentSuggestionKeys({ nodeCount, connectionCount, selectedNodeCount }: AgentCanvasSummary): AgentSuggestionKey[] {
    if (selectedNodeCount > 0) {
        return ["agent.connect.exampleSelectedPrompts", "agent.connect.exampleSelectedFlow", "agent.connect.exampleSelectedDescribe", "agent.connect.exampleSelectedStoryboard"];
    }
    if (nodeCount === 0) {
        return ["agent.connect.exampleCreateFlow", "agent.connect.exampleCreateGrid", "agent.connect.exampleCreateStoryboard", "agent.connect.exampleCreateShotPlan"];
    }
    if (connectionCount > 0) {
        return ["agent.connect.exampleReviewFlow", "agent.connect.exampleFindGaps", "agent.connect.exampleGenerateVariants", "agent.connect.exampleReviewDependencies"];
    }
    return ["agent.connect.exampleOrganize", "agent.connect.exampleConnectFlow", "agent.connect.exampleRead", "agent.connect.exampleOrganizeGroups"];
}
