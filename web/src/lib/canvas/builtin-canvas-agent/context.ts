import type { CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

import type { BuiltinCanvasAction, BuiltinCanvasReadAction } from "./actions";
import { isBuiltinCanvasReadAction } from "./actions";

export type BuiltinCanvasNodeSummary = {
    id: string;
    type: string;
    title: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    status?: string;
    textPreview?: string;
    hasImage?: boolean;
    hasVideo?: boolean;
    hasAudio?: boolean;
    model?: string;
};

export type BuiltinCanvasContext = {
    projectTitle: string;
    selectedNodeIds: string[];
    nodes: BuiltinCanvasNodeSummary[];
    connections: Array<{ id: string; fromNodeId: string; toNodeId: string }>;
    viewport: { x: number; y: number; k: number };
    counts: Record<string, number>;
};

export function buildBuiltinCanvasContext(snapshot: CanvasAgentSnapshot): BuiltinCanvasContext {
    const nodes = snapshot.nodes.slice(0, 500).map(summarizeNode);
    return {
        projectTitle: safeText(snapshot.title, 120),
        selectedNodeIds: snapshot.selectedNodeIds.filter(Boolean).slice(0, 100),
        nodes,
        connections: snapshot.connections.slice(0, 500).map((connection) => ({
            id: safeText(connection.id, 200),
            fromNodeId: safeText(connection.fromNodeId, 200),
            toNodeId: safeText(connection.toNodeId, 200),
        })),
        viewport: { x: finite(snapshot.viewport.x), y: finite(snapshot.viewport.y), k: finite(snapshot.viewport.k) },
        counts: nodes.reduce<Record<string, number>>((counts, node) => {
            counts[node.type] = (counts[node.type] || 0) + 1;
            return counts;
        }, {}),
    };
}

export function executeBuiltinCanvasReadAction(action: BuiltinCanvasReadAction, context: BuiltinCanvasContext): Record<string, unknown> {
    if (action.name === "get_canvas_summary") {
        return {
            projectTitle: context.projectTitle,
            nodeCount: context.nodes.length,
            counts: context.counts,
            selectedNodeIds: context.selectedNodeIds,
            connectionCount: context.connections.length,
            viewport: context.viewport,
        };
    }
    if (action.name === "get_selected_nodes") {
        const selected = new Set(context.selectedNodeIds);
        return { nodes: context.nodes.filter((node) => selected.has(node.id)) };
    }
    return { node: context.nodes.find((node) => node.id === action.args.id) || null };
}

export function isReadOnlyBuiltinCanvasAction(action: BuiltinCanvasAction) {
    return isBuiltinCanvasReadAction(action);
}

function summarizeNode(node: CanvasNodeData): BuiltinCanvasNodeSummary {
    return {
        id: safeText(node.id, 200),
        type: safeText(node.type, 120),
        title: safeText(node.title, 120),
        position: { x: finite(node.position.x), y: finite(node.position.y) },
        size: { width: boundedDimension(node.width), height: boundedDimension(node.height) },
        ...(node.metadata?.status ? { status: node.metadata.status } : {}),
        ...(node.type === CanvasNodeType.Text ? { textPreview: safeText(node.metadata?.content || node.metadata?.prompt || "", 500) } : {}),
        ...(node.type === CanvasNodeType.Image ? { hasImage: Boolean(node.metadata?.content) } : {}),
        ...(node.type === CanvasNodeType.Video ? { hasVideo: Boolean(node.metadata?.content) } : {}),
        ...(node.type === CanvasNodeType.Audio ? { hasAudio: Boolean(node.metadata?.content) } : {}),
        ...(node.metadata?.model ? { model: safeText(node.metadata.model, 300) } : {}),
    };
}

function safeText(value: unknown, max: number) {
    return String(value || "")
        .replace(/data:[^\s]+/gi, "[data-url-removed]")
        .replace(/(?:api[_-]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
        .replace(/[A-Za-z]:\\[^\s]+|\/(?:Users|home|tmp|var)\/[^\s]+/g, "[path-removed]")
        .slice(0, max);
}

function finite(value: number) {
    return Number.isFinite(value) ? value : 0;
}

function boundedDimension(value: number) {
    return Math.max(0, Math.min(100000, finite(value)));
}
