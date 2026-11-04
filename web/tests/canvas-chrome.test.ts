import { expect, test } from "bun:test";

import { CANVAS_EMPTY_QUICK_ACTION_IDS, canvasEmptyQuickActionNodeType, canvasTopBarLayout, shouldOverlayAgentPanel, shouldShowCanvasEmptyQuickActions } from "../src/lib/canvas/canvas-chrome";
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

test("canvas top bar switches compact clusters at the actual layout breakpoints", () => {
    expect(canvasTopBarLayout({ width: 419, floating: false, agentOpen: false })).toEqual({ compactActions: true, minimalActions: true, ultraCompactActions: true, singleClusterActions: false });
    expect(canvasTopBarLayout({ width: 420, floating: false, agentOpen: false })).toEqual({ compactActions: true, minimalActions: true, ultraCompactActions: true, singleClusterActions: false });
    expect(canvasTopBarLayout({ width: 421, floating: false, agentOpen: false }).ultraCompactActions).toBe(false);
    expect(canvasTopBarLayout({ width: 759, floating: false, agentOpen: false }).compactActions).toBe(true);
    expect(canvasTopBarLayout({ width: 767, floating: false, agentOpen: false }).compactActions).toBe(true);
    expect(canvasTopBarLayout({ width: 768, floating: false, agentOpen: false }).compactActions).toBe(false);
    expect(canvasTopBarLayout({ width: 1200, floating: true, agentOpen: false }).compactActions).toBe(true);
    expect(canvasTopBarLayout({ width: 1279, floating: true, agentOpen: false }).compactActions).toBe(true);
    expect(canvasTopBarLayout({ width: 1280, floating: true, agentOpen: false }).compactActions).toBe(false);
    expect(canvasTopBarLayout({ width: 1280, floating: true, agentOpen: true }).compactActions).toBe(true);
    expect(canvasTopBarLayout({ width: 259, floating: false, agentOpen: false }).singleClusterActions).toBe(true);
    expect(canvasTopBarLayout({ width: 260, floating: false, agentOpen: false }).singleClusterActions).toBe(false);
});

test("Agent panel overlays when fixed side panels would leave too little canvas", () => {
    expect(shouldOverlayAgentPanel({ viewportWidth: 1024, sidePanelWidth: 480, agentWidth: 440 })).toBe(true);
    expect(shouldOverlayAgentPanel({ viewportWidth: 1280, sidePanelWidth: 480, agentWidth: 760 })).toBe(true);
    expect(shouldOverlayAgentPanel({ viewportWidth: 1440, sidePanelWidth: 320, agentWidth: 440 })).toBe(false);
    expect(shouldOverlayAgentPanel({ viewportWidth: 390, sidePanelWidth: 0, agentWidth: 440 })).toBe(true);
});
