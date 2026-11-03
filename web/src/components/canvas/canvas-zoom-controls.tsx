import type { ReactNode } from "react";
import { ChevronDown, Compass, Eye, EyeOff, Focus, HelpCircle, Maximize2 } from "lucide-react";
import { useState } from "react";
import { Button, Dropdown, Modal, Tooltip } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";

type CanvasZoomControlsProps = {
    scale: number;
    onScaleChange: (scale: number) => void;
    onReset: () => void;
    onFitView: () => void;
    isMiniMapOpen: boolean;
    onToggleMiniMap: () => void;
    showConnections: boolean;
    onToggleConnections: () => void;
};

export function CanvasZoomControls({ scale, onScaleChange, onReset, onFitView, isMiniMapOpen, onToggleMiniMap, showConnections, onToggleConnections }: CanvasZoomControlsProps) {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    const { t } = useTranslation();
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];
    const dockStyle = { background: theme.toolbar.floating, borderColor: theme.toolbar.border, color: theme.toolbar.item, boxShadow: colorTheme === "dark" ? "0 10px 28px rgba(0,0,0,.18)" : "0 10px 28px rgba(28,25,23,.08)" };
    const activeStyle = { background: theme.toolbar.activeBg, color: theme.toolbar.activeText };

    return (
        <div className="absolute bottom-5 left-5 z-50" onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex h-10 items-center gap-0.5 rounded-lg border px-1.5 backdrop-blur-md" style={dockStyle}>
                <Tooltip title={isMiniMapOpen ? t("canvas.miniMapClose") : t("canvas.miniMapOpen")}>
                    <Button
                        type="text"
                        className="!h-8 !w-8 !min-w-8 !p-0"
                        style={isMiniMapOpen ? activeStyle : { color: theme.toolbar.item }}
                        icon={<Compass className="size-4" />}
                        onClick={onToggleMiniMap}
                        aria-label={isMiniMapOpen ? t("canvas.miniMapClose") : t("canvas.miniMapOpen")}
                    />
                </Tooltip>
                <Tooltip title={t("canvas.resetView")}>
                    <Button type="text" className="!h-8 !w-8 !min-w-8 !p-0" style={{ color: theme.toolbar.item }} icon={<Focus className="size-4" />} onClick={onReset} aria-label={t("canvas.resetView")} />
                </Tooltip>
                <Tooltip title={t("canvas.fitView")}>
                    <Button type="text" className="!h-8 !w-8 !min-w-8 !p-0" style={{ color: theme.toolbar.item }} icon={<Maximize2 className="size-4" />} onClick={onFitView} aria-label={t("canvas.fitView")} />
                </Tooltip>
                <Tooltip title={showConnections ? t("canvas.hideConnections") : t("canvas.showConnections")}>
                    <Button
                        type="text"
                        className="!h-8 !w-8 !min-w-8 !p-0"
                        style={showConnections ? { color: theme.toolbar.item } : activeStyle}
                        icon={showConnections ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        onClick={onToggleConnections}
                        aria-label={showConnections ? t("canvas.hideConnections") : t("canvas.showConnections")}
                    />
                </Tooltip>
                <Tooltip title={t("canvas.zoom")}>
                    <input
                        type="range"
                        min="5"
                        max="500"
                        step="1"
                        value={Math.round(scale * 100)}
                        className="w-20"
                        style={{ accentColor: theme.node.activeStroke }}
                        onChange={(event) => onScaleChange(Number(event.target.value) / 100)}
                        aria-label={t("canvas.zoom")}
                    />
                </Tooltip>
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        items: [
                            { key: "50", label: "50%", onClick: () => onScaleChange(0.5) },
                            { key: "100", label: "100%", onClick: () => onScaleChange(1) },
                            { key: "fit", label: t("canvas.fitView"), onClick: onFitView },
                        ],
                    }}
                >
                    <button
                        type="button"
                        className="flex h-8 min-w-14 items-center justify-end gap-0.5 rounded-md px-1 text-xs tabular-nums transition hover:bg-black/5 dark:hover:bg-white/10"
                        style={{ color: theme.node.muted }}
                        aria-label={t("canvas.zoomPresets")}
                    >
                        {Math.round(scale * 100)}%
                        <ChevronDown className="size-3" />
                    </button>
                </Dropdown>
                <Tooltip title={t("canvas.shortcuts")}>
                    <Button
                        type="text"
                        className="!h-8 !w-8 !min-w-8 !p-0"
                        style={shortcutsOpen ? activeStyle : { color: theme.toolbar.item }}
                        icon={<HelpCircle className="size-4" />}
                        onClick={() => setShortcutsOpen(true)}
                        aria-label={t("canvas.shortcuts")}
                    />
                </Tooltip>
            </div>
            <Modal title={t("canvas.shortcuts")} open={shortcutsOpen} onCancel={() => setShortcutsOpen(false)} footer={null} centered>
                <div className="space-y-3 border-t pt-4 text-sm" style={{ borderColor: theme.node.stroke }}>
                    <Shortcut label={`Ctrl / Space + ${t("canvas.shortcut.drag")}`} value={t("canvas.shortcut.toggleTool")} />
                    <Shortcut label={t("canvas.shortcut.wheel")} value={t("canvas.shortcut.zoom")} />
                    <Shortcut label={t("canvas.shortcut.drag")} value={t("canvas.shortcut.boxSelect")} />
                    <Shortcut label={`Shift / Cmd + ${t("canvas.shortcut.click")}`} value={t("canvas.shortcut.addSelection")} />
                    <Shortcut label="Ctrl / Cmd + C / V" value={t("canvas.shortcut.copyPasteNodes")} />
                    <Shortcut label="Ctrl / Cmd + G" value={t("canvas.shortcut.group")} />
                    <Shortcut label="Ctrl / Cmd + Shift + G" value={t("canvas.shortcut.ungroup")} />
                    <Shortcut label="Delete / Backspace" value={t("canvas.shortcut.delete")} />
                </div>
            </Modal>
        </div>
    );
}

function Shortcut({ label, value }: { label: ReactNode; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-base font-medium">{label}</span>
            <span className="opacity-60">{value}</span>
        </div>
    );
}
