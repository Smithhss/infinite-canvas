import { expect, test } from "bun:test";

import { buildStoryboardProjection } from "../src/lib/canvas/storyboard-projection";
import { filterStoryboardLibraryItems, groupStoryboardLibraryItems } from "../src/lib/canvas/storyboard-workbench";
import { CanvasNodeType, type CanvasNodeData } from "../src/types/canvas";

const base = { position: { x: 0, y: 0 }, width: 320, height: 240 };

function node(id: string, title: string, category: "character" | "scene" | "prop" | "other", content = ""): CanvasNodeData {
    return {
        ...base,
        id,
        type: CanvasNodeType.Image,
        title,
        metadata: { content, status: "success", naturalWidth: 1, naturalHeight: 1, storyboardCategory: category, prompt: `${title} prompt` },
    };
}

test("filters the project asset library by storyboard category and search text", () => {
    const projection = buildStoryboardProjection([
        node("character-1", "主角", "character"),
        node("scene-1", "雨夜街道", "scene"),
        node("prop-1", "旧伞", "prop"),
        node("other-1", "参考", "other"),
    ]);

    expect(filterStoryboardLibraryItems(projection.image, { keyword: "", category: "all" })).toHaveLength(4);
    expect(filterStoryboardLibraryItems(projection.image, { keyword: "", category: "character" }).map((item) => item.nodeId)).toEqual(["character-1"]);
    expect(filterStoryboardLibraryItems(projection.image, { keyword: "雨夜", category: "all" }).map((item) => item.nodeId)).toEqual(["scene-1"]);
    expect(filterStoryboardLibraryItems(projection.image, { keyword: "不存在", category: "all" })).toEqual([]);
});

test("groups filtered library items back into the three visible sections", () => {
    const projection = buildStoryboardProjection([
        node("character-1", "主角", "character"),
        {
            ...base,
            id: "text-1",
            type: CanvasNodeType.Text,
            title: "剧本片段",
            metadata: { content: "第一场", status: "success", storyboardCategory: "scene" },
        },
        {
            ...base,
            id: "video-1",
            type: CanvasNodeType.Video,
            title: "镜头视频",
            metadata: { content: "blob:video", status: "success", storyboardCategory: "scene" },
        },
    ]);
    const all = [...projection.text, ...projection.image, ...projection.video];
    const grouped = groupStoryboardLibraryItems(filterStoryboardLibraryItems(all, { keyword: "", category: "scene" }));

    expect(grouped.text.map((item) => item.nodeId)).toEqual(["text-1"]);
    expect(grouped.image).toEqual([]);
    expect(grouped.video.map((item) => item.nodeId)).toEqual(["video-1"]);
});

test("keeps script V2 items in their own library section", () => {
    const projection = buildStoryboardProjection([
        {
            ...base,
            id: "script-1",
            type: CanvasNodeType.Script,
            title: "脚本 V2",
            metadata: { status: "success", storyboardCategory: "scene", scriptV2: { version: 1, rows: [] } },
        },
    ]);
    const grouped = groupStoryboardLibraryItems([...projection.script, ...projection.text, ...projection.image, ...projection.video]);

    expect(grouped.script.map((item) => item.nodeId)).toEqual(["script-1"]);
    expect(grouped.text).toEqual([]);
    expect(grouped.image).toEqual([]);
    expect(grouped.video).toEqual([]);
});
