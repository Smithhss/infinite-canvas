import { buildScriptShotPrompt } from "@/lib/canvas/script-v2";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasScriptStoryboardGrid, type CanvasScriptV2, type Position } from "@/types/canvas";

export const STORYBOARD_GRID_MAX_SHOTS = 25;
export const STORYBOARD_GRID_MIN_COLUMNS = 2;
export const STORYBOARD_GRID_MAX_COLUMNS = 5;
export const STORYBOARD_GRID_ASPECT_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] as const;
const GRID_GAP = 28;
const GRID_PADDING = 24;
const GRID_TOP_PADDING = 52;
const GRID_CELL_LONG_EDGE = 280;

export type CanvasStoryboardGridOptions = {
    columns: number;
    showShotNumbers: boolean;
    aspectRatio: string;
};

type BuildStoryboardGridInput = {
    scriptNode: CanvasNodeData;
    script: CanvasScriptV2;
    options: CanvasStoryboardGridOptions;
    groupId?: string;
    titles: {
        group: string;
        shot: (shotNumber: number) => string;
    };
    origin?: Position;
};

function gridHash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function shotPrompt(script: CanvasScriptV2, shot: CanvasScriptV2["rows"][number]) {
    return shot.imageGenerationPrompt?.trim() || buildScriptShotPrompt(script, shot);
}

export function storyboardGridSourceSignature(script: CanvasScriptV2) {
    return gridHash(JSON.stringify(script.rows.slice(0, STORYBOARD_GRID_MAX_SHOTS).map((shot) => ({
        id: shot.id,
        shotNumber: shot.shotNumber,
        prompt: shotPrompt(script, shot),
    }))));
}

export function normalizeStoryboardGridOptions(options: Partial<CanvasStoryboardGridOptions> = {}, fallbackAspectRatio = "16:9"): CanvasStoryboardGridOptions {
    const candidateAspectRatio = options.aspectRatio || fallbackAspectRatio;
    const aspectRatio = /^\d+(?:\.\d+)?\s*[:x]\s*\d+(?:\.\d+)?$/.test(candidateAspectRatio) ? candidateAspectRatio.replace(/\s+/g, "").replace("x", ":") : "16:9";
    return {
        columns: Math.max(STORYBOARD_GRID_MIN_COLUMNS, Math.min(STORYBOARD_GRID_MAX_COLUMNS, Math.trunc(options.columns || 4))),
        showShotNumbers: options.showShotNumbers !== false,
        aspectRatio,
    };
}

function gridCellSize(aspectRatio: string | undefined) {
    const match = (aspectRatio || "16:9").match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/);
    const width = Number(match?.[1] || 16);
    const height = Number(match?.[2] || 9);
    const ratio = Math.max(0.25, Math.min(4, width / Math.max(1, height)));
    return ratio >= 1
        ? { width: GRID_CELL_LONG_EDGE, height: GRID_CELL_LONG_EDGE / ratio }
        : { width: GRID_CELL_LONG_EDGE * ratio, height: GRID_CELL_LONG_EDGE };
}

export function findStoryboardGridGroup(scriptNodeId: string, nodes: CanvasNodeData[]) {
    return nodes.find((node) => node.type === CanvasNodeType.Group && node.metadata?.storyboardGrid?.scriptNodeId === scriptNodeId);
}

export function collectStoryboardGridNodeIds(scriptNodeId: string, nodes: CanvasNodeData[]) {
    const group = findStoryboardGridGroup(scriptNodeId, nodes);
    if (!group) return new Set<string>();
    return new Set([group.id, ...nodes.filter((node) => node.metadata?.storyboardGridId === group.id).map((node) => node.id)]);
}

export function hasLockedStoryboardGridNodes(scriptNodeId: string, nodes: CanvasNodeData[]) {
    const group = findStoryboardGridGroup(scriptNodeId, nodes);
    if (!group) return false;
    return nodes.some((node) => (node.id === group.id || node.metadata?.storyboardGridId === group.id || node.metadata?.groupId === group.id) && node.locked);
}

export function storyboardGridStateDetails(script: CanvasScriptV2, group: CanvasNodeData | undefined, nodes: CanvasNodeData[]) {
    const metadata = group?.metadata?.storyboardGrid;
    if (!group || !metadata) return { state: "missing" as const };
    if (metadata.sourceSignature !== storyboardGridSourceSignature(script)) return { state: "stale" as const, reason: "source-changed" as const };

    const children = nodes.filter((node) => node.metadata?.storyboardGridId === group.id);
    if (children.length !== metadata.shotOrder.length || new Set(children.map((node) => node.id)).size !== children.length) return { state: "stale" as const, reason: "nodes-invalid" as const };
    const childrenById = new Map(children.map((node) => [node.id, node]));
    const shotsById = new Map(script.rows.map((shot) => [shot.id, shot]));
    for (const shotId of metadata.shotOrder) {
        const nodeId = metadata.shotNodeIds[shotId];
        const child = nodeId ? childrenById.get(nodeId) : undefined;
        const shot = shotsById.get(shotId);
        if (!child || child.type !== CanvasNodeType.Image || child.metadata?.storyboardShotId !== shotId || child.metadata?.storyboardShotNumber !== shot?.shotNumber) {
            return { state: "stale" as const, reason: "nodes-invalid" as const };
        }
    }
    return { state: "ready" as const };
}

export function storyboardGridState(script: CanvasScriptV2, group: CanvasNodeData | undefined, nodes: CanvasNodeData[]) {
    return storyboardGridStateDetails(script, group, nodes).state;
}

export function stripStoryboardGridMetadata(node: CanvasNodeData): CanvasNodeData {
    if (!node.metadata?.storyboardGrid && !node.metadata?.storyboardGridId && !node.metadata?.storyboardShotId && node.metadata?.storyboardShotNumber === undefined) return node;
    return {
        ...node,
        metadata: {
            ...node.metadata,
            storyboardGrid: undefined,
            storyboardGridId: undefined,
            storyboardShotId: undefined,
            storyboardShotNumber: undefined,
        },
    };
}

export function stripRemovedStoryboardGridMetadata(nodes: CanvasNodeData[], removedNodes: CanvasNodeData[]) {
    const removedGridIds = new Set(removedNodes.filter((node) => node.metadata?.storyboardGrid).map((node) => node.id));
    if (!removedGridIds.size) return nodes;
    return nodes.map((node) => {
        const groupId = node.metadata?.groupId;
        const storyboardGridId = node.metadata?.storyboardGridId;
        if ((!groupId || !removedGridIds.has(groupId)) && (!storyboardGridId || !removedGridIds.has(storyboardGridId))) return node;
        const stripped = stripStoryboardGridMetadata(node);
        return {
            ...stripped,
            metadata: {
                ...stripped.metadata,
                groupId: groupId && removedGridIds.has(groupId) ? undefined : groupId,
            },
        };
    });
}

export function storyboardGridOptionsMatch(
    group: CanvasNodeData | undefined,
    options: Partial<CanvasStoryboardGridOptions>,
    fallbackAspectRatio = "16:9",
) {
    const stored = group?.metadata?.storyboardGrid;
    if (!stored) return false;
    const normalized = normalizeStoryboardGridOptions(options, fallbackAspectRatio);
    return stored.columns === normalized.columns
        && stored.showShotNumbers === normalized.showShotNumbers
        && stored.aspectRatio === normalized.aspectRatio;
}

function createStoryboardGridId(scriptNodeId: string) {
    return `storyboard-grid-${scriptNodeId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildStoryboardGrid({ scriptNode, script, options: rawOptions, groupId: existingGroupId, titles, origin }: BuildStoryboardGridInput) {
    const shots = script.rows.slice(0, STORYBOARD_GRID_MAX_SHOTS);
    if (!shots.length) return null;

    const options = normalizeStoryboardGridOptions(rawOptions, script.aspectRatio);
    const rowCount = Math.ceil(shots.length / options.columns);
    const cell = gridCellSize(options.aspectRatio);
    const groupPosition = origin || { x: scriptNode.position.x + scriptNode.width + 120, y: scriptNode.position.y };
    const groupWidth = GRID_PADDING * 2 + options.columns * cell.width + (options.columns - 1) * GRID_GAP;
    const groupHeight = GRID_TOP_PADDING + GRID_PADDING * 2 + rowCount * cell.height + (rowCount - 1) * GRID_GAP;
    const groupId = existingGroupId || createStoryboardGridId(scriptNode.id);
    const shotNodeIds = Object.fromEntries(shots.map((shot) => [shot.id, `storyboard-shot-${groupId}-${shot.id}`]));
    const metadata: CanvasScriptStoryboardGrid = {
        scriptNodeId: scriptNode.id,
        sourceSignature: storyboardGridSourceSignature(script),
        shotOrder: shots.map((shot) => shot.id),
        shotNodeIds,
        columns: options.columns,
        showShotNumbers: options.showShotNumbers,
        aspectRatio: options.aspectRatio,
    };
    const images: CanvasNodeData[] = shots.map((shot, index) => {
        const column = index % options.columns;
        const row = Math.floor(index / options.columns);
        return {
            id: shotNodeIds[shot.id],
            type: CanvasNodeType.Image,
            title: `${options.showShotNumbers ? `#${shot.shotNumber} ` : ""}${titles.shot(shot.shotNumber)}`,
            position: {
                x: groupPosition.x + GRID_PADDING + column * (cell.width + GRID_GAP),
                y: groupPosition.y + GRID_TOP_PADDING + GRID_PADDING + row * (cell.height + GRID_GAP),
            },
            width: cell.width,
            height: cell.height,
            metadata: {
                content: "",
                status: "idle",
                prompt: shotPrompt(script, shot),
                groupId,
                storyboardGridId: groupId,
                storyboardShotId: shot.id,
                storyboardShotNumber: shot.shotNumber,
            },
        };
    });
    const group: CanvasNodeData = {
        id: groupId,
        type: CanvasNodeType.Group,
        title: titles.group,
        position: groupPosition,
        width: groupWidth,
        height: groupHeight,
        metadata: { status: "idle", storyboardGrid: metadata },
    };
    return { group, images };
}

export function replaceStoryboardGridNodes(
    nodes: CanvasNodeData[],
    connections: CanvasConnection[],
    replacedIds: Set<string>,
    built: NonNullable<ReturnType<typeof buildStoryboardGrid>>,
) {
    const nextNodes = [...nodes.filter((node) => !replacedIds.has(node.id)), built.group, ...built.images];
    const replacedChildIds = new Set([...replacedIds].filter((id) => id !== built.group.id));
    return {
        nodes: nextNodes,
        connections: connections.filter((connection) => !replacedChildIds.has(connection.fromNodeId) && !replacedChildIds.has(connection.toNodeId)),
    };
}

export function convertStoryboardGridToGroup(scriptNodeId: string, nodes: CanvasNodeData[]) {
    const group = findStoryboardGridGroup(scriptNodeId, nodes);
    if (!group) return nodes;
    return nodes.map((node) => {
        if (node.id === group.id) return { ...node, metadata: { ...node.metadata, storyboardGrid: undefined } };
        if (node.metadata?.storyboardGridId !== group.id) return node;
        return {
            ...node,
            metadata: {
                ...node.metadata,
                storyboardGridId: undefined,
                storyboardShotId: undefined,
                storyboardShotNumber: undefined,
            },
        };
    });
}
