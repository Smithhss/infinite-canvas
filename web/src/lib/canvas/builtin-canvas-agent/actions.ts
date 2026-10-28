import { CanvasNodeType, type CanvasNodeData, type CanvasNodeMetadata } from "@/types/canvas";
import type { CanvasAgentOp } from "@/lib/canvas/canvas-agent-ops";

import type { BuiltinCanvasAgentToolCall, BuiltinCanvasAgentToolName } from "./tools";
import { isRecord } from "./tools";

export type BuiltinCanvasReadAction =
    | { name: "get_canvas_summary"; args: Record<string, never> }
    | { name: "get_selected_nodes"; args: Record<string, never> }
    | { name: "get_node"; args: { id: string } };

export type BuiltinCanvasWriteAction =
    | { name: "create_text_node"; args: { title: string; content: string; position: { x: number; y: number } } }
    | { name: "update_text_node"; args: { id: string; title?: string; content?: string } }
    | { name: "move_nodes"; args: { positions: Array<{ id: string; x: number; y: number }> } }
    | { name: "connect_nodes"; args: { fromNodeId: string; toNodeId: string } }
    | { name: "delete_nodes"; args: { ids: string[] } }
    | { name: "run_node"; args: { nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string } };

export type BuiltinCanvasMediaAction =
    | { name: "generate_image"; args: { prompt: string; count?: number; model?: string } }
    | { name: "edit_image"; args: { prompt: string; sourceNodeIds: string[]; count?: number; model?: string } };

export type BuiltinCanvasAction = BuiltinCanvasReadAction | BuiltinCanvasWriteAction | BuiltinCanvasMediaAction;

const READ_ACTIONS = new Set<BuiltinCanvasAgentToolName>(["get_canvas_summary", "get_selected_nodes", "get_node"]);
const WRITE_ACTIONS = new Set<BuiltinCanvasAgentToolName>(["create_text_node", "update_text_node", "move_nodes", "connect_nodes", "delete_nodes", "run_node"]);
const MEDIA_ACTIONS = new Set<BuiltinCanvasAgentToolName>(["generate_image", "edit_image"]);

export function isBuiltinCanvasReadAction(action: BuiltinCanvasAction): action is BuiltinCanvasReadAction {
    return READ_ACTIONS.has(action.name as BuiltinCanvasAgentToolName);
}

export function isBuiltinCanvasWriteAction(action: BuiltinCanvasAction): action is BuiltinCanvasWriteAction {
    return WRITE_ACTIONS.has(action.name as BuiltinCanvasAgentToolName);
}

export function isBuiltinCanvasMediaAction(action: BuiltinCanvasAction): action is BuiltinCanvasMediaAction {
    return MEDIA_ACTIONS.has(action.name as BuiltinCanvasAgentToolName);
}

export function normalizeBuiltinCanvasAction(call: BuiltinCanvasAgentToolCall): BuiltinCanvasAction;
export function normalizeBuiltinCanvasAction(name: string, args: unknown): BuiltinCanvasAction;
export function normalizeBuiltinCanvasAction(nameOrCall: string | BuiltinCanvasAgentToolCall, input?: unknown): BuiltinCanvasAction {
    const name = typeof nameOrCall === "string" ? nameOrCall : nameOrCall.name;
    const args = typeof nameOrCall === "string" ? input : nameOrCall.arguments;
    if (!isRecord(args)) throw new Error("arguments-required");

    if (name === "get_canvas_summary" || name === "get_selected_nodes") {
        assertKeys(args, []);
        return { name, args: {} };
    }
    if (name === "get_node") {
        assertKeys(args, ["id"]);
        return { name, args: { id: requiredId(args.id, "id") } };
    }
    if (name === "create_text_node") {
        assertKeys(args, ["title", "content", "position"]);
        const position = isRecord(args.position) ? args.position : null;
        if (!position) throw new Error("position-required");
        assertKeys(position, ["x", "y"]);
        return {
            name,
            args: {
                title: requiredText(args.title, "title", 120),
                content: requiredText(args.content, "content", 20000),
                position: { x: finiteNumber(position.x, "x"), y: finiteNumber(position.y, "y") },
            },
        };
    }
    if (name === "update_text_node") {
        assertKeys(args, ["id", "title", "content"]);
        const title = args.title === undefined ? undefined : requiredText(args.title, "title", 120);
        const content = args.content === undefined ? undefined : optionalText(args.content, "content", 20000);
        if (title === undefined && content === undefined) throw new Error("update-required");
        return { name, args: { id: requiredId(args.id, "id"), ...(title !== undefined ? { title } : {}), ...(content !== undefined ? { content } : {}) } };
    }
    if (name === "move_nodes") {
        assertKeys(args, ["positions"]);
        if (!Array.isArray(args.positions) || args.positions.length === 0 || args.positions.length > 100) throw new Error("positions-required");
        return {
            name,
            args: {
                positions: args.positions.map((item, index) => {
                    if (!isRecord(item)) throw new Error(`invalid-position:${index}`);
                    assertKeys(item, ["id", "x", "y"]);
                    return { id: requiredId(item.id, `positions.${index}.id`), x: finiteNumber(item.x, `positions.${index}.x`), y: finiteNumber(item.y, `positions.${index}.y`) };
                }),
            },
        };
    }
    if (name === "connect_nodes") {
        assertKeys(args, ["fromNodeId", "toNodeId"]);
        const fromNodeId = requiredId(args.fromNodeId, "fromNodeId");
        const toNodeId = requiredId(args.toNodeId, "toNodeId");
        if (fromNodeId === toNodeId) throw new Error("self-connection");
        return { name, args: { fromNodeId, toNodeId } };
    }
    if (name === "delete_nodes") {
        assertKeys(args, ["ids"]);
        return { name, args: { ids: requiredIds(args.ids, "ids", 100) } };
    }
    if (name === "generate_image") {
        assertKeys(args, ["prompt", "count", "model"]);
        return {
            name,
            args: {
                prompt: requiredText(args.prompt, "prompt", 20000),
                ...(args.count !== undefined ? { count: generationCount(args.count) } : {}),
                ...(args.model !== undefined ? { model: requiredText(args.model, "model", 300) } : {}),
            },
        };
    }
    if (name === "edit_image") {
        assertKeys(args, ["prompt", "sourceNodeIds", "count", "model"]);
        return {
            name,
            args: {
                prompt: requiredText(args.prompt, "prompt", 20000),
                sourceNodeIds: requiredIds(args.sourceNodeIds, "sourceNodeIds", 6),
                ...(args.count !== undefined ? { count: generationCount(args.count) } : {}),
                ...(args.model !== undefined ? { model: requiredText(args.model, "model", 300) } : {}),
            },
        };
    }
    if (name === "run_node") {
        assertKeys(args, ["nodeId", "mode", "prompt"]);
        const mode = args.mode === undefined ? undefined : args.mode;
        if (mode !== undefined && mode !== "text" && mode !== "image" && mode !== "video" && mode !== "audio") throw new Error("invalid-mode");
        return {
            name,
            args: {
                nodeId: requiredId(args.nodeId, "nodeId"),
                ...(mode ? { mode } : {}),
                ...(args.prompt !== undefined ? { prompt: optionalText(args.prompt, "prompt", 20000) } : {}),
            },
        };
    }
    throw new Error(`unsupported-tool:${name || "unknown"}`);
}

export function actionToCanvasAgentOps(action: BuiltinCanvasAction): CanvasAgentOp[] {
    if (isBuiltinCanvasReadAction(action) || isBuiltinCanvasMediaAction(action)) return [];
    if (action.name === "create_text_node") {
        return [
            {
                type: "add_node",
                nodeType: CanvasNodeType.Text,
                title: action.args.title,
                position: action.args.position,
                metadata: { content: action.args.content, prompt: action.args.content, status: "success" },
            },
        ];
    }
    if (action.name === "update_text_node") {
        const metadata: CanvasNodeMetadata = {
            ...(action.args.content !== undefined ? { content: action.args.content, prompt: action.args.content, status: "success" } : {}),
        };
        return [{ type: "update_node", id: action.args.id, ...(action.args.title !== undefined ? { patch: { title: action.args.title } } : {}), metadata }];
    }
    if (action.name === "move_nodes") {
        return action.args.positions.map((item) => ({ type: "update_node", id: item.id, patch: { position: { x: item.x, y: item.y } } }));
    }
    if (action.name === "connect_nodes") {
        return [{ type: "connect_nodes", fromNodeId: action.args.fromNodeId, toNodeId: action.args.toNodeId }];
    }
    if (action.name === "delete_nodes") {
        return [{ type: "delete_node", ids: action.args.ids }];
    }
    if (action.name === "run_node") {
        return [{ type: "run_generation", nodeId: action.args.nodeId, ...(action.args.mode ? { mode: action.args.mode } : {}), ...(action.args.prompt !== undefined ? { prompt: action.args.prompt } : {}) }];
    }
    return [];
}

export function builtinCanvasActionImageOutputs(action: BuiltinCanvasAction) {
    if (isBuiltinCanvasMediaAction(action)) return action.args.count || 1;
    if (action.name === "run_node" && (!action.args.mode || action.args.mode === "image")) return 1;
    return 0;
}

export function builtinCanvasActionConsumesMediaBudget(action: BuiltinCanvasAction) {
    return isBuiltinCanvasMediaAction(action) || action.name === "run_node";
}

export function actionTargetIds(action: BuiltinCanvasAction): string[] {
    if (action.name === "get_node") return [action.args.id];
    if (action.name === "update_text_node") return [action.args.id];
    if (action.name === "run_node") return [action.args.nodeId];
    if (action.name === "move_nodes") return action.args.positions.map((item) => item.id);
    if (action.name === "connect_nodes") return [action.args.fromNodeId, action.args.toNodeId];
    if (action.name === "delete_nodes") return action.args.ids;
    if (action.name === "edit_image") return action.args.sourceNodeIds;
    return [];
}

export function actionTargetNodes(action: BuiltinCanvasAction, nodes: CanvasNodeData[]) {
    const ids = new Set(actionTargetIds(action));
    return nodes.filter((node) => ids.has(node.id));
}

function assertKeys(value: Record<string, unknown>, allowed: string[]) {
    const allowedSet = new Set(allowed);
    if (Object.keys(value).some((key) => !allowedSet.has(key))) throw new Error("unknown-field");
}

function requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field}-required`);
    if (value.length > 200) throw new Error(`${field}-too-long`);
    return value.trim();
}

function requiredIds(value: unknown, field: string, max: number) {
    if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new Error(`${field}-required`);
    const ids = value.map((item, index) => requiredId(item, `${field}.${index}`));
    if (new Set(ids).size !== ids.length) throw new Error(`${field}-duplicate`);
    return ids;
}

function requiredText(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`${field}-required`);
    if (value.length > max) throw new Error(`${field}-too-long`);
    return value.trim();
}

function optionalText(value: unknown, field: string, max: number) {
    if (typeof value !== "string") throw new Error(`${field}-invalid`);
    if (value.length > max) throw new Error(`${field}-too-long`);
    return value.trim();
}

function finiteNumber(value: unknown, field: string) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field}-invalid`);
    return value;
}

function generationCount(value: unknown) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) throw new Error("count-invalid");
    return value;
}
