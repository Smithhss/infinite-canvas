import { ArrowLeft, ArrowRight, BookOpen, CheckSquare, ChevronDown, ClipboardPaste, Download, Film, FolderPlus, History, LoaderCircle, Plus, SlidersHorizontal, Sparkles, Trash2, VideoIcon, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import { App, Button, Checkbox, Drawer, Input, Modal, Popover, Tag, Tooltip, Typography } from "antd";
import localforage from "localforage";
import { nanoid } from "nanoid";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";

import { AssetPickerModal, type InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import { StudioModelPicker } from "@/components/studio-model-picker";
import { PromptSelectDialog } from "@/components/prompts/prompt-select-dialog";
import { VideoSettingsPanel, normalizeVideoResolutionValue, normalizeVideoSizeValue, videoModeLabel, videoSizeLabel } from "@/components/video-settings-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { clampVideoSeconds } from "@/lib/media-size";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { imageReferenceLabel } from "@/lib/image-reference-prompt";
import { resolveVideoCapabilities } from "@/lib/video-model-capabilities";
import { deleteStoredMedia, resolveMediaUrl } from "@/services/file-storage";
import { resolveImageUrl, ensureImagePreview, getImagePreviewRevision, previewUrlFor, subscribeImagePreviews, uploadImage } from "@/services/image-storage";
import { createVideoGenerationTask, pollVideoGenerationTask, storeGeneratedVideo, type VideoGenerationTask } from "@/services/api/video";
import { useAssetStore } from "@/stores/use-asset-store";
import { useWorkbenchAgentStore } from "@/stores/use-workbench-agent-store";
import { boolConfig, modelOptionLabel, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ReferenceImage } from "@/types/image";
import i18n from "@/i18n";

type GeneratedVideo = {
    id: string;
    url: string;
    storageKey: string;
    durationMs: number;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

type GenerationResult = {
    id: string;
    status: "pending" | "success" | "failed";
    video?: GeneratedVideo;
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
    size: string;
    resolution: string;
    seconds: string;
    status: "pending" | "success" | "failed";
    task?: VideoGenerationTask;
    video?: GeneratedVideo;
    error?: string;
};

type GenerationLogConfig = Pick<AiConfig, "model" | "videoModel" | "size" | "vquality" | "videoSeconds" | "videoGenerateAudio" | "videoWatermark" | "videoMode">;

type UpdateAiConfig = <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;

const LOG_STORE_KEY = "infinite-canvas:video_generation_logs";
const logStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function VideoPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);
    const activeLogIdsRef = useRef<Set<string>>(new Set());
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
    const [referenceDragTarget, setReferenceDragTarget] = useState(false);
    const [autoRunToken, setAutoRunToken] = useState(0);
    const videoCommand = useWorkbenchAgentStore((state) => state.videoCommand);
    const clearVideoCommand = useWorkbenchAgentStore((state) => state.clearVideoCommand);
    const updateAgentTask = useWorkbenchAgentStore((state) => state.updateTask);
    const processedCommandRef = useRef(0);
    const agentTaskIdRef = useRef<string | undefined>(undefined);

    const model = effectiveConfig.videoModel || effectiveConfig.model;
    const capabilities = resolveVideoCapabilities(effectiveConfig, model);
    const canGenerate = Boolean(prompt.trim());

    useEffect(() => {
        if (!running || !startedAt) return;
        const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 1000);
        return () => window.clearInterval(timer);
    }, [running, startedAt]);

    useEffect(() => {
        void refreshLogs();
    }, []);

    const addReferences = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        if (!capabilities.maxReferenceImages) {
            if (selectedFiles.length) message.warning(t("videoWorkbench.referencesUnsupported"));
            return;
        }
        const unsupported = selectedFiles.filter((file) => !file.type.startsWith("image/"));
        if (unsupported.length) message.warning(t("videoWorkbench.unsupportedFiles"));
        const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/")).slice(0, capabilities.maxReferenceImages - references.length);
        const nextReferences = await Promise.all(
            imageFiles.map(async (file) => {
                const image = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
            }),
        );
        setReferences((value) => [...value, ...nextReferences].slice(0, capabilities.maxReferenceImages));
    };

    const handleReferenceDragEnter = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        if (event.dataTransfer.types.includes("Files")) setReferenceDragTarget(true);
    };

    const handleReferenceDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (!dragDepthRef.current) setReferenceDragTarget(false);
    };

    const handleReferenceDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setReferenceDragTarget(false);
        void addReferences(event.dataTransfer.files);
    };

    const addReferencesFromClipboard = async () => {
        try {
            if (!capabilities.maxReferenceImages) {
                message.error(t("videoWorkbench.referencesUnsupported"));
                return;
            }
            const items = await navigator.clipboard.read();
            const blobs = await Promise.all(items.flatMap((item) => item.types.filter((type) => type.startsWith("image/")).map((type) => item.getType(type))));
            if (!blobs.length) {
                message.error(t("videoWorkbench.clipboardEmpty"));
                return;
            }
            const nextReferences = await Promise.all(
                blobs.slice(0, capabilities.maxReferenceImages - references.length).map(async (blob, index) => {
                    const image = await uploadImage(blob);
                    return { id: nanoid(), name: `clipboard-${index + 1}.png`, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
                }),
            );
            setReferences((value) => [...value, ...nextReferences].slice(0, capabilities.maxReferenceImages));
            message.success(t("videoWorkbench.clipboardAdded", { count: nextReferences.length }));
        } catch {
            message.error(t("videoWorkbench.clipboardEmpty"));
        }
    };
    const generate = async () => {
        const agentTaskId = agentTaskIdRef.current;
        agentTaskIdRef.current = undefined;
        const snapshot = buildRequestSnapshot();
        if (!snapshot) {
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", error: t("videoWorkbench.invalidParams") });
            return;
        }
        setElapsedMs(0);
        setRunning(true);
        if (agentTaskId) updateAgentTask(agentTaskId, { status: "running", error: undefined });
        setPreviewLog(null);
        setResults([{ id: nanoid(), status: "pending" }]);
        const batchStartedAt = performance.now();
        setStartedAt(batchStartedAt);
        try {
            const task = await createVideoGenerationTask(snapshot.config, snapshot.text, snapshot.references);
            const log = buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: 0, status: "pending", task });
            await saveLog(log, false);
            void pollGenerationLog(log, snapshot.config, agentTaskId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("workbench.generationFailed");
            setResults([{ id: nanoid(), status: "failed", error: errorMessage }]);
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", successCount: 0, failCount: 1, error: errorMessage });
            await saveLog(buildLog({ prompt: snapshot.text, model, config: snapshot.config, references: snapshot.references, durationMs: performance.now() - batchStartedAt, status: "failed", error: errorMessage }));
            message.error(errorMessage);
            setRunning(false);
        }
    };

    // Handle video-generation commands from the Agent panel by setting the prompt and optionally starting generation.
    useEffect(() => {
        if (!videoCommand || videoCommand.nonce === processedCommandRef.current) return;
        processedCommandRef.current = videoCommand.nonce;
        clearVideoCommand();
        if (typeof videoCommand.prompt === "string") setPrompt(videoCommand.prompt);
        if (videoCommand.run && running) {
            if (videoCommand.taskId) updateAgentTask(videoCommand.taskId, { status: "failed", error: t("videoWorkbench.busy") });
            return;
        }
        if (videoCommand.run) {
            agentTaskIdRef.current = videoCommand.taskId;
            setAutoRunToken((value) => value + 1);
        }
    }, [videoCommand, clearVideoCommand, running, updateAgentTask]);

    useEffect(() => {
        if (!autoRunToken) return;
        void generate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRunToken]);

    const buildRequestSnapshot = () => {
        const text = prompt.trim();
        if (!text) {
            message.error(t("videoWorkbench.promptRequired"));
            return null;
        }
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning(t("workbench.configFirst"));
            openConfigDialog(true);
            return null;
        }
        return { text, config: buildVideoConfig(effectiveConfig, model), references: [...references] };
    };

    const retryResult = () => {
        void generate();
    };

    const downloadVideo = (video: GeneratedVideo) => {
        saveAs(video.url, "video.mp4");
    };

    const saveResultToAssets = (video: GeneratedVideo) => {
        addAsset({
            kind: "video",
            title: t("videoWorkbench.resultTitle"),
            coverUrl: "",
            tags: [],
            source: t("videoWorkbench.source"),
            data: { url: video.url, storageKey: video.storageKey, width: video.width, height: video.height, bytes: video.bytes, mimeType: video.mimeType },
            metadata: { source: "video-page", prompt },
        });
        message.success(t("common.addedToAssets"));
    };

    const insertPickedAsset = async (payload: InsertAssetPayload) => {
        if (payload.kind === "text") {
            setPrompt(payload.content);
        } else if (payload.kind === "image") {
            const stored = await uploadImage(payload.dataUrl);
            setReferences((value) => [...value, { id: nanoid(), name: payload.title, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey }].slice(0, 7));
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
        const mediaKeys = logs
            .filter((log) => selectedLogIds.includes(log.id))
            .map((log) => log.video?.storageKey)
            .filter((key): key is string => Boolean(key));
        void Promise.all([deleteStoredMedia(mediaKeys), ...selectedLogIds.map((id) => logStore.removeItem(id))]).then(() => refreshLogs());
        if (previewLog && selectedLogIds.includes(previewLog.id)) {
            setPreviewLog(null);
            setResults([]);
        }
        setSelectedLogIds([]);
        setDeleteConfirmOpen(false);
    };

    const saveLog = async (log: GenerationLog, resumePending = true) => {
        await logStore.setItem(log.id, serializeLog(log));
        await refreshLogs(resumePending);
    };

    const refreshLogs = async (resumePending = true) => {
        const nextLogs = await readStoredLogs();
        setLogs(nextLogs);
        if (resumePending) resumePendingLogs(nextLogs);
        return nextLogs;
    };

    const resumePendingLogs = (items: GenerationLog[]) => {
        for (const log of items) {
            if (log.status === "pending" && log.task) void pollGenerationLog(log);
        }
    };

    const pollGenerationLog = async (log: GenerationLog, configOverride?: AiConfig, agentTaskId?: string) => {
        if (!log.task || activeLogIdsRef.current.has(log.id)) return;
        activeLogIdsRef.current.add(log.id);
        setRunning(true);
        setStartedAt((value) => value || performance.now());
        setResults((value) => (value.length ? value : [{ id: log.id, status: "pending" }]));
        const taskConfig = buildVideoConfig({ ...effectiveConfig, ...log.config }, log.task.model || log.model);
        try {
            for (let attempt = 0; attempt < 120; attempt += 1) {
                const state = await pollVideoGenerationTask(configOverride || taskConfig, log.task);
                if (state.status === "completed") {
                    const stored = await storeGeneratedVideo(state.result);
                    const nextVideo: GeneratedVideo = {
                        id: nanoid(),
                        url: stored.url,
                        storageKey: stored.storageKey,
                        durationMs: Date.now() - log.createdAt,
                        width: stored.width || 1280,
                        height: stored.height || 720,
                        bytes: stored.bytes,
                        mimeType: stored.mimeType,
                    };
                    setResults([{ id: nextVideo.id, status: "success", video: nextVideo }]);
                    if (agentTaskId) updateAgentTask(agentTaskId, { status: "succeeded", successCount: 1, failCount: 0, error: undefined });
                    await saveLog({ ...log, status: "success", durationMs: nextVideo.durationMs, video: nextVideo, error: undefined });
                    message.success(t("videoWorkbench.generated"));
                    return;
                }
                if (state.status === "failed") throw new Error(state.error);
                if (attempt === 119) throw new Error(t("videoWorkbench.timeout"));
                await delay(2500);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("workbench.generationFailed");
            setResults([{ id: log.id, status: "failed", error: errorMessage }]);
            if (agentTaskId) updateAgentTask(agentTaskId, { status: "failed", successCount: 0, failCount: 1, error: errorMessage });
            await saveLog({ ...log, status: "failed", durationMs: Date.now() - log.createdAt, error: errorMessage });
            message.error(errorMessage);
        } finally {
            activeLogIdsRef.current.delete(log.id);
            if (!activeLogIdsRef.current.size) {
                setRunning(false);
                setStartedAt(0);
            }
        }
    };

    const previewGenerationLog = (log: GenerationLog) => {
        setPreviewLog(log);
        setLogsOpen(false);
        setPrompt(log.prompt);
        setReferences(log.references || []);
        if (log.config.videoModel || log.model) updateConfig("videoModel", log.config.videoModel || log.model);
        if (log.config.size) updateConfig("size", log.config.size);
        if (log.config.vquality) updateConfig("vquality", log.config.vquality);
        if (log.config.videoSeconds) updateConfig("videoSeconds", log.config.videoSeconds);
        if (log.config.videoGenerateAudio) updateConfig("videoGenerateAudio", log.config.videoGenerateAudio);
        if (log.config.videoWatermark) updateConfig("videoWatermark", log.config.videoWatermark);
        if (log.config.videoMode) updateConfig("videoMode", log.config.videoMode);
        setResults(log.status === "pending" ? [{ id: log.id, status: "pending" }] : log.video ? [{ id: log.video.id, status: "success", video: log.video }] : [{ id: log.id, status: "failed", error: log.error || t("workbench.generationFailed") }]);
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
                                        {results.map((result) => (result.status === "success" && result.video ? <ResultVideoCard key={result.id} video={result.video} onDownload={downloadVideo} onSaveAsset={saveResultToAssets} /> : result.status === "failed" ? <FailedVideoCard key={result.id} error={result.error || t("workbench.generationFailed")} onRetry={retryResult} /> : <PendingVideoCard key={result.id} />))}
                                    </div>
                                </>
                            ) : (
                                <VideoStageHero model={modelOptionLabel(effectiveConfig, model)} />
                            )}
                        </div>

                        <PromptComposer
                            prompt={prompt}
                            onPromptChange={setPrompt}
                            references={references}
                            referenceDragTarget={referenceDragTarget}
                            dragDepthRef={dragDepthRef}
                            onReferenceDragEnter={handleReferenceDragEnter}
                            onReferenceDragLeave={handleReferenceDragLeave}
                            onReferenceDrop={handleReferenceDrop}
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
                            referenceLimit={capabilities.maxReferenceImages}
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
                <LogPanel logs={logs} selectedLogIds={selectedLogIds} activeLogId={previewLog?.id} onSelectedLogIdsChange={setSelectedLogIds} onCreateSession={createSession} onDeleteSelected={() => setDeleteConfirmOpen(true)} onPreviewLog={previewGenerationLog} />
            </Drawer>
            <PromptSelectDialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen} onSelect={setPrompt} />
            <AssetPickerModal open={assetPickerOpen} defaultTab="my-assets" onInsert={(payload) => void insertPickedAsset(payload)} onClose={() => setAssetPickerOpen(false)} />
            <Modal title={t("workbench.deleteLogs")} open={deleteConfirmOpen} onCancel={() => setDeleteConfirmOpen(false)} onOk={deleteSelectedLogs} okText={t("common.delete")} okButtonProps={{ danger: true }} cancelText={t("common.cancel")}>
                {t("workbench.deleteLogsConfirm", { count: selectedLogIds.length })}
            </Modal>
        </div>
    );
}

function VideoStageHero({ model }: { model: string }) {
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
                        <Film className="relative size-5 text-white/80" />
                    </div>
                ))}
            </div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400 sm:text-xs sm:tracking-[0.24em] dark:text-stone-500">{t("videoWorkbench.heroEyebrow")}</p>
            <h2 className="max-w-2xl text-balance text-2xl font-black uppercase leading-[1.02] tracking-[-0.035em] text-stone-950 min-[400px]:text-3xl sm:text-5xl dark:text-white">
                {t("videoWorkbench.heroTitle")}
                <span className="mx-auto mt-1 block max-w-full break-words text-[clamp(1.25rem,7vw,3rem)] leading-tight text-cyan-600 sm:leading-[0.98] dark:text-cyan-400">{model}</span>
            </h2>
            <p className="mt-4 max-w-lg text-pretty text-sm leading-6 text-stone-500 dark:text-stone-400">{t("videoWorkbench.heroDescription")}</p>
        </div>
    );
}

function PromptComposer({
    prompt,
    onPromptChange,
    references,
    referenceDragTarget,
    dragDepthRef,
    onReferenceDragEnter,
    onReferenceDragLeave,
    onReferenceDrop,
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
    referenceLimit,
}: {
    prompt: string;
    onPromptChange: (value: string) => void;
    references: ReferenceImage[];
    referenceDragTarget: boolean;
    dragDepthRef: { current: number };
    onReferenceDragEnter: (event: DragEvent<HTMLDivElement>) => void;
    onReferenceDragLeave: (event: DragEvent<HTMLDivElement>) => void;
    onReferenceDrop: (event: DragEvent<HTMLDivElement>) => void;
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
    referenceLimit: number;
}) {
    const { t } = useTranslation();

    return (
        <div className="mx-auto w-full max-w-4xl shrink-0">
            <div
                className={`overflow-hidden rounded-[26px] border bg-white/95 shadow-[0_24px_80px_-32px_rgba(28,25,23,0.3)] backdrop-blur-xl transition-colors dark:bg-[#121214]/95 dark:shadow-[0_30px_100px_-24px_rgba(0,0,0,0.9)] ${referenceDragTarget ? "border-cyan-500 ring-4 ring-cyan-500/10 dark:border-cyan-400" : "border-stone-200 dark:border-white/10"}`}
                onDragEnter={onReferenceDragEnter}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={onReferenceDragLeave}
                onDrop={onReferenceDrop}
            >
                <div className="flex items-start gap-2 px-4 pt-4 sm:px-5">
                    <button
                        type="button"
                        className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-600 transition hover:border-stone-300 hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/5"
                        onClick={onUpload}
                        disabled={referenceLimit === 0}
                        title={referenceLimit === 0 ? t("videoWorkbench.referencesUnsupported") : t("workbench.upload")}
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
                        placeholder={t("videoWorkbench.promptPlaceholder")}
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
                                    aria-label={t("videoWorkbench.removeImage")}
                                >
                                    <X className="size-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : referenceDragTarget ? (
                    <div className="mx-4 mb-3 rounded-xl border border-dashed border-cyan-500/50 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-300">{t("videoWorkbench.dropReferences")}</div>
                ) : null}

                <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 px-3 py-2.5 sm:px-4 dark:border-white/5">
                    <StudioModelPicker compact config={config} value={model} onChange={(value) => updateConfig("videoModel", value)} capability="video" onMissingConfig={() => openConfigDialog(false)} className="!h-9 !w-auto !min-w-0 !max-w-[13rem] !rounded-full !border-transparent !bg-stone-100 !px-2.5 !text-xs !shadow-none hover:!bg-stone-200/70 dark:!bg-white/[0.06] dark:hover:!bg-white/10" />
                    <VideoParameterPopover config={config} model={model} updateConfig={updateConfig} />
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
                <span>{videoSizeLabel(config.size)}</span>
                <span aria-hidden="true">·</span>
                <span>{normalizeVideoSeconds(config.videoSeconds)}s</span>
                <span aria-hidden="true">·</span>
                <span>{normalizeResolution(config.vquality)}p</span>
                <span aria-hidden="true">·</span>
                <VideoParameterPopover config={config} model={model} updateConfig={updateConfig} triggerClassName="transition hover:text-stone-700 dark:hover:text-stone-300" triggerContent={t("workbench.adjust")} />
            </div>
        </div>
    );
}

function VideoParameterPopover({ config, model, updateConfig, triggerClassName, triggerContent }: { config: AiConfig; model: string; updateConfig: UpdateAiConfig; triggerClassName?: string; triggerContent?: string }) {
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
                    <VideoSettingsPanel config={config} model={model} onConfigChange={(key, value) => updateConfig(key, value)} theme={theme} showTitle={false} className="space-y-4" />
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
                        <span className="tabular-nums">{videoSizeLabel(config.size)}</span>
                        <span className="hidden tabular-nums sm:inline">{normalizeVideoSeconds(config.videoSeconds)}s</span>
                        <ChevronDown className="size-3.5 opacity-50" />
                    </>
                )}
            </button>
        </Popover>
    );
}

function ResultVideoCard({ video, onDownload, onSaveAsset }: { video: GeneratedVideo; onDownload: (video: GeneratedVideo) => void; onSaveAsset: (video: GeneratedVideo) => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-background dark:border-stone-800">
            <video src={video.url} controls className="aspect-video w-full bg-black object-contain" />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-800">
                <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                    <span>
                        {video.width}x{video.height}
                    </span>
                    <span>{formatBytes(video.bytes)}</span>
                    <span>{formatDuration(video.durationMs)}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                    <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => onSaveAsset(video)}>
                        {t("common.addToAssets")}
                    </Button>
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(video)}>
                        {t("common.download")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingVideoCard() {
    const { t } = useTranslation();
    return (
        <div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <LoaderCircle className="size-6 animate-spin" />
                <span>{t("workbench.generating")}</span>
            </div>
        </div>
    );
}

function FailedVideoCard({ error, onRetry }: { error: string; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="overflow-hidden rounded-lg border border-red-200 bg-red-50 dark:border-red-950 dark:bg-red-950/20">
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-5 text-center">
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
                <h2 className="text-base font-semibold">{t("workbench.logs")}</h2>
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
                    <LogCard key={log.id} log={log} selected={selectedLogIds.includes(log.id)} active={activeLogId === log.id} onSelectedChange={(checked) => onSelectedLogIdsChange(checked ? [...selectedLogIds, log.id] : selectedLogIds.filter((id) => id !== log.id))} onClick={() => onPreviewLog(log)} />
                ))}
                {!logs.length ? <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-stone-300 text-center text-sm text-stone-500 dark:border-stone-700">{t("workbench.noLogs")}</div> : null}
            </div>
        </>
    );
}

function LogCard({ log, selected, active, onSelectedChange, onClick }: { log: GenerationLog; selected: boolean; active: boolean; onSelectedChange: (checked: boolean) => void; onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button type="button" className={`block w-full rounded-lg border p-2 text-left transition ${active ? "border-stone-900 bg-blue-50 dark:border-stone-100 dark:bg-blue-950/20" : "border-stone-200 bg-background hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900"}`} onClick={onClick}>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                <Checkbox className="mt-0.5" checked={selected} onClick={(event) => event.stopPropagation()} onChange={(event) => onSelectedChange(event.target.checked)} />
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold leading-5">{log.title}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.size}</Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.resolution}p</Tag>
                        <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none">{log.seconds}s</Tag>
                    </div>
                    {log.task?.id ? (
                        <div className="mt-1 truncate text-[11px] text-stone-500 dark:text-stone-400" title={log.task.id}>
                            {t("workbench.taskId")}: {log.task.id}
                        </div>
                    ) : null}
                    {log.task?.requestId ? (
                        <div className="mt-1 truncate text-[11px] text-stone-500 dark:text-stone-400" title={log.task.requestId}>
                            {t("workbench.requestId")}: {log.task.requestId}
                        </div>
                    ) : null}
                </div>
                <div className="grid justify-items-end gap-2">
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color={log.status === "success" ? "blue" : log.status === "pending" ? "processing" : "red"}>
                        {t(`workbench.${log.status === "success" ? "success" : log.status === "pending" ? "generating" : "failed"}`)}
                    </Tag>
                    <Tag className="m-0 flex h-6 items-center rounded-md px-1.5 text-xs leading-none" color="green">
                        {formatDuration(log.durationMs)}
                    </Tag>
                </div>
            </div>
        </button>
    );
}

async function readStoredLogs() {
    if (typeof window === "undefined") return [];
    try {
        const logs: GenerationLog[] = [];
        await logStore.iterate<GenerationLog, void>((value) => {
            logs.push(value);
        });
        return (await Promise.all(logs.map(normalizeLog))).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
        return [];
    }
}

async function normalizeLog(log: Partial<GenerationLog>): Promise<GenerationLog> {
    const video = log.video?.storageKey ? { ...log.video, url: await resolveMediaUrl(log.video.storageKey, log.video.url) } : log.video;
    const references = await Promise.all(
        (log.references || []).map(async (item) => {
            void ensureImagePreview(item.storageKey);
            return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        }),
    );
    const config = normalizeLogConfig(log);
    return {
        id: log.id || nanoid(),
        createdAt: log.createdAt || Date.now(),
        title: log.title || log.model || i18n.t("workbench.untitled"),
        prompt: log.prompt || "",
        time: log.time || new Date().toLocaleString(i18n.resolvedLanguage, { hour12: false }),
        model: log.model || config.videoModel || "",
        config,
        references,
        durationMs: log.durationMs || 0,
        size: log.size || config.size || "",
        resolution: normalizeResolution(log.resolution || config.vquality || ""),
        seconds: log.seconds || config.videoSeconds || "",
        status: log.status || "success",
        task: log.task,
        video,
        error: log.error,
    };
}

function serializeLog(log: GenerationLog): GenerationLog {
    return {
        ...log,
        references: log.references.map((item) => ({ ...item, dataUrl: item.storageKey ? "" : item.dataUrl })),
        video: log.video?.storageKey ? { ...log.video, url: "" } : log.video,
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

function normalizeLogConfig(log: Partial<GenerationLog>): GenerationLogConfig {
    return {
        model: log.config?.model || log.model || "",
        videoModel: log.config?.videoModel || log.model || "",
        size: log.config?.size || log.size || "",
        vquality: normalizeResolution(log.config?.vquality || log.resolution || ""),
        videoSeconds: log.config?.videoSeconds || log.seconds || "",
        videoGenerateAudio: log.config?.videoGenerateAudio || "true",
        videoWatermark: log.config?.videoWatermark || "false",
        videoMode: log.config?.videoMode === "reference" ? "reference" : "frames",
    };
}

function buildLog({ prompt, model, config, references, durationMs, status, task, video, error }: { prompt: string; model: string; config: AiConfig; references: ReferenceImage[]; durationMs: number; status: GenerationLog["status"]; task?: VideoGenerationTask; video?: GeneratedVideo; error?: string }): GenerationLog {
    const logConfig = {
        model: config.model,
        videoModel: config.videoModel,
        size: config.size,
        vquality: normalizeResolution(config.vquality),
        videoSeconds: config.videoSeconds,
        videoGenerateAudio: config.videoGenerateAudio,
        videoWatermark: config.videoWatermark,
        videoMode: config.videoMode === "reference" ? "reference" : "frames",
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
        size: logConfig.size,
        resolution: logConfig.vquality,
        seconds: logConfig.videoSeconds,
        status,
        task,
        video,
        error,
    };
}

function buildVideoConfig(config: AiConfig, model: string): AiConfig {
    return {
        ...config,
        model,
        videoModel: model,
        size: normalizeVideoSize(config.size),
        videoSeconds: normalizeVideoSeconds(config.videoSeconds),
        vquality: normalizeResolution(config.vquality),
        videoGenerateAudio: String(boolConfig(config.videoGenerateAudio, true)),
        videoWatermark: String(boolConfig(config.videoWatermark, false)),
        videoMode: config.videoMode === "reference" ? "reference" : "frames",
    };
}

function normalizeVideoSeconds(value: string) {
    if (String(value).trim() === "-1") return "-1";
    return clampVideoSeconds(value);
}

function normalizeVideoSize(value: string) {
    return normalizeVideoSizeValue(value);
}

function normalizeResolution(value: string) {
    return normalizeVideoResolutionValue(value);
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
