import { expect, test } from "bun:test";

import { addScriptShot, createEmptyScriptV2, normalizeScriptColumnVisibility, normalizeScriptV2, removeScriptShot, scriptDurationSeconds, updateScriptColumnVisibility, updateScriptMeta, updateScriptShot, updateScriptViewMode } from "../src/lib/canvas/script-v2";

test("normalizes missing and partially persisted script data", () => {
    const script = normalizeScriptV2({
        theme: "雨夜",
        rows: [{ id: "shot-a", shotNumber: 9, durationSeconds: 0, plotDescription: "主角走进车站" }],
    });

    expect(script.version).toBe(1);
    expect(script.aspectRatio).toBe("16:9");
    expect(script.rows[0]).toMatchObject({ id: "shot-a", shotNumber: 1, durationSeconds: 4, plotDescription: "主角走进车站" });
});

test("adds, edits and removes shots while keeping shot numbers contiguous", () => {
    let script = addScriptShot(addScriptShot(createEmptyScriptV2()));
    expect(script.rows.map((row) => row.shotNumber)).toEqual([1, 2]);

    script = updateScriptShot(script, script.rows[0].id, { plotDescription: "第一镜已编辑", durationSeconds: 6 });
    script = updateScriptMeta(script, { theme: "追光", styleDescription: "冷色电影感" });
    expect(script.rows[0]).toMatchObject({ plotDescription: "第一镜已编辑", durationSeconds: 6 });
    expect(script.theme).toBe("追光");
    expect(scriptDurationSeconds(script)).toBe(10);

    script = removeScriptShot(script, script.rows[0].id);
    expect(script.rows).toHaveLength(1);
    expect(script.rows[0].shotNumber).toBe(1);
    expect(script.rows[0].plotDescription).toBe("");
});

test("normalizes advanced shot fields, view mode and persisted column visibility", () => {
    const script = normalizeScriptV2({
        viewMode: "asset",
        columnVisibility: { shotNumber: false, cameraMovement: true },
        rows: [
            {
                id: "shot-a",
                shotNumber: 1,
                durationSeconds: 5,
                plotDescription: "角色走入雨幕",
                characters: ["林默", "林默", "顾川"],
                videoReference: "ref-video-1",
                propTags: ["伞", "旧信"],
                cameraMovement: "缓慢推近",
                imageToVideoMotionPrompt: "镜头从远处推进到面部",
                color: "blue",
            },
            {
                id: "shot-b",
                shotNumber: 2,
                durationSeconds: 3,
                plotDescription: "",
                color: "invalid",
            },
        ],
    });

    expect(script.viewMode).toBe("asset");
    expect(script.columnVisibility).toMatchObject({ shotNumber: false, cameraMovement: true, plot: true });
    expect(script.rows[0]).toMatchObject({ characters: ["林默", "顾川"], propTags: ["伞", "旧信"], cameraMovement: "缓慢推近", color: "blue" });
    expect(script.rows[1].color).toBeUndefined();
});

test("persists view and field visibility changes without losing defaults", () => {
    let script = updateScriptViewMode(createEmptyScriptV2(), "creative");
    script = updateScriptColumnVisibility(script, "videoReference", true);

    expect(script.viewMode).toBe("creative");
    expect(normalizeScriptColumnVisibility(script.columnVisibility)).toMatchObject({ shotNumber: true, videoReference: true, videoPrompt: false });
});
