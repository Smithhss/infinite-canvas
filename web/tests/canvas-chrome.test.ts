import { expect, test } from "bun:test";

import { CANVAS_EMPTY_QUICK_ACTION_IDS, canvasEmptyQuickActionNodeType, shouldShowCanvasEmptyQuickActions } from "../src/lib/canvas/canvas-chrome";
import { CanvasNodeType } from "../src/types/canvas";

test("empty canvas quick actions only show after a workflow project has loaded with no nodes", () => {
    expect(shouldShowCanvasEmptyQuickActions({ enabled: true, projectLoaded: true, workspaceView: "workflow", nodeCount: 0 })).toBe(true);
    expect(shouldShowCanvasEmptyQuickActions({ enabled: false, projectLoaded: true, workspaceView: "workflow", nodeCount: 0 })).toBe(false);
    expect(shouldShowCanvasEmptyQuickActions({ enabled: true, projectLoaded: false, workspaceView: "workflow", nodeCount: 0 })).toBe(false);
    expect(shouldShowCanvasEmptyQuickActions({ enabled: true, projectLoaded: true, workspaceView: "storyboard", nodeCount: 0 })).toBe(false);
    expect(shouldShowCanvasEmptyQuickActions({ enabled: true, projectLoaded: true, workspaceView: "workflow", nodeCount: 1 })).toBe(false);
});

test("empty canvas quick actions map to existing node types and keep smart cut disabled", () => {
    expect(CANVAS_EMPTY_QUICK_ACTION_IDS).toEqual(["image", "video", "audio", "script", "smart-cut"]);
    expect(canvasEmptyQuickActionNodeType("image")).toBe(CanvasNodeType.Image);
    expect(canvasEmptyQuickActionNodeType("video")).toBe(CanvasNodeType.Video);
    expect(canvasEmptyQuickActionNodeType("audio")).toBe(CanvasNodeType.Audio);
    expect(canvasEmptyQuickActionNodeType("script")).toBe(CanvasNodeType.Text);
    expect(canvasEmptyQuickActionNodeType("smart-cut")).toBeNull();
});
