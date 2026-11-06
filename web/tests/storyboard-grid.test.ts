import { expect, test } from "bun:test";

import {
    buildStoryboardGrid,
    collectStoryboardGridNodeIds,
    convertStoryboardGridToGroup,
    findStoryboardGridGroup,
    hasLockedStoryboardGridNodes,
    normalizeStoryboardGridOptions,
    replaceStoryboardGridNodes,
    stripRemovedStoryboardGridMetadata,
    storyboardGridState,
    storyboardGridStateDetails,
    storyboardGridOptionsMatch,
    stripStoryboardGridMetadata,
    STORYBOARD_GRID_MAX_SHOTS,
} from "@/lib/canvas/storyboard-grid";
import { applyUngroupSelection } from "@/lib/canvas/canvas-node-geometry";
import { addScriptShot, createEmptyScriptV2, moveScriptShotToTarget, updateScriptMeta, updateScriptShot } from "@/lib/canvas/script-v2";
import { CanvasNodeType, type CanvasNodeData, type CanvasScriptV2 } from "@/types/canvas";

function scriptNode(): CanvasNodeData {
    return {
        id: "script-1",
        type: CanvasNodeType.Script,
        title: "雨夜故事",
        position: { x: 100, y: 200 },
        width: 560,
        height: 420,
        metadata: {},
    };
}

function scriptWithShots(count: number): CanvasScriptV2 {
    let script = updateScriptMeta(createEmptyScriptV2(), { theme: "雨夜追踪", aspectRatio: "16:9", styleDescription: "电影感" });
    for (let index = 0; index < count; index += 1) script = addScriptShot(script);
    return script;
}

function titles() {
    return { group: "分镜组", shot: () => "镜头" };
}

test("builds a bounded multi-column storyboard group with stable shot mappings", () => {
    let script = scriptWithShots(6);
    script = updateScriptShot(script, script.rows[0].id, { plotDescription: "林默走进雨夜车站", shotSize: "中景" });
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 3, showShotNumbers: true, aspectRatio: "4:3" },
        titles: titles(),
    });

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.images).toHaveLength(6);
    expect(result.group.type).toBe(CanvasNodeType.Group);
    expect(result.group.metadata?.storyboardGrid?.columns).toBe(3);
    expect(result.group.metadata?.storyboardGrid?.aspectRatio).toBe("4:3");
    expect(result.group.metadata?.storyboardGrid?.shotOrder).toEqual(script.rows.map((row) => row.id));
    expect(result.images[0].title).toBe("#1 镜头");
    expect(result.images[0].metadata?.prompt).toContain("林默走进雨夜车站");
    expect(result.images[0].metadata?.groupId).toBe(result.group.id);
    expect(result.images[0].metadata?.storyboardShotId).toBe(script.rows[0].id);
    for (const image of result.images) {
        expect(image.position.x).toBeGreaterThanOrEqual(result.group.position.x);
        expect(image.position.y).toBeGreaterThanOrEqual(result.group.position.y);
        expect(image.position.x + image.width).toBeLessThanOrEqual(result.group.position.x + result.group.width);
        expect(image.position.y + image.height).toBeLessThanOrEqual(result.group.position.y + result.group.height);
    }
});

test("caps the storyboard at 25 shots and clamps the column setting", () => {
    const script = scriptWithShots(STORYBOARD_GRID_MAX_SHOTS + 5);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 99, showShotNumbers: false },
        titles: titles(),
    });

    expect(normalizeStoryboardGridOptions({ columns: 99, showShotNumbers: false })).toEqual({ columns: 5, showShotNumbers: false, aspectRatio: "16:9" });
    expect(result?.images).toHaveLength(STORYBOARD_GRID_MAX_SHOTS);
    expect(result?.group.metadata?.storyboardGrid?.shotOrder).toHaveLength(STORYBOARD_GRID_MAX_SHOTS);
    expect(result?.images[0].title).toBe("镜头");
});

test("detects stale bindings after prompts or shot order change", () => {
    let script = scriptWithShots(2);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const nodes = [scriptNode(), result.group, ...result.images];
    expect(storyboardGridState(script, result.group, nodes)).toBe("ready");
    expect(storyboardGridStateDetails(script, result.group, nodes)).toEqual({ state: "ready" });

    script = updateScriptShot(script, script.rows[0].id, { imageGenerationPrompt: "新版提示词" });
    expect(storyboardGridState(script, result.group, nodes)).toBe("stale");
    expect(storyboardGridStateDetails(script, result.group, nodes)).toEqual({ state: "stale", reason: "source-changed" });

    script = moveScriptShotToTarget(script, script.rows[0].id, script.rows[1].id);
    expect(storyboardGridState(script, result.group, nodes)).toBe("stale");
});

test("detects missing, duplicated or manually linked grid children", () => {
    const script = scriptWithShots(2);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const complete = [scriptNode(), result.group, ...result.images];
    expect(storyboardGridState(script, result.group, complete)).toBe("ready");
    expect(storyboardGridState(script, result.group, complete.slice(0, -1))).toBe("stale");
    expect(storyboardGridStateDetails(script, result.group, complete.slice(0, -1))).toEqual({ state: "stale", reason: "nodes-invalid" });
    expect(storyboardGridState(script, result.group, [...complete, { ...result.images[0], id: "extra" }])).toBe("stale");
    expect(storyboardGridState(script, result.group, [...complete, { ...result.images[0], id: "other-shot", metadata: { ...result.images[0].metadata, storyboardShotId: "unknown" } }])).toBe("stale");
});

test("treats any locked group member as a locked storyboard operation", () => {
    const script = scriptWithShots(2);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const nodes = [scriptNode(), result.group, ...result.images];
    expect(hasLockedStoryboardGridNodes("script-1", nodes)).toBe(false);
    expect(hasLockedStoryboardGridNodes("script-1", nodes.map((node) => node.id === result.group.id ? { ...node, locked: true } : node))).toBe(true);
    expect(hasLockedStoryboardGridNodes("script-1", nodes.map((node) => node.id === result.images[0].id ? { ...node, locked: true } : node))).toBe(true);
    expect(hasLockedStoryboardGridNodes("script-1", [...nodes, { ...result.images[0], id: "normal-child", metadata: { groupId: result.group.id }, locked: true }])).toBe(true);
});

test("collects and converts a storyboard grid without deleting its nodes", () => {
    const script = scriptWithShots(2);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const nodes = [scriptNode(), result.group, ...result.images];

    expect(collectStoryboardGridNodeIds("script-1", nodes).size).toBe(3);
    const converted = convertStoryboardGridToGroup("script-1", nodes);
    expect(converted).toHaveLength(nodes.length);
    expect(findStoryboardGridGroup("script-1", converted)).toBeUndefined();
    expect(converted.filter((node) => node.type === CanvasNodeType.Image).every((node) => !node.metadata?.storyboardGridId)).toBe(true);

    const rebuilt = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!rebuilt) throw new Error("expected a rebuilt storyboard grid");
    expect(rebuilt.group.id).not.toBe(result.group.id);
    expect(new Set([...converted, rebuilt.group, ...rebuilt.images].map((node) => node.id)).size).toBe(converted.length + 1 + rebuilt.images.length);
});

test("keeps node mappings stable when the same group is rebound", () => {
    const script = scriptWithShots(2);
    const first = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!first) throw new Error("expected a storyboard grid");
    const second = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 3, showShotNumbers: false, aspectRatio: "9:16" },
        groupId: first.group.id,
        titles: titles(),
    });
    if (!second) throw new Error("expected a rebound storyboard grid");

    expect(second.group.id).toBe(first.group.id);
    expect(second.images.map((node) => node.id)).toEqual(first.images.map((node) => node.id));
    expect(storyboardGridOptionsMatch(first.group, { columns: 2, showShotNumbers: true, aspectRatio: "16:9" })).toBe(true);
    expect(storyboardGridOptionsMatch(first.group, { columns: 3, showShotNumbers: true, aspectRatio: "16:9" })).toBe(false);
    expect(storyboardGridOptionsMatch(first.group, { columns: 2, showShotNumbers: true, aspectRatio: "9:16" })).toBe(false);
});

test("rebinding preserves group connections and replaces child connections", () => {
    const script = scriptWithShots(2);
    const first = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!first) throw new Error("expected a storyboard grid");
    const rebound = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        groupId: first.group.id,
        titles: titles(),
    });
    if (!rebound) throw new Error("expected a rebound storyboard grid");
    const connections = [
        { id: "group", fromNodeId: first.group.id, toNodeId: "config" },
        { id: "child", fromNodeId: first.images[0].id, toNodeId: "config" },
    ];
    const result = replaceStoryboardGridNodes([scriptNode(), first.group, ...first.images], connections, collectStoryboardGridNodeIds("script-1", [first.group, ...first.images]), rebound);

    expect(result.connections.map((connection) => connection.id)).toEqual(["group"]);
    expect(result.nodes.filter((node) => node.id === first.group.id)).toHaveLength(1);
    expect(result.nodes.filter((node) => node.metadata?.storyboardGridId === first.group.id)).toHaveLength(2);
});

test("strips storyboard linkage before duplicating nodes", () => {
    const script = scriptWithShots(1);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const strippedGroup = stripStoryboardGridMetadata(result.group);
    const strippedImage = stripStoryboardGridMetadata(result.images[0]);
    expect(strippedGroup.metadata?.storyboardGrid).toBeUndefined();
    expect(strippedImage.metadata?.storyboardGridId).toBeUndefined();
    expect(strippedImage.metadata?.storyboardShotId).toBeUndefined();
    expect(strippedImage.metadata?.storyboardShotNumber).toBeUndefined();
    expect(strippedImage.metadata?.groupId).toBe(result.group.id);
});

test("removing or ungrouping the grid detaches surviving linked nodes", () => {
    const script = scriptWithShots(2);
    const result = buildStoryboardGrid({
        scriptNode: scriptNode(),
        script,
        options: { columns: 2, showShotNumbers: true, aspectRatio: "16:9" },
        titles: titles(),
    });
    if (!result) throw new Error("expected a storyboard grid");
    const nodes = [scriptNode(), result.group, ...result.images];

    const afterDelete = stripRemovedStoryboardGridMetadata(
        nodes.filter((node) => node.id !== result.group.id).map((node) => ({ ...node, metadata: { ...node.metadata, groupId: undefined } })),
        [result.group],
    );
    for (const image of afterDelete.filter((node) => node.type === CanvasNodeType.Image)) {
        expect(image.metadata?.groupId).toBeUndefined();
        expect(image.metadata?.storyboardGridId).toBeUndefined();
        expect(image.metadata?.storyboardShotId).toBeUndefined();
    }

    const ungrouped = applyUngroupSelection(new Set([result.group.id]), nodes, []);
    if (!ungrouped) throw new Error("expected ungroup result");
    const remainingIds = new Set(ungrouped.nodes.map((node) => node.id));
    const afterUngroup = stripRemovedStoryboardGridMetadata(ungrouped.nodes, nodes.filter((node) => !remainingIds.has(node.id)));
    for (const image of afterUngroup.filter((node) => node.type === CanvasNodeType.Image)) {
        expect(image.metadata?.groupId).toBeUndefined();
        expect(image.metadata?.storyboardGridId).toBeUndefined();
        expect(image.metadata?.storyboardShotId).toBeUndefined();
    }
});
