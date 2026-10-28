import type { BuiltinCanvasAction, BuiltinCanvasMediaAction } from "./actions";
import { isBuiltinCanvasMediaAction } from "./actions";
import { modelCapabilityOf, resolveModelChannel, type AiConfig } from "@/stores/use-config-store";

export type BuiltinCanvasMediaResult = {
    requestId?: string;
    taskIds?: string[];
    imageUrls: string[];
    images?: Array<{
        url: string;
        storageKey?: string;
        width: number;
        height: number;
        bytes: number;
        mimeType: string;
    }>;
};

export type BuiltinCanvasMediaExecutor = {
    generateImage: (action: Extract<BuiltinCanvasMediaAction, { name: "generate_image" }>, signal: AbortSignal) => Promise<BuiltinCanvasMediaResult>;
    editImage: (action: Extract<BuiltinCanvasMediaAction, { name: "edit_image" }>, signal: AbortSignal) => Promise<BuiltinCanvasMediaResult>;
};

export { isBuiltinCanvasMediaAction };

export async function executeBuiltinCanvasMediaAction(action: BuiltinCanvasMediaAction, executor: BuiltinCanvasMediaExecutor, signal: AbortSignal): Promise<BuiltinCanvasMediaResult> {
    if (signal.aborted) throw new Error("canceled");
    return action.name === "generate_image" ? executor.generateImage(action, signal) : executor.editImage(action, signal);
}

export function isMediaAction(action: BuiltinCanvasAction): action is BuiltinCanvasMediaAction {
    return isBuiltinCanvasMediaAction(action);
}

export function selectBuiltinImageModel(config: AiConfig, requestedModel?: string) {
    const model = requestedModel?.trim() || config.imageModel.trim();
    if (!model) throw new Error("image-model-required");
    if (modelCapabilityOf(config, model) !== "image") throw new Error("image-model-invalid");
    const channel = resolveModelChannel(config, model);
    if (!channel.baseUrl.trim() || !channel.apiKey.trim()) throw new Error("image-model-not-ready");
    return model;
}
