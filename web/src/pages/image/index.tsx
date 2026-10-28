import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ChevronDown, ClipboardPaste, Download, FolderPlus, History, LoaderCircle, PenLine, Plus, SlidersHorizontal, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { App, Button, Checkbox, Drawer, Image, Input, Modal, Popover, Tag, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { StudioModelPicker } from "@/components/studio-model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { AssetPickerModal, type InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import { canvasThemes } from "@/lib/canvas-theme";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { readQuickCreateDraft } from "@/lib/quick-create";
import { modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { nanoid } from "nanoid";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { deleteStoredImages, ensureImagePreview, getImagePreviewRevision, previewUrlFor, resolveImageUrl, subscribeImagePreviews, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useWorkbenchAgentStore } from "@/stores/use-workbench-agent-store";
import type { ReferenceImage } from "@/types/image";
import i18n from "@/i18n";

type GeneratedImage = {
    id: string;
    dataUrl: string;
    requestId?: string;
    storageKey?: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType?: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    image?: GeneratedImage;
    error?: string;
};

type GenerationLog = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    time: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    imageCount: number;
    size: string;
    quality: string;
    status: "success" | "failed";
    requestIds: string[];
    images: GeneratedImage[];
};

type GenerationLogConfig = Pick<AiConfig, "model" | "imageModel" | "quality" | "size" | "count">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const RESULT_ACTION_BUTTON_CLASS = "min-w-0 px-1.5 [&_.ant-btn-icon]:shrink-0 [&>span:last-child]:min-w-0 [&>span:last-child]:truncate";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

export default function ImagePage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const quickCreateQuery = searchParams.toString();
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const addAsset = useAssetStore((state) => state.addAsset);
    const [prompt, setPrompt] = useState("");
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [results, setResults] = useState<GenerationResult[]>([]);
    const [logs, setLogs] = useState<GenerationLog[]>([]);
    const [running, setRunning] = useState(false);
    const [logsOpen, setLogsOpen] = useState(false);
    const [promptDialogOpen, setPromptDialogOpen] = useState(false);
    const [assetPickerOpen, setAssetPickerOpen] = useState(false);
    const [startedAt, setStartedAt] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
    const [previewLog, setPreviewLog] = useState<GenerationLog | null>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isReferenceDragActive, setIsReferenceDragActive] = useState(false);
    const [autoRunToken, setAutoRunToken] = useState(0);
    const imageCommand = useWorkbenchAgentStore((state) => state.imageCommand);
    const clearImageCommand = useWorkbenchAgentStore((state) => state.clearImageCommand);
    const updateAgentTask = useWorkbenchAgentStore((state) => state.updateTask);
    const processedCommandRef = useRef(0);
    const agentTaskIdRef = useRef<string | undefined>(undefined);

    const model = effectiveConfig.imageModel || effectiveConfig.model;
    const canGenerate = Boolean(prompt.trim());
    const generationCount = Math.max(1, Math.min(10, Number(config.count) || 1));

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    useEffect(() => {
        const draft = readQuickCreateDraft(new URLSearchParams(quickCreateQuery));
        if (!draft || draft.mode !== "image") return;
        setPrompt(draft.prompt);
        if (draft.model) updateConfig("imageModel", draft.model);
    }, [quickCreateQuery, updateConfig]);

    const addReferences = async (files?: FileList | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => [...value, ...nextReferences]);
    };

    const addReferencesFromClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error(t("imageWorkbench.clipboardEmpty"));
                return;
            }
            const nextReferences = await Promise.all(
                blobs.map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences]);
            message.success(t("imageWorkbench.clipboardAdded", { count: nextReferences.length }));
        } catch {
            message.error(t("imageWorkbench.clipboardEmpty"));
        }
    };

    const generate = async () => {
        const agentTaskId = agentTaskIdRef.current;
        agentTaskIdRef.current = undefined;
        const text = prompt.trim();
        if (!text) {
            message.error(t("imageWorkbench.promptRequired"));
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", error: t("imageWorkbench.promptRequired") });
            return;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning(t("workbench.configFirst"));
            openConfigDialog(true);
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", error: t("imageWorkbench.configIncomplete") });
            return;
        }

        const snapshot = buildRequestSnapshot();
        if (!snapshot) {
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", error: t("imageWorkbench.invalidParams") });
            return;
        }

        setElapsedMs(0);
        setRunning(true);
        if (agentTaskId) updateAgentTask(agentTaskId, { status: "running", error: undefined });
        setPreviewLog(null);
        setResults(Array.from({ length: generationCount }, () => ({ id: nanoid(), status: "pending" })));
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);

        const tasks = Array.from({ length: generationCount }, (_, index) => runGenerationSlot(index, snapshot));

        const result = await Promise.allSettled(tasks);
        const successImages = result.filter((item): item is PromiseFulfilledResult<GeneratedImage> => item.status === "fulfilled").map((item) => item.value);
        const successCount = successImages.length;
        const failCount = generationCount - successCount;
        const failed = result.find((item): item is PromiseRejectedResult => item.status === "rejected");
        const error = failed?.reason instanceof Error ? failed.reason.message : failCount ? t("workbench.generationFailed") : undefined;
        if (agentTaskId) updateAgentTask(agentTaskId, { status: successCount ? "succeeded" : "failed", successCount, failCount, error: successCount ? undefined : error });

        try {
            saveLog(
                buildLog({
                    prompt: text,
                    model,
                    config: { ...snapshot.config, count: String(generationCount) },
                    references: snapshot.references,
                    durationMs: performance.now() - batchStartedAt,
                    successCount,
                    failCount,
                    status: successCount ? "success" : "failed",
                    images: successImages,
                }),
            );
            successCount ? message.success(t("imageWorkbench.generated")) : message.error(failed?.reason instanceof Error ? failed.reason.message : t("workbench.generationFailed"));
        } finally {
            setRunning(false);
        }
    };

    // Handle image-generation commands from the Agent panel by setting the prompt and optionally starting generation.
    useEffect(() => {
        if (!imageCommand || imageCommand.nonce === processedCommandRef.current) return;
        processedCommandRef.current = imageCommand.nonce;
        clearImageCommand();
        if (typeof imageCommand.prompt === "string") setPrompt(imageCommand.prompt);
        if (imageCommand.run && running) {
            if (imageCommand.taskId) updateAgentTask(imageCommand.taskId, { status: "failed", error: t("imageWorkbench.busy") });
            return;
        }
        if (imageCommand.run) {
            agentTaskIdRef.current = imageCommand.taskId;
            setAutoRunToken((value) => value + 1);
        }
    }, [imageCommand, clearImageCommand, running, updateAgentTask]);

    useEffect(() => {
        if (!autoRunToken) return;
        void generate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRunToken]);

    const downloadImage = (image: GeneratedImage, index: number) => {
        saveAs(image.dataUrl, `image-${index + 1}.png`);
    };

    const addResultToReferences = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        setReferences((value) => [...value, { id: nanoid(), name: `result-${index + 1}.png`, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }]);
        message.success(t("imageWorkbench.addedReference"));
    };

    const saveResultToAssets = async (image: GeneratedImage, index: number) => {
        const stored = await uploadImage(image.dataUrl);
        addAsset({
            kind: "image",
            title: t("imageWorkbench.resultTitle", { count: index + 1 }),
            coverUrl: stored.url,
            tags: [],
            source: t("imageWorkbench.source"),
            data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
            metadata: { source: "image-page", prompt },
        });
        message.success(t("common.addedToAssets"));
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }]);
        } else {
            message.warning(t("imageWorkbench.unsupportedAsset"));
        }
        setAssetPickerOpen(false);
    };

    const createSession = () => {
        setPrompt("");
        setReferences([]);
        setResults([]);
        setElapsedMs(0);
        setStartedAt(0);
        setSelectedLogIds([]);
        setPreviewLog(null);
    };

    const deleteSelectedLogs = () => {
        const imageKeys = logs.filter((log) => selectedLogIds.includes(log.id)).flatMap((log) => log.images.map((image) => image.storageKey).filter((key): key is string => Boolean(key)));
        void Promise.all([deleteStoredImages(imageKeys), ...selectedLogIds.map((id) => logStore.removeItem(id))]).then(refreshLogs);
        if (previewLog && selectedLogIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLog = (log: GenerationLog) => {
        void logStore.setItem(log.id, serializeLog(log)).then(refreshLogs);
    };

    const refreshLogs = async () => setLogs(await readStoredLogs());

    const previewGenerationLog = async (log: GenerationLog) => {
        setPreviewLog(log);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        if (log.config.imageModel || log.model) updateConfig("imageModel", log.config.imageModel || log.model);
        if (log.config.quality) updateConfig("quality", log.config.quality);
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.count) updateConfig("count", log.config.count);
        setResults(log.images.map((image) => ({ id: image.id, status: "success", image })));
    };

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error(t("imageWorkbench.promptRequired"));
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning(t("workbench.configFirst"));
            openConfigDialog(true);
            return null;
        }
        return { text, config: { ...effectiveConfig, model, count: "1" }, references: [...references] };
    };

    const runGenerationSlot = async (index: number, snapshot: { text: string; config: AiConfig; references: ReferenceImage[] }) => {
        const itemStartedAt = performance.now();
        let requestId = "";
        try {
            const options = { onRequestId: (value: string) => { requestId = value; } };
            const result = snapshot.references.length ? await requestEdit(snapshot.config, snapshot.text, snapshot.references, options) : await requestGeneration(snapshot.config, snapshot.text, options);
            const image = result[0];
            if (!image) throw new Error(t("imageWorkbench.missingResult"));
            const stored = await uploadImage(image.dataUrl);
            const nextImage: GeneratedImage = { id: image.id, dataUrl: stored.url, ...(requestId ? { requestId } : {}), ...(stored.storageKey ? { storageKey: stored.storageKey } : {}), durationMs: performance.now() - itemStartedAt, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType };
            setResults((value) => updateResultAt(value, index, { status: "success", image: nextImage }));
            return nextImage;
        } catch (error) {
            setResults((value) => updateResultAt(value, index, { status: "failed", error: error instanceof Error ? error.message : t("workbench.generationFailed") }));
            throw error;
        }
    };

    const retryResult = async (index: number) => {
        const snapshot = buildRequestSnapshot();
        if (!snapshot) return;
        setPreviewLog(null);
        setResults((value) => updateResultAt(value, index, { status: "pending", error: undefined, image: undefined }));
        const retryStartedAt = performance.now();
        try {
            const image = await runGenerationSlot(index, snapshot);
            saveLog(
                buildLog({
                    prompt: snapshot.text,
                    model,
                    config: { ...snapshot.config, count: "1" },
                    references: snapshot.references,
                    durationMs: performance.now() - retryStartedAt,
                    successCount: 1,
                    failCount: 0,
                    status: "success",
                    images: [image],
                }),
            );
            message.success(t("workbench.retrySuccess"));
        } catch {
            // runGenerationSlot has already marked the result as failed.
        }
    };

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-stone-50 text-stone-900 dark:bg-[#0b0b0c] dark:text-stone-100">
            <div className="pointer-events-none absolute inset-0 hidden dark:block" aria-hidden="true">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.07),transparent_36%),radial-gradient(circle_at_20%_90%,rgba(59,130,246,0.05),transparent_28%)]" />
                <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:48px_48px]" />
            </div>

            <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <section className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
                    <div className={`mx-auto flex min-h-full w-full max-w-[1480px] flex-col px-3 pb-6 sm:px-6 ${results.length ? "pt-3" : "pt-0"}`}>
                        <div className={`flex min-h-0 flex-1 flex-col ${results.length ? "" : "justify-center"}`}>
                            {results.length ? (
                                <>
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-semibold">{t("workbench.results")}</h2>
                                            <span className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] tabular-nums text-stone-500 dark:border-white/10 dark:text-stone-400">{results.length}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {running ? <Tag className="m-0 px-2.5 py-1">{t("workbench.waiting", { time: formatDuration(elapsedMs) })}</Tag> : null}
                                            <Button type="text" size="small" icon={<Plus className="size-4" />} onClick={createSession}>
                                                {t("workbench.new")}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 pb-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                        {results.map((result, index) =>
                                            result.status === "success" && result.image ? (
                                                <ResultImageCard key={result.id} image={result.image} index={index} onEdit={addResultToReferences} onDownload={downloadImage} onSaveAsset={saveResultToAssets} />
                                            ) : result.status === "failed" ? (
                                                <FailedImageCard key={result.id} error={result.error || t("workbench.generationFailed")} onRetry={() => retryResult(index)} />
                                            ) : (
                                                <PendingImageCard key={result.id} />
                                            ),
                                        )}
                                    </div>
                                </>
                            ) : (
                                <ImageStageHero model={modelOptionLabel(effectiveConfig, model)} />
                            )}
                        </div>

                        <PromptComposer
                            prompt={prompt}
                            onPromptChange={setPrompt}
                            references={references}
                            isReferenceDragActive={isReferenceDragActive}
                            dragDepthRef={dragDepthRef}
                            running={running}
                            canGenerate={canGenerate}
                            config={effectiveConfig}
                            model={model}
                            updateConfig={updateConfig}
                            openConfigDialog={openConfigDialog}
                            onGenerate={() => void generate()}
                            onOpenPrompts={() => setPromptDialogOpen(true)}
                            onOpenAssets={() => setAssetPickerOpen(true)}
                            onOpenHistory={() => setLogsOpen(true)}
                            onUpload={() => fileInputRef.current?.click()}
                            onClipboard={() => void addReferencesFromClipboard()}
                            onRemoveReference={(id) => setReferences((value) => value.filter((ref) => ref.id !== id))}
                            onMoveReference={(index, offset) => setReferences((value) => moveListItem(value, index, offset))}
                            onDragStateChange={setIsReferenceDragActive}
                            onAddReferences={(files) => void addReferences(files)}
                        />
                    </div>
                </section>
            </main>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addReferences(event.target.files);
                    event.target.value = "";
                }}
            />
            <Drawer title={t("workbench.logs")} placement="bottom" size="large" open={logsOpen} onClose={() => setLogsOpen(false)}>
                <LogPanel
                    logs={logs}
                    selectedLogIds={selectedLogIds}
                    activeLogId={previewLog?.id}
                    onSelectedLogIdsChange={setSelectedLogIds}
                    onCreateSession={createSession}
                    onDeleteSelected={() => setDeleteConfirmOpen(true)}
                    onPreviewLog={(log) => void previewGenerationLog(log)}
                />
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title={t("workbench.deleteLogs")} open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText={t("common.delete")} okButtonProps={{ danger: true }} cancelText={t("common.cancel")}>
                {t("workbench.deleteLogsConfirm", { count: selectedLogIds.length })}
            </Modal>
        </div>
    );
}

function ImageStageHero({ model }: { model: string }) {
    const { t } = useTranslation();
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pb-8 pt-10 text-center sm:pb-12 sm:pt-16">
            <div className="relative mb-8 flex h-32 w-full max-w-md items-center justify-center select-none sm:h-40 sm:max-w-lg">
                <div className="absolute h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-400/15" />
                {["-rotate-[14deg] -translate-x-[116px] -translate-y-2", "-rotate-[5deg] -translate-x-[40px] translate-y-3", "rotate-[5deg] translate-x-[40px] -translate-y-2", "rotate-[14deg] translate-x-[116px] translate-y-3"].map((position, index) => (
                    <div
                        key={position}
                        className={`absolute grid size-16 place-items-center overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xl transition duration-300 hover:z-20 hover:rotate-0 hover:scale-110 sm:size-20 dark:border-white/10 dark:bg-[#171719] dark:shadow-black/50 ${position}`}
                    >
                        <div className={`absolute inset-0 ${["bg-[linear-gradient(135deg,#0e7490,#164e63_48%,#111827)]", "bg-[linear-gradient(135deg,#7c3aed,#db2777_50%,#f59e0b)]", "bg-[linear-gradient(135deg,#cbd5e1,#f8fafc_45%,#64748b)]", "bg-[linear-gradient(135deg,#a16207,#eab308_45%,#fef3c7)]"][index]}`} />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.45),transparent_38%)] opacity-70" />
                        <WandSparkles className="relative size-5 text-white/80" />
                    </div>
                ))}
            </div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 sm:text-xs sm:tracking-[0.24em] dark:text-stone-500">{t("imageWorkbench.heroEyebrow")}</p>
            <h2 className="max-w-2xl text-balance text-2xl font-black uppercase leading-[1.02] tracking-[-0.035em] text-stone-950 min-[400px]:text-3xl sm:text-5xl dark:text-white">
                {t("imageWorkbench.heroTitle")}
                <span className="mx-auto mt-1 block max-w-full break-words text-[clamp(1.25rem,7vw,3rem)] leading-tight text-cyan-600 sm:leading-[0.98] dark:text-cyan-400">{model}</span>
            </h2>
            <p className="mt-4 max-w-lg text-pretty text-sm leading-6 text-stone-500 dark:text-stone-400">{t("imageWorkbench.heroDescription")}</p>
        </div>
    );
}

function PromptComposer({
    prompt,
    onPromptChange,
    references,
    isReferenceDragActive,
    dragDepthRef,
    running,
    canGenerate,
    config,
    model,
    updateConfig,
    openConfigDialog,
    onGenerate,
    onOpenPrompts,
    onOpenAssets,
    onOpenHistory,
    onUpload,
    onClipboard,
    onRemoveReference,
    onMoveReference,
    onDragStateChange,
    onAddReferences,
}: {
    prompt: string;
    onPromptChange: (value: string) => void;
    references: ReferenceImage[];
    isReferenceDragActive: boolean;
    dragDepthRef: { current: number };
    running: boolean;
    canGenerate: boolean;
    config: AiConfig;
    model: string;
    updateConfig: UpdateAiConfig;
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
    onGenerate: () => void;
    onOpenPrompts: () => void;
    onOpenAssets: () => void;
    onOpenHistory: () => void;
    onUpload: () => void;
    onClipboard: () => void;
    onRemoveReference: (id: string) => void;
    onMoveReference: (index: number, offset: number) => void;
    onDragStateChange: (active: boolean) => void;
    onAddReferences: (files: FileList) => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="mx-auto w-full max-w-4xl shrink-0">
            <div
                className={`overflow-hidden rounded-[26px] border bg-white/95 shadow-[0_24px_80px_-32px_rgba(28,25,23,0.3)] backdrop-blur-xl transition-colors dark:bg-[#121214]/95 dark:shadow-[0_30px_100px_-24px_rgba(0,0,0,0.9)] ${isReferenceDragActive ? "border-cyan-500 ring-4 ring-cyan-500/10 dark:border-cyan-400" : "border-stone-200 dark:border-white/10"}`}
                onDragEnter={(event) => {
                    event.preventDefault();
                    dragDepthRef.current += 1;
                    if (event.dataTransfer.types.includes("Files")) onDragStateChange(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                    if (!dragDepthRef.current) onDragStateChange(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    dragDepthRef.current = 0;
                    onDragStateChange(false);
                    onAddReferences(event.dataTransfer.files);
                }}
            >
                <div className="flex items-start gap-2 px-4 pt-4 sm:px-5">
                    <button
                        type="button"
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/5"
                        onClick={onUpload}
                        title={t("workbench.upload")}
                        aria-label={t("workbench.upload")}
                    >
                        <Plus className="size-4" />
                    </button>
                    <Input.TextArea
                        value={prompt}
                        onChange={(event) => onPromptChange(event.target.value)}
                        autoSize={{ minRows: 2, maxRows: 6 }}
                        variant="borderless"
                        className="!min-h-[72px] !bg-transparent !px-1 !py-1.5 !text-[15px] !leading-6 !shadow-none placeholder:!text-stone-400 dark:placeholder:!text-stone-500"
                        placeholder={t("imageWorkbench.promptPlaceholder")}
                    />
                </div>

                {references.length ? (
                    <div className="hover-scrollbar mx-4 flex gap-2 overflow-x-auto pb-3 sm:mx-5">
                        {references.map((item, index) => (
                            <div key={item.id} className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-stone-200 dark:border-white/10">
                                <img src={previewUrlFor(item.storageKey) || item.dataUrl} alt={item.name} className="size-full object-cover" />
                                <span className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">{imageReferenceLabel(index)}</span>
                                <ReferenceOrderButtons index={index} total={references.length} onMove={(offset) => onMoveReference(index, offset)} />
                                <button
                                    type="button"
                                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white opacity-0 transition group-hover:opacity-100"
                                    onClick={() => onRemoveReference(item.id)}
                                    aria-label={t("imageWorkbench.removeReference")}
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : isReferenceDragActive ? (
                    <div className="mx-4 mb-3 rounded-xl border border-dashed border-cyan-500/50 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-300">{t("imageWorkbench.dropReferences")}</div>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 px-3 py-2.5 sm:px-4 dark:border-white/5">
                    <StudioModelPicker compact config={config} value={model} onChange={(value) => updateConfig("imageModel", value)} capability="image" onMissingConfig={() => openConfigDialog(false)} className="!h-9 !w-auto !min-w-0 !max-w-[13rem] !rounded-full !border-transparent !bg-stone-100 !px-2.5 !text-xs !shadow-none hover:!bg-stone-200/70 dark:!bg-white/[0.06] dark:hover:!bg-white/10" />
                    <ImageParameterPopover config={config} updateConfig={updateConfig} />
                    <span className="mx-1 hidden h-5 w-px bg-stone-200 sm:block dark:bg-white/10" />
                    <Tooltip title={t("workbench.viewPrompts")}>
                        <button type="button" className="grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white" onClick={onOpenPrompts} aria-label={t("workbench.viewPrompts")}>
                            <BookOpen className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t("workbench.viewAssets")}>
                        <button type="button" className="grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white" onClick={onOpenAssets} aria-label={t("workbench.viewAssets")}>
                            <FolderPlus className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t("workbench.clipboard")}>
                        <button type="button" className="grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white" onClick={onClipboard} aria-label={t("workbench.clipboard")}>
                            <ClipboardPaste className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip title={t("workbench.logs")}>
                        <button type="button" className="grid size-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/5 dark:hover:text-white" onClick={onOpenHistory} aria-label={t("workbench.logs")}>
                            <History className="size-4" />
                        </button>
                    </Tooltip>
                    <Button
                        type="primary"
                        className="!ml-auto !h-10 !rounded-full !px-5 !font-semibold dark:!bg-cyan-400 dark:!text-black dark:hover:!bg-cyan-300"
                        icon={running ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        loading={running}
                        disabled={!canGenerate || running}
                        onClick={onGenerate}
                    >
                        {running ? t("workbench.generating") : t("workbench.generate")}
                    </Button>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-[11px] text-stone-400 dark:text-stone-500">
                <span>{modelOptionLabel(config, model)}</span>
                <span aria-hidden="true">·</span>
                <span>{config.size}</span>
                <span aria-hidden="true">·</span>
                <span>{t("imageWorkbench.imageCount", { count: config.count })}</span>
                <span aria-hidden="true">·</span>
                <ImageParameterPopover config={config} updateConfig={updateConfig} triggerClassName="transition hover:text-stone-700 dark:hover:text-stone-300" triggerContent={t("workbench.adjust")} />
            </div>
        </div>
    );
}

function ImageParameterPopover({ config, updateConfig, triggerClassName, triggerContent }: { config: AiConfig; updateConfig: UpdateAiConfig; triggerClassName?: string; triggerContent?: string }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [open, setOpen] = useState(false);

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger="click"
            placement="topRight"
            content={
                <div className="w-[min(360px,calc(100vw-24px))] max-h-[min(70vh,620px)] overflow-y-auto p-1">
                    <ImageSettingsPanel config={config} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" maxCount={10} />
                </div>
            }
        >
            <button
                type="button"
                className={triggerClassName || "flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/5"}
                aria-label={t("workbench.settings")}
                title={t("workbench.settings")}
            >
                {triggerContent ? (
                    <span>{triggerContent}</span>
                ) : (
                    <>
                        <SlidersHorizontal className="size-3.5 opacity-60" />
                        <span className="tabular-nums">{config.size}</span>
                        <span className="hidden tabular-nums sm:inline">{config.count}/10</span>
                        <ChevronDown className="size-3.5 opacity-50" />
                    </>
                )}
            </button>
        </Popover>
    );
}

function ResultImageCard({
    image,
    index,
    onEdit,
    onDownload,
    onSaveAsset,
}: {
    image: GeneratedImage;
    index: number;
    onEdit: (image: GeneratedImage, index: number) => void;
    onDownload: (image: GeneratedImage, index: number) => void;
    onSaveAsset: (image: GeneratedImage, index: number) => void;
}) {
    const { t } = useTranslation();
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <Image src={previewUrlFor(image.storageKey) || image.dataUrl} preview={{ src: image.dataUrl }} alt={t("imageWorkbench.resultAlt", { count: index + 1 })} className="aspect-square object-cover" />
            <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {image.width}x{image.height}
                    </span>
                    <span>{formatBytes(image.bytes)}</span>
                    <span>{formatDuration(image.durationMs)}</span>
                </div>
                <div className="grid min-w-0 grid-cols-3 gap-2">
                    <Tooltip title={t("common.addToAssets")}>
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => void onSaveAsset(image, index)}>
                            {t("common.addToAssets")}
                        </Button>
                    </Tooltip>
                    <Tooltip title={t("imageWorkbench.addReference")}>
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<PenLine className="size-3.5" />} onClick={() => void onEdit(image, index)}>
                            {t("imageWorkbench.addReference")}
                        </Button>
                    </Tooltip>
                    <Tooltip title={t("common.download")}>
                        <Button className={RESULT_ACTION_BUTTON_CLASS} size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(image, index)}>
                            {t("common.download")}
                        </Button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

function PendingImageCard() {
    const { t } = useTranslation();
    return (
        <div className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div
                className="absolute inset-0 opacity-60"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(120,113,108,0.35) 1.4px, transparent 1.6px)",
                    backgroundSize: "16px 16px",
                }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>{t("workbench.generating")}</span>
            </div>
        </div>
    );
}

function FailedImageCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="text-sm font-medium text-red-600 dark:text-red-300">{t("workbench.failed")}</div>
                <Typography.Paragraph ellipsis={{ rows: 4 }} className="!mb-0 !text-xs !text-red-500 dark:!text-red-300">
                    {error}
                </Typography.Paragraph>
            </div>
            <div className="flex justify-end border-t border-red-200 p-3 dark:border-red-950">
                <Button size="small" danger onClick={onRetry}>
                    {t("workbench.retry")}
                </Button>
            </div>
        </div>
    );
}

function updateResultAt(results: GenerationResult[], index: number, next: Partial<GenerationResult>) {
    return results.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item));
}

function LogPanel({
    logs,
    selectedLogIds,
    activeLogId,
    onSelectedLogIdsChange,
    onCreateSession,
    onDeleteSelected,
    onPreviewLog,
}: {
    logs: GenerationLog[];
    selectedLogIds: string[];
    activeLogId?: string;
    onSelectedLogIdsChange: (ids: string[]) => void;
    onCreateSession: () => void;
    onDeleteSelected: () => void;
    onPreviewLog: (log: GenerationLog) => void;
}) {
    const { t } = useTranslation();
    const allSelected = Boolean(logs.length) && selectedLogIds.length === logs.length;
    const toggleAll = () => onSelectedLogIdsChange(allSelected ? [] : logs.map((log) => log.id));

    return (
        <>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold">{t("workbench.logs")}</h2>
                </div>
                <Tag className="m-0">{logs.length}</Tag>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
                <Button size="small" icon={<Plus className="size-3.5" />} onClick={onCreateSession}>
                    {t("workbench.new")}
                </Button>
                <Button size="small" icon={<CheckSquare className="size-3.5" />} disabled={!logs.length} onClick={toggleAll}>
                    {allSelected ? t("common.cancel") : t("workbench.selectAll")}
                </Button>
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={!selectedLogIds.length} onClick={onDeleteSelected}>
                    {t("common.delete")}
                </Button>
            </div>
            <div className="space-y-3">
                {logs.map((log) => (
                    <LogCard
                        key={log.id}
                        log={log}
                        selected={selectedLogIds.includes(log.id)}
                        active={activeLogId === log.id}
                        onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))}
                        onClick={() => onPreviewLog(log)}
                    />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">{t("workbench.noLogs")}</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const { t } = useTranslation();
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const thumbnails = log.images.filter((image) => image.dataUrl).slice(0, 4);

    return (
        <button
            type="button"
            className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`}
            onClick={onClick}
        >
            <div className="grid grid-cols-[minmax(128px,1fr)_auto] gap-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                    <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                        {thumbnails.length ? (
                            <div className="mt-2 flex gap-1 overflow-hidden">
                                {thumbnails.map((image) => (
                                    <img key={image.id} src={previewUrlFor(image.storageKey) || image.dataUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                                ))}
                            </div>
                        ) : null}
                        {log.requestIds?.length ? (
                            <div className="mt-1 truncate text-[11px] text-stone-500 dark:text-stone-400" title={log.requestIds.join(", ")}>
                                {t("workbench.requestId")}: {log.requestIds.join(", ")}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="grid justify-items-end gap-2">
                    <div className="flex gap-1">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="blue">
                            {t("workbench.successCount", { count: log.successCount ?? log.imageCount })}
                        </Tag>
                        {log.failCount ? (
                            <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="red">
                                {t("workbench.failCount", { count: log.failCount })}
                            </Tag>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{t("workbench.itemCount", { count: log.imageCount })}</Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                            {formatDuration(log.durationMs)}
                        </Tag>
                    </div>
                    <div className="flex justify-end">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.time}</Tag>
                    </div>
                </div>
            </div>
        </button>
    );
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const values: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            values.push(value);
        });
        const logs = await Promise.all(values.map(normalizeLog));
        return logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const references = await Promise.all(
        (log.references || []).map(async (item) => {
            void ensureImagePreview(item.storageKey);
            return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        }),
    );
    const images = await Promise.all(
        (log.images || []).map(async (item) => {
            void ensureImagePreview(item.storageKey);
            return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        }),
    );
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || i18n.t("workbench.untitled"),
        prompt: log.prompt || log.title || "",
        time: log.time || new Date().toLocaleString(i18n.resolvedLanguage, { hour12: false }),
        model: log.model || config.imageModel || "",
        config,
        references,
        durationMs: log.durationMs || 0,
        successCount: log.successCount ?? log.imageCount ?? 0,
        failCount: log.failCount || 0,
        imageCount: log.imageCount || log.successCount || 0,
        size: log.size || config.size || "",
        quality: log.quality || config.quality || "",
        status: log.status || "success",
        requestIds: Array.isArray(log.requestIds) ? log.requestIds : [],
        images,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        images: log.images.map((image) => ({ ...image, dataUrl: image.storageKey ? "" : image.dataUrl })),
    };
}

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        imageModel: log.config?.imageModel || log.model || "",
        quality: log.config?.quality || log.quality || "",
        size: log.config?.size || log.size || "",
        count: log.config?.count || String(log.imageCount || log.successCount || 1),
    };
}

function moveListItem<T>(items: T[], index: number, offset: number) {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
}

function ReferenceOrderButtons({ index, total, onMove }: { index: number; total: number; onMove: (offset: number) => void }) {
    if (total <= 1) return null;
    return (
        <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowLeft className="size-3" />} disabled={index <= 0} onClick={() => onMove(-1)} />
            <Button size="small" className="!h-6 !w-6 !min-w-6 !rounded-full !bg-white/85 !p-0 !shadow-sm" icon={<ArrowRight className="size-3" />} disabled={index >= total - 1} onClick={() => onMove(1)} />
        </div>
    );
}

function buildLog({
    prompt,
    model,
    config,
    references,
    durationMs,
    successCount,
    failCount,
    status,
    images,
}: {
    prompt: string;
    model: string;
    config: GenerationLogConfig;
    references: ReferenceImage[];
    durationMs: number;
    successCount: number;
    failCount: number;
    status: GenerationLog["status"];
    images: GeneratedImage[];
}): GenerationLog {
    const logConfig = {
        model: config.model,
        imageModel: config.imageModel,
        quality: config.quality,
        size: config.size,
        count: config.count,
    };
    return {
        id: nanoid(),
        createdAt: Date.now(),
        title: prompt.slice(0, 12) || i18n.t("workbench.untitled"),
        prompt,
        time: new Date().toLocaleString(i18n.resolvedLanguage, { hour12: false }),
        model,
        config: logConfig,
        references,
        durationMs,
        successCount,
        failCount,
        imageCount: Number(logConfig.count) || successCount,
        size: logConfig.size,
        quality: logConfig.quality,
        status,
        requestIds: images.flatMap((image) => (image.requestId ? [image.requestId] : [])),
        images,
    };
}
