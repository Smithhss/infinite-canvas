import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Segmented, Switch, Tooltip } from "antd";
import { CircleDot, CircleHelp, Eraser, Grid2x2, Group, Hand, History, Image as ImageIcon, Images, Info, Keyboard, MoreHorizontal, Moon, MousePointer2, Music2, Palette, Plus, Redo2, Scissors, Settings2, Square, Sun, Trash2, Type, Undo2, Upload, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getNodeSpec } from "@/constant/canvas";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { canvasThemes, type CanvasBackgroundMode, type CanvasColorTheme, type CanvasTheme } from "@/lib/canvas-theme";
import { getNodePluginId, listNodeDefinitions, useNodeRegistryVersion } from "@/lib/canvas/node-registry";
import { useThemeStore } from "@/stores/use-theme-store";

type DockPanel = "create" | "resources" | "history" | "appearance" | "more" | null;

type CanvasCommandDockProps = {
    selectedCount: number;
    canvasTool: "select" | "pan";
    canUndo: boolean;
    canRedo: boolean;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    onAddImage: () => void;
    onAddVideo: () => void;
    onAddAudio: () => void;
    onAddText: () => void;
    onAddConfig: () => void;
    onAddGroup: () => void;
    onAddExtensionNode: (type: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onUpload: () => void;
    onOpenAssets: () => void;
    onSmartCut: () => void;
    onDelete: () => void;
    onClear: () => void;
    onCanvasToolChange: (tool: "select" | "pan") => void;
    onBackgroundModeChange: (mode: CanvasBackgroundMode) => void;
    onShowImageInfoChange: (show: boolean) => void;
    onFocusSelected: () => void;
};

export function CanvasCommandDock(props: CanvasCommandDockProps) {
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const theme = canvasThemes[colorTheme];
    const rootRef = useRef<HTMLDivElement>(null);
    const [panel, setPanel] = useState<DockPanel>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    useNodeRegistryVersion();

    const extensionDefs = listNodeDefinitions().filter((definition) => definition.showInCreateMenu !== false && getNodePluginId(definition.type) !== "builtin");
    const dockStyle = {
        background: theme.toolbar.floating,
        borderColor: theme.toolbar.border,
        color: theme.toolbar.item,
        boxShadow: colorTheme === "dark" ? "0 10px 28px rgba(0,0,0,.18)" : "0 10px 28px rgba(28,25,23,.08)",
    };

    useEffect(() => {
        if (!panel) return;
        const close = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setPanel(null);
        };
        document.addEventListener("pointerdown", close, true);
        return () => document.removeEventListener("pointerdown", close, true);
    }, [panel]);

    const togglePanel = (next: Exclude<DockPanel, null>) => setPanel((current) => (current === next ? null : next));
    const runAndClose = (action: () => void) => {
        setPanel(null);
        action();
    };

    return (
        <div ref={rootRef} className="pointer-events-none absolute bottom-[84px] left-4 right-4 z-50 flex justify-center sm:bottom-5 sm:left-[300px] sm:right-4" data-canvas-bottom-toolbar>
            {panel ? (
                <section
                    className="thin-scrollbar pointer-events-auto absolute bottom-[52px] z-30 max-h-[min(62vh,430px)] w-[280px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl border p-2 shadow-2xl backdrop-blur-md"
                    style={{ background: theme.toolbar.floating, borderColor: theme.toolbar.border, color: theme.node.text }}
                    aria-label={panel === "appearance" ? t("canvas.toolbar.appearance") : t(`canvas.commandDock.${panel}`)}
                    role="dialog"
                >
                    {panel === "create" ? (
                        <>
                            <PanelHeading label={t("canvas.commandDock.create")} muted={theme.node.muted} />
                            <DockMenuItem theme={theme} icon={<Type className="size-4" />} label={t("canvas.toolbar.text")} onClick={() => runAndClose(props.onAddText)} />
                            <DockMenuItem theme={theme} icon={<ImageIcon className="size-4" />} label={t("canvas.toolbar.image")} onClick={() => runAndClose(props.onAddImage)} />
                            <DockMenuItem theme={theme} icon={<Video className="size-4" />} label={t("canvas.toolbar.video")} onClick={() => runAndClose(props.onAddVideo)} />
                            <DockMenuItem theme={theme} icon={<Music2 className="size-4" />} label={t("canvas.toolbar.audio")} onClick={() => runAndClose(props.onAddAudio)} />
                            <DockMenuItem theme={theme} icon={<Settings2 className="size-4" />} label={t("canvas.toolbar.config")} onClick={() => runAndClose(props.onAddConfig)} />
                            <DockMenuItem theme={theme} icon={<Group className="size-4" />} label={t("canvas.toolbar.group")} onClick={() => runAndClose(props.onAddGroup)} />
                            {extensionDefs.length ? (
                                <>
                                    <PanelHeading label={t("canvas.commandDock.extensions")} muted={theme.node.muted} separated />
                                    {extensionDefs.map((definition) => (
                                        <DockMenuItem
                                            key={definition.type}
                                            theme={theme}
                                            icon={<span className="grid size-4 place-items-center [&>svg]:size-4">{definition.icon}</span>}
                                            label={getNodeSpec(definition.type).title}
                                            onClick={() => runAndClose(() => props.onAddExtensionNode(definition.type))}
                                        />
                                    ))}
                                </>
                            ) : null}
                        </>
                    ) : null}

                    {panel === "resources" ? (
                        <>
                            <PanelHeading label={t("canvas.commandDock.resources")} muted={theme.node.muted} />
                            <DockMenuItem theme={theme} icon={<Upload className="size-4" />} label={t("canvas.toolbar.upload")} onClick={() => runAndClose(props.onUpload)} />
                            <DockMenuItem theme={theme} icon={<Images className="size-4" />} label={t("canvas.commandDock.library")} hint={t("canvas.commandDock.libraryHint")} onClick={() => runAndClose(props.onOpenAssets)} />
                        </>
                    ) : null}

                    {panel === "history" ? (
                        <>
                            <PanelHeading label={t("canvas.commandDock.history")} muted={theme.node.muted} />
                            <DockMenuItem theme={theme} icon={<Undo2 className="size-4" />} label={t("canvas.undo")} disabled={!props.canUndo} onClick={() => runAndClose(props.onUndo)} />
                            <DockMenuItem theme={theme} icon={<Redo2 className="size-4" />} label={t("canvas.redo")} disabled={!props.canRedo} onClick={() => runAndClose(props.onRedo)} />
                        </>
                    ) : null}

                    {panel === "appearance" ? (
                        <AppearancePanel theme={theme} colorTheme={colorTheme} backgroundMode={props.backgroundMode} showImageInfo={props.showImageInfo} onThemeChange={setTheme} onBackgroundModeChange={props.onBackgroundModeChange} onShowImageInfoChange={props.onShowImageInfoChange} />
                    ) : null}

                    {panel === "more" ? (
                        <>
                            <PanelHeading label={t("canvas.commandDock.more")} muted={theme.node.muted} />
                            <DockMenuItem theme={theme} icon={<Scissors className="size-4" />} label={t("canvas.smartCut.title")} hint={t("canvas.smartCut.menuHint")} onClick={() => runAndClose(props.onSmartCut)} />
                            <DockMenuItem theme={theme} icon={<Trash2 className="size-4" />} label={t("canvas.deleteSelected")} disabled={!props.selectedCount} danger onClick={() => runAndClose(props.onDelete)} />
                            <DockMenuItem theme={theme} icon={<Eraser className="size-4" />} label={t("canvas.toolbar.clear")} danger onClick={() => runAndClose(props.onClear)} />
                            <DockMenuItem
                                theme={theme}
                                icon={<Keyboard className="size-4" />}
                                label={t("canvas.shortcuts")}
                                onClick={() => {
                                    setPanel(null);
                                    setShortcutsOpen(true);
                                }}
                            />
                        </>
                    ) : null}
                </section>
            ) : null}

            <div className="pointer-events-auto flex h-12 items-center gap-1 rounded-[16px] border px-1.5 backdrop-blur-md" style={dockStyle} role="toolbar" aria-label={t("canvas.commandDock.label")}>
                <DockButton theme={theme} label={t("canvas.commandDock.create")} active={panel === "create"} hasPopup onClick={() => togglePanel("create")}>
                    <Plus className="size-4.5" />
                </DockButton>
                <DockDivider theme={theme} />
                <DockButton theme={theme} label={t(`canvas.toolbar.${props.canvasTool}`)} active onClick={() => props.onCanvasToolChange(props.canvasTool === "select" ? "pan" : "select")}>
                    {props.canvasTool === "select" ? <MousePointer2 className="size-4.5" /> : <Hand className="size-4.5" />}
                </DockButton>
                <DockButton theme={theme} label={t("canvas.toolbar.focus")} disabled={!props.selectedCount} onClick={props.onFocusSelected}>
                    <FocusIcon />
                </DockButton>
                <DockDivider theme={theme} />
                <DockButton theme={theme} label={t("canvas.commandDock.resources")} active={panel === "resources"} hasPopup onClick={() => togglePanel("resources")}>
                    <Images className="size-4.5" />
                </DockButton>
                <DockButton theme={theme} label={t("canvas.commandDock.history")} active={panel === "history"} hasPopup onClick={() => togglePanel("history")}>
                    <History className="size-4.5" />
                </DockButton>
                <DockButton theme={theme} label={t("canvas.toolbar.appearance")} active={panel === "appearance"} hasPopup onClick={() => togglePanel("appearance")}>
                    <Palette className="size-4.5" />
                </DockButton>
                <DockButton theme={theme} label={t("canvas.commandDock.more")} active={panel === "more"} hasPopup onClick={() => togglePanel("more")}>
                    <MoreHorizontal className="size-4.5" />
                </DockButton>
                <DockButton theme={theme} label={t("canvas.shortcuts")} onClick={() => setShortcutsOpen(true)}>
                    <CircleHelp className="size-4.5" />
                </DockButton>
            </div>

            <Modal title={t("canvas.shortcuts")} open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-2 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut label={t("canvas.shortcut.toggleTool")} value="Ctrl / Space" />
                    <Shortcut label={t("canvas.shortcut.zoom")} value={t("canvas.shortcut.wheel")} />
                    <Shortcut label={t("canvas.shortcut.boxSelect")} value={t("canvas.shortcut.drag")} />
                    <Shortcut label={t("canvas.shortcut.addSelection")} value={`Shift / Cmd + ${t("canvas.shortcut.click")}`} />
                    <Shortcut label={t("canvas.shortcut.copyPasteNodes")} value="Ctrl / Cmd + C / V" />
                    <Shortcut label={t("canvas.shortcut.group")} value="Ctrl / Cmd + G" />
                    <Shortcut label={t("canvas.shortcut.ungroup")} value="Ctrl / Cmd + Shift + G" />
                    <Shortcut label={t("canvas.shortcut.delete")} value="Delete / Backspace" />
                </div>
            </Modal>
        </div>
    );
}

function DockButton({ theme, label, active = false, disabled = false, hasPopup = false, onClick, children }: { theme: CanvasTheme; label: string; active?: boolean; disabled?: boolean; hasPopup?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <Tooltip title={label}>
            <button
                type="button"
                aria-label={label}
                aria-pressed={hasPopup ? undefined : active || undefined}
                aria-expanded={hasPopup ? active : undefined}
                aria-haspopup={hasPopup ? "dialog" : undefined}
                disabled={disabled}
                className="grid size-9 place-items-center rounded-xl transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
                style={{ background: active ? theme.toolbar.activeBg : "transparent", color: active ? theme.toolbar.activeText : theme.toolbar.item, outlineColor: theme.toolbar.activeText }}
                onClick={onClick}
            >
                {children}
            </button>
        </Tooltip>
    );
}

function DockMenuItem({ theme, icon, label, hint, disabled = false, danger = false, onClick }: { theme: CanvasTheme; icon: ReactNode; label: string; hint?: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
            style={{ color: danger ? "#ef4444" : theme.node.text, outlineColor: theme.toolbar.activeText }}
            onClick={onClick}
        >
            <span className="grid size-5 shrink-0 place-items-center" style={{ color: danger ? "#ef4444" : theme.node.muted }}>
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{label}</span>
                {hint ? (
                    <span className="mt-0.5 block truncate text-[10px]" style={{ color: theme.node.muted }}>
                        {hint}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

function AppearancePanel({
    theme,
    colorTheme,
    backgroundMode,
    showImageInfo,
    onThemeChange,
    onBackgroundModeChange,
    onShowImageInfoChange,
}: {
    theme: CanvasTheme;
    colorTheme: CanvasColorTheme;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    onThemeChange: (theme: CanvasColorTheme) => void;
    onBackgroundModeChange: (mode: CanvasBackgroundMode) => void;
    onShowImageInfoChange: (show: boolean) => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <PanelHeading label={t("canvas.toolbar.appearance")} muted={theme.node.muted} />
            <div className="grid grid-cols-2 gap-1 rounded-xl p-1" style={{ background: theme.toolbar.itemHover }}>
                <ThemeButton theme={theme} colorTheme={colorTheme} targetTheme="light" onThemeChange={onThemeChange} icon={<Sun className="size-4" />} label={t("canvas.toolbar.light")} />
                <ThemeButton theme={theme} colorTheme={colorTheme} targetTheme="dark" onThemeChange={onThemeChange} icon={<Moon className="size-4" />} label={t("canvas.toolbar.dark")} />
            </div>
            <PanelHeading label={t("canvas.toolbar.gridStyle")} muted={theme.node.muted} separated />
            <Segmented
                block
                value={backgroundMode}
                onChange={(value) => onBackgroundModeChange(value as CanvasBackgroundMode)}
                options={[
                    { value: "dots", label: <SegmentedLabel icon={<CircleDot className="size-3.5" />} text={t("canvas.toolbar.dots")} /> },
                    { value: "lines", label: <SegmentedLabel icon={<Grid2x2 className="size-3.5" />} text={t("canvas.toolbar.lines")} /> },
                    { value: "blank", label: <SegmentedLabel icon={<Square className="size-3.5" />} text={t("canvas.toolbar.blank")} /> },
                ]}
            />
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl px-1.5 py-1">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium" style={{ color: theme.node.muted }}>
                    <Info className="size-3.5" />
                    {t("canvas.toolbar.imageInfo")}
                </span>
                <Switch size="small" checked={showImageInfo} onChange={onShowImageInfoChange} />
            </div>
        </>
    );
}

function ThemeButton({ theme, colorTheme, targetTheme, onThemeChange, icon, label }: { theme: CanvasTheme; colorTheme: CanvasColorTheme; targetTheme: CanvasColorTheme; onThemeChange: (theme: CanvasColorTheme) => void; icon: ReactNode; label: string }) {
    const active = colorTheme === targetTheme;
    return (
        <AnimatedThemeToggler
            theme={colorTheme}
            targetTheme={targetTheme}
            onThemeChange={onThemeChange}
            className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition"
            style={active ? { background: colorTheme === "light" ? "#111111" : theme.toolbar.activeBg, color: colorTheme === "light" ? "#ffffff" : theme.toolbar.activeText } : { color: theme.toolbar.item }}
            aria-label={label}
            title={label}
        >
            {icon}
            {label}
        </AnimatedThemeToggler>
    );
}

function PanelHeading({ label, muted, separated = false }: { label: string; muted: string; separated?: boolean }) {
    return (
        <div className={`px-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] ${separated ? "mt-2 border-t pt-2.5" : ""}`} style={{ color: muted, borderColor: `${muted}33` }}>
            {label}
        </div>
    );
}

function DockDivider({ theme }: { theme: CanvasTheme }) {
    return <span className="mx-0.5 h-5 w-px" style={{ background: theme.toolbar.border }} />;
}

function FocusIcon() {
    return (
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M4 16v3a1 1 0 0 0 1 1h3" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function SegmentedLabel({ icon, text }: { icon: ReactNode; text: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            {icon}
            <span className="hidden min-[360px]:inline">{text}</span>
        </span>
    );
}

function Shortcut({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs opacity-55">{value}</span>
        </div>
    );
}
