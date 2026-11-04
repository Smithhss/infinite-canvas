import { CanvasNodeType, type CanvasWorkspaceView } from "@/types/canvas";

export type CanvasEmptyQuickActionId = "image" | "video" | "audio" | "script" | "smart-cut";

export const CANVAS_EMPTY_QUICK_ACTION_IDS = ["image", "video", "audio", "script", "smart-cut"] as const satisfies CanvasEmptyQuickActionId[];

export function shouldShowCanvasEmptyQuickActions({ enabled, projectLoaded, workspaceView, nodeCount }: { enabled: boolean; projectLoaded: boolean; workspaceView: CanvasWorkspaceView; nodeCount: number }) {
    return enabled && projectLoaded && workspaceView === "workflow" && nodeCount === 0;
}

export function canvasEmptyQuickActionNodeType(action: CanvasEmptyQuickActionId) {
    if (action === "image") return CanvasNodeType.Image;
    if (action === "video") return CanvasNodeType.Video;
    if (action === "audio") return CanvasNodeType.Audio;
    if (action === "script") return CanvasNodeType.Text;
    return null;
}
