import { buildScriptShotPrompt } from "@/lib/canvas/script-v2";
import { CanvasNodeType, type CanvasNodeData, type CanvasScriptV2 } from "@/types/canvas";

export type StoryboardBatchMode = "unfinished" | "failed" | "all";
export type StoryboardBatchStatus = "done" | "failed" | "running" | "pending";

export type StoryboardBatchItem = {
    shotId: string;
    shotNumber: number;
    nodeId: string;
    prompt: string;
    status: StoryboardBatchStatus;
};

export function storyboardBatchNodeStatus(node: CanvasNodeData | undefined): StoryboardBatchStatus {
    if (!node) return "pending";
    if (node.metadata?.status === "loading") return "running";
    if (node.metadata?.status === "error") return "failed";
    if (node.metadata?.status === "success" || node.metadata?.storageKey || node.metadata?.images?.length) return "done";
    return "pending";
}

export function storyboardBatchItems(script: CanvasScriptV2, group: CanvasNodeData | undefined, nodes: CanvasNodeData[]) {
    const metadata = group?.metadata?.storyboardGrid;
    if (!group || !metadata) return [] as StoryboardBatchItem[];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const shotsById = new Map(script.rows.map((shot) => [shot.id, shot]));
    return metadata.shotOrder.flatMap((shotId): StoryboardBatchItem[] => {
        const shot = shotsById.get(shotId);
        const nodeId = metadata.shotNodeIds[shotId];
        const node = nodeId ? nodesById.get(nodeId) : undefined;
        if (!shot || !node || node.type !== CanvasNodeType.Image) return [];
        return [{
            shotId,
            shotNumber: shot.shotNumber,
            nodeId: node.id,
            prompt: node.metadata?.prompt?.trim() || shot.imageGenerationPrompt?.trim() || buildScriptShotPrompt(script, shot),
            status: storyboardBatchNodeStatus(node),
        }];
    });
}

export function selectStoryboardBatchItems(items: StoryboardBatchItem[], mode: StoryboardBatchMode) {
    if (mode === "all") return items.filter((item) => item.status !== "running");
    if (mode === "failed") return items.filter((item) => item.status === "failed");
    return items.filter((item) => item.status === "pending" || item.status === "failed");
}

export function storyboardBatchCounts(items: StoryboardBatchItem[]) {
    return items.reduce(
        (counts, item) => {
            counts[item.status] += 1;
            return counts;
        },
        { total: items.length, done: 0, failed: 0, running: 0, pending: 0 } as Record<StoryboardBatchStatus | "total", number>,
    );
}
