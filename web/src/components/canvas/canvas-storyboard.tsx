import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Empty, Input, Modal, Select } from "antd";
import { Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Image as ImageIcon, LocateFixed, MousePointer2, Music2, Play, Search, Type, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useStoryboardTransferActions } from "@/hooks/use-storyboard-transfer-actions";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { buildStoryboardProjection, filterStoryboardItems, type StoryboardGeneration, type StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { readAppStorageItem, writeAppStorageItem } from "@/lib/storage-namespace";
import { cn } from "@/lib/utils";
import { ensureVideoPoster, getVideoPosterRevision, subscribeVideoPosters, videoPosterUrlFor } from "@/services/file-storage";
import { ensureImagePreview, getImagePreviewRevision, previewUrlFor, subscribeImagePreviews } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasGenerationReference, CanvasNodeData, CanvasNodeStatus, CanvasStoryboardCategory } from "@/types/canvas";

type ModuleKey = "text" | "image" | "video";
type StatusFilter = CanvasNodeStatus | "all";

type Props = {
    projectId: string;
    nodes: CanvasNodeData[];
    onLocateNode: (nodeId: string) => void;
    onSelectNodesInCanvas: (nodeIds: string[]) => void;
    onUpdateNodeCategory: (nodeId: string, category: CanvasStoryboardCategory) => boolean;
};

const COLLAPSED_KEY_PREFIX = "canvas-storyboard-collapsed:";
const LAYOUT_KEY_PREFIX = "canvas-storyboard-layout:";
const TEXT_PANEL_MIN_WIDTH = 148;
const TEXT_PANEL_MAX_WIDTH = 320;
const TEXT_PANEL_COLLAPSED_WIDTH = 56;
const DEFAULT_LAYOUT = { textRatio: 0.42, imageRatio: 0.5 };

type StoryboardLayout = typeof DEFAULT_LAYOUT;

function readCollapsed(projectId: string): Record<ModuleKey, boolean> {
    try {
        const saved = JSON.parse(readAppStorageItem(`${COLLAPSED_KEY_PREFIX}${projectId}`) || "{}") as Partial<Record<ModuleKey, boolean>>;
        return { text: Boolean(saved.text), image: Boolean(saved.image), video: Boolean(saved.video) };
    } catch {
        return { text: false, image: false, video: false };
    }
}

function savedRatio(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(0.85, Math.max(0.1, value)) : fallback;
}

function readLayout(projectId: string): StoryboardLayout {
    try {
        const saved = JSON.parse(readAppStorageItem(`${LAYOUT_KEY_PREFIX}${projectId}`) || "{}") as Partial<StoryboardLayout>;
        return {
            textRatio: savedRatio(saved.textRatio, DEFAULT_LAYOUT.textRatio),
            imageRatio: savedRatio(saved.imageRatio, DEFAULT_LAYOUT.imageRatio),
        };
    } catch {
        return DEFAULT_LAYOUT;
    }
}

function saveLayout(projectId: string, layout: StoryboardLayout) {
    try {
        writeAppStorageItem(`${LAYOUT_KEY_PREFIX}${projectId}`, JSON.stringify(layout));
    } catch {
        // Layout persistence must not block resizing.
    }
}

function mediaUrl(item: StoryboardItem) {
    return previewUrlFor(item.storageKey) || item.content || "";
}

function formatDuration(durationMs: number | undefined) {
    if (!durationMs) return "";
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes ? `${minutes}:` : ""}${String(seconds % 60).padStart(2, "0")}`;
}

function itemMeta(item: StoryboardItem) {
    if (item.kind === "image" && item.width && item.height) return `${item.width} × ${item.height}`;
    if (item.kind === "video") return [formatDuration(item.durationMs), item.width && item.height ? `${item.width} × ${item.height}` : ""].filter(Boolean).join(" · ");
    return item.model || "";
}

export function CanvasStoryboard({ projectId, nodes, onLocateNode, onSelectNodesInCanvas, onUpdateNodeCategory }: Props) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { addToAgent, addingToAgent, exportItems, exporting } = useStoryboardTransferActions(nodes);
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    useSyncExternalStore(subscribeVideoPosters, getVideoPosterRevision);
    const projection = useMemo(() => buildStoryboardProjection(nodes), [nodes]);
    const [keyword, setKeyword] = useState("");
    const [collapsed, setCollapsed] = useState(() => readCollapsed(projectId));
    const [layout, setLayout] = useState(() => readLayout(projectId));
    const [filters, setFilters] = useState<Record<ModuleKey, StatusFilter>>({ text: "all", image: "all", video: "all" });
    const [detail, setDetail] = useState<StoryboardItem | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [resizing, setResizing] = useState<"text" | "media" | null>(null);
    const layoutRef = useRef(layout);
    const layoutAreaRef = useRef<HTMLDivElement>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        try {
            writeAppStorageItem(`${COLLAPSED_KEY_PREFIX}${projectId}`, JSON.stringify(collapsed));
        } catch {
            // Collapsed state is a convenience; keep the panel usable if storage is full.
        }
    }, [collapsed, projectId]);
    useEffect(() => () => dragCleanupRef.current?.(), []);

    const items = useMemo(
        () => ({
            text: filterStoryboardItems(projection.text, keyword, filters.text),
            image: filterStoryboardItems(projection.image, keyword, filters.image),
            video: filterStoryboardItems(projection.video, keyword, filters.video),
        }),
        [filters, keyword, projection],
    );
    useEffect(() => {
        items.video.forEach((item) => {
            if (item.storageKey) void ensureVideoPoster(item.storageKey);
        });
    }, [items.video]);
    const total = items.text.length + items.image.length + items.video.length;
    const allTotal = projection.text.length + projection.image.length + projection.video.length;
    const visibleItems = useMemo(() => [...items.text, ...items.image, ...items.video], [items]);
    const selectedItems = useMemo(() => visibleItems.filter((item) => selectedItemIds.has(item.id)), [selectedItemIds, visibleItems]);
    const selectedNodeIds = useMemo(() => [...new Set(selectedItems.map((item) => item.nodeId))], [selectedItems]);
    const detailId = detail?.id;
    const detailIndex = detail ? visibleItems.findIndex((item) => item.id === detail.id) : -1;

    useEffect(() => {
        if (!detailId) return;
        const next = visibleItems.find((item) => item.id === detailId);
        if (!next) {
            setDetail(null);
            return;
        }
        setDetail((current) => (current?.id === next.id ? next : current));
    }, [detailId, visibleItems]);

    const locate = (item: StoryboardItem) => {
        setDetail(null);
        onLocateNode(item.nodeId);
    };
    const navigateDetail = (offset: number) => {
        const next = visibleItems[detailIndex + offset];
        if (next) setDetail(next);
    };
    const toggleSelected = (itemId: string) => {
        setSelectedItemIds((current) => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };
    const updateLayout = (next: StoryboardLayout) => {
        layoutRef.current = next;
        setLayout(next);
    };
    const finishResize = (next: StoryboardLayout) => {
        saveLayout(projectId, next);
        setResizing(null);
    };
    const startTextResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragCleanupRef.current?.();
        const areaWidth = layoutAreaRef.current?.getBoundingClientRect().width;
        const panelWidth = event.currentTarget.parentElement?.getBoundingClientRect().width;
        if (!areaWidth || !panelWidth) return;
        const startX = event.clientX;
        let next = layoutRef.current;
        const onMove = (moveEvent: PointerEvent) => {
            const width = Math.min(TEXT_PANEL_MAX_WIDTH, Math.max(TEXT_PANEL_MIN_WIDTH, panelWidth + moveEvent.clientX - startX));
            next = { ...layoutRef.current, textRatio: width / areaWidth };
            updateLayout(next);
        };
        const cleanup = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            dragCleanupRef.current = null;
            setResizing(null);
        };
        const onUp = () => {
            finishResize(next);
            cleanup();
        };
        dragCleanupRef.current = cleanup;
        setResizing("text");
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };
    const startMediaResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        dragCleanupRef.current?.();
        const areaHeight = event.currentTarget.parentElement?.getBoundingClientRect().height;
        if (!areaHeight) return;
        const startY = event.clientY;
        const startHeight = areaHeight * layoutRef.current.imageRatio;
        const minHeight = 112;
        const maxHeight = Math.max(minHeight, areaHeight - 112);
        let next = layoutRef.current;
        const onMove = (moveEvent: PointerEvent) => {
            const height = Math.min(maxHeight, Math.max(minHeight, startHeight + moveEvent.clientY - startY));
            next = { ...layoutRef.current, imageRatio: height / areaHeight };
            updateLayout(next);
        };
        const cleanup = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            dragCleanupRef.current = null;
            setResizing(null);
        };
        const onUp = () => {
            finishResize(next);
            cleanup();
        };
        dragCleanupRef.current = cleanup;
        setResizing("media");
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    };
    const resizeTextBy = (delta: number) => {
        const areaWidth = layoutAreaRef.current?.getBoundingClientRect().width;
        if (!areaWidth) return;
        const width = Math.min(TEXT_PANEL_MAX_WIDTH, Math.max(TEXT_PANEL_MIN_WIDTH, layoutRef.current.textRatio * areaWidth + delta));
        const next = { ...layoutRef.current, textRatio: width / areaWidth };
        updateLayout(next);
        saveLayout(projectId, next);
    };
    const resizeMediaBy = (delta: number) => {
        const areaHeight = layoutAreaRef.current?.getBoundingClientRect().height;
        if (!areaHeight) return;
        const maxHeight = Math.max(112, areaHeight - 112);
        const height = Math.min(maxHeight, Math.max(112, layoutRef.current.imageRatio * areaHeight + delta));
        const next = { ...layoutRef.current, imageRatio: height / areaHeight };
        updateLayout(next);
        saveLayout(projectId, next);
    };
    const onTextResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        resizeTextBy(event.key === "ArrowRight" ? 16 : -16);
    };
    const onMediaResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        resizeMediaBy(event.key === "ArrowDown" ? 16 : -16);
    };

    return (
        <div className="absolute inset-0 flex min-h-0 flex-col pt-12" style={{ background: theme.node.panel, color: theme.node.text }}>
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 sm:px-4" style={{ background: theme.toolbar.floating, borderColor: theme.toolbar.border }}>
                <Input
                    allowClear
                    size="small"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    prefix={<Search className="size-3.5" style={{ color: theme.node.muted }} />}
                    placeholder={t("canvas.storyboard.search")}
                    className="min-w-0 max-w-md flex-1 sm:flex-none"
                    aria-label={t("canvas.storyboard.search")}
                />
                {keyword.trim() ? (
                    <span className="shrink-0 text-[11px] tabular-nums" style={{ color: theme.node.muted }} aria-live="polite">
                        {t("canvas.storyboard.matches", { count: total, total: allTotal })}
                    </span>
                ) : null}
                {selectedItems.length ? (
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                        <span className="hidden text-xs tabular-nums sm:inline" style={{ color: theme.node.muted }}>
                            {t("canvas.storyboard.selected", { count: selectedItems.length })}
                        </span>
                        <button type="button" className="rounded-md px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.muted }} onClick={() => setSelectedItemIds(new Set(visibleItems.map((item) => item.id)))}>
                            {t("canvas.storyboard.selectAll")}
                        </button>
                        <button type="button" className="rounded-md px-2 py-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.muted }} onClick={() => setSelectedItemIds(new Set())}>
                            {t("canvas.storyboard.clearSelection")}
                        </button>
                        <button
                            type="button"
                            className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-xs transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:min-w-0 dark:hover:bg-white/10"
                            style={{ color: theme.node.muted }}
                            onClick={() => void exportItems(selectedItems)}
                            disabled={exporting}
                            aria-label={t("canvas.storyboard.exportSelection")}
                        >
                            <Download className="size-3.5" />
                            <span className="hidden sm:inline">{t("canvas.storyboard.exportSelection")}</span>
                        </button>
                        <button
                            type="button"
                            className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-xs transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:min-w-0 dark:hover:bg-white/10"
                            style={{ color: theme.node.muted }}
                            onClick={() => void addToAgent(selectedItems)}
                            disabled={addingToAgent}
                            aria-label={t("canvas.storyboard.addToAgent")}
                        >
                            <Bot className="size-3.5" />
                            <span className="hidden sm:inline">{t("canvas.storyboard.addToAgent")}</span>
                        </button>
                        <button
                            type="button"
                            className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium sm:h-7 sm:min-w-0"
                            style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}
                            onClick={() => onSelectNodesInCanvas(selectedNodeIds)}
                            aria-label={t("canvas.storyboard.processSelection")}
                        >
                            <MousePointer2 className="size-3.5" />
                            <span className="hidden sm:inline">{t("canvas.storyboard.processSelection")}</span>
                        </button>
                    </div>
                ) : keyword.trim() ? null : (
                    <span className="ml-auto shrink-0 text-xs tabular-nums" style={{ color: theme.node.muted }}>
                        {t("canvas.storyboard.total", { count: total })}
                    </span>
                )}
            </div>

            <div ref={layoutAreaRef} className="flex min-h-0 flex-1 overflow-hidden" style={{ background: theme.toolbar.border }}>
                <StoryboardModule
                    title={t("canvas.storyboard.modules.text")}
                    icon={<Type className="size-4" />}
                    count={items.text.length}
                    collapsed={collapsed.text}
                    onToggle={() => setCollapsed((value) => ({ ...value, text: !value.text }))}
                    filter={filters.text}
                    onFilter={(filter) => setFilters((value) => ({ ...value, text: filter }))}
                    theme={theme}
                    className="h-full shrink-0"
                    panelStyle={{ width: collapsed.text ? `${TEXT_PANEL_COLLAPSED_WIDTH}px` : `clamp(${TEXT_PANEL_MIN_WIDTH}px, ${layout.textRatio * 100}%, ${TEXT_PANEL_MAX_WIDTH}px)` }}
                    resizeHandle={
                        collapsed.text ? null : (
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 z-30 w-4 cursor-col-resize touch-none"
                                onPointerDown={startTextResize}
                                onKeyDown={onTextResizeKeyDown}
                                aria-label={t("canvas.storyboard.resizeText")}
                                data-canvas-shortcuts-ignore
                            >
                                <span className="absolute inset-y-0 right-0 w-px transition-colors" style={{ background: resizing === "text" ? theme.node.activeStroke : theme.toolbar.border }} />
                            </button>
                        )
                    }
                >
                    {items.text.length ? (
                        <div className="space-y-1.5 p-2">
                            {items.text.map((item) => (
                                <div key={item.id} className="relative">
                                    <button type="button" onClick={() => setDetail(item)} className="group block w-full rounded-md px-2 py-1.5 pr-8 text-left transition hover:bg-black/5 dark:hover:bg-white/5" style={{ background: theme.toolbar.panel }}>
                                        <ItemHeading item={item} theme={theme} />
                                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-4" style={{ color: theme.node.muted }}>
                                            {item.content || item.prompt || t("canvas.storyboard.emptyText")}
                                        </p>
                                    </button>
                                    <SelectionToggle checked={selectedItemIds.has(item.id)} theme={theme} onClick={() => toggleSelected(item.id)} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <StoryboardEmpty label={t("canvas.storyboard.noText")} />
                    )}
                </StoryboardModule>

                <div className="relative flex min-w-0 flex-1 flex-col gap-px">
                    <StoryboardModule
                        title={t("canvas.storyboard.modules.image")}
                        icon={<ImageIcon className="size-4" />}
                        count={items.image.length}
                        collapsed={collapsed.image}
                        onToggle={() => setCollapsed((value) => ({ ...value, image: !value.image }))}
                        filter={filters.image}
                        onFilter={(filter) => setFilters((value) => ({ ...value, image: filter }))}
                        theme={theme}
                        surface="panel"
                        className="min-h-0 flex-1"
                        panelStyle={collapsed.image ? { flex: "0 0 2.5rem" } : collapsed.video ? { flex: "1 1 0", minHeight: 112 } : { flex: `0 0 ${layout.imageRatio * 100}%`, minHeight: 112 }}
                    >
                        {items.image.length ? (
                            <div className="grid gap-1.5 p-1.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
                                {items.image.map((item) => (
                                    <div key={item.id} className="relative min-w-0">
                                        <button type="button" onClick={() => setDetail(item)} className="group block w-full min-w-0 overflow-hidden rounded-lg text-left transition hover:bg-white/[0.035]" style={{ background: theme.toolbar.panel }}>
                                            <span className="relative flex aspect-square items-center justify-center overflow-hidden" style={{ background: theme.canvas.background }}>
                                                {mediaUrl(item) ? <img src={mediaUrl(item)} alt={item.title} className="size-full object-contain" /> : <ImageIcon className="size-7 opacity-30" />}
                                                <StatusBadge item={item} theme={theme} />
                                            </span>
                                            <span className="block px-1.5 pb-1 pt-1">
                                                <ItemHeading item={item} theme={theme} compact />
                                                <span className="mt-0.5 block truncate text-[10px]" style={{ color: theme.node.muted }}>
                                                    {itemMeta(item)}
                                                </span>
                                            </span>
                                        </button>
                                        <SelectionToggle checked={selectedItemIds.has(item.id)} theme={theme} onClick={() => toggleSelected(item.id)} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <StoryboardEmpty label={t("canvas.storyboard.noImage")} />
                        )}
                    </StoryboardModule>

                    <StoryboardModule
                        title={t("canvas.storyboard.modules.video")}
                        icon={<Video className="size-4" />}
                        count={items.video.length}
                        collapsed={collapsed.video}
                        onToggle={() => setCollapsed((value) => ({ ...value, video: !value.video }))}
                        filter={filters.video}
                        onFilter={(filter) => setFilters((value) => ({ ...value, video: filter }))}
                        theme={theme}
                        surface="panel"
                        className="min-h-0 flex-1"
                        panelStyle={collapsed.video ? { flex: "0 0 2.5rem" } : { flex: "1 1 0", minHeight: 112 }}
                    >
                        {items.video.length ? (
                            <div className="grid gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                                {items.video.map((item) => (
                                    <div key={item.id} className="relative min-w-0">
                                        <button type="button" onClick={() => setDetail(item)} className="group block w-full min-w-0 overflow-hidden rounded-lg text-left transition hover:bg-white/[0.035]" style={{ background: theme.toolbar.panel }}>
                                            <span className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
                                                {videoPosterUrlFor(item.storageKey) ? <img src={videoPosterUrlFor(item.storageKey)} alt={item.title} className="size-full object-contain" /> : item.storageKey ? null : mediaUrl(item) ? <video src={`${mediaUrl(item)}#t=0.1`} muted playsInline preload="metadata" className="size-full object-contain" /> : <Video className="size-7 text-white/30" />}
                                                <span className="absolute inset-0 grid place-items-center bg-black/10 opacity-80">
                                                    <span className="grid size-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                                                        <Play className="ml-0.5 size-4 fill-current" />
                                                    </span>
                                                </span>
                                                <StatusBadge item={item} theme={theme} />
                                            </span>
                                            <span className="block px-2 pb-1.5 pt-1.5">
                                                <ItemHeading item={item} theme={theme} compact />
                                                <span className="mt-0.5 block truncate text-[10px]" style={{ color: theme.node.muted }}>
                                                    {itemMeta(item)}
                                                </span>
                                            </span>
                                        </button>
                                        <SelectionToggle checked={selectedItemIds.has(item.id)} theme={theme} onClick={() => toggleSelected(item.id)} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <StoryboardEmpty label={t("canvas.storyboard.noVideo")} />
                        )}
                    </StoryboardModule>
                    {!collapsed.image && !collapsed.video ? (
                        <button
                            type="button"
                            className="absolute inset-x-0 z-30 h-4 -translate-y-1/2 cursor-row-resize touch-none"
                            style={{ top: `${layout.imageRatio * 100}%` }}
                            onPointerDown={startMediaResize}
                            onKeyDown={onMediaResizeKeyDown}
                            aria-label={t("canvas.storyboard.resizeMedia")}
                            data-canvas-shortcuts-ignore
                        >
                            <span className="absolute inset-x-0 top-1/2 h-px transition-colors" style={{ background: resizing === "media" ? theme.node.activeStroke : theme.toolbar.border }} />
                        </button>
                    ) : null}
                </div>
            </div>

            <StoryboardDetail
                item={detail}
                theme={theme}
                index={detailIndex}
                count={visibleItems.length}
                onPrevious={() => navigateDetail(-1)}
                onNext={() => navigateDetail(1)}
                onClose={() => setDetail(null)}
                onLocate={locate}
                onCategoryChange={(category) => {
                    if (!detail || category === detail.category || !onUpdateNodeCategory(detail.nodeId, category)) return;
                    setDetail({ ...detail, category });
                }}
            />
        </div>
    );
}

function StoryboardModule({
    title,
    icon,
    count,
    collapsed,
    onToggle,
    filter,
    onFilter,
    theme,
    className,
    panelStyle,
    surface = "canvas",
    resizeHandle,
    children,
}: {
    title: string;
    icon: ReactNode;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
    filter: StatusFilter;
    onFilter: (filter: StatusFilter) => void;
    theme: CanvasTheme;
    className?: string;
    panelStyle?: CSSProperties;
    surface?: "canvas" | "panel";
    resizeHandle?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    const filterOptions = [
        { value: "all", label: t("common.all") },
        { value: "success", label: t("canvas.storyboard.status.success") },
        { value: "loading", label: t("canvas.storyboard.status.loading") },
        { value: "error", label: t("canvas.storyboard.status.error") },
    ];

    return (
        <section className={cn("relative flex min-h-0 flex-col overflow-hidden", className)} style={{ background: surface === "panel" ? theme.node.panel : theme.canvas.background, ...panelStyle }}>
            <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2" style={{ borderColor: theme.toolbar.border }}>
                <button
                    type="button"
                    onClick={onToggle}
                    className="grid size-8 shrink-0 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10 sm:size-6"
                    aria-label={collapsed ? t("canvas.storyboard.expand") : t("canvas.storyboard.collapse")}
                >
                    <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")} />
                </button>
                <span className="hidden shrink-0 sm:inline" style={{ color: theme.node.muted }}>
                    {icon}
                </span>
                <h2 className="min-w-0 truncate text-xs font-medium">{title}</h2>
                <span className="shrink-0 text-[11px] tabular-nums" style={{ color: theme.node.muted }}>
                    {count}
                </span>
                {collapsed ? null : <Select size="small" variant="borderless" value={filter} onChange={onFilter} options={filterOptions} className="ml-auto w-14 sm:w-20" aria-label={t("canvas.storyboard.filter")} />}
            </div>
            {collapsed ? null : <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>}
            {resizeHandle}
        </section>
    );
}

function ItemHeading({ item, theme, compact = false }: { item: StoryboardItem; theme: CanvasTheme; compact?: boolean }) {
    const { t } = useTranslation();
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate font-medium", compact ? "text-[11px] leading-4" : "text-sm")}>{item.title}</span>
            {item.category !== "other" ? (
                <span className="shrink-0 rounded border px-1 py-0.5 text-[9px]" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
                    {t(`canvas.storyboard.categories.${item.category}`)}
                </span>
            ) : null}
            {item.isPrimary ? (
                <span className="shrink-0 rounded px-1 py-0.5 text-[9px]" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                    {item.kind === "image" ? <ImageIcon className="size-3" /> : null}
                </span>
            ) : null}
            {item.groupTitle ? (
                <span className="max-w-16 shrink-0 truncate text-[9px]" style={{ color: theme.node.faint }}>
                    {item.groupTitle}
                </span>
            ) : null}
        </span>
    );
}

function StatusBadge({ item, theme }: { item: StoryboardItem; theme: CanvasTheme }) {
    if (item.status === "idle" || item.status === "success") return null;
    const color = item.status === "error" ? "#ef4444" : "#f59e0b";
    return <span className="absolute bottom-2 right-2 size-2 rounded-full ring-2" style={{ background: color, boxShadow: `0 0 0 2px ${theme.toolbar.panel}` }} />;
}

function SelectionToggle({ checked, theme, onClick }: { checked: boolean; theme: CanvasTheme; onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            aria-label={t(checked ? "canvas.storyboard.deselectItem" : "canvas.storyboard.selectItem")}
            aria-pressed={checked}
            onClick={onClick}
            className="absolute right-1.5 top-1.5 z-10 grid size-7 touch-manipulation place-items-center rounded border backdrop-blur transition sm:size-5"
            style={{ background: checked ? theme.node.activeStroke : "rgba(0,0,0,.42)", borderColor: checked ? theme.node.activeStroke : "rgba(255,255,255,.28)", color: "#fff" }}
        >
            <Check className={cn("size-3 transition-opacity", checked ? "opacity-100" : "opacity-0")} />
        </button>
    );
}

function StoryboardEmpty({ label }: { label: string }) {
    return (
        <div className="grid h-full min-h-32 place-items-center p-6">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={label} />
        </div>
    );
}

function StoryboardDetail({
    item,
    theme,
    index,
    count,
    onPrevious,
    onNext,
    onClose,
    onLocate,
    onCategoryChange,
}: {
    item: StoryboardItem | null;
    theme: CanvasTheme;
    index: number;
    count: number;
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
    onLocate: (item: StoryboardItem) => void;
    onCategoryChange: (category: CanvasStoryboardCategory) => void;
}) {
    const { t } = useTranslation();
    const src = item ? mediaUrl(item) : "";
    const poster = item?.kind === "video" ? videoPosterUrlFor(item.storageKey) : undefined;
    const generation = item?.generation;
    const parameters = generation
        ? [
              generation.type ? t(`canvas.storyboard.generationTypes.${generation.type}`) : "",
              generation.size,
              generation.quality,
              generation.count ? t("canvas.storyboard.parameters.count", { count: generation.count }) : "",
              generation.seconds ? t("canvas.storyboard.parameters.seconds", { value: generation.seconds }) : "",
              generation.vquality,
              generation.background ? t("canvas.storyboard.parameters.background", { value: generation.background }) : "",
              generation.generateAudio ? t("canvas.storyboard.parameters.audio", { value: yesNo(generation.generateAudio, t) }) : "",
              generation.watermark ? t("canvas.storyboard.parameters.watermark", { value: yesNo(generation.watermark, t) }) : "",
              generation.videoMode ? t(`canvas.storyboard.videoModes.${generation.videoMode}`, { defaultValue: generation.videoMode }) : "",
          ].filter((value): value is string => Boolean(value))
        : [];
    return (
        <Modal
            open={Boolean(item)}
            title={item?.title}
            onCancel={onClose}
            width={1180}
            styles={{ body: { maxHeight: "calc(100vh - 260px)", overflowY: "auto" } }}
            footer={
                item ? (
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={index <= 0}
                                onClick={onPrevious}
                                className="grid size-8 place-items-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={t("canvas.storyboard.previous")}
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <span className="min-w-14 text-center text-xs tabular-nums" style={{ color: theme.node.muted }}>
                                {t("canvas.storyboard.position", { current: Math.max(index + 1, 0), total: count })}
                            </span>
                            <button
                                type="button"
                                disabled={index < 0 || index >= count - 1}
                                onClick={onNext}
                                className="grid size-8 place-items-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={t("canvas.storyboard.next")}
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                        <button type="button" onClick={() => onLocate(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                            <LocateFixed className="size-4" />
                            {t("canvas.storyboard.locate")}
                        </button>
                    </div>
                ) : null
            }
        >
            {item ? (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_272px]">
                    <div className="min-w-0 space-y-4">
                        <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl" style={{ background: theme.node.panel }}>
                            {item.kind === "image" && src ? <img src={src} alt={item.title} className="max-h-[58vh] max-w-full object-contain" /> : null}
                            {item.kind === "video" && src ? <video src={src} poster={poster} controls autoPlay className="max-h-[58vh] w-full object-contain" /> : null}
                            {item.kind === "text" ? <div className="thin-scrollbar max-h-[58vh] w-full overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-6">{item.content || item.prompt}</div> : null}
                            {item.kind !== "text" && !src ? <span className="text-sm opacity-45">{t("canvas.storyboard.noPreview")}</span> : null}
                        </div>
                        {item.kind !== "text" && item.prompt ? (
                            <section className="rounded-xl border p-4" style={{ borderColor: theme.toolbar.border, background: theme.node.panel }}>
                                <h3 className="text-xs font-medium" style={{ color: theme.node.muted }}>
                                    {t("canvas.storyboard.fields.prompt")}
                                </h3>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.prompt}</p>
                            </section>
                        ) : null}
                        {generation?.references.length ? (
                            <section className="rounded-xl border p-4" style={{ borderColor: theme.toolbar.border, background: theme.node.panel }}>
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-xs font-medium" style={{ color: theme.node.muted }}>
                                        {t("canvas.storyboard.fields.references")}
                                    </h3>
                                    <span className="text-[11px] tabular-nums" style={{ color: theme.node.faint }}>
                                        {t("canvas.storyboard.referenceCount", { count: generation.references.length })}
                                    </span>
                                </div>
                                <GenerationReferences generation={generation} theme={theme} />
                            </section>
                        ) : null}
                    </div>
                    <dl className="min-w-0 space-y-3 text-sm">
                        <div>
                            <dt className="flex items-center gap-2 text-xs opacity-45">
                                {t("canvas.storyboard.fields.category")}
                                {item.locked ? (
                                    <span className="rounded border px-1 py-0.5 text-[9px] opacity-80" style={{ borderColor: theme.node.stroke }}>
                                        {t("canvas.node.locked")}
                                    </span>
                                ) : null}
                            </dt>
                            <dd className="mt-1">
                                <Select
                                    size="small"
                                    variant="borderless"
                                    value={item.category}
                                    disabled={item.locked}
                                    onChange={(value) => onCategoryChange(value as CanvasStoryboardCategory)}
                                    options={[
                                        { value: "character", label: t("canvas.storyboard.categories.character") },
                                        { value: "scene", label: t("canvas.storyboard.categories.scene") },
                                        { value: "prop", label: t("canvas.storyboard.categories.prop") },
                                        { value: "other", label: t("canvas.storyboard.categories.other") },
                                    ]}
                                    className="w-full"
                                    aria-label={t("canvas.storyboard.category")}
                                />
                            </dd>
                        </div>
                        <DetailRow label={t("canvas.storyboard.fields.group")} value={item.groupTitle || "-"} />
                        <DetailRow label={t("canvas.storyboard.fields.status")} value={t(`canvas.storyboard.status.${item.status}`)} />
                        <DetailRow label={t("canvas.storyboard.fields.model")} value={item.model || "-"} />
                        <DetailRow label={t("canvas.storyboard.fields.size")} value={itemMeta(item) || "-"} />
                        {parameters.length ? (
                            <div>
                                <dt className="text-xs opacity-45">{t("canvas.storyboard.fields.parameters")}</dt>
                                <dd className="mt-2 flex flex-wrap gap-1.5">
                                    {parameters.map((parameter, index) => (
                                        <span key={`${parameter}:${index}`} className="rounded-md px-2 py-1 text-[11px] leading-4" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                                            {parameter}
                                        </span>
                                    ))}
                                </dd>
                            </div>
                        ) : null}
                        <DetailRow label={t("canvas.storyboard.fields.node")} value={item.nodeId} mono />
                    </dl>
                </div>
            ) : null}
        </Modal>
    );
}

function yesNo(value: string, t: ReturnType<typeof useTranslation>["t"]) {
    return value === "true" ? t("settingsPanels.common.yes") : value === "false" ? t("settingsPanels.common.no") : value;
}

function referenceSource(reference: CanvasGenerationReference) {
    return (reference.storageKey ? previewUrlFor(reference.storageKey) : undefined) || reference.url || "";
}

function GenerationReferences({ generation, theme }: { generation: StoryboardGeneration; theme: CanvasTheme }) {
    const { t } = useTranslation();
    const counts = { image: 0, video: 0, audio: 0, text: 0 };
    useEffect(() => {
        generation.references.forEach((reference) => {
            if (reference.kind === "image" && reference.storageKey) void ensureImagePreview(reference.storageKey);
        });
    }, [generation.references]);

    return (
        <div className="thin-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {generation.references.map((reference, index) => {
                const number = counts[reference.kind]++;
                const label = t(`canvas.composer.resources.${reference.kind}`, { index: number + 1 });
                const src = referenceSource(reference);
                return (
                    <div
                        key={`${reference.kind}:${reference.nodeId || reference.storageKey || reference.url || "reference"}:${index}`}
                        className="w-28 shrink-0 overflow-hidden rounded-lg border"
                        style={{ borderColor: theme.toolbar.border, background: theme.canvas.background }}
                    >
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden">
                            {reference.kind === "image" && src ? <img src={src} alt={reference.title || label} className="size-full object-cover" /> : null}
                            {reference.kind === "video" ? <Video className="size-7" style={{ color: theme.node.muted }} /> : null}
                            {reference.kind === "audio" ? <Music2 className="size-7" style={{ color: theme.node.muted }} /> : null}
                            {reference.kind === "text" ? <Type className="size-7" style={{ color: theme.node.muted }} /> : null}
                            {reference.kind === "image" && !src ? <ImageIcon className="size-7" style={{ color: theme.node.faint }} /> : null}
                            <span className="absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">{label}</span>
                        </div>
                        <p className="truncate px-2 py-1.5 text-[10px]" style={{ color: theme.node.muted }}>
                            {reference.title || (src ? label : t("canvas.storyboard.referenceMissing"))}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <dt className="text-xs opacity-45">{label}</dt>
            <dd className={cn("mt-1 break-words", mono && "font-mono text-xs")}>{value}</dd>
        </div>
    );
}
