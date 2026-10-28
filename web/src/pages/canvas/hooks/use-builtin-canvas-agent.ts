import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";

import i18n from "@/i18n";
import { buildNodeGenerationContext } from "@/components/canvas/canvas-node-generation";
import { createCanvasNode, imageMetadata } from "@/lib/canvas/canvas-node-factory";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import type { CanvasAgentOp, CanvasAgentSnapshot } from "@/lib/canvas/canvas-agent-ops";
import { actionToCanvasAgentOps, isBuiltinCanvasMediaAction, isBuiltinCanvasReadAction, isBuiltinCanvasWriteAction, type BuiltinCanvasAction, type BuiltinCanvasMediaAction } from "@/lib/canvas/builtin-canvas-agent/actions";
import { builtinActionNeedsMaterialization, requestBuiltinActionConfirmation } from "@/lib/canvas/builtin-canvas-agent/attachments";
import { buildBuiltinCanvasContext, executeBuiltinCanvasReadAction } from "@/lib/canvas/builtin-canvas-agent/context";
import { executeBuiltinCanvasMediaAction, selectBuiltinImageModel, type BuiltinCanvasMediaExecutor, type BuiltinCanvasMediaResult } from "@/lib/canvas/builtin-canvas-agent/media";
import { createBuiltinCanvasBudget, runBuiltinCanvasAgent, type BuiltinCanvasActionExecution, type BuiltinCanvasBudget, type BuiltinCanvasRunResult, type BuiltinCanvasTurn } from "@/lib/canvas/builtin-canvas-agent/runtime";
import { buildBuiltinCanvasSkillPrompt } from "@/lib/canvas/builtin-canvas-agent/skills";
import type { BuiltinCanvasAgentMessage } from "@/services/api/builtin-canvas-agent";
import { requestBuiltinCanvasAgentTurn } from "@/services/api/builtin-canvas-agent";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { imageToDataUrl, uploadImage } from "@/services/image-storage";
import { modelOptionLabel, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

import type { BuiltinAgentAttachment, BuiltinAgentChatMessage, BuiltinAgentConfirmation } from "@/lib/canvas/builtin-canvas-agent/ui-state";

const MAX_ATTACHMENTS = 6;
const MAX_AGENT_IMAGES = 12;

export function useBuiltinCanvasAgent({
    snapshot,
    applyAgentOps,
    applyAgentSnapshot,
}: {
    snapshot: CanvasAgentSnapshot;
    applyAgentOps: (ops?: CanvasAgentOp[], options?: { recordUndo?: boolean }) => CanvasAgentSnapshot;
    applyAgentSnapshot: (snapshot: CanvasAgentSnapshot) => CanvasAgentSnapshot;
}) {
    const { t } = useTranslationText();
    const config = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<BuiltinAgentChatMessage[]>([]);
    const [attachments, setAttachments] = useState<BuiltinAgentAttachment[]>([]);
    const [input, setInput] = useState("");
    const [running, setRunning] = useState(false);
    const [budget, setBudget] = useState<BuiltinCanvasBudget>(() => createBuiltinCanvasBudget());
    const [lastResult, setLastResult] = useState<BuiltinCanvasRunResult | null>(null);
    const [confirmation, setConfirmation] = useState<BuiltinAgentConfirmation | null>(null);
    const [undoSession, setUndoSession] = useState<{ before: CanvasAgentSnapshot; after: CanvasAgentSnapshot } | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const messagesRef = useRef(messages);
    const confirmationResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    const model = config.textModel.trim();
    const modelReady = Boolean(model && isAiConfigReady(config, model));
    const modelLabel = model ? modelOptionLabel(config, model) : "";
    const canUndo = Boolean(undoSession && snapshot.nodes === undoSession.after.nodes && snapshot.connections === undoSession.after.connections);

    const appendMessage = useCallback((message: BuiltinAgentChatMessage) => {
        messagesRef.current = [...messagesRef.current, message];
        setMessages(messagesRef.current);
    }, []);

    const confirmAction = useCallback((action: BuiltinCanvasAction, currentBudget: BuiltinCanvasBudget, nodes: CanvasNodeData[]) => {
        const result = new Promise<boolean>((resolve) => {
            confirmationResolveRef.current = resolve;
            setConfirmation({
                action,
                budget: currentBudget,
                request: requestBuiltinActionConfirmation(action, currentBudget, nodes),
            });
        });
        return result;
    }, []);

    const resolveConfirmation = useCallback((confirmed: boolean) => {
        const resolve = confirmationResolveRef.current;
        confirmationResolveRef.current = null;
        setConfirmation(null);
        resolve?.(confirmed);
    }, []);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        resolveConfirmation(false);
    }, [resolveConfirmation]);

    const addFiles = useCallback(
        (files: FileList | File[]) => {
            const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
            const remaining = Math.max(0, MAX_ATTACHMENTS - attachments.length);
            void Promise.all(
                images.slice(0, remaining).map(async (file): Promise<BuiltinAgentAttachment | null> => {
                    try {
                        const image = await uploadImage(file);
                        return { id: nanoid(), name: file.name, type: image.mimeType || file.type || "image/png", size: image.bytes, storageKey: image.storageKey, url: image.url, width: image.width, height: image.height };
                    } catch {
                        appendMessage({ id: nanoid(), role: "error", text: t("canvas.builtinAgent.attachmentFailed", { name: file.name }) });
                        return null;
                    }
                }),
            ).then((items) => setAttachments((current) => [...current, ...items.filter((item): item is BuiltinAgentAttachment => Boolean(item))].slice(0, MAX_ATTACHMENTS)));
        },
        [appendMessage, attachments.length, t],
    );

    const removeAttachment = useCallback((id: string) => setAttachments((current) => current.filter((item) => item.id !== id)), []);

    const clear = useCallback(() => {
        if (running) return;
        messagesRef.current = [];
        setMessages([]);
        setAttachments([]);
        setBudget(createBuiltinCanvasBudget());
        setLastResult(null);
    }, [running]);

    const undo = useCallback(() => {
        if (!canUndo || !undoSession) return;
        applyAgentSnapshot(undoSession.before);
        setUndoSession(null);
    }, [applyAgentSnapshot, canUndo, undoSession]);

    const send = useCallback(() => {
        const prompt = input.trim();
        if (!prompt || running || !modelReady) {
            if (!modelReady) openConfigDialog(false, "channels");
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        const before = snapshot;
        const materialized = new Set<string>();
        const attachmentNodeIds = new Map<string, string>();
        let workingSnapshot = before;
        let changed = false;
        let nextBudget = createBuiltinCanvasBudget();
        setRunning(true);
        setInput("");
        setLastResult(null);
        setBudget(nextBudget);
        setUndoSession(null);
        const previousMessages = [...messagesRef.current];
        appendMessage({ id: nanoid(), role: "user", text: prompt });

        const currentAttachments = [...attachments];
        void (async () => {
            try {
                const history = previousMessages
                    .filter((item) => item.role === "user" || item.role === "assistant")
                    .slice(-20)
                    .map((item): BuiltinCanvasAgentMessage => ({ role: item.role as "user" | "assistant", content: item.text }));
                const userParts = await buildUserContent(prompt, currentAttachments, controller.signal);
                const baseMessages: BuiltinCanvasAgentMessage[] = [...history, { role: "user", content: userParts }];
                const mediaExecutor: BuiltinCanvasMediaExecutor = {
                    generateImage: (action, signal) => runImageGeneration(action, signal),
                    editImage: (action, signal) => runImageEdit(action, signal, workingSnapshot),
                };

                const result = await runBuiltinCanvasAgent({
                    signal: controller.signal,
                    runTurn: async (_turnIndex, toolResults): Promise<BuiltinCanvasTurn> => {
                        const selectedNodeTypes = workingSnapshot.nodes.filter((node) => workingSnapshot.selectedNodeIds.includes(node.id)).map((node) => node.type);
                        const context = buildBuiltinCanvasContext(workingSnapshot);
                        const systemPrompt = `${buildBuiltinCanvasSkillPrompt({ userText: prompt, selectedNodeTypes })}\n\n当前画布上下文（已脱敏）：\n${JSON.stringify(context)}`;
                        const turnMessages: BuiltinCanvasAgentMessage[] = [...baseMessages];
                        for (const item of toolResults) {
                            turnMessages.push({ role: "assistant", content: "", toolCalls: [item.call] });
                            turnMessages.push({ role: "tool", toolCallId: item.call.id, name: item.call.name, content: item.result });
                        }
                        return requestBuiltinCanvasAgentTurn({ config, messages: turnMessages, systemPrompt, signal: controller.signal });
                    },
                    executeAction: async (action, signal): Promise<BuiltinCanvasActionExecution> => {
                        try {
                            if (isBuiltinCanvasReadAction(action)) {
                                const context = buildBuiltinCanvasContext(workingSnapshot);
                                const result = executeBuiltinCanvasReadAction(action, context);
                                appendMessage({ id: nanoid(), role: "tool", text: t("canvas.builtinAgent.toolRead", { name: action.name }) });
                                return { ok: true, result };
                            }
                            const effectiveAction = action.name === "edit_image" ? { ...action, args: { ...action.args, sourceNodeIds: action.args.sourceNodeIds.map((id) => attachmentNodeIds.get(id) || id) } } : action;
                            const confirmed = await confirmAction(effectiveAction, nextBudget, workingSnapshot.nodes);
                            if (!confirmed) {
                                controller.abort();
                                return { ok: false, canceled: true, error: "canceled" };
                            }
                            if (builtinActionNeedsMaterialization(action)) materializeAttachments();
                            if (isBuiltinCanvasWriteAction(effectiveAction)) {
                                const ops = actionToCanvasAgentOps(effectiveAction);
                                const addedNodeIds = applyCanvasOps(ops);
                                appendMessage({ id: nanoid(), role: "tool", text: t("canvas.builtinAgent.toolWrite", { name: effectiveAction.name }) });
                                return { ok: true, result: { applied: ops.length, addedNodeIds } };
                            }
                            if (isBuiltinCanvasMediaAction(effectiveAction)) {
                                const media = await executeBuiltinCanvasMediaAction(effectiveAction, mediaExecutor, signal);
                                appendMessage({ id: nanoid(), role: "tool", text: t("canvas.builtinAgent.toolImage", { count: media.imageUrls.length, request: media.requestId || t("canvas.builtinAgent.noRequestId") }) });
                                const addedNodeIds = applyCanvasOps(mediaResultToOps(media, effectiveAction, workingSnapshot, 0));
                                return { ok: true, result: { imageCount: media.imageUrls.length, requestId: media.requestId || null, addedNodeIds } };
                            }
                            return { ok: false, error: "unsupported-action" };
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error || "unknown-error");
                            appendMessage({ id: nanoid(), role: "error", text: t("canvas.builtinAgent.actionFailed", { name: action.name, message: actionErrorText(message, t) }) });
                            return { ok: false, error: message };
                        }
                    },
                });
                nextBudget = result.budget;
                setBudget(result.budget);
                setLastResult(result);
                if (changed) setUndoSession({ before, after: workingSnapshot });
                if (result.content) appendMessage({ id: nanoid(), role: "assistant", text: result.content, meta: result.stoppedReason });
                if (!result.content) {
                    const completed = result.stoppedReason === "completed" || result.stoppedReason === "canceled";
                    appendMessage({ id: nanoid(), role: completed ? "assistant" : "error", text: stopReasonText(result, t), meta: result.stoppedReason });
                }
            } catch (error) {
                const errorText = error instanceof Error ? error.message : t("canvas.builtinAgent.requestFailed");
                if (controller.signal.aborted) appendMessage({ id: nanoid(), role: "assistant", text: t("canvas.builtinAgent.stopped"), meta: "canceled" });
                else appendMessage({ id: nanoid(), role: "error", text: errorText });
            } finally {
                abortRef.current = null;
                setRunning(false);
            }

            function applyCanvasOps(ops: CanvasAgentOp[]) {
                if (!ops.length) return [];
                const existingIds = new Set(workingSnapshot.nodes.map((node) => node.id));
                workingSnapshot = applyAgentOps(ops, { recordUndo: false });
                changed = true;
                return workingSnapshot.nodes.filter((node) => !existingIds.has(node.id)).map((node) => node.id);
            }

            function materializeAttachments() {
                const ops: CanvasAgentOp[] = [];
                for (const attachment of currentAttachments) {
                    if (materialized.has(attachment.id)) continue;
                    const node = createCanvasNode(CanvasNodeType.Image, nextImagePosition(workingSnapshot, attachmentNodeIds.size), {
                        ...imageMetadata({ url: attachment.url, storageKey: attachment.storageKey, width: attachment.width, height: attachment.height, bytes: attachment.size, mimeType: attachment.type }),
                        prompt: attachment.name,
                    });
                    materialized.add(attachment.id);
                    attachmentNodeIds.set(attachment.id, node.id);
                    ops.push({
                        type: "add_node",
                        id: node.id,
                        nodeType: node.type,
                        title: node.title,
                        position: node.position,
                        width: node.width,
                        height: node.height,
                        metadata: node.metadata,
                    });
                }
                applyCanvasOps(ops);
            }
        })();
    }, [appendMessage, applyAgentOps, attachments, config, confirmAction, input, modelReady, openConfigDialog, running, snapshot, t]);

    return {
        open,
        toggle: () => setOpen((value) => !value),
        close: () => setOpen(false),
        messages,
        attachments,
        input,
        setInput,
        running,
        modelReady,
        modelLabel,
        budget,
        lastResult,
        confirmation,
        canUndo,
        send,
        stop,
        clear,
        undo,
        addFiles,
        removeAttachment,
        resolveConfirmation,
        openConfig: () => openConfigDialog(false, "channels"),
    };
}

function useTranslationText() {
    return useMemo(
        () => ({
            t: (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
        }),
        [],
    );
}

async function buildUserContent(prompt: string, attachments: BuiltinAgentAttachment[], signal: AbortSignal) {
    if (!attachments.length) return prompt;
    const images = await Promise.all(
        attachments.map(async (attachment) => {
            const dataUrl = await imageToDataUrl({ dataUrl: attachment.url, storageKey: attachment.storageKey });
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");
            return { type: "image_url" as const, image_url: { url: dataUrl } };
        }),
    );
    return [{ type: "text" as const, text: prompt }, ...images];
}

function nextImagePosition(snapshot: CanvasAgentSnapshot, index: number) {
    const selected = snapshot.nodes.find((node) => snapshot.selectedNodeIds.includes(node.id));
    if (selected) return { x: selected.position.x + selected.width + 96 + index * 28, y: selected.position.y + index * 28 };
    const left = (100 - snapshot.viewport.x) / Math.max(snapshot.viewport.k, 0.05);
    const top = (100 - snapshot.viewport.y) / Math.max(snapshot.viewport.k, 0.05);
    return { x: left + index * 40, y: top + index * 40 };
}

function mediaResultToOps(media: BuiltinCanvasMediaResult, action: BuiltinCanvasMediaAction, snapshot: CanvasAgentSnapshot, offset: number): CanvasAgentOp[] {
    const images = media.images || media.imageUrls.map((url) => ({ url, width: 1024, height: 1024, bytes: 0, mimeType: "image/png" }));
    return images.slice(0, MAX_AGENT_IMAGES).map((image, index) => {
        const node = createCanvasNode(CanvasNodeType.Image, nextImagePosition(snapshot, offset + index), {
            ...imageMetadata(image),
            prompt: action.args.prompt,
            generationType: action.name === "edit_image" ? "edit" : "generation",
        });
        return {
            type: "add_node",
            id: node.id,
            nodeType: node.type,
            title: node.title,
            position: node.position,
            width: node.width,
            height: node.height,
            metadata: node.metadata,
        };
    });
}

function stopReasonText(result: BuiltinCanvasRunResult, t: (key: string, options?: Record<string, unknown>) => string) {
    const key = `canvas.builtinAgent.stopReasons.${result.stoppedReason}`;
    return t(key, { defaultValue: result.stoppedReason });
}

function actionErrorText(message: string, t: (key: string, options?: Record<string, unknown>) => string) {
    return t(`canvas.builtinAgent.actionErrors.${message}`, { defaultValue: message });
}

async function runImageGeneration(action: Extract<BuiltinCanvasAction, { name: "generate_image" }>, signal: AbortSignal) {
    const config = useConfigStore.getState().config;
    const model = selectBuiltinImageModel(config, action.args.model);
    const count = Math.min(15, Math.max(1, action.args.count || 1));
    let requestId = "";
    const items = await requestGeneration({ ...config, model, count: String(count) }, action.args.prompt, {
        signal,
        onRequestId: (value) => {
            requestId = value;
        },
    });
    const images = await Promise.all(items.slice(0, MAX_AGENT_IMAGES).map((item) => uploadImage(item.dataUrl, { signal })));
    return { requestId: requestId || undefined, imageUrls: images.map((item) => item.url), images };
}

async function runImageEdit(action: Extract<BuiltinCanvasAction, { name: "edit_image" }>, signal: AbortSignal, snapshot: CanvasAgentSnapshot) {
    const config = useConfigStore.getState().config;
    const model = selectBuiltinImageModel(config, action.args.model);
    const count = Math.min(15, Math.max(1, action.args.count || 1));
    const sourceNodes = action.args.sourceNodeIds.map((id) => snapshot.nodes.find((node) => node.id === id)).filter((node): node is CanvasNodeData => Boolean(node));
    if (!sourceNodes.length) throw new Error("edit-source-required");
    const contexts = sourceNodes.map((node) => buildNodeGenerationContext(node.id, snapshot.nodes, snapshot.connections, action.args.prompt));
    const context = contexts[0];
    const references = [...new Map(contexts.flatMap((item) => item.referenceImages).map((image) => [image.id, image])).values()];
    const generationConfig = buildGenerationConfig({ ...config, model, count: String(count) }, sourceNodes[0], "image");
    let requestId = "";
    const items = await requestEdit(generationConfig, context.prompt, references, {
        signal,
        onRequestId: (value) => {
            requestId = value;
        },
    });
    const images = await Promise.all(items.slice(0, MAX_AGENT_IMAGES).map((item) => uploadImage(item.dataUrl, { signal })));
    return { requestId: requestId || undefined, imageUrls: images.map((item) => item.url), images };
}
