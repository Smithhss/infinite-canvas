import { expect, test } from "bun:test";

import { selectStoryboardBatchItems, storyboardBatchCounts, storyboardBatchItems, storyboardBatchNodeStatus } from "../src/lib/canvas/storyboard-batch";
import type { CanvasNodeData, CanvasScriptV2 } from "../src/types/canvas";

const script: CanvasScriptV2 = {
    version: 1,
    aspectRatio: "16:9",
    rows: [
        { id: "shot-a", shotNumber: 1, durationSeconds: 5, plotDescription: "开场", imageGenerationPrompt: "prompt-a" },
        { id: "shot-b", shotNumber: 2, durationSeconds: 5, plotDescription: "冲突", imageGenerationPrompt: "prompt-b" },
        { id: "shot-c", shotNumber: 3, durationSeconds: 5, plotDescription: "收尾", imageGenerationPrompt: "prompt-c" },
    ],
};

function imageNode(id: string, metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData {
    return { id, type: "image", title: id, position: { x: 0, y: 0 }, width: 100, height: 100, metadata };
}

const group: CanvasNodeData = {
    id: "grid",
    type: "group",
    title: "grid",
    position: { x: 0, y: 0 },
    width: 100,
    height: 100,
    metadata: {
        storyboardGrid: {
            scriptNodeId: "script",
            sourceSignature: "sig",
            shotOrder: ["shot-a", "shot-b", "shot-c"],
            shotNodeIds: { "shot-a": "node-a", "shot-b": "node-b", "shot-c": "node-c" },
            columns: 3,
            showShotNumbers: true,
            aspectRatio: "16:9",
        },
    },
};

test("derives per-shot batch status from node metadata", () => {
    expect(storyboardBatchNodeStatus(imageNode("x"))).toBe("pending");
    expect(storyboardBatchNodeStatus(imageNode("x", { status: "loading" }))).toBe("running");
    expect(storyboardBatchNodeStatus(imageNode("x", { status: "error" }))).toBe("failed");
    expect(storyboardBatchNodeStatus(imageNode("x", { storageKey: "media/1.png" }))).toBe("done");
    expect(storyboardBatchNodeStatus(undefined)).toBe("pending");
});

test("plans batch items in shot order with stored prompts", () => {
    const items = storyboardBatchItems(script, group, [
        group,
        imageNode("node-a", { prompt: "prompt-a", storageKey: "media/a.png" }),
        imageNode("node-b", { prompt: "prompt-b" }),
        imageNode("node-c", { status: "error", prompt: "prompt-c" }),
    ]);
    expect(items.map((item) => [item.shotId, item.nodeId, item.status])).toEqual([
        ["shot-a", "node-a", "done"],
        ["shot-b", "node-b", "pending"],
        ["shot-c", "node-c", "failed"],
    ]);
    expect(items.map((item) => item.prompt)).toEqual(["prompt-a", "prompt-b", "prompt-c"]);
});

test("selects missing, failed and all items without duplicating running nodes", () => {
    const items = storyboardBatchItems(script, group, [
        group,
        imageNode("node-a", { storageKey: "media/a.png" }),
        imageNode("node-b", { status: "loading" }),
        imageNode("node-c", { status: "error" }),
    ]);
    expect(selectStoryboardBatchItems(items, "unfinished").map((item) => item.shotId)).toEqual(["shot-c"]);
    expect(selectStoryboardBatchItems(items, "failed").map((item) => item.shotId)).toEqual(["shot-c"]);
    expect(selectStoryboardBatchItems(items, "all").map((item) => item.shotId)).toEqual(["shot-a", "shot-c"]);
});

test("counts each batch state", () => {
    const items = storyboardBatchItems(script, group, [
        group,
        imageNode("node-a", { storageKey: "media/a.png" }),
        imageNode("node-b", { status: "loading" }),
        imageNode("node-c", { status: "error" }),
    ]);
    expect(storyboardBatchCounts(items)).toEqual({ total: 3, done: 1, failed: 1, running: 1, pending: 0 });
});
