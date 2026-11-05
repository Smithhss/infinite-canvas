import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Empty, Input, Modal, Select } from "antd";
import { Check, ChevronDown, Image as ImageIcon, LocateFixed, MousePointer2, Play, Search, Type, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { buildStoryboardProjection, filterStoryboardItems, type StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { readAppStorageItem, writeAppStorageItem } from "@/lib/storage-namespace";
import { cn } from "@/lib/utils";
import { getImagePreviewRevision, previewUrlFor, subscribeImagePreviews } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, CanvasNodeStatus } from "@/types/canvas";

type ModuleKey = "text" | "image" | "video";
type StatusFilter = CanvasNodeStatus | "all";

type Props = {
    projectId: string;
    nodes: CanvasNodeData[];
    onLocateNode: (nodeId: string) => void;
    onSelectNodesInCanvas: (nodeIds: string[]) => void;
};

const COLLAPSED_KEY_PREFIX = "canvas-storyboard-collapsed:";

function readCollapsed(projectId: string): Record<ModuleKey, boolean> {
    try {
        const saved = JSON.parse(readAppStorageItem(`${COLLAPSED_KEY_PREFIX}${projectId}`) || "{}") as Partial<Record<ModuleKey, boolean>>;
        return { text: Boolean(saved.text), image: Boolean(saved.image), video: Boolean(saved.video) };
    } catch {
        return { text: false, image: false, video: false };
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

export function CanvasStoryboard({ projectId, nodes, onLocateNode, onSelectNodesInCanvas }: Props) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const projection = useMemo(() => buildStoryboardProjection(nodes), [nodes]);
    const [keyword, setKeyword] = useState("");
    const [collapsed, setCollapsed] = useState(() => readCollapsed(projectId));
    const [filters, setFilters] = useState<Record<ModuleKey, StatusFilter>>({ text: "all", image: "all", video: "all" });
    const [detail, setDetail] = useState<StoryboardItem | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        writeAppStorageItem(`${COLLAPSED_KEY_PREFIX}${projectId}`, JSON.stringify(collapsed));
    }, [collapsed, projectId]);

    const items = useMemo(
        () => ({
            text: filterStoryboardItems(projection.text, keyword, filters.text),
            image: filterStoryboardItems(projection.image, keyword, filters.image),
            video: filterStoryboardItems(projection.video, keyword, filters.video),
        }),
        [filters, keyword, projection],
    );
    const total = items.text.length + items.image.length + items.video.length;
    const visibleItems = useMemo(() => [...items.text, ...items.image, ...items.video], [items]);
    const selectedItems = useMemo(() => visibleItems.filter((item) => selectedItemIds.has(item.id)), [selectedItemIds, visibleItems]);
    const selectedNodeIds = useMemo(() => [...new Set(selectedItems.map((item) => item.nodeId))], [selectedItems]);

    const locate = (item: StoryboardItem) => {
        setDetail(null);
        onLocateNode(item.nodeId);
    };
    const toggleSelected = (itemId: string) => {
        setSelectedItemIds((current) => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
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
                            className="flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium sm:h-7 sm:min-w-0"
                            style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}
                            onClick={() => onSelectNodesInCanvas(selectedNodeIds)}
                            aria-label={t("canvas.storyboard.processSelection")}
                        >
                            <MousePointer2 className="size-3.5" />
                            <span className="hidden sm:inline">{t("canvas.storyboard.processSelection")}</span>
                        </button>
                    </div>
                ) : (
                    <span className="ml-auto shrink-0 text-xs tabular-nums" style={{ color: theme.node.muted }}>
                        {t("canvas.storyboard.total", { count: total })}
                    </span>
                )}
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden" style={{ background: theme.toolbar.border }}>
                <StoryboardModule
                    title={t("canvas.storyboard.modules.text")}
                    icon={<Type className="size-4" />}
                    count={items.text.length}
                    collapsed={collapsed.text}
                    onToggle={() => setCollapsed((value) => ({ ...value, text: !value.text }))}
                    filter={filters.text}
                    onFilter={(filter) => setFilters((value) => ({ ...value, text: filter }))}
                    theme={theme}
                    className="h-full w-[42%] min-w-[148px] max-w-[320px] shrink-0"
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

                <div className="flex min-w-0 flex-1 flex-col gap-px">
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
                    >
                        {items.video.length ? (
                            <div className="grid gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                                {items.video.map((item) => (
                                    <div key={item.id} className="relative min-w-0">
                                        <button type="button" onClick={() => setDetail(item)} className="group block w-full min-w-0 overflow-hidden rounded-lg text-left transition hover:bg-white/[0.035]" style={{ background: theme.toolbar.panel }}>
                                            <span className="relative flex aspect-video items-center justify-center overflow-hidden bg-black">
                                                {mediaUrl(item) ? <video src={`${mediaUrl(item)}#t=0.1`} muted playsInline preload="metadata" className="size-full object-contain" /> : <Video className="size-7 text-white/30" />}
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
                </div>
            </div>

            <StoryboardDetail item={detail} theme={theme} onClose={() => setDetail(null)} onLocate={locate} />
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
    surface = "canvas",
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
    surface?: "canvas" | "panel";
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
        <section className={cn("flex min-h-0 flex-col overflow-hidden", className)} style={{ background: surface === "panel" ? theme.node.panel : theme.canvas.background }}>
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
        </section>
    );
}

function ItemHeading({ item, theme, compact = false }: { item: StoryboardItem; theme: CanvasTheme; compact?: boolean }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate font-medium", compact ? "text-[11px] leading-4" : "text-sm")}>{item.title}</span>
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

function StoryboardDetail({ item, theme, onClose, onLocate }: { item: StoryboardItem | null; theme: CanvasTheme; onClose: () => void; onLocate: (item: StoryboardItem) => void }) {
    const { t } = useTranslation();
    const src = item ? mediaUrl(item) : "";
    return (
        <Modal
            open={Boolean(item)}
            title={item?.title}
            onCancel={onClose}
            width={960}
            footer={
                item ? (
                    <button type="button" onClick={() => onLocate(item)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}>
                        <LocateFixed className="size-4" />
                        {t("canvas.storyboard.locate")}
                    </button>
                ) : null
            }
        >
            {item ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-xl" style={{ background: theme.node.panel }}>
                        {item.kind === "image" && src ? <img src={src} alt={item.title} className="max-h-[68vh] max-w-full object-contain" /> : null}
                        {item.kind === "video" && src ? <video src={src} controls autoPlay className="max-h-[68vh] w-full object-contain" /> : null}
                        {item.kind === "text" ? <div className="thin-scrollbar max-h-[68vh] w-full overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-6">{item.content || item.prompt}</div> : null}
                        {item.kind !== "text" && !src ? <span className="text-sm opacity-45">{t("canvas.storyboard.noPreview")}</span> : null}
                    </div>
                    <dl className="space-y-3 text-sm">
                        <DetailRow label={t("canvas.storyboard.fields.group")} value={item.groupTitle || "-"} />
                        <DetailRow label={t("canvas.storyboard.fields.status")} value={t(`canvas.storyboard.status.${item.status}`)} />
                        <DetailRow label={t("canvas.storyboard.fields.model")} value={item.model || "-"} />
                        <DetailRow label={t("canvas.storyboard.fields.size")} value={itemMeta(item) || "-"} />
                        <DetailRow label={t("canvas.storyboard.fields.node")} value={item.nodeId} mono />
                        {item.prompt ? <DetailRow label={t("canvas.storyboard.fields.prompt")} value={item.prompt} /> : null}
                    </dl>
                </div>
            ) : null}
        </Modal>
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
