import { expect, test } from "bun:test";

import { collectStoryboardExportFiles, storyboardExportFileNames } from "../src/lib/canvas/canvas-export";
import { buildCanvasResourceReferences } from "../src/lib/canvas/canvas-resource-references";
import { buildStoryboardAgentTransfer } from "../src/lib/canvas/storyboard-agent-transfer";
import { buildStoryboardProjection, scriptV2Text, type StoryboardItem } from "../src/lib/canvas/storyboard-projection";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const base = { position: { x: 0, y: 0 }, width: 320, height: 240 };

function item(patch: Partial<StoryboardItem> & Pick<StoryboardItem, "id" | "kind" | "title">): StoryboardItem {
    return {
        nodeId: patch.id,
        status: "success",
        locked: false,
        category: "other",
        ...patch,
    };
}

test("creates deterministic, safe and unique storyboard export names", () => {
    const names = storyboardExportFileNames([
        item({ id: "image-1", kind: "image", title: "角色/图?" }),
        item({ id: "image-2", kind: "image", title: "角色/图?" }),
        item({ id: "text-1", kind: "text", title: "   " }),
        item({ id: "script-1", kind: "script", title: "剧本:第一集", content: "第一场" }),
        item({ id: "video-1", kind: "video", title: "角色/图? " }),
    ]);

    expect(names[0]).toBe("角色_图_.png");
    expect(names[1]).toBe("角色_图_-1.png");
    expect(names[2]).toMatch(/[^.]\.txt$/);
    expect(names[3]).toBe("剧本_第一集.md");
    expect(names[4]).toBe("角色_图_.mp4");
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);
});

test("keeps successful export files when another remote item cannot be downloaded", async () => {
    const result = await collectStoryboardExportFiles(
        [
            item({ id: "text-1", kind: "text", title: "镜头说明", content: "第一镜" }),
            item({ id: "image-1", kind: "image", title: "远程图", content: "https://blocked.example/image.png" }),
            item({ id: "script-1", kind: "script", title: "脚本", content: "第二镜" }),
        ],
        async (source) => {
            if (source.kind === "image") throw new Error("CORS");
            return new Blob(["media"]);
        },
    );

    expect(result.failed).toBe(1);
    expect(result.files.map((file) => file.name)).toEqual(["镜头说明.txt", "脚本.md"]);
});

test("uses media MIME types for export extensions", async () => {
    const result = await collectStoryboardExportFiles(
        [item({ id: "image-1", kind: "image", title: "WebP 图", content: "https://example.com/image" }), item({ id: "video-1", kind: "video", title: "WebM 视频", content: "https://example.com/video" })],
        async (source) => new Blob(["media"], { type: source.kind === "image" ? "image/webp" : "video/webm" }),
    );

    expect(result.failed).toBe(0);
    expect(result.files.map((file) => file.name)).toEqual(["WebP 图.webp", "WebM 视频.webm"]);
});

test("treats Script V2 nodes as text canvas resources", () => {
    const nodes: CanvasNodeData[] = [
        {
            ...base,
            id: "script-1",
            type: CanvasNodeType.Script,
            title: "脚本",
            metadata: {
                scriptV2: {
                    version: 1,
                    originalStoryText: "雨夜的车站",
                    rows: [{ id: "shot-1", shotNumber: 1, plotDescription: "主角走进空车站", dialogue: "有人吗？" }],
                },
            },
        },
        { ...base, id: "text-1", type: CanvasNodeType.Text, title: "补充文本", metadata: { content: "人物设定" } },
    ];

    const references = buildCanvasResourceReferences(nodes);
    expect(references.map((reference) => reference.kind)).toEqual(["text", "text"]);
    expect(references[0].text).toContain("主角走进空车站");
    expect(references[0].text).toContain("有人吗？");
    expect(references[1].label).not.toBe(references[0].label);
    expect(scriptV2Text(nodes[0].metadata?.scriptV2)).toContain("雨夜的车站");
});

test("adds selected non-image assets as deduplicated canvas references", async () => {
    const nodes: CanvasNodeData[] = [
        {
            ...base,
            id: "script-1",
            type: CanvasNodeType.Script,
            title: "脚本",
            metadata: { scriptV2: { version: 1, rows: [{ id: "shot-1", shotNumber: 1, plotDescription: "第一镜" }] } },
        },
        { ...base, id: "text-1", type: CanvasNodeType.Text, title: "文本", metadata: { content: "角色说明" } },
        { ...base, id: "video-1", type: CanvasNodeType.Video, title: "视频", metadata: { content: "blob:video" } },
    ];
    const projection = buildStoryboardProjection(nodes);
    const existing = buildCanvasResourceReferences(nodes).filter((reference) => reference.nodeId === "text-1");
    const result = await buildStoryboardAgentTransfer([...projection.text, ...projection.script], nodes, { attachments: [], canvasReferences: existing });

    expect(result.addedAttachments).toBe(0);
    expect(result.addedReferences).toBe(1);
    expect(result.canvasReferences.map((reference) => reference.nodeId)).toEqual(["text-1", "script-1"]);
    expect(result.canvasReferences[1]).toMatchObject({ kind: "text", title: "脚本", label: "文本1" });
});

test("skips storyboard images when the Agent attachment limit is already full", async () => {
    const attachments = Array.from({ length: 6 }, (_, index) => ({
        id: `existing-${index}`,
        name: `image-${index}`,
        type: "image/png",
        size: 1,
        width: 1,
        height: 1,
        url: "data:image/png;base64,AA==",
        dataUrl: "data:image/png;base64,AA==",
    }));
    const result = await buildStoryboardAgentTransfer([item({ id: "image-1", kind: "image", title: "角色图", content: "https://example.com/image.png" })], [], { attachments, canvasReferences: [] });

    expect(result.addedAttachments).toBe(0);
    expect(result.skippedImages).toBe(1);
    expect(result.failedImages).toBe(0);
    expect(result.attachments).toEqual(attachments);
});
