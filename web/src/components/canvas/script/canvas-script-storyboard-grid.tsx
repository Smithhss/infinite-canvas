import { useEffect, useState } from "react";
import { App, Popover } from "antd";
import { Grid2X2, RefreshCw, Trash2, Ungroup } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import {
    findStoryboardGridGroup,
    hasLockedStoryboardGridNodes,
    storyboardGridStateDetails,
    storyboardGridOptionsMatch,
    STORYBOARD_GRID_ASPECT_RATIOS,
    STORYBOARD_GRID_MAX_SHOTS,
    STORYBOARD_GRID_MAX_COLUMNS,
    STORYBOARD_GRID_MAX_ROWS,
    STORYBOARD_GRID_MIN_COLUMNS,
    STORYBOARD_GRID_MIN_ROWS,
    type CanvasStoryboardGridOptions,
} from "@/lib/canvas/storyboard-grid";
import type { CanvasNodeData, CanvasScriptV2 } from "@/types/canvas";

const GRID_PRESETS = [2, 3, 4, 5] as const;

type Props = {
    script: CanvasScriptV2;
    scriptNodeId: string;
    nodes: CanvasNodeData[];
    theme: CanvasTheme;
    onCreate: (scriptNodeId: string, script: CanvasScriptV2, options: CanvasStoryboardGridOptions, origin?: CanvasNodeData["position"]) => void;
    onClear: (scriptNodeId: string) => void;
    onConvert: (scriptNodeId: string) => void;
    onUngroup: (scriptNodeId: string) => void;
};

export function CanvasScriptStoryboardGrid({ script, scriptNodeId, nodes, theme, onCreate, onClear, onConvert, onUngroup }: Props) {
    const { t } = useTranslation();
    const { modal, message } = App.useApp();
    const group = findStoryboardGridGroup(scriptNodeId, nodes);
    const status = storyboardGridStateDetails(script, group, nodes);
    const state = status.state;
    const stored = group?.metadata?.storyboardGrid;
    const [columns, setColumns] = useState(stored?.columns || 4);
    const [rows, setRows] = useState<number | undefined>(stored?.rows);
    const [showShotNumbers, setShowShotNumbers] = useState(stored?.showShotNumbers !== false);
    const [aspectRatio, setAspectRatio] = useState(stored?.aspectRatio || script.aspectRatio || "16:9");
    const [customGridOpen, setCustomGridOpen] = useState(false);
    const [hoveredGrid, setHoveredGrid] = useState<{ rows: number; columns: number } | null>(null);
    const shotCount = Math.min(script.rows.length, STORYBOARD_GRID_MAX_SHOTS);
    const layoutRows = rows ?? Math.max(1, Math.ceil(shotCount / columns));
    const capacity = columns * layoutRows;
    const options = { columns, rows, showShotNumbers, aspectRatio };
    const optionsChanged = Boolean(stored) && !storyboardGridOptionsMatch(group, options, script.aspectRatio);
    const stateLabel = !group ? "missing" : state === "stale" ? "stale" : optionsChanged ? "settings" : state;
    const stateColor = stateLabel === "ready" ? "#16a34a" : stateLabel === "stale" || stateLabel === "settings" ? "#d97706" : theme.node.muted;
    const locked = hasLockedStoryboardGridNodes(scriptNodeId, nodes);

    useEffect(() => {
        if (!stored) return;
        setColumns(stored.columns);
        setRows(stored.rows);
        setShowShotNumbers(stored.showShotNumbers);
        setAspectRatio(stored.aspectRatio);
    }, [group?.id, stored?.columns, stored?.rows, stored?.showShotNumbers, stored?.aspectRatio]);

    const create = () => {
        const run = () => onCreate(scriptNodeId, script, options, group?.position);
        if (!group) {
            run();
            return;
        }
        modal.confirm({
            title: t(state === "stale" ? "canvas.storyboard.workbench.storyboardGrid.rebindTitle" : "canvas.storyboard.workbench.storyboardGrid.applySettingsTitle"),
            content: state === "stale"
                ? t(status.reason === "nodes-invalid"
                    ? optionsChanged
                        ? "canvas.storyboard.workbench.storyboardGrid.rebindNodesWithSettingsDescription"
                        : "canvas.storyboard.workbench.storyboardGrid.rebindNodesDescription"
                    : optionsChanged
                      ? "canvas.storyboard.workbench.storyboardGrid.rebindWithSettingsDescription"
                      : "canvas.storyboard.workbench.storyboardGrid.rebindDescription", {
                    oldCount: stored?.shotOrder.length || 0,
                    newCount: shotCount,
                    columns,
                    rows: layoutRows,
                    ratio: aspectRatio,
                })
                : t("canvas.storyboard.workbench.storyboardGrid.applySettingsDescription", { columns, rows: layoutRows, ratio: aspectRatio }),
            okText: t(state === "stale" ? "canvas.storyboard.workbench.storyboardGrid.rebind" : "canvas.storyboard.workbench.storyboardGrid.applySettings"),
            cancelText: t("common.cancel"),
            onOk: run,
        });
    };

    const clear = () => {
        modal.confirm({
            title: t("canvas.storyboard.workbench.storyboardGrid.clearTitle"),
            content: t("canvas.storyboard.workbench.storyboardGrid.clearDescription"),
            okText: t("canvas.storyboard.workbench.storyboardGrid.clear"),
            cancelText: t("common.cancel"),
            okButtonProps: { danger: true },
            onOk: () => onClear(scriptNodeId),
        });
    };

    const ungroup = () => {
        if (locked) {
            message.warning(t("canvas.node.lockedAction"));
            return;
        }
        modal.confirm({
            title: t("canvas.storyboard.workbench.storyboardGrid.ungroupTitle"),
            content: t("canvas.storyboard.workbench.storyboardGrid.ungroupDescription"),
            okText: t("canvas.storyboard.workbench.storyboardGrid.ungroup"),
            cancelText: t("common.cancel"),
            onOk: () => onUngroup(scriptNodeId),
        });
    };

    const selectPreset = (size: number) => {
        setColumns(size);
        setRows(size);
    };

    const selectCustomGrid = (nextRows: number, nextColumns: number) => {
        setColumns(nextColumns);
        setRows(nextRows);
        setCustomGridOpen(false);
        setHoveredGrid(null);
    };

    const customGrid = (
        <div className="w-40" onMouseLeave={() => setHoveredGrid(null)} data-canvas-shortcuts-ignore>
            <div className="mb-2 text-center text-[11px] font-medium tabular-nums" style={{ color: theme.node.text }}>
                {hoveredGrid ? `${hoveredGrid.rows} × ${hoveredGrid.columns}` : `${layoutRows} × ${columns}`}
            </div>
            <div className="grid grid-cols-5 gap-1">
                {Array.from({ length: STORYBOARD_GRID_MAX_ROWS }, (_, rowIndex) => rowIndex + STORYBOARD_GRID_MIN_ROWS).flatMap((row) =>
                    Array.from({ length: STORYBOARD_GRID_MAX_COLUMNS }, (_, columnIndex) => columnIndex + STORYBOARD_GRID_MIN_COLUMNS).map((column) => {
                        const highlighted = (hoveredGrid || { rows: layoutRows, columns }).rows >= row && (hoveredGrid || { rows: layoutRows, columns }).columns >= column;
                        return (
                            <button
                                key={`${row}-${column}`}
                                type="button"
                                aria-label={`${row} × ${column}`}
                                className="grid size-6 place-items-center rounded-[4px] transition-colors"
                                style={{ background: highlighted ? theme.toolbar.activeBg : "transparent" }}
                                onMouseEnter={() => setHoveredGrid({ rows: row, columns: column })}
                                onFocus={() => setHoveredGrid({ rows: row, columns: column })}
                                onClick={() => selectCustomGrid(row, column)}
                            >
                                <span
                                    className="size-1.5 rounded-full"
                                    style={{ background: highlighted ? theme.toolbar.activeText : theme.node.muted, opacity: highlighted ? 1 : 0.35 }}
                                />
                            </button>
                        );
                    }),
                )}
            </div>
        </div>
    );

    return (
        <section className="mt-4 rounded-xl p-4" style={{ background: theme.node.panel, border: `0.5px solid ${theme.toolbar.border}` }}>
            <div className="flex flex-wrap items-center gap-2">
                <Grid2X2 className="size-4" style={{ color: theme.node.muted }} />
                <h3 className="text-sm font-medium">{t("canvas.storyboard.workbench.storyboardGrid.title")}</h3>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ color: stateColor, background: `${stateColor}14` }}>
                    {t(`canvas.storyboard.workbench.storyboardGrid.state.${stateLabel}`)}
                </span>
                <span className="ml-auto text-[10px] tabular-nums" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.storyboardGrid.shotCount", { count: shotCount, max: STORYBOARD_GRID_MAX_SHOTS })}
                </span>
            </div>
            <p className="mt-2 text-[10px] leading-5" style={{ color: theme.node.muted }}>
                {t("canvas.storyboard.workbench.storyboardGrid.description")}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px]" style={{ color: theme.node.muted }}>{t("canvas.storyboard.workbench.storyboardGrid.grid")}</span>
                {GRID_PRESETS.map((value) => {
                    const active = rows === value && columns === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={active}
                            className="grid h-7 min-w-10 place-items-center rounded-md px-1.5 text-[10px] font-medium tabular-nums transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted, border: `0.5px solid ${active ? "transparent" : theme.toolbar.border}` }}
                            onClick={() => selectPreset(value)}
                        >
                            {value}×{value}
                        </button>
                    );
                })}
                <Popover
                    trigger="click"
                    open={customGridOpen}
                    onOpenChange={setCustomGridOpen}
                    content={customGrid}
                    placement="bottomLeft"
                >
                    <button
                        type="button"
                        aria-pressed={!GRID_PRESETS.some((value) => rows === value && columns === value)}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium tabular-nums transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.node.muted, border: `0.5px solid ${theme.toolbar.border}` }}
                    >
                        <Grid2X2 className="size-3" />
                        {t("canvas.storyboard.workbench.storyboardGrid.custom")}
                        <span>{layoutRows}×{columns}</span>
                    </button>
                </Popover>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[10px]" style={{ color: theme.node.muted }}>{t("canvas.storyboard.workbench.storyboardGrid.aspectRatio")}</span>
                {STORYBOARD_GRID_ASPECT_RATIOS.map((value) => {
                    const active = aspectRatio === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={active}
                            className="h-7 rounded-md px-2 text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted, border: `0.5px solid ${active ? "transparent" : theme.toolbar.border}` }}
                            onClick={() => setAspectRatio(value)}
                        >
                            {value}
                        </button>
                    );
                })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="ml-2 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[10px]" style={{ color: theme.node.muted, border: `0.5px solid ${theme.toolbar.border}` }}>
                    <input type="checkbox" checked={showShotNumbers} style={{ accentColor: theme.node.text }} onChange={(event) => setShowShotNumbers(event.target.checked)} />
                    {t("canvas.storyboard.workbench.storyboardGrid.showNumbers")}
                </label>
                <span className="text-[10px]" style={{ color: theme.node.muted }}>
                    {t("canvas.storyboard.workbench.storyboardGrid.layout", { columns, rows: layoutRows, ratio: aspectRatio })}
                </span>
            </div>
            {capacity < shotCount ? (
                <p className="mt-2 text-[10px] leading-5" style={{ color: "#d97706" }}>
                    {t("canvas.storyboard.workbench.storyboardGrid.capacityHint", { capacity, count: shotCount - capacity })}
                </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={!shotCount || (state === "ready" && !optionsChanged)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
                    style={{ color: theme.node.text, border: `0.5px solid ${theme.toolbar.border}` }}
                    onClick={create}
                >
                    {group ? <RefreshCw className="size-3.5" /> : <Grid2X2 className="size-3.5" />}
                    {state === "ready" && !optionsChanged
                        ? t("canvas.storyboard.workbench.storyboardGrid.bound")
                        : state === "stale"
                          ? t("canvas.storyboard.workbench.storyboardGrid.rebind")
                          : optionsChanged
                            ? t("canvas.storyboard.workbench.storyboardGrid.applySettings")
                            : t("canvas.storyboard.workbench.storyboardGrid.create")}
                </button>
                {group ? (
                    <>
                        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.muted }} onClick={() => onConvert(scriptNodeId)}>
                            <Grid2X2 className="size-3.5" />
                            {t("canvas.storyboard.workbench.storyboardGrid.convert")}
                        </button>
                        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.muted }} onClick={ungroup}>
                            <Ungroup className="size-3.5" />
                            {t("canvas.storyboard.workbench.storyboardGrid.ungroup")}
                        </button>
                        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] transition hover:bg-red-500/10" style={{ color: "#dc2626" }} onClick={clear}>
                            <Trash2 className="size-3.5" />
                            {t("canvas.storyboard.workbench.storyboardGrid.clear")}
                        </button>
                    </>
                ) : null}
            </div>
        </section>
    );
}
