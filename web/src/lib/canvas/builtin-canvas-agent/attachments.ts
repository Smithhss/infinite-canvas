import type { CanvasAgentOp } from "@/lib/canvas/canvas-agent-ops";
import type { CanvasAssistantReference, CanvasNodeData } from "@/types/canvas";

import { actionTargetIds, actionTargetNodes, builtinCanvasActionImageOutputs, isBuiltinCanvasMediaAction, isBuiltinCanvasReadAction, isBuiltinCanvasWriteAction, type BuiltinCanvasAction } from "./actions";
import type { BuiltinCanvasBudget } from "./runtime";

export type BuiltinAttachmentMaterializer = (reference: CanvasAssistantReference) => Promise<CanvasNodeData>;

export function builtinActionNeedsMaterialization(action: BuiltinCanvasAction) {
    return !isBuiltinCanvasReadAction(action);
}

export async function materializeBuiltinAttachment(reference: CanvasAssistantReference, materializedIds: Set<string>, materializer: BuiltinAttachmentMaterializer): Promise<CanvasNodeData | null> {
    if (materializedIds.has(reference.id)) return null;
    const node = await materializer(reference);
    materializedIds.add(reference.id);
    return node;
}

export async function materializeBuiltinAttachments(references: CanvasAssistantReference[], materializedIds: Set<string>, materializer: BuiltinAttachmentMaterializer): Promise<CanvasAgentOp[]> {
    const nodes: CanvasNodeData[] = [];
    for (const reference of references) {
        const node = await materializeBuiltinAttachment(reference, materializedIds, materializer);
        if (node) nodes.push(node);
    }
    return nodes.map((node) => ({
        type: "add_node",
        id: node.id,
        nodeType: node.type,
        title: node.title,
        position: node.position,
        width: node.width,
        height: node.height,
        metadata: node.metadata,
    }));
}

export function requestBuiltinActionConfirmation(action: BuiltinCanvasAction, budget: BuiltinCanvasBudget, nodes: CanvasNodeData[] = []) {
    const media = isBuiltinCanvasMediaAction(action);
    const consumesMediaBudget = media || action.name === "run_node";
    const targetNodes = actionTargetNodes(action, nodes);
    return {
        actionName: action.name,
        targetIds: actionTargetIds(action),
        targetTitles: targetNodes.map((node) => node.title),
        mediaTasks: consumesMediaBudget ? 1 : 0,
        imageOutputs: builtinCanvasActionImageOutputs(action),
        requiresPayment: media || action.name === "run_node",
        writesCanvas: isBuiltinCanvasWriteAction(action) || media,
        budget: { ...budget },
    };
}
