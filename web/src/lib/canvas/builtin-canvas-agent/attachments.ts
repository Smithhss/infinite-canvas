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
