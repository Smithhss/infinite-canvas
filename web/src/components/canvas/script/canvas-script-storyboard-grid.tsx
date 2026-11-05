import { useEffect, useState } from "react";
import { App } from "antd";
import { Grid2X2, RefreshCw, Trash2, Ungroup } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CanvasTheme } from "@/lib/canvas-theme";
import {
    findStoryboardGridGroup,
    storyboardGridStateDetails,
    storyboardGridOptionsMatch,
    STORYBOARD_GRID_ASPECT_RATIOS,
    STORYBOARD_GRID_MAX_SHOTS,
    STORYBOARD_GRID_MAX_COLUMNS,
    STORYBOARD_GRID_MIN_COLUMNS,
    type CanvasStoryboardGridOptions,
} from "@/lib/canvas/storyboard-grid";
import type { CanvasNodeData, CanvasScriptV2 } from "@/types/canvas";

type Props = {
    script: CanvasScriptV2;
    scriptNodeId: string;
    nodes: CanvasNodeData[];
    theme: CanvasTheme;
    onCreate: (scriptNodeId: string, script: CanvasScriptV2, options: CanvasStoryboardGridOptions, origin?: CanvasNodeData["position"]) => void;
    onClear: (scriptNodeId: string) => void;
    onConvert: (scriptNodeId: string) => void;
};

export function CanvasScriptStoryboardGrid({ script, scriptNodeId, nodes, theme, onCreate, onClear, onConvert }: Props) {
    const { t } = useTranslation();
    const { modal } = App.useApp();
    const group = findStoryboardGridGroup(scriptNodeId, nodes);
    const status = storyboardGridStateDetails(script, group, nodes);
    const state = status.state;
    const stored = group?.metadata?.storyboardGrid;
    const [columns, setColumns] = useState(stored?.columns || 4);
    const [showShotNumbers, setShowShotNumbers] = useState(stored?.showShotNumbers !== false);
    const [aspectRatio, setAspectRatio] = useState(stored?.aspectRatio || script.aspectRatio || "16:9");
    const shotCount = Math.min(script.rows.length, STORYBOARD_GRID_MAX_SHOTS);
    const options = { columns, showShotNumbers, aspectRatio };
    const optionsChanged = Boolean(stored) && !storyboardGridOptionsMatch(group, options, script.aspectRatio);
    const stateLabel = !group ? "missing" : state === "stale" ? "stale" : optionsChanged ? "settings" : state;
    const stateColor = stateLabel === "ready" ? "#16a34a" : stateLabel === "stale" || stateLabel === "settings" ? "#d97706" : theme.node.muted;

    useEffect(() => {
        if (!stored) return;
        setColumns(stored.columns);
        setShowShotNumbers(stored.showShotNumbers);
        setAspectRatio(stored.aspectRatio);
    }, [group?.id, stored?.columns, stored?.showShotNumbers, stored?.aspectRatio]);

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
                    rows: Math.max(1, Math.ceil(shotCount / columns)),
                    ratio: aspectRatio,
                })
                : t("canvas.storyboard.workbench.storyboardGrid.applySettingsDescription", { columns, rows: Math.max(1, Math.ceil(shotCount / columns)), ratio: aspectRatio }),
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
                <span className="text-[10px]" style={{ color: theme.node.muted }}>{t("canvas.storyboard.workbench.storyboardGrid.columns")}</span>
                {Array.from({ length: STORYBOARD_GRID_MAX_COLUMNS - STORYBOARD_GRID_MIN_COLUMNS + 1 }, (_, index) => index + STORYBOARD_GRID_MIN_COLUMNS).map((value) => {
                    const active = columns === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            aria-pressed={active}
                            className="grid size-7 place-items-center rounded-md text-[10px] font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted, border: `0.5px solid ${active ? "transparent" : theme.toolbar.border}` }}
                            onClick={() => setColumns(value)}
                        >
                            {value}
                        </button>
                    );
                })}
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
                    {t("canvas.storyboard.workbench.storyboardGrid.layout", { columns, rows: Math.max(1, Math.ceil(shotCount / columns)), ratio: aspectRatio })}
                </span>
            </div>

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
                            <Ungroup className="size-3.5" />
                            {t("canvas.storyboard.workbench.storyboardGrid.convert")}
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
