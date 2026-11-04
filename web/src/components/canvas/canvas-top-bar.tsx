import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
    ArrowLeft,
    BookOpen,
    Bot,
    Clapperboard,
    CloudCheck,
    CloudOff,
    Download,
    GitBranch,
    Home,
    Images,
    Keyboard,
    Languages,
    LayoutGrid,
    LoaderCircle,
    Menu,
    Moon,
    Orbit,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Puzzle,
    Redo2,
    Settings2,
    Sparkles,
    Sun,
    Trash2,
    Undo2,
    Upload,
} from "lucide-react";
import { Button, Dropdown, Modal, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { canvasThemes, type CanvasTheme } from "@/lib/canvas-theme";
import { canvasTopBarLayout } from "@/lib/canvas/canvas-chrome";
import { useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { DOCS_URL } from "@/constant/env";
import { changeAppLocale, type AppLocale } from "@/i18n";
import { cn } from "@/lib/utils";
import type { CanvasSaveStatus } from "@/stores/canvas/canvas-save-status-store";
import type { CanvasWorkspaceView } from "@/types/canvas";

export function CanvasTopBar({
    title,
    titleDraft,
    isTitleEditing,
    onTitleDraftChange,
    onStartTitleEditing,
    onFinishTitleEditing,
    onCancelTitleEditing,
    canUndo,
    canRedo,
    onHome,
    onProjects,
    onCreateProject,
    onDeleteProject,
    onExportProject,
    onImportImage,
    onOpenPlugins,
    onUndo,
    onRedo,
    agentOpen,
    compactAgentStatus,
    onToggleAgent,
    builtinAgentEnabled,
    builtinAgentOpen,
    onToggleBuiltinAgent,
    directorEnabled,
    directorOpen,
    onOpenDirector,
    panoramaAvailable,
    onViewPanorama,
    saveStatus,
    workspaceView,
    onWorkspaceViewChange,
    variant = "classic",
}: {
    title: string;
    titleDraft: string;
    isTitleEditing: boolean;
    onTitleDraftChange: (value: string) => void;
    onStartTitleEditing: () => void;
    onFinishTitleEditing: () => void;
    onCancelTitleEditing: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onHome: () => void;
    onProjects: () => void;
    onCreateProject: () => void;
    onDeleteProject: () => void;
    onExportProject: () => void;
    onImportImage: () => void;
    onOpenPlugins: () => void;
    onUndo: () => void;
    onRedo: () => void;
    agentOpen: boolean;
    compactAgentStatus: { connected: boolean; enabled: boolean; activity: string };
    onToggleAgent: () => void;
    builtinAgentEnabled: boolean;
    builtinAgentOpen: boolean;
    onToggleBuiltinAgent: () => void;
    directorEnabled: boolean;
    directorOpen: boolean;
    onOpenDirector: () => void;
    panoramaAvailable: boolean;
    onViewPanorama: () => void;
    saveStatus: CanvasSaveStatus;
    workspaceView: CanvasWorkspaceView;
    onWorkspaceViewChange: (view: CanvasWorkspaceView) => void;
    variant?: "classic" | "floating";
}) {
    const colorTheme = useThemeStore((state) => state.theme);
    const { t, i18n } = useTranslation();
    const theme = canvasThemes[colorTheme];
    const titleRef = useRef<HTMLDivElement>(null);
    const topBarRef = useRef<HTMLDivElement>(null);
    const [topBarWidth, setTopBarWidth] = useState(0);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const sidePanelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const toggleSidePanel = useCanvasSidePanelStore((state) => state.togglePanel);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const setColorTheme = useThemeStore((state) => state.setTheme);
    const locale = i18n.resolvedLanguage as AppLocale;
    const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
    const languageLabel = t("topNav.switchLanguage", { language: t(nextLocale === "zh-CN" ? "locale.zhCN" : "locale.enUS") });
    const floating = variant === "floating";
    const { compactActions, minimalActions, ultraCompactActions, singleClusterActions } = canvasTopBarLayout({ width: topBarWidth, floating, agentOpen });
    const secondaryMenuItemClass = compactActions ? undefined : floating ? "xl:hidden" : "md:hidden";
    const floatingClusterStyle = floating ? { background: theme.toolbar.floating, borderColor: theme.toolbar.border, boxShadow: colorTheme === "dark" ? "0 8px 24px rgba(0,0,0,.18)" : "0 8px 24px rgba(28,25,23,.08)" } : undefined;

    useEffect(() => {
        if (!isTitleEditing) return;
        const close = (event: PointerEvent) => {
            if (!titleRef.current?.contains(event.target as Node)) onFinishTitleEditing();
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [isTitleEditing, onFinishTitleEditing]);

    useLayoutEffect(() => {
        const element = topBarRef.current;
        if (!element) return;
        const updateWidth = () => setTopBarWidth(element.clientWidth);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div
                ref={topBarRef}
                data-canvas-top-bar
                className={cn("pointer-events-none absolute left-0 right-0 top-0 z-50 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1", floating ? "px-2" : "border-b pl-1 pr-2 sm:pr-4")}
                style={{ background: floating ? "transparent" : theme.toolbar.floating, borderColor: theme.toolbar.border }}
            >
                <div className={cn("pointer-events-auto flex min-w-0 max-w-full items-center gap-1.5 justify-self-start", floating && "h-9 rounded-xl border px-1 backdrop-blur-md")} style={floatingClusterStyle}>
                    {workspaceView === "workflow" && !ultraCompactActions ? (
                        <Tooltip title={sidePanelOpen ? t("canvas.collapsePanel") : t("canvas.expandPanel")}>
                            <button
                                type="button"
                                onClick={toggleSidePanel}
                                aria-label={sidePanelOpen ? t("canvas.collapsePanel") : t("canvas.expandPanel")}
                                className={floating ? "hidden size-7 place-items-center rounded-full transition hover:bg-black/5 sm:grid dark:hover:bg-white/10" : "grid size-7 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"}
                                style={{ color: theme.node.text }}
                            >
                                {sidePanelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                            </button>
                        </Tooltip>
                    ) : null}
                    {floating && !singleClusterActions ? (
                        <Tooltip title={t("canvas.backToProjects")}>
                            <button type="button" onClick={onProjects} aria-label={t("canvas.backToProjects")} className="grid size-7 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }}>
                                <ArrowLeft className="size-4" />
                            </button>
                        </Tooltip>
                    ) : null}
                    <Dropdown
                        trigger={["click"]}
                        menu={{
                            items: [
                                ...(ultraCompactActions
                                    ? [
                                          { key: "workflow", icon: <GitBranch className="size-4" />, label: t("canvas.workspace.workflow"), onClick: () => onWorkspaceViewChange("workflow") },
                                          { key: "storyboard", icon: <LayoutGrid className="size-4" />, label: t("canvas.workspace.storyboard"), onClick: () => onWorkspaceViewChange("storyboard") },
                                          { type: "divider" as const },
                                      ]
                                    : []),
                                ...(singleClusterActions
                                    ? [
                                          { key: "back", icon: <ArrowLeft className="size-4" />, label: t("canvas.backToProjects"), onClick: onProjects },
                                          ...(saveStatus === "idle" ? [] : [{ key: "save-status", disabled: true, icon: saveStatus === "saving" ? <LoaderCircle className="size-4 animate-spin" /> : saveStatus === "error" ? <CloudOff className="size-4" /> : <CloudCheck className="size-4" />, label: t(`canvas.saveStatus.${saveStatus}`) }]),
                                          { type: "divider" as const },
                                      ]
                                    : []),
                                { key: "home", icon: <Home className="size-4" />, label: t("canvas.home"), onClick: onHome },
                                ...(workspaceView === "workflow" && (floating || ultraCompactActions)
                                    ? [{ key: "side-panel", className: ultraCompactActions ? undefined : "sm:hidden", icon: sidePanelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />, label: sidePanelOpen ? t("canvas.collapsePanel") : t("canvas.expandPanel"), onClick: toggleSidePanel }]
                                    : []),
                                { key: "docs", icon: <BookOpen className="size-4" />, label: t("canvas.docs"), onClick: () => window.open(DOCS_URL, "_blank", "noopener,noreferrer") },
                                { key: "plugins", className: secondaryMenuItemClass, icon: <Puzzle className="size-4" />, label: t("topNav.plugins"), onClick: onOpenPlugins },
                                { key: "config", className: secondaryMenuItemClass, icon: <Settings2 className="size-4" />, label: t("navigation.config"), onClick: () => openConfigDialog(false) },
                                { key: "theme", icon: colorTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />, label: t(colorTheme === "dark" ? "topNav.lightTheme" : "topNav.darkTheme"), onClick: () => setColorTheme(colorTheme === "dark" ? "light" : "dark") },
                                { key: "language", className: secondaryMenuItemClass, icon: <Languages className="size-4" />, label: languageLabel, onClick: () => void changeAppLocale(nextLocale) },
                                { key: "shortcuts", className: secondaryMenuItemClass, icon: <Keyboard className="size-4" />, label: t("canvas.shortcuts"), onClick: () => setShortcutsOpen(true) },
                                ...(directorEnabled ? [{ key: "director", icon: <Clapperboard className="size-4" />, label: t("canvas.director.open"), onClick: onOpenDirector }] : []),
                                ...(builtinAgentEnabled ? [{ key: "builtin-agent", icon: <Sparkles className="size-4" />, label: t("canvas.builtinAgent.openButton"), onClick: onToggleBuiltinAgent }] : []),
                                ...(panoramaAvailable ? [{ key: "panorama", icon: <Orbit className="size-4" />, label: t("canvas.panorama.openTitle"), onClick: onViewPanorama }] : []),
                                { key: "projects", icon: <Images className="size-4" />, label: t("canvas.projects"), onClick: onProjects },
                                { type: "divider" },
                                { key: "new", icon: <Plus className="size-4" />, label: t("canvas.create"), onClick: onCreateProject },
                                { key: "delete", danger: true, icon: <Trash2 className="size-4" />, label: t("canvas.deleteCurrent"), onClick: onDeleteProject },
                                { type: "divider" },
                                { key: "import", icon: <Upload className="size-4" />, label: t("canvas.importAsset"), onClick: onImportImage },
                                { key: "export", icon: <Download className="size-4" />, label: t("canvas.exportCurrent"), onClick: onExportProject },
                                { type: "divider" },
                                { key: "undo", disabled: !canUndo, icon: <Undo2 className="size-4" />, label: <MenuLabel text={t("canvas.undo")} shortcut="⌘ Z" />, onClick: onUndo },
                                { key: "redo", disabled: !canRedo, icon: <Redo2 className="size-4" />, label: <MenuLabel text={t("canvas.redo")} shortcut="⌘ ⇧ Z / ⌘ Y" />, onClick: onRedo },
                            ],
                        }}
                    >
                        <button type="button" className="grid size-7 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10" style={{ color: theme.node.text }} aria-label={t("canvas.openMenu")}>
                            <Menu className="size-4" />
                        </button>
                    </Dropdown>

                    {singleClusterActions ? null : (
                        <div ref={titleRef} className="flex min-w-0 flex-1 items-center gap-2">
                            {floating ? (
                                <span className="hidden shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] sm:flex" style={{ color: theme.node.muted }}>
                                    {t("canvas.workspaceLabel")}
                                    <span aria-hidden="true">/</span>
                                </span>
                            ) : null}
                            {isTitleEditing ? (
                                <input
                                    autoFocus
                                    value={titleDraft}
                                    onChange={(event) => onTitleDraftChange(event.target.value)}
                                    onBlur={onFinishTitleEditing}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") onFinishTitleEditing();
                                        if (event.key === "Escape") onCancelTitleEditing();
                                    }}
                                    className={cn("min-w-0 flex-1 bg-transparent p-0 text-left text-sm font-medium tracking-normal outline-none", floating ? "max-w-[64px] sm:max-w-[180px]" : "max-w-[180px]")}
                                    style={{ color: theme.node.text }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className={cn("min-w-0 flex-1 truncate border-b border-dashed border-transparent text-left text-sm font-medium tracking-normal transition hover:border-current", floating ? "max-w-[64px] sm:max-w-[180px]" : "max-w-[180px]")}
                                    onDoubleClick={onStartTitleEditing}
                                    title={t("canvas.renameHint")}
                                >
                                    {title}
                                </button>
                            )}
                        </div>
                    )}
                    {minimalActions ? null : <CompactAgentStatus status={compactAgentStatus} compact={floating} onClick={onToggleAgent} />}
                </div>

                {ultraCompactActions ? (
                    <div aria-hidden="true" />
                ) : (
                    <div className={cn("pointer-events-auto flex h-8 justify-self-center rounded-md border p-0", floating && "h-9 rounded-xl backdrop-blur-md")} style={floating ? floatingClusterStyle : { background: "transparent", borderColor: theme.toolbar.border }}>
                        <WorkspaceViewButton active={workspaceView === "workflow"} icon={<GitBranch className="size-4" />} label={t("canvas.workspace.workflow")} theme={theme} onClick={() => onWorkspaceViewChange("workflow")} />
                        <WorkspaceViewButton active={workspaceView === "storyboard"} icon={<LayoutGrid className="size-4" />} label={t("canvas.workspace.storyboard")} theme={theme} onClick={() => onWorkspaceViewChange("storyboard")} />
                    </div>
                )}

                <div className={cn("pointer-events-auto flex shrink-0 items-center gap-1 justify-self-end", floating && "h-9 rounded-xl border px-1 backdrop-blur-md")} style={floatingClusterStyle}>
                    {singleClusterActions ? null : <SaveStatusIndicator status={saveStatus} theme={theme} />}
                    {minimalActions ? null : (
                        <UserStatusActions variant="canvas" compact={compactActions} className={compactActions ? "inline-flex" : floating ? "hidden xl:inline-flex" : "hidden md:inline-flex"} onOpenShortcuts={() => setShortcutsOpen(true)} onOpenPlugins={onOpenPlugins} />
                    )}
                    {compactActions ? null : <span className={floating ? "hidden h-6 w-px xl:block" : "hidden h-6 w-px md:block"} style={{ background: theme.toolbar.border }} />}
                    {directorEnabled && !ultraCompactActions ? (
                        <Tooltip title={t("canvas.director.title")}>
                            <Button
                                type="text"
                                className="!h-8 !rounded-md !px-2 !text-xs !font-medium"
                                style={{ background: directorOpen ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                                icon={<Clapperboard className="size-4" />}
                                onClick={onOpenDirector}
                                aria-label={t("canvas.director.open")}
                            >
                                <span className={compactActions ? "hidden" : floating ? "hidden xl:inline" : undefined}>{t("canvas.director.open")}</span>
                            </Button>
                        </Tooltip>
                    ) : null}
                    {builtinAgentEnabled && !ultraCompactActions ? (
                        <Tooltip title={t("canvas.builtinAgent.title")}>
                            <Button
                                type="text"
                                className="!h-8 !rounded-md !px-2 !text-xs !font-medium"
                                style={{ background: builtinAgentOpen ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                                icon={<Sparkles className="size-4" />}
                                onClick={onToggleBuiltinAgent}
                                aria-label={t("canvas.builtinAgent.openButton")}
                            >
                                <span className={compactActions ? "hidden" : floating ? "hidden xl:inline" : undefined}>{t("canvas.builtinAgent.openButton")}</span>
                            </Button>
                        </Tooltip>
                    ) : null}
                    <Button
                        type="text"
                        className="!h-8 !rounded-md !px-2 !text-xs !font-medium"
                        style={{ background: agentOpen ? theme.toolbar.activeBg : "transparent", color: theme.node.text }}
                        icon={<Bot className="size-4" />}
                        onClick={onToggleAgent}
                        aria-label="Agent"
                    >
                        <span className={compactActions ? "hidden" : floating ? "hidden xl:inline" : undefined}>Agent</span>
                    </Button>
                </div>
            </div>
            <Modal title={t("canvas.shortcuts")} open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut keys={["Ctrl / Space", t("canvas.shortcut.drag")]} value={t("canvas.shortcut.toggleTool")} />
                    <Shortcut keys={[t("canvas.shortcut.wheel")]} value={t("canvas.shortcut.zoom")} />
                    <Shortcut keys={[t("canvas.shortcut.zoomSlider")]} value={t("canvas.shortcut.preciseZoom")} />
                    <Shortcut keys={[t("canvas.shortcut.drag")]} value={t("canvas.shortcut.boxSelect")} />
                    <Shortcut keys={["Shift / Cmd", t("canvas.shortcut.click")]} value={t("canvas.shortcut.addSelection")} />
                    <Shortcut keys={["Ctrl / Cmd", "A"]} value={t("canvas.shortcut.selectAll")} />
                    <Shortcut keys={["Ctrl / Cmd", "C / V"]} value={t("canvas.shortcut.copyPaste")} />
                    <Shortcut keys={["Ctrl / Cmd", "G"]} value={t("canvas.shortcut.group")} />
                    <Shortcut keys={["Ctrl / Cmd", "Shift", "G"]} value={t("canvas.shortcut.ungroup")} />
                    <Shortcut keys={["Ctrl / Cmd", "Z"]} value={t("canvas.undo")} />
                    <Shortcut keys={["Ctrl / Cmd", "Shift", "Z"]} value={t("canvas.redo")} />
                    <Shortcut keys={["Ctrl / Cmd", "Y"]} value={t("canvas.redo")} />
                    <Shortcut keys={["Delete / Backspace"]} value={t("canvas.shortcut.delete")} />
                    <Shortcut keys={["Esc"]} value={t("canvas.shortcut.escape")} />
                    <Shortcut keys={[t("canvas.shortcut.dropMedia")]} value={t("canvas.shortcut.upload")} />
                </div>
            </Modal>
        </>
    );
}

function WorkspaceViewButton({ active, icon, label, theme, onClick }: { active: boolean; icon: ReactNode; label: string; theme: CanvasTheme; onClick: () => void }) {
    return (
        <Tooltip title={label}>
            <button
                type="button"
                onClick={onClick}
                aria-label={label}
                aria-pressed={active}
                className="grid h-full w-8 place-items-center rounded-[5px] text-xs font-medium transition"
                style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.node.muted }}
            >
                {icon}
                <span className="sr-only">{label}</span>
            </button>
        </Tooltip>
    );
}

function SaveStatusIndicator({ status, theme }: { status: CanvasSaveStatus; theme: CanvasTheme }) {
    const { t } = useTranslation();
    if (status === "idle") return null;
    const label = t(`canvas.saveStatus.${status}`);
    const color = status === "error" ? "#ef4444" : status === "saved" ? "#22c55e" : theme.node.muted;
    return (
        <Tooltip title={label}>
            <span role="status" aria-label={label} className="grid size-7 shrink-0 place-items-center" style={{ color }}>
                {status === "saving" ? <LoaderCircle className="size-3.5 animate-spin" /> : status === "error" ? <CloudOff className="size-4" /> : <CloudCheck className="size-4" />}
            </span>
        </Tooltip>
    );
}

function MenuLabel({ text, shortcut }: { text: string; shortcut: string }) {
    return (
        <span className="flex min-w-36 items-center justify-between gap-8">
            <span>{text}</span>
            <span className="text-xs opacity-45">{shortcut}</span>
        </span>
    );
}

function CompactAgentStatus({ status, compact = false, onClick }: { status: { connected: boolean; enabled: boolean; activity: string }; compact?: boolean; onClick: () => void }) {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const { t } = useTranslation();
    const label = status.connected ? t("canvas.agentConnected") : status.enabled ? t("canvas.agentConnecting", { activity: status.activity || t("canvas.connecting") }) : t("canvas.agentDisconnected");
    const dotColor = status.connected ? "#22c55e" : status.enabled ? "#f59e0b" : theme.node.muted;
    return (
        <button
            type="button"
            className={compact ? "hidden h-8 items-center gap-1.5 text-xs transition hover:opacity-75 xl:flex" : "hidden h-8 items-center gap-1.5 text-xs transition hover:opacity-75 md:flex"}
            style={{ color: status.connected ? "#16a34a" : status.enabled ? "#d97706" : theme.node.muted }}
            onClick={onClick}
            title={t("canvas.openAgent")}
        >
            <span className="size-2 rounded-full" style={{ background: dotColor }} />
            <span className="max-w-[140px] truncate">{label}</span>
        </button>
    );
}

function Shortcut({ keys, value }: { keys: string[]; value: string }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-6 rounded-lg px-1 py-1.5">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                {keys.map((key, index) => (
                    <span key={`${key}-${index}`} className="flex items-center gap-1.5">
                        {index ? <span className="text-xs opacity-35">+</span> : null}
                        <kbd
                            className="min-w-9 rounded-md border px-2.5 py-1.5 text-center text-xs font-medium leading-none shadow-[inset_0_-1px_0_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.06)]"
                            style={{ borderColor: "rgba(120,113,108,.28)", background: "linear-gradient(#fff, rgba(245,245,244,.92))", color: "rgb(68,64,60)" }}
                        >
                            {key}
                        </kbd>
                    </span>
                ))}
            </span>
            <span className="text-right text-sm opacity-55">{value}</span>
        </div>
    );
}
