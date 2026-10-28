import type { BuiltinCanvasAction } from "./actions";
import { requestBuiltinActionConfirmation } from "./attachments";
import type { BuiltinCanvasBudget } from "./runtime";

export type BuiltinAgentChatMessage = {
    id: string;
    role: "user" | "assistant" | "error" | "tool";
    text: string;
    meta?: string;
};

export type BuiltinAgentAttachment = {
    id: string;
    name: string;
    type: string;
    size: number;
    storageKey?: string;
    url: string;
    width: number;
    height: number;
};

export type BuiltinAgentConfirmation = {
    action: BuiltinCanvasAction;
    budget: BuiltinCanvasBudget;
    request: ReturnType<typeof requestBuiltinActionConfirmation>;
};

export function builtinAgentButtonLabel(open: boolean) {
    return open ? "关闭创作 Agent" : "打开创作 Agent";
}

export function canSendBuiltinAgentMessage(input: string, running: boolean) {
    return !running && input.trim().length > 0;
}
