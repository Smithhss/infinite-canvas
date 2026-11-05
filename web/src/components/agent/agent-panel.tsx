import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { LocalAgentPanel } from "./local-agent-panel";
import { canvasThemes } from "@/lib/canvas-theme";
import { shouldOverlayAgentPanel } from "@/lib/canvas/canvas-chrome";
import { cn } from "@/lib/utils";
import { CANVAS_AGENT_PANEL_MOTION_MS, useAgentStore } from "@/stores/use-agent-store";
import { useCanvasSidePanelStore } from "@/stores/use-canvas-side-panel-store";
import { useThemeStore } from "@/stores/use-theme-store";

const PANEL_MOTION_SECONDS = CANVAS_AGENT_PANEL_MOTION_MS / 1000;

export function AgentPanel() {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const width = useAgentStore((state) => state.width);
    const sidePanelOpen = useCanvasSidePanelStore((state) => state.panelOpen);
    const sidePanelWidth = useCanvasSidePanelStore((state) => state.width);
    const [resizing, setResizing] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const panelMounted = useAgentStore((state) => state.panelMounted);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const panelClosing = useAgentStore((state) => state.panelClosing);
    const setAgentState = useAgentStore((state) => state.setAgentState);
    const canvasProject = /^\/canvas\/[^/]+/.test(pathname);
    const overlay = shouldOverlayAgentPanel({
        viewportWidth,
        sidePanelWidth: canvasProject && sidePanelOpen ? sidePanelWidth : 0,
        agentWidth: width,
    });

    useEffect(() => {
        const updateViewportWidth = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", updateViewportWidth);
        return () => window.removeEventListener("resize", updateViewportWidth);
    }, []);

    const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;
        let nextWidth = startWidth;
        const onMove = (moveEvent: PointerEvent) => {
            nextWidth = Math.min(760, Math.max(360, startWidth + startX - moveEvent.clientX));
            setAgentState({ width: nextWidth });
        };
        const onUp = () => {
            localStorage.setItem("canvas-agent-panel-width", String(nextWidth));
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            setResizing(false);
        };
        setResizing(true);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    if (!panelMounted) return null;

    return (
        <motion.div
            className={cn("relative z-[70] flex h-full shrink-0", overlay && (canvasProject ? "fixed bottom-0 right-0 top-12 z-[80] h-auto shadow-2xl" : "fixed inset-y-0 right-0 z-[80] shadow-2xl"))}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: panelOpen ? width + 1 : 0, opacity: panelOpen ? 1 : 0 }}
            transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "clip", maxWidth: "100vw", pointerEvents: panelOpen && !panelClosing ? undefined : "none" }}
        >
            <motion.aside
                className="relative flex h-full shrink-0 flex-col border-l"
                data-canvas-shortcuts-ignore
                initial={{ x: 48 }}
                animate={{ x: panelClosing ? 28 : 0 }}
                transition={{ duration: resizing ? 0 : PANEL_MOTION_SECONDS, ease: [0.22, 1, 0.36, 1] }}
                style={{ width, maxWidth: "100vw", background: theme.node.panel, borderColor: theme.node.stroke, color: theme.node.text }}
            >
                <button type="button" className="absolute inset-y-0 left-0 z-40 w-4 -translate-x-1/2 cursor-col-resize max-sm:hidden" onPointerDown={startResize} aria-label={t("agent.panel.resize")} />
                <LocalAgentPanel embedded />
            </motion.aside>
        </motion.div>
    );
}
