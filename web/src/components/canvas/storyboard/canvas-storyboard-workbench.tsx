import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { App } from "antd";
import { ArrowLeft, ArrowRight, Bot, Boxes, Check, ChevronDown, Columns3, Download, FileText, Image as ImageIcon, ListChecks, ListFilter, LocateFixed, Plus, Redo2, ScrollText, Search, Sparkles, Table2, Trash2, Undo2, Video, WandSparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CanvasScriptAssetSummary } from "@/components/canvas/script/canvas-script-asset-summary";
import { CanvasScriptFilterPanel } from "@/components/canvas/script/canvas-script-filter-panel";
import { CanvasScriptPresetModal } from "@/components/canvas/script/canvas-script-preset-modal";
import { CanvasScriptPromptEditor } from "@/components/canvas/script/canvas-script-prompt-editor";
import { CanvasScriptStoryboardGrid } from "@/components/canvas/script/canvas-script-storyboard-grid";
import { CanvasScriptTable } from "@/components/canvas/script/canvas-script-table";
import { useStoryboardTransferActions } from "@/hooks/use-storyboard-transfer-actions";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { buildStoryboardProjection, type StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { filterStoryboardLibraryItems, groupStoryboardLibraryItems, STORYBOARD_LIBRARY_CATEGORIES, type StoryboardLibraryCategory } from "@/lib/canvas/storyboard-workbench";
import { applyScriptPresetToScript } from "@/lib/canvas/script-preset";
import type { CanvasStoryboardGridOptions } from "@/lib/canvas/storyboard-grid";
import {
    addScriptAsset,
    addScriptShot,
    bindScriptAssetReference,
    composeAllScriptPrompts,
    duplicateScriptShot,
    filterScriptShots,
    insertScriptShot,
    moveScriptShotToTarget,
    normalizeScriptColumnVisibility,
    normalizeScriptV2,
    removeScriptAsset,
    removeScriptShot,
    restoreScriptPrompt,
    SCRIPT_V2_COLUMNS,
    SCRIPT_V2_SHOT_SIZES,
    scriptDurationSeconds,
    syncScriptAssetsFromShots,
    updateScriptColumnVisibility,
    updateScriptFilters,
    updateScriptMeta,
    updateScriptPrompt,
    updateScriptShot,
    updateScriptViewMode,
} from "@/lib/canvas/script-v2";
import { cn } from "@/lib/utils";
import { getImagePreviewRevision, previewUrlFor, subscribeImagePreviews } from "@/services/image-storage";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasNodeData, CanvasScriptColumnKey, CanvasScriptViewMode, CanvasScriptV2 } from "@/types/canvas";

type Props = {
    nodes: CanvasNodeData[];
    onLocateNode: (nodeId: string) => void;
    onSelectNodesInCanvas: (nodeIds: string[]) => void;
    onAddAsset: () => void;
    onUpdateScript: (nodeId: string, script: CanvasScriptV2) => void;
    onCreateStoryboardGrid: (scriptNodeId: string, script: CanvasScriptV2, options: CanvasStoryboardGridOptions, origin?: CanvasNodeData["position"]) => void;
    onClearStoryboardGrid: (scriptNodeId: string) => void;
    onConvertStoryboardGrid: (scriptNodeId: string) => void;
    onUngroupStoryboardGrid: (scriptNodeId: string) => void;
};

type SectionKey = "script" | "text" | "image" | "video";

function mediaUrl(item: StoryboardItem) {
    return previewUrlFor(item.storageKey) || item.content || "";
}

function formatDuration(durationMs: number | undefined) {
    if (!durationMs) return "";
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes ? `${minutes}:` : ""}${String(seconds % 60).padStart(2, "0")}`;
}

function itemSize(item: StoryboardItem) {
    if (!item.width || !item.height) return "";
    return `${item.width} × ${item.height}`;
}

export function CanvasStoryboardWorkbench({ nodes, onLocateNode, onSelectNodesInCanvas, onAddAsset, onUpdateScript, onCreateStoryboardGrid, onClearStoryboardGrid, onConvertStoryboardGrid, onUngroupStoryboardGrid }: Props) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const { addToAgent, addingToAgent, exportItems, exporting } = useStoryboardTransferActions(nodes);
    useSyncExternalStore(subscribeImagePreviews, getImagePreviewRevision);
    const projection = useMemo(() => buildStoryboardProjection(nodes), [nodes]);
    const allItems = useMemo(() => [...projection.script, ...projection.text, ...projection.image, ...projection.video], [projection]);
    const [category, setCategory] = useState<StoryboardLibraryCategory>("all");
    const [keyword, setKeyword] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({ script: false, text: false, image: false, video: false });
    const [batchMode, setBatchMode] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [detailHistory, setDetailHistory] = useState<{ items: string[]; index: number }>({ items: [], index: -1 });

    const filteredItems = useMemo(() => filterStoryboardLibraryItems(allItems, { keyword, category }), [allItems, category, keyword]);
    const sections = useMemo(() => groupStoryboardLibraryItems(filteredItems), [filteredItems]);
    const selectedId = detailHistory.index >= 0 ? detailHistory.items[detailHistory.index] : null;
    const selectedItem = allItems.find((item) => item.id === selectedId) || null;
    const selectedItems = allItems.filter((item) => selectedItemIds.has(item.id));
    const selectedNodeIds = [...new Set(selectedItems.map((item) => item.nodeId))];

    const selectDetail = (itemId: string) => {
        setDetailHistory((current) => {
            if (current.items[current.index] === itemId) return current;
            const items = [...current.items.slice(0, current.index + 1), itemId];
            return { items, index: items.length - 1 };
        });
    };
    const toggleBatchItem = (itemId: string) => {
        setSelectedItemIds((current) => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };
    const openItem = (item: StoryboardItem) => {
        if (batchMode) {
            toggleBatchItem(item.id);
            return;
        }
        selectDetail(item.id);
    };
    const sectionItems = (key: SectionKey) => sections[key];
    const handleBatchModeToggle = () => {
        setBatchMode((current) => {
            if (current) setSelectedItemIds(new Set());
            return !current;
        });
    };

    return (
        <div className="absolute inset-0 flex min-h-0 flex-col pt-12" style={{ background: theme.canvas.background, color: theme.node.text }}>
            <div className="flex min-h-0 flex-1 overflow-hidden" style={{ borderColor: theme.toolbar.border }}>
                <section className="relative flex min-h-0 w-full min-w-0 flex-col border-r lg:w-[360px] lg:shrink-0" style={{ borderColor: theme.toolbar.border }}>
                    <div className="flex h-[52px] shrink-0 items-center gap-1 px-2" style={{ borderColor: theme.toolbar.border, borderBottomWidth: 1 }}>
                        <IconButton theme={theme} label={t("canvas.storyboard.workbench.back")} disabled={detailHistory.index <= 0} onClick={() => setDetailHistory((current) => ({ ...current, index: current.index - 1 }))}>
                            <ArrowLeft className="size-4" />
                        </IconButton>
                        <IconButton
                            theme={theme}
                            label={t("canvas.storyboard.workbench.forward")}
                            disabled={detailHistory.index < 0 || detailHistory.index >= detailHistory.items.length - 1}
                            onClick={() => setDetailHistory((current) => ({ ...current, index: current.index + 1 }))}
                        >
                            <ArrowRight className="size-4" />
                        </IconButton>
                        <h2 className="ml-1 min-w-0 flex-1 truncate text-[13px] font-medium">{t("canvas.storyboard.workbench.title")}</h2>
                        <IconButton theme={theme} label={t("canvas.storyboard.workbench.search")} active={searchOpen} onClick={() => setSearchOpen((value) => !value)}>
                            <Search className="size-4" />
                        </IconButton>
                        <IconButton theme={theme} label={t("canvas.storyboard.workbench.add")} onClick={onAddAsset}>
                            <Plus className="size-4" />
                        </IconButton>
                        <IconButton theme={theme} label={t("canvas.storyboard.workbench.batch")} active={batchMode} onClick={handleBatchModeToggle}>
                            <ListChecks className="size-4" />
                        </IconButton>
                    </div>

                    {searchOpen ? (
                        <div className="shrink-0 px-3 py-2" style={{ borderColor: theme.toolbar.border, borderBottomWidth: 1 }}>
                            <div className="flex h-8 items-center gap-2 rounded-lg px-2.5" style={{ background: theme.node.panel, border: `0.5px solid ${theme.node.stroke}` }}>
                                <Search className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                                <input
                                    autoFocus
                                    value={keyword}
                                    onChange={(event) => setKeyword(event.target.value)}
                                    placeholder={t("canvas.storyboard.workbench.searchPlaceholder")}
                                    aria-label={t("canvas.storyboard.workbench.search")}
                                    className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none"
                                    style={{ color: theme.node.text }}
                                />
                                {keyword ? (
                                    <button type="button" className="grid size-5 place-items-center rounded" style={{ color: theme.node.muted }} aria-label={t("canvas.storyboard.workbench.clear")} onClick={() => setKeyword("")}>
                                        <X className="size-3" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="thin-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-3" style={{ borderColor: theme.toolbar.border, borderBottomWidth: 1 }}>
                        {STORYBOARD_LIBRARY_CATEGORIES.map((value) => {
                            const active = category === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={active}
                                    className="h-7 shrink-0 rounded-md px-2.5 text-[11px] transition hover:bg-black/5 dark:hover:bg-white/10"
                                    style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted }}
                                    onClick={() => setCategory(value)}
                                >
                                    {t(`canvas.storyboard.workbench.categories.${value}`)}
                                </button>
                            );
                        })}
                    </div>

                    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-20 pt-1">
                        {(["script", "text", "image", "video"] as const).map((key) => (
                            <LibrarySection
                                key={key}
                                section={key}
                                items={sectionItems(key)}
                                collapsed={collapsed[key]}
                                theme={theme}
                                selectedId={selectedId}
                                batchMode={batchMode}
                                selectedItemIds={selectedItemIds}
                                onToggle={() => setCollapsed((current) => ({ ...current, [key]: !current[key] }))}
                                onOpen={openItem}
                            />
                        ))}
                        {filteredItems.length === 0 ? <LibraryEmpty theme={theme} /> : null}
                    </div>

                    {batchMode && selectedItems.length ? (
                        <div className="absolute bottom-3 left-3 right-3 flex h-10 items-center gap-2 rounded-xl px-2 shadow-xl lg:right-auto lg:w-[336px]" style={{ background: theme.toolbar.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                            <span className="min-w-0 flex-1 truncate px-1 text-[11px]" style={{ color: theme.node.muted }}>
                                {t("canvas.storyboard.workbench.selected", { count: selectedItems.length })}
                            </span>
                            <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2 text-xs" style={{ color: theme.node.muted }} aria-label={t("canvas.storyboard.exportSelection")} disabled={exporting} onClick={() => void exportItems(selectedItems)}>
                                <Download className="size-3.5" />
                                <span className="hidden xl:inline">{t("canvas.storyboard.exportSelection")}</span>
                            </button>
                            <button type="button" className="flex h-7 items-center gap-1 rounded-md px-2 text-xs" style={{ color: theme.node.muted }} aria-label={t("canvas.storyboard.addToAgent")} disabled={addingToAgent} onClick={() => void addToAgent(selectedItems)}>
                                <Bot className="size-3.5" />
                                <span className="hidden xl:inline">{t("canvas.storyboard.addToAgent")}</span>
                            </button>
                            <button type="button" className="h-7 rounded-md px-2.5 text-xs font-medium" style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }} onClick={() => onSelectNodesInCanvas(selectedNodeIds)}>
                                {t("canvas.storyboard.workbench.process")}
                            </button>
                            <button type="button" className="grid size-7 place-items-center rounded-md" style={{ color: theme.node.muted }} aria-label={t("canvas.storyboard.workbench.clear")} onClick={() => setSelectedItemIds(new Set())}>
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ) : null}
                </section>

                <section className={cn("absolute inset-x-0 bottom-0 top-12 z-20 min-h-0 min-w-0 flex-1 lg:static lg:z-auto lg:flex", selectedItem ? "flex" : "hidden")} style={{ background: theme.canvas.background }}>
                    <StoryboardDetail
                        item={selectedItem}
                        nodes={nodes}
                        theme={theme}
                        onClose={() => setDetailHistory((current) => ({ ...current, index: -1 }))}
                        onLocate={onLocateNode}
                        onUpdateScript={onUpdateScript}
                        onCreateStoryboardGrid={onCreateStoryboardGrid}
                        onClearStoryboardGrid={onClearStoryboardGrid}
                        onConvertStoryboardGrid={onConvertStoryboardGrid}
                        onUngroupStoryboardGrid={onUngroupStoryboardGrid}
                    />
                </section>
            </div>
        </div>
    );
}

function IconButton({
    theme,
    label,
    active = false,
    disabled = false,
    onClick,
    children,
}: {
    theme: CanvasTheme;
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-lg transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-25 dark:hover:bg-white/10"
            style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted }}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function LibrarySection({
    section,
    items,
    collapsed,
    theme,
    selectedId,
    batchMode,
    selectedItemIds,
    onToggle,
    onOpen,
}: {
    section: SectionKey;
    items: StoryboardItem[];
    collapsed: boolean;
    theme: CanvasTheme;
    selectedId: string | null;
    batchMode: boolean;
    selectedItemIds: Set<string>;
    onToggle: () => void;
    onOpen: (item: StoryboardItem) => void;
}) {
    const { t } = useTranslation();
    if (!items.length) return null;
    const icon = section === "script" ? <ScrollText className="size-3.5" /> : section === "text" ? <FileText className="size-3.5" /> : section === "image" ? <ImageIcon className="size-3.5" /> : <Video className="size-3.5" />;

    return (
        <section className="pb-2">
            <button type="button" className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left transition hover:bg-black/5 dark:hover:bg-white/[0.05]" onClick={onToggle} aria-expanded={!collapsed}>
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")} style={{ color: theme.node.muted }} />
                <span style={{ color: theme.node.muted }}>{icon}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{t(`canvas.storyboard.modules.${section}`)}</span>
                <span className="text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {items.length}
                </span>
            </button>
            {collapsed ? null : (
                <div className={cn("grid gap-2 px-1 pt-1", section === "text" || section === "script" ? "grid-cols-1" : "grid-cols-2")}>
                    {items.map((item) => (
                        <LibraryCard
                            key={item.id}
                            item={item}
                            theme={theme}
                            selected={selectedId === item.id}
                            batchMode={batchMode}
                            checked={selectedItemIds.has(item.id)}
                            onOpen={() => onOpen(item)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function LibraryCard({ item, theme, selected, batchMode, checked, onOpen }: { item: StoryboardItem; theme: CanvasTheme; selected: boolean; batchMode: boolean; checked: boolean; onOpen: () => void }) {
    const { t } = useTranslation();
    const src = mediaUrl(item);
    const scriptRows = item.script?.rows || [];
    return (
        <button
            type="button"
            className="group relative min-w-0 overflow-hidden rounded-[10px] text-left transition hover:-translate-y-0.5"
            style={{ background: selected ? theme.toolbar.activeBg : theme.node.panel, border: `1px solid ${selected ? theme.node.activeStroke : theme.toolbar.border}` }}
            onClick={onOpen}
            aria-pressed={batchMode ? checked : selected}
        >
            {item.kind === "script" ? (
                <div className="flex min-h-[96px] flex-col gap-2 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <ScrollText className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                        <span className="truncate">{item.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                            {t("canvas.storyboard.workbench.shotCount", { count: scriptRows.length })}
                        </span>
                    </div>
                    <p className="line-clamp-2 whitespace-pre-wrap text-[10px] leading-4" style={{ color: theme.node.muted }}>
                        {scriptRows[0]?.plotDescription || item.script?.originalStoryText || item.script?.theme || t("canvas.storyboard.workbench.emptyScript")}
                    </p>
                    <span className="mt-auto text-[9px] tabular-nums" style={{ color: theme.node.muted }}>
                        {t("canvas.storyboard.workbench.scriptDuration", { seconds: scriptDurationSeconds(normalizeScriptV2(item.script)) })}
                    </span>
                </div>
            ) : item.kind === "text" ? (
                <div className="flex min-h-[88px] flex-col gap-2 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <FileText className="size-3.5 shrink-0" style={{ color: theme.node.muted }} />
                        <span className="truncate">{item.title}</span>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-[10px] leading-4" style={{ color: theme.node.muted }}>
                        {item.content || item.prompt || t("canvas.storyboard.emptyText")}
                    </p>
                </div>
            ) : (
                <>
                    <span className={cn("relative flex items-center justify-center overflow-hidden", item.kind === "image" ? "aspect-square" : "aspect-video")} style={{ background: theme.canvas.background }}>
                        {item.kind === "image" && src ? <img src={src} alt={item.title} className="size-full object-cover" loading="lazy" /> : null}
                        {item.kind === "image" && !src ? <ImageIcon className="size-7 opacity-25" /> : null}
                        {item.kind === "video" && src ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover" /> : null}
                        {item.kind === "video" && !src ? <Video className="size-7 opacity-25" /> : null}
                        <StatusDot item={item} theme={theme} />
                    </span>
                    <span className="block px-2 pb-1.5 pt-1">
                        <span className="block truncate text-[11px] font-medium">{item.title}</span>
                        <span className="mt-0.5 block truncate text-[9px]" style={{ color: theme.node.muted }}>
                            {item.kind === "video" ? [formatDuration(item.durationMs), itemSize(item)].filter(Boolean).join(" · ") : itemSize(item)}
                        </span>
                    </span>
                </>
            )}
            {batchMode ? (
                <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full border" style={{ background: checked ? theme.node.activeStroke : "rgba(0,0,0,.5)", borderColor: checked ? theme.node.activeStroke : "rgba(255,255,255,.3)", color: "#fff" }}>
                    <Check className={cn("size-3 transition-opacity", checked ? "opacity-100" : "opacity-0")} />
                </span>
            ) : null}
        </button>
    );
}

function StatusDot({ item, theme }: { item: StoryboardItem; theme: CanvasTheme }) {
    if (item.status === "idle" || item.status === "success") return null;
    return <span className="absolute right-2 top-2 size-2 rounded-full ring-2" style={{ background: item.status === "error" ? "#ef4444" : "#f59e0b", boxShadow: `0 0 0 2px ${theme.canvas.background}` }} />;
}

function LibraryEmpty({ theme }: { theme: CanvasTheme }) {
    const { t } = useTranslation();
    return (
        <div className="grid min-h-48 place-items-center px-6 text-center">
            <div>
                <ImageIcon className="mx-auto size-7 opacity-20" />
                <p className="mt-3 text-xs" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.emptyLibrary")}
                </p>
            </div>
        </div>
    );
}

function StoryboardDetail({
    item,
    nodes,
    theme,
    onClose,
    onLocate,
    onUpdateScript,
    onCreateStoryboardGrid,
    onClearStoryboardGrid,
    onConvertStoryboardGrid,
    onUngroupStoryboardGrid,
}: {
    item: StoryboardItem | null;
    nodes: CanvasNodeData[];
    theme: CanvasTheme;
    onClose: () => void;
    onLocate: (nodeId: string) => void;
    onUpdateScript: (nodeId: string, script: CanvasScriptV2) => void;
    onCreateStoryboardGrid: (scriptNodeId: string, script: CanvasScriptV2, options: CanvasStoryboardGridOptions, origin?: CanvasNodeData["position"]) => void;
    onClearStoryboardGrid: (scriptNodeId: string) => void;
    onConvertStoryboardGrid: (scriptNodeId: string) => void;
    onUngroupStoryboardGrid: (scriptNodeId: string) => void;
}) {
    const { t } = useTranslation();
    const src = item ? mediaUrl(item) : "";

    if (!item) {
        return (
            <div className="grid min-h-0 flex-1 place-items-center text-center">
                <div>
                    <ImageIcon className="mx-auto size-8 opacity-15" />
                    <h3 className="mt-4 text-sm font-medium">{t("canvas.storyboard.workbench.emptyDetailTitle")}</h3>
                    <p className="mt-1.5 text-xs" style={{ color: theme.node.muted }}>
                        {t("canvas.storyboard.workbench.emptyDetailDescription")}
                    </p>
                </div>
            </div>
        );
    }

    if (item.kind === "script") {
        return (
            <ScriptDetail
                key={item.id}
                item={item}
                nodes={nodes}
                theme={theme}
                onClose={onClose}
                onLocate={onLocate}
                onUpdateScript={onUpdateScript}
                onCreateStoryboardGrid={onCreateStoryboardGrid}
                onClearStoryboardGrid={onClearStoryboardGrid}
                onConvertStoryboardGrid={onConvertStoryboardGrid}
                onUngroupStoryboardGrid={onUngroupStoryboardGrid}
            />
        );
    }

    const download = () => {
        if (src) {
            const link = document.createElement("a");
            link.href = src;
            link.download = item.title || `storyboard-${item.nodeId}`;
            link.click();
            return;
        }
        if (item.kind === "text" && item.content) {
            const href = URL.createObjectURL(new Blob([item.content], { type: "text/plain;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = href;
            link.download = `${item.title || "storyboard"}.txt`;
            link.click();
            URL.revokeObjectURL(href);
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col" style={{ background: theme.canvas.background }}>
            <div className="flex h-[52px] shrink-0 items-center gap-2 px-4" style={{ borderColor: theme.toolbar.border, borderBottomWidth: 1 }}>
                <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</h2>
                <IconButton theme={theme} label={t("canvas.storyboard.workbench.download")} disabled={!src && item.kind !== "text"} onClick={download}>
                    <Download className="size-4" />
                </IconButton>
                <IconButton theme={theme} label={t("canvas.storyboard.workbench.locate")} onClick={() => onLocate(item.nodeId)}>
                    <LocateFixed className="size-4" />
                </IconButton>
                <IconButton theme={theme} label={t("canvas.storyboard.workbench.close")} onClick={onClose}>
                    <X className="size-4" />
                </IconButton>
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mx-auto max-w-[900px]">
                    <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl sm:min-h-[320px]" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                        {item.kind === "image" && src ? <img src={src} alt={item.title} className="max-h-[52vh] max-w-full object-contain" /> : null}
                        {item.kind === "video" && src ? <video src={src} controls className="max-h-[52vh] w-full object-contain" /> : null}
                        {item.kind === "text" ? <div className="thin-scrollbar max-h-[52vh] w-full overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-6">{item.content || item.prompt || t("canvas.storyboard.emptyText")}</div> : null}
                        {item.kind !== "text" && !src ? (
                            <div className="text-center" style={{ color: theme.node.muted }}>
                                {item.kind === "image" ? <ImageIcon className="mx-auto size-8 opacity-25" /> : <Video className="mx-auto size-8 opacity-25" />}
                                <span className="mt-3 block text-xs">{t("canvas.storyboard.noPreview")}</span>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-5 rounded-xl px-4 py-4" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                        <DetailRow label={t("canvas.storyboard.workbench.details.type")} value={t(`canvas.storyboard.workbench.types.${item.kind}`)} theme={theme} />
                        <DetailRow label={t("canvas.storyboard.workbench.details.status")} value={t(`canvas.storyboard.status.${item.status}`)} theme={theme} />
                        <DetailRow label={t("canvas.storyboard.workbench.details.group")} value={item.groupTitle || "-"} theme={theme} />
                        <DetailRow label={t("canvas.storyboard.workbench.details.model")} value={item.model || "-"} theme={theme} />
                        <DetailRow label={t("canvas.storyboard.workbench.details.size")} value={[itemSize(item), formatDuration(item.durationMs)].filter(Boolean).join(" · ") || "-"} theme={theme} />
                        <DetailRow label={t("canvas.storyboard.workbench.details.node")} value={item.nodeId} theme={theme} mono />
                    </div>

                    {item.prompt ? (
                        <div className="mt-4 rounded-xl px-4 py-4" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                            <div className="text-[11px] font-medium" style={{ color: theme.node.muted }}>
                                {t("canvas.storyboard.workbench.details.prompt")}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{item.prompt}</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ScriptDetail({
    item,
    nodes,
    theme,
    onClose,
    onLocate,
    onUpdateScript,
    onCreateStoryboardGrid,
    onClearStoryboardGrid,
    onConvertStoryboardGrid,
    onUngroupStoryboardGrid,
}: {
    item: StoryboardItem;
    nodes: CanvasNodeData[];
    theme: CanvasTheme;
    onClose: () => void;
    onLocate: (nodeId: string) => void;
    onUpdateScript: (nodeId: string, script: CanvasScriptV2) => void;
    onCreateStoryboardGrid: (scriptNodeId: string, script: CanvasScriptV2, options: CanvasStoryboardGridOptions, origin?: CanvasNodeData["position"]) => void;
    onClearStoryboardGrid: (scriptNodeId: string) => void;
    onConvertStoryboardGrid: (scriptNodeId: string) => void;
    onUngroupStoryboardGrid: (scriptNodeId: string) => void;
}) {
    const { t } = useTranslation();
    const { modal } = App.useApp();
    const [draft, setDraft] = useState(() => normalizeScriptV2(item.script));
    const [presetOpen, setPresetOpen] = useState(false);
    const [fieldsOpen, setFieldsOpen] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [promptEditorShotId, setPromptEditorShotId] = useState<string | null>(null);
    const [, setHistoryRevision] = useState(0);
    const draftRef = useRef(draft);
    const historyRef = useRef<{ past: CanvasScriptV2[]; future: CanvasScriptV2[] }>({ past: [], future: [] });
    const columnVisibility = normalizeScriptColumnVisibility(draft.columnVisibility);
    const visibleColumns = SCRIPT_V2_COLUMNS.filter((column) => columnVisibility[column.key]).map((column) => column.key);
    const visibleRows = filterScriptShots(draft);
    const activeFilterCount = (draft.filters || []).filter((filter) => filter.value.trim()).length;
    const promptEditorShot = promptEditorShotId ? draft.rows.find((row) => row.id === promptEditorShotId) : undefined;

    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    const commit = (next = draft) => {
        const current = draftRef.current;
        if (JSON.stringify(current) === JSON.stringify(next)) {
            setDraft(next);
            return;
        }
        historyRef.current.past = [...historyRef.current.past.slice(-49), current];
        historyRef.current.future = [];
        draftRef.current = next;
        setDraft(next);
        setHistoryRevision((value) => value + 1);
        onUpdateScript(item.nodeId, next);
    };
    const commitShot = (shotId: string, patch: Parameters<typeof updateScriptShot>[2]) => {
        if (Object.prototype.hasOwnProperty.call(patch, "imageGenerationPrompt")) {
            commit(updateScriptPrompt(draftRef.current, shotId, String(patch.imageGenerationPrompt || ""), "manual"));
            return;
        }
        commit(updateScriptShot(draftRef.current, shotId, patch));
    };
    const composeAllPrompts = () => {
        const current = draftRef.current;
        const next = composeAllScriptPrompts(current);
        if (next === current) return;
        const run = () => commit(next);
        if (!current.rows.some((row) => row.imageGenerationPrompt?.trim())) {
            run();
            return;
        }
        modal.confirm({
            title: t("canvas.storyboard.workbench.promptEditor.composeAllConfirmTitle"),
            content: t("canvas.storyboard.workbench.promptEditor.composeAllConfirmDescription"),
            okText: t("canvas.storyboard.workbench.promptEditor.composeAllConfirmAction"),
            cancelText: t("common.cancel"),
            onOk: run,
        });
    };
    const setViewMode = (viewMode: CanvasScriptViewMode) => {
        const next = updateScriptViewMode(draftRef.current, viewMode);
        commit(viewMode === "asset" ? syncScriptAssetsFromShots(next) : next);
    };
    const toggleColumn = (column: CanvasScriptColumnKey, visible: boolean) => {
        commit(updateScriptColumnVisibility(draft, column, visible));
    };
    const setAllColumns = (visible: boolean) => {
        commit({
            ...draft,
            columnVisibility: Object.fromEntries(SCRIPT_V2_COLUMNS.map((column) => [column.key, visible])),
        });
    };
    const applyHistory = (direction: "undo" | "redo") => {
        const history = historyRef.current;
        const target = direction === "undo" ? history.past.at(-1) : history.future[0];
        if (!target) return;
        const current = draftRef.current;
        if (direction === "undo") {
            history.past = history.past.slice(0, -1);
            history.future = [current, ...history.future].slice(0, 50);
        } else {
            history.past = [...history.past.slice(-49), current];
            history.future = history.future.slice(1);
        }
        draftRef.current = target;
        setDraft(target);
        setHistoryRevision((value) => value + 1);
        onUpdateScript(item.nodeId, target);
    };

    return (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col" style={{ background: theme.canvas.background }}>
            <div className="flex h-[52px] shrink-0 items-center gap-2 px-4" style={{ borderColor: theme.toolbar.border, borderBottomWidth: 1 }}>
                <ScrollText className="size-4 shrink-0" style={{ color: theme.node.muted }} />
                <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</h2>
                <IconButton theme={theme} label={t("canvas.undo")} disabled={!historyRef.current.past.length} onClick={() => applyHistory("undo")}>
                    <Undo2 className="size-4" />
                </IconButton>
                <IconButton theme={theme} label={t("canvas.redo")} disabled={!historyRef.current.future.length} onClick={() => applyHistory("redo")}>
                    <Redo2 className="size-4" />
                </IconButton>
                <IconButton theme={theme} label={t("canvas.storyboard.workbench.locate")} onClick={() => onLocate(item.nodeId)}>
                    <LocateFixed className="size-4" />
                </IconButton>
                <IconButton theme={theme} label={t("canvas.storyboard.workbench.close")} onClick={onClose}>
                    <X className="size-4" />
                </IconButton>
            </div>
            <div className="thin-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mx-auto w-full min-w-0 max-w-[980px]">
                    <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
                        {[
                            t("canvas.storyboard.workbench.stages.confirm"),
                            t("canvas.storyboard.workbench.stages.assets"),
                            t("canvas.storyboard.workbench.stages.prompts"),
                        ].map((label, index) => (
                            <span key={label} className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: index === 0 ? theme.toolbar.activeBg : theme.node.panel, color: index === 0 ? theme.toolbar.activeText : theme.node.muted }}>
                                {index + 1}. {label}
                            </span>
                        ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex rounded-lg p-0.5" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                            {[
                                { value: "table" as const, icon: <Table2 className="size-3.5" /> },
                                { value: "creative" as const, icon: <WandSparkles className="size-3.5" /> },
                                { value: "asset" as const, icon: <Boxes className="size-3.5" /> },
                            ].map((view) => {
                                const active = (draft.viewMode || "table") === view.value;
                                return (
                                    <button
                                        key={view.value}
                                        type="button"
                                        aria-pressed={active}
                                        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                        style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted }}
                                        onClick={() => setViewMode(view.value)}
                                    >
                                        {view.icon}
                                        {t(`canvas.storyboard.workbench.views.${view.value}`)}
                                    </button>
                                );
                            })}
                        </div>
                        {(draft.viewMode || "table") === "table" ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    aria-expanded={fieldsOpen}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                    style={{ color: theme.node.muted, border: `0.5px solid ${theme.toolbar.border}` }}
                                    onClick={() => setFieldsOpen((current) => !current)}
                                >
                                    <Columns3 className="size-3.5" />
                                    {t("canvas.storyboard.workbench.fieldsButton")}
                                    <span className="tabular-nums">
                                        {visibleColumns.length}/{SCRIPT_V2_COLUMNS.length}
                                    </span>
                                </button>
                                {fieldsOpen ? (
                                    <div className="absolute left-0 top-9 z-30 w-[240px] rounded-xl p-2 shadow-2xl" style={{ background: theme.toolbar.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                                        <div className="mb-1.5 flex items-center gap-2 px-1">
                                            <span className="text-[10px] font-medium">{t("canvas.storyboard.workbench.fieldsVisibility")}</span>
                                            <button type="button" className="ml-auto text-[9px]" style={{ color: theme.node.muted }} onClick={() => setAllColumns(true)}>
                                                {t("canvas.storyboard.workbench.showAllFields")}
                                            </button>
                                            <button type="button" className="text-[9px]" style={{ color: theme.node.muted }} onClick={() => setAllColumns(false)}>
                                                {t("canvas.storyboard.workbench.hideAllFields")}
                                            </button>
                                        </div>
                                        <div className="thin-scrollbar grid max-h-64 grid-cols-2 gap-0.5 overflow-y-auto">
                                            {SCRIPT_V2_COLUMNS.map((column) => (
                                                <label key={column.key} className="flex h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[10px] hover:bg-black/5 dark:hover:bg-white/10">
                                                    <input
                                                        type="checkbox"
                                                        checked={columnVisibility[column.key]}
                                                        style={{ accentColor: theme.node.text }}
                                                        onChange={(event) => toggleColumn(column.key, event.target.checked)}
                                                    />
                                                    <span className="truncate">{t(`canvas.storyboard.workbench.fields.${column.labelKey}`)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {(draft.viewMode || "table") === "table" ? (
                            <button
                                type="button"
                                aria-expanded={filtersOpen}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ color: activeFilterCount ? theme.node.text : theme.node.muted, border: `0.5px solid ${theme.toolbar.border}` }}
                                onClick={() => setFiltersOpen((current) => !current)}
                            >
                                <ListFilter className="size-3.5" />
                                {t("canvas.storyboard.workbench.filters.button")}
                                {activeFilterCount ? <span className="tabular-nums">{activeFilterCount}</span> : null}
                            </button>
                        ) : null}
                    </div>

                    {(draft.viewMode || "table") === "table" && filtersOpen ? (
                        <CanvasScriptFilterPanel
                            filters={draft.filters || []}
                            theme={theme}
                            onChange={(filters) => commit(updateScriptFilters(draftRef.current, filters))}
                        />
                    ) : null}

                    <div className="mt-4 rounded-xl p-4" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-medium">{t("canvas.storyboard.workbench.scriptSettings")}</h3>
                            <button
                                type="button"
                                className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ background: draft.preset ? theme.toolbar.activeBg : "transparent", color: draft.preset ? theme.toolbar.activeText : theme.node.muted, border: `0.5px solid ${theme.toolbar.border}` }}
                                onClick={() => setPresetOpen(true)}
                            >
                                <Sparkles className="size-3" />
                                {draft.preset ? t("canvas.storyboard.workbench.scriptPreset.configured") : t("canvas.storyboard.workbench.scriptPreset.open")}
                            </button>
                            <span className="ml-auto text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                                {t("canvas.storyboard.workbench.scriptDuration", { seconds: scriptDurationSeconds(draft) })}
                            </span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <ScriptField label={t("canvas.storyboard.workbench.fields.theme")} theme={theme}>
                                <input value={draft.theme || ""} onChange={(event) => setDraft(updateScriptMeta(draft, { theme: event.target.value }))} onBlur={() => commit()} className="h-8 w-full rounded-lg border px-2.5 text-xs outline-none" style={scriptInputStyle(theme)} />
                            </ScriptField>
                            <ScriptField label={t("canvas.storyboard.workbench.fields.aspectRatio")} theme={theme}>
                                <input value={draft.aspectRatio || ""} onChange={(event) => setDraft(updateScriptMeta(draft, { aspectRatio: event.target.value }))} onBlur={() => commit()} className="h-8 w-full rounded-lg border px-2.5 text-xs outline-none" style={scriptInputStyle(theme)} />
                            </ScriptField>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <ScriptField label={t("canvas.storyboard.workbench.fields.style")} theme={theme}>
                                <textarea value={draft.styleDescription || ""} onChange={(event) => setDraft(updateScriptMeta(draft, { styleDescription: event.target.value }))} onBlur={() => commit()} rows={3} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                            </ScriptField>
                            <ScriptField label={t("canvas.storyboard.workbench.fields.story")} theme={theme}>
                                <textarea value={draft.originalStoryText || ""} onChange={(event) => setDraft(updateScriptMeta(draft, { originalStoryText: event.target.value }))} onBlur={() => commit()} rows={3} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                            </ScriptField>
                        </div>
                    </div>

                    {(draft.viewMode || "table") === "asset" ? (
                        <>
                            <div className="mt-5 flex items-center gap-3">
                                <h3 className="text-sm font-medium">{t("canvas.storyboard.workbench.assets.title")}</h3>
                                <span className="text-[10px]" style={{ color: theme.node.muted }}>
                                    {t("canvas.storyboard.workbench.shotCount", { count: draft.rows.length })}
                                </span>
                            </div>
                            <CanvasScriptAssetSummary
                                script={draft}
                                theme={theme}
                                onAddAsset={(kind, name) => commit(addScriptAsset(draftRef.current, kind, name))}
                                onBindAsset={(kind, assetId, reference) => commit(bindScriptAssetReference(draftRef.current, kind, assetId, reference))}
                                onRemoveAsset={(kind, assetId) => commit(removeScriptAsset(draftRef.current, kind, assetId))}
                                onSyncAssets={() => commit(syncScriptAssetsFromShots(draftRef.current))}
                            />
                            <CanvasScriptStoryboardGrid
                                script={draft}
                                scriptNodeId={item.nodeId}
                                nodes={nodes}
                                theme={theme}
                                onCreate={(scriptNodeId, script, options, origin) => {
                                    commit(script);
                                    onCreateStoryboardGrid(scriptNodeId, script, options, origin);
                                }}
                                onClear={onClearStoryboardGrid}
                                onConvert={onConvertStoryboardGrid}
                                onUngroup={onUngroupStoryboardGrid}
                            />
                        </>
                    ) : (
                        <>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <h3 className="text-sm font-medium">{t("canvas.storyboard.workbench.shotTable")}</h3>
                        <span className="text-[10px]" style={{ color: theme.node.muted }}>
                            {activeFilterCount
                                ? t("canvas.storyboard.workbench.filteredShotCount", { visible: visibleRows.length, total: draft.rows.length })
                                : t("canvas.storyboard.workbench.shotCount", { count: draft.rows.length })}
                        </span>
                        <button
                            type="button"
                            disabled={!draft.rows.length}
                            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10"
                            style={{ color: theme.node.text }}
                            onClick={composeAllPrompts}
                        >
                            <WandSparkles className="size-3.5" />
                            {t("canvas.storyboard.workbench.promptEditor.composeAll")}
                        </button>
                        <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: theme.node.text }}
                            onClick={() => {
                                const next = addScriptShot(draft);
                                commit(next);
                            }}
                        >
                            <Plus className="size-3.5" />
                            {t("canvas.storyboard.workbench.addShot")}
                        </button>
                    </div>

                    {draft.rows.length ? (
                        (draft.viewMode || "table") === "table" ? (
                            <CanvasScriptTable
                                script={draft}
                                visibleColumns={visibleColumns}
                                theme={theme}
                                onCommitShot={commitShot}
                                onInsertShot={(shotId) => {
                                    const index = draftRef.current.rows.findIndex((row) => row.id === shotId);
                                    commit(insertScriptShot(draftRef.current, index + 1));
                                }}
                                onDuplicateShot={(shotId) => commit(duplicateScriptShot(draftRef.current, shotId))}
                                onMoveShot={(shotId, targetShotId) => commit(moveScriptShotToTarget(draftRef.current, shotId, targetShotId))}
                                onOpenPrompt={setPromptEditorShotId}
                                onRemoveShot={(shotId) => commit(removeScriptShot(draftRef.current, shotId))}
                            />
                        ) : (
                        <div className="mt-2 space-y-3">
                            {draft.rows.map((row) => (
                                <div key={row.id} className="rounded-xl p-3.5" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
                                    <div className="grid gap-2 sm:grid-cols-[72px_88px_1fr_1fr_32px]">
                                        <div className="flex h-8 items-center text-xs font-medium">#{row.shotNumber}</div>
                                        <label className="flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[10px]" style={scriptInputStyle(theme)}>
                                            <input
                                                type="number"
                                                min={1}
                                                value={row.durationSeconds}
                                                onChange={(event) => setDraft(updateScriptShot(draft, row.id, { durationSeconds: Math.max(1, Number(event.target.value) || 1) }))}
                                                onBlur={() => commit()}
                                                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                                                aria-label={t("canvas.storyboard.workbench.fields.duration")}
                                            />
                                            <span style={{ color: theme.node.muted }}>{t("canvas.storyboard.workbench.seconds")}</span>
                                        </label>
                                        <select
                                            value={row.shotSize || ""}
                                            aria-label={t("canvas.storyboard.workbench.fields.shotSize")}
                                            onChange={(event) => commit(updateScriptShot(draftRef.current, row.id, { shotSize: event.target.value }))}
                                            className="h-8 rounded-lg border px-2 text-xs outline-none"
                                            style={scriptInputStyle(theme)}
                                        >
                                            <option value="">{t("canvas.storyboard.workbench.shotSizes.none")}</option>
                                            {SCRIPT_V2_SHOT_SIZES.map((shotSize) => (
                                                <option key={shotSize.value} value={shotSize.value}>
                                                    {t(`canvas.storyboard.workbench.shotSizes.${shotSize.labelKey}`)}
                                                </option>
                                            ))}
                                            {row.shotSize && !SCRIPT_V2_SHOT_SIZES.some((shotSize) => shotSize.value === row.shotSize) ? <option value={row.shotSize}>{row.shotSize}</option> : null}
                                        </select>
                                        <input value={row.emotion || ""} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { emotion: event.target.value }))} onBlur={() => commit()} placeholder={t("canvas.storyboard.workbench.fields.emotion")} className="h-8 rounded-lg border px-2.5 text-xs outline-none" style={scriptInputStyle(theme)} />
                                        <button
                                            type="button"
                                            className="grid size-8 place-items-center rounded-lg transition hover:bg-red-500/10"
                                            style={{ color: theme.node.muted }}
                                            aria-label={t("canvas.storyboard.workbench.removeShot")}
                                            title={t("canvas.storyboard.workbench.removeShot")}
                                            onClick={() => {
                                                const next = removeScriptShot(draft, row.id);
                                                commit(next);
                                            }}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.plot")} theme={theme}>
                                            <textarea value={row.plotDescription} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { plotDescription: event.target.value }))} onBlur={() => commit()} rows={3} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                                        </ScriptField>
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.dialogue")} theme={theme}>
                                            <textarea value={row.dialogue || ""} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { dialogue: event.target.value }))} onBlur={() => commit()} rows={3} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                                        </ScriptField>
                                    </div>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.lighting")} theme={theme}>
                                            <textarea value={row.lightingAndAtmosphere || ""} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { lightingAndAtmosphere: event.target.value }))} onBlur={() => commit()} rows={2} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                                        </ScriptField>
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.audio")} theme={theme}>
                                            <textarea value={row.audioEffects || ""} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { audioEffects: event.target.value }))} onBlur={() => commit()} rows={2} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                                        </ScriptField>
                                    </div>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.imagePrompt")} theme={theme}>
                                            <textarea
                                                key={`${row.id}-${row.promptVersion || 0}`}
                                                defaultValue={row.imageGenerationPrompt || ""}
                                                onBlur={(event) => commitShot(row.id, { imageGenerationPrompt: event.target.value })}
                                                rows={3}
                                                className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none"
                                                style={scriptInputStyle(theme)}
                                            />
                                        </ScriptField>
                                        <ScriptField label={t("canvas.storyboard.workbench.fields.videoPrompt")} theme={theme}>
                                            <textarea value={row.videoMotionPrompt || ""} onChange={(event) => setDraft(updateScriptShot(draft, row.id, { videoMotionPrompt: event.target.value }))} onBlur={() => commit()} rows={3} className="w-full resize-y rounded-lg border px-2.5 py-2 text-xs leading-5 outline-none" style={scriptInputStyle(theme)} />
                                        </ScriptField>
                                    </div>
                                </div>
                            ))}
                        </div>
                        )
                    ) : (
                        <div className="mt-2 rounded-xl px-5 py-10 text-center" style={{ background: theme.node.panel, border: `0.5px dashed ${theme.toolbar.border}` }}>
                            <ScrollText className="mx-auto size-8 opacity-20" />
                            <p className="mt-3 text-xs" style={{ color: theme.node.muted }}>
                                {t("canvas.storyboard.workbench.emptyShots")}
                            </p>
                            <button
                                type="button"
                                className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
                                style={{ background: theme.toolbar.activeBg, color: theme.toolbar.activeText }}
                                onClick={() => commit(addScriptShot(draft))}
                            >
                                <Plus className="size-3.5" />
                                {t("canvas.storyboard.workbench.addShot")}
                            </button>
                        </div>
                    )}
                        </>
                    )}
                </div>
            </div>
            {promptEditorShot ? (
                <CanvasScriptPromptEditor
                    script={draft}
                    shot={promptEditorShot}
                    theme={theme}
                    onClose={() => setPromptEditorShotId(null)}
                    onSave={(prompt) => commitShot(promptEditorShot.id, { imageGenerationPrompt: prompt })}
                    onRestore={(version) => commit(restoreScriptPrompt(draftRef.current, promptEditorShot.id, version))}
                />
            ) : null}
            <CanvasScriptPresetModal
                open={presetOpen}
                preset={draft.preset}
                theme={theme}
                onClose={() => setPresetOpen(false)}
                onConfirm={(preset) => {
                    commit(applyScriptPresetToScript(draft, preset));
                    setPresetOpen(false);
                }}
            />
        </div>
    );
}

function scriptInputStyle(theme: CanvasTheme) {
    return { background: theme.canvas.background, borderColor: theme.toolbar.border, color: theme.node.text };
}

function ScriptField({ label, theme, children }: { label: string; theme: CanvasTheme; children: ReactNode }) {
    return (
        <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-medium" style={{ color: theme.node.muted }}>
                {label}
            </span>
            {children}
        </label>
    );
}

function DetailRow({ label, value, theme, mono = false }: { label: string; value: string; theme: CanvasTheme; mono?: boolean }) {
    return (
        <div className="flex gap-4 border-b py-2.5 text-xs last:border-b-0" style={{ borderColor: theme.toolbar.border }}>
            <span className="w-20 shrink-0" style={{ color: theme.node.muted }}>
                {label}
            </span>
            <span className={cn("min-w-0 flex-1 break-words", mono && "font-mono text-[10px]")}>{value}</span>
        </div>
    );
}
