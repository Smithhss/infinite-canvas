import { expect, test } from "bun:test";

import { buildStoryboardProjection, filterStoryboardItems } from "../src/lib/canvas/storyboard-projection";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const base = { position: { x: 0, y: 0 }, width: 320, height: 240 };

test("projects text, image alternatives and video from the same node ids", () => {
    const nodes: CanvasNodeData[] = [
        { ...base, id: "group-1", type: CanvasNodeType.Group, title: "角色组" },
        {
            ...base,
            id: "text-1",
            type: CanvasNodeType.Text,
            title: "角色描述",
            metadata: { content: "银发剑士", groupId: "group-1", status: "success" },
        },
        {
            ...base,
            id: "image-1",
            type: CanvasNodeType.Image,
            title: "角色图",
            metadata: {
                groupId: "group-1",
                prompt: "银发剑士",
                primaryImageId: "image-a",
                images: [
                    { id: "image-a", status: "success", content: "blob:a", storageKey: "image:a", naturalWidth: 1024, naturalHeight: 1536, bytes: 10, mimeType: "image/png" },
                    { id: "image-b", status: "error", content: "", naturalWidth: 0, naturalHeight: 0, bytes: 0, mimeType: "image/png" },
                ],
            },
        },
        {
            ...base,
            id: "video-1",
            type: CanvasNodeType.Video,
            title: "角色短片",
            metadata: { content: "blob:video", storageKey: "media:v", durationMs: 15_000, status: "success" },
        },
    ];

    const projection = buildStoryboardProjection(nodes);
    expect(projection.text.map((item) => item.nodeId)).toEqual(["text-1"]);
    expect(projection.image.map((item) => item.nodeId)).toEqual(["image-1", "image-1"]);
    expect(projection.image.filter((item) => item.isPrimary)).toHaveLength(1);
    expect(projection.image[0].groupTitle).toBe("角色组");
    expect(projection.video[0]).toMatchObject({ nodeId: "video-1", durationMs: 15_000, kind: "video" });
});

test("projects script V2 nodes into the storyboard library", () => {
    const projection = buildStoryboardProjection([
        {
            ...base,
            id: "script-1",
            type: CanvasNodeType.Script,
            title: "雨夜短片",
            metadata: {
                status: "success",
                storyboardCategory: "scene",
                scriptV2: {
                    version: 1,
                    theme: "悬疑",
                    rows: [{ id: "shot-1", shotNumber: 1, durationSeconds: 5, plotDescription: "主角走进空车站", dialogue: "有人吗？" }],
                },
            },
        },
    ]);

    expect(projection.script).toHaveLength(1);
    expect(projection.script[0]).toMatchObject({ nodeId: "script-1", kind: "script", title: "雨夜短片", category: "scene" });
    expect(projection.script[0].content).toContain("主角走进空车站");
    expect(projection.script[0].script?.rows[0].dialogue).toBe("有人吗？");
});

test("skips empty idle nodes but keeps loading and failed media", () => {
    const projection = buildStoryboardProjection([
        { ...base, id: "empty-image", type: CanvasNodeType.Image, title: "空图", metadata: { status: "idle" } },
        { ...base, id: "loading-image", type: CanvasNodeType.Image, title: "生成中", metadata: { status: "loading" } },
        { ...base, id: "failed-video", type: CanvasNodeType.Video, title: "失败", metadata: { status: "error" } },
        { ...base, id: "empty-text", type: CanvasNodeType.Text, title: "空文本", metadata: { status: "idle" } },
    ]);

    expect(projection.image.map((item) => item.nodeId)).toEqual(["loading-image"]);
    expect(projection.video.map((item) => item.nodeId)).toEqual(["failed-video"]);
    expect(projection.text).toEqual([]);
});

test("searches across content, prompt and group context and filters by status", () => {
    const projection = buildStoryboardProjection([
        {
            ...base,
            id: "image-1",
            type: CanvasNodeType.Image,
            title: "角色图",
            metadata: { content: "blob:image", prompt: "红色披风", status: "success", naturalWidth: 1, naturalHeight: 1 },
        },
        {
            ...base,
            id: "image-2",
            type: CanvasNodeType.Image,
            title: "场景图",
            metadata: { status: "error" },
        },
    ]);

    expect(filterStoryboardItems(projection.image, "红色", "all").map((item) => item.nodeId)).toEqual(["image-1"]);
    expect(filterStoryboardItems(projection.image, "", "error").map((item) => item.nodeId)).toEqual(["image-2"]);
    expect(filterStoryboardItems(projection.image, "不存在", "all")).toEqual([]);
});

test("handles a high-density storyboard without dropping or duplicating media", () => {
    const nodes: CanvasNodeData[] = Array.from({ length: 5 }, (_, index) => ({
        ...base,
        id: `group-${index}`,
        type: CanvasNodeType.Group,
        title: `分组 ${index + 1}`,
    }));

    for (let index = 0; index < 30; index += 1) {
        nodes.push({
            ...base,
            id: `image-${index}`,
            type: CanvasNodeType.Image,
            title: `图片 ${index + 1}`,
            metadata: {
                content: `data:image/png;base64,image-${index}`,
                prompt: `镜头 ${index + 1}`,
                status: index % 10 === 0 ? "error" : "success",
                groupId: `group-${index % 5}`,
                naturalWidth: 1024,
                naturalHeight: 1536,
            },
        });
    }
    for (let index = 0; index < 12; index += 1) {
        nodes.push({
            ...base,
            id: `video-${index}`,
            type: CanvasNodeType.Video,
            title: `视频 ${index + 1}`,
            metadata: {
                content: `blob:video-${index}`,
                status: index === 0 ? "loading" : "success",
                groupId: `group-${index % 5}`,
                durationMs: (index + 1) * 1000,
                naturalWidth: 1920,
                naturalHeight: 1080,
            },
        });
    }
    for (let index = 0; index < 10; index += 1) {
        nodes.push({
            ...base,
            id: `text-${index}`,
            type: CanvasNodeType.Text,
            title: `文本 ${index + 1}`,
            metadata: {
                content: `第 ${index + 1} 段分镜`,
                status: "success",
                groupId: `group-${index % 5}`,
            },
        });
    }

    const projection = buildStoryboardProjection(nodes);
    const allItems = [...projection.text, ...projection.image, ...projection.video];

    expect(projection.image).toHaveLength(30);
    expect(projection.video).toHaveLength(12);
    expect(projection.text).toHaveLength(10);
    expect(allItems).toHaveLength(52);
    expect(new Set(allItems.map((item) => item.id)).size).toBe(52);
    expect(filterStoryboardItems(projection.image, "镜头 17", "all").map((item) => item.nodeId)).toEqual(["image-16"]);
    expect(filterStoryboardItems(projection.image, "", "error")).toHaveLength(3);
    expect(filterStoryboardItems(projection.video, "", "loading").map((item) => item.nodeId)).toEqual(["video-0"]);
});
