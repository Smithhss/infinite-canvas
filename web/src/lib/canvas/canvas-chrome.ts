import { CanvasNodeType, type CanvasWorkspaceView } from "@/types/canvas";

export type CanvasEmptyQuickActionId = "image" | "video" | "audio" | "script" | "smart-cut";

export const CANVAS_EMPTY_QUICK_ACTION_IDS = ["image", "video", "audio", "script", "smart-cut"] as const satisfies CanvasEmptyQuickActionId[];
export const CANVAS_MIN_WORKSPACE_WIDTH = 320;

export function shouldShowCanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount }: { enabled: boolean; projectLoaded: boolean; workspaceView: CanvasWorkspaceView; nodeCount: number }) {
    return enabled && projectLoaded && workspaceView === "workflow" && nodeCount === 0;
}

export function canvasEmptyQuickActionNodeType(action: CanvasEmptyQuickActionId) {
    if (action === "image") return CanvasNodeType.Image;
    if (action === "video") return CanvasNodeType.Video;
    if (action === "audio") return CanvasNodeType.Audio;
    if (action === "script") return CanvasNodeType.Script;
    return null;
}

export function isCanvasEmptyQuickActionEnabled(action: CanvasEmptyQuickActionId) {
    return action === "smart-cut" || Boolean(canvasEmptyQuickActionNodeType(action));
}

export function canvasTopBarLayout({ width, floating, agentOpen }: { width: number; floating: boolean; agentOpen: boolean }) {
    return {
        compactActions: floating ? agentOpen || width < 1280 : width < 768,
        minimalActions: width > 0 && width < (floating ? 760 : 640),
        ultraCompactActions: width > 0 && width <= 420,
        singleClusterActions: width > 0 && width < 260,
    };
}

export function shouldOverlayAgentPanel({ viewportWidth, sidePanelWidth, agentWidth }: { viewportWidth: number; sidePanelWidth: number; agentWidth: number }) {
    return viewportWidth - sidePanelWidth - agentWidth < CANVAS_MIN_WORKSPACE_WIDTH;
}
