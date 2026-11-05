import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Modal, Progress, Tooltip } from "antd";
import { ChevronDown, ChevronUp, Scissors, Trash2, Upload, Video } from "lucide-react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";

import { formatSmartCutTime, moveSmartCutClip, normalizeSmartCutClips, smartCutDurationMs, SMART_CUT_MAX_CLIPS, SMART_CUT_MIN_CLIP_MS, type SmartCutClip } from "@/lib/canvas/canvas-smart-cut";
import { probeSmartCutVideoDuration, renderSmartCutVideo, type SmartCutRenderResult } from "@/lib/canvas/canvas-smart-cut-render";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

export type SmartCutSourceVideo = {
    id: string;
    title: string;
    src: string;
    durationMs?: number;
};

type DialogClip = SmartCutClip & {
    enabled: boolean;
    local: boolean;
};

export function CanvasSmartCutDialog({ open, videos, onClose, onApply }: { open: boolean; videos: SmartCutSourceVideo[]; onClose: () => void; onApply: (result: SmartCutRenderResult, sourceNodeIds: string[]) => Promise<void> }) {
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const [clips, setClips] = useState<DialogClip[]>([]);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");
    const abortRef = useRef<AbortController | null>(null);
    const localUrlsRef = useRef(new Set<string>());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const signature = videos.map((video) => `${video.id}:${video.src}:${video.durationMs || 0}`).join("|");

    useEffect(() => {
        if (!open) return;
        let canceled = false;
        const initial = videos.map((video) => toDialogClip(video));
        setClips(initial);
        setError("");
        setProgress(0);
        void Promise.all(
            initial.map(async (clip) => {
                if (clip.durationMs >= SMART_CUT_MIN_CLIP_MS) return clip;
                const durationMs = await probeSmartCutVideoDuration(clip.src);
                return { ...clip, durationMs, endMs: durationMs };
            }),
        ).then((next) => {
            if (!canceled) setClips(next);
        });
        return () => {
            canceled = true;
        };
    }, [open, signature]);

    useEffect(() => {
        if (open) return;
        releaseLocalUrls(localUrlsRef.current);
    }, [open]);

    const activeClips = useMemo(() => clips.filter((clip) => clip.enabled), [clips]);
    const normalizedActiveClips = useMemo(() => normalizeSmartCutClips(activeClips), [activeClips]);
    const totalMs = useMemo(() => smartCutDurationMs(activeClips), [activeClips]);
    const canGenerate = !generating && normalizedActiveClips.length > 0 && normalizedActiveClips.length === activeClips.length;

    const close = () => {
        abortRef.current?.abort();
        onClose();
    };

    const updateClip = (id: string, patch: Partial<DialogClip>) => {
        setClips((current) =>
            current.map((clip) => {
                if (clip.id !== id) return clip;
                const next = { ...clip, ...patch };
                const durationMs = Math.max(SMART_CUT_MIN_CLIP_MS, Math.round(next.durationMs));
                const endMs = clamp(Math.round(next.endMs), SMART_CUT_MIN_CLIP_MS, durationMs);
                const startMs = clamp(Math.round(next.startMs), 0, Math.max(0, endMs - SMART_CUT_MIN_CLIP_MS));
                return { ...next, durationMs, startMs, endMs };
            }),
        );
    };

    const removeClip = (id: string) => {
        setClips((current) => {
            const removing = current.find((clip) => clip.id === id);
            if (removing?.local) {
                URL.revokeObjectURL(removing.src);
                localUrlsRef.current.delete(removing.src);
            }
            return current.filter((clip) => clip.id !== id);
        });
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setError("");
        const room = Math.max(0, SMART_CUT_MAX_CLIPS - clips.length);
        const selected = Array.from(files)
            .filter((file) => file.type.startsWith("video/"))
            .slice(0, room);
        const next = await Promise.all(
            selected.map(async (file) => {
                const src = URL.createObjectURL(file);
                localUrlsRef.current.add(src);
                const durationMs = await probeSmartCutVideoDuration(src);
                return { id: `local-${nanoid()}`, title: file.name, src, durationMs, startMs: 0, endMs: durationMs, enabled: true, local: true };
            }),
        );
        setClips((current) => [...current, ...next.filter((clip) => clip.durationMs >= SMART_CUT_MIN_CLIP_MS)].slice(0, SMART_CUT_MAX_CLIPS));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const generate = async () => {
        if (!canGenerate) return;
        const controller = new AbortController();
        abortRef.current = controller;
        setGenerating(true);
        setProgress(0);
        setError("");
        try {
            const result = await renderSmartCutVideo({
                clips: normalizedActiveClips,
                signal: controller.signal,
                onProgress: setProgress,
            });
            const sourceNodeIds = normalizedActiveClips.flatMap((clip) => (clip.sourceId ? [clip.sourceId] : []));
            await onApply(result, Array.from(new Set(sourceNodeIds)));
            releaseLocalUrls(localUrlsRef.current);
        } catch (reason) {
            if (reason instanceof DOMException && reason.name === "AbortError") return;
            setError(t(`canvas.smartCut.errors.${errorKey(reason)}`));
        } finally {
            abortRef.current = null;
            setGenerating(false);
        }
    };

    return (
        <Modal open={open} width={900} centered destroyOnClose footer={null} maskClosable={!generating} closable={!generating} title={null} onCancel={close}>
            <div className="space-y-4" style={{ color: theme.node.text }}>
                <div className="pr-8">
                    <div className="flex items-center gap-2">
                        <span className="grid size-9 place-items-center rounded-xl" style={{ background: `${theme.toolbar.activeText}14`, color: theme.toolbar.activeText }}>
                            <Scissors className="size-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold">{t("canvas.smartCut.title")}</h2>
                            <p className="mt-0.5 text-xs" style={{ color: theme.node.muted }}>
                                {t("canvas.smartCut.description")}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="thin-scrollbar max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {clips.map((clip, index) => (
                        <SmartCutClipRow
                            key={clip.id}
                            clip={clip}
                            index={index}
                            total={clips.length}
                            theme={theme}
                            onUpdate={(patch) => updateClip(clip.id, patch)}
                            onMove={(delta) => setClips((current) => moveSmartCutClip(current, index, delta) as DialogClip[])}
                            onRemove={() => removeClip(clip.id)}
                        />
                    ))}
                    {!clips.length ? (
                        <button
                            type="button"
                            className="flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center transition hover:opacity-80"
                            style={{ borderColor: theme.node.stroke, background: theme.node.fill, color: theme.node.text }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className="grid size-12 place-items-center rounded-2xl" style={{ background: theme.toolbar.itemHover }}>
                                <Video className="size-5" />
                            </span>
                            <span className="mt-3 text-sm font-medium">{t("canvas.smartCut.empty")}</span>
                            <span className="mt-1 text-xs" style={{ color: theme.node.muted }}>
                                {t("canvas.smartCut.emptyHint")}
                            </span>
                        </button>
                    ) : null}
                </div>

                {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-500">{error}</p> : null}
                {generating ? <Progress percent={Math.round(progress * 100)} size="small" strokeColor={theme.toolbar.activeText} /> : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: theme.node.muted }}>
                        <Button type="text" icon={<Upload className="size-4" />} disabled={generating || clips.length >= SMART_CUT_MAX_CLIPS} onClick={() => fileInputRef.current?.click()}>
                            {t("canvas.smartCut.addVideo")}
                        </Button>
                        <span>{t(activeClips.length === 1 ? "canvas.smartCut.summaryOne" : "canvas.smartCut.summary", { count: activeClips.length, duration: formatSmartCutTime(totalMs) })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button disabled={generating} onClick={close}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="primary" disabled={!canGenerate} loading={generating} icon={<Scissors className="size-4" />} onClick={() => void generate()}>
                            {t("canvas.smartCut.generate")}
                        </Button>
                    </div>
                </div>
                <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
            </div>
        </Modal>
    );
}

function SmartCutClipRow({
    clip,
    index,
    total,
    theme,
    onUpdate,
    onMove,
    onRemove,
}: {
    clip: DialogClip;
    index: number;
    total: number;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onUpdate: (patch: Partial<DialogClip>) => void;
    onMove: (delta: -1 | 1) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl border p-3" style={{ borderColor: theme.node.stroke, background: theme.node.fill }}>
            <div className="flex gap-3">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-black sm:h-20 sm:w-32">
                    <video src={clip.src} muted playsInline preload="metadata" className="size-full object-contain" />
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{formatSmartCutTime(clip.endMs - clip.startMs)}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Checkbox checked={clip.enabled} onChange={(event) => onUpdate({ enabled: event.target.checked })} aria-label={t("canvas.smartCut.include", { title: clip.title })} />
                        <span className="min-w-[7rem] flex-1 truncate text-sm font-medium">{clip.title}</span>
                        <div className="ml-auto flex shrink-0 items-center">
                            <Tooltip title={t("canvas.smartCut.moveUp")}>
                                <Button type="text" size="small" className="!h-8 !w-8 !min-w-8" disabled={index === 0} icon={<ChevronUp className="size-4" />} onClick={() => onMove(-1)} aria-label={t("canvas.smartCut.moveUp")} />
                            </Tooltip>
                            <Tooltip title={t("canvas.smartCut.moveDown")}>
                                <Button type="text" size="small" className="!h-8 !w-8 !min-w-8" disabled={index === total - 1} icon={<ChevronDown className="size-4" />} onClick={() => onMove(1)} aria-label={t("canvas.smartCut.moveDown")} />
                            </Tooltip>
                            <Tooltip title={t("canvas.smartCut.remove")}>
                                <Button type="text" danger size="small" className="!h-8 !w-8 !min-w-8" icon={<Trash2 className="size-4" />} onClick={onRemove} aria-label={t("canvas.smartCut.remove")} />
                            </Tooltip>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <TrimField label={t("canvas.smartCut.start")} value={clip.startMs} min={0} max={Math.max(0, clip.endMs - SMART_CUT_MIN_CLIP_MS)} onChange={(startMs) => onUpdate({ startMs })} theme={theme} />
                        <TrimField label={t("canvas.smartCut.end")} value={clip.endMs} min={Math.min(clip.durationMs, clip.startMs + SMART_CUT_MIN_CLIP_MS)} max={clip.durationMs} onChange={(endMs) => onUpdate({ endMs })} theme={theme} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function TrimField({ label, value, min, max, onChange, theme }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; theme: (typeof canvasThemes)[keyof typeof canvasThemes] }) {
    return (
        <label className="block text-[11px]" style={{ color: theme.node.muted }}>
            <span className="mb-1 flex items-center justify-between">
                {label}
                <span className="tabular-nums">{formatSmartCutTime(value)}</span>
            </span>
            <input type="range" min={min} max={Math.max(min, max)} step={100} value={value} className="h-2 w-full cursor-pointer accent-cyan-500" onChange={(event) => onChange(Number(event.target.value))} />
        </label>
    );
}

function toDialogClip(video: SmartCutSourceVideo): DialogClip {
    const durationMs = Math.max(0, video.durationMs || 0);
    return { id: `source-${video.id}`, sourceId: video.id, title: video.title, src: video.src, durationMs, startMs: 0, endMs: durationMs, enabled: true, local: false };
}

function releaseLocalUrls(urls: Set<string>) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
}

function errorKey(reason: unknown) {
    const message = reason instanceof Error ? reason.message : "";
    if (message.includes("unsupported")) return "unsupported";
    if (message.includes("load")) return "loadFailed";
    if (message.includes("playback")) return "playbackFailed";
    if (message.includes("recorder")) return "recorderFailed";
    return "generateFailed";
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
