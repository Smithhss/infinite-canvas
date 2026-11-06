import { expect, test } from "bun:test";

import {
    addScriptAsset,
    addScriptShot,
    bindScriptAssetReference,
    buildScriptShotPrompt,
    composeAllScriptPrompts,
    createEmptyScriptV2,
    duplicateScriptShot,
    filterScriptShots,
    insertScriptShot,
    moveScriptShotToTarget,
    normalizeScriptColumnVisibility,
    normalizeScriptAssets,
    normalizeScriptFilters,
    normalizeScriptV2,
    removeScriptAsset,
    removeScriptShot,
    restoreScriptPrompt,
    scriptAssetAvailability,
    SCRIPT_PROMPT_MAX_LENGTH,
    SCRIPT_V2_SHOT_SIZES,
    scriptShotPromptStatus,
    scriptDurationSeconds,
    syncScriptAssetsFromShots,
    updateScriptColumnVisibility,
    updateScriptFilters,
    updateScriptMeta,
    updateScriptPrompt,
    updateScriptShot,
    updateScriptViewMode,
    validateScriptPrompt,
} from "../src/lib/canvas/script-v2";

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

test("inserts, duplicates and reorders shots with contiguous numbering", () => {
    let script = addScriptShot(addScriptShot(createEmptyScriptV2()));
    script = updateScriptShot(script, script.rows[0].id, { plotDescription: "A" });
    script = updateScriptShot(script, script.rows[1].id, { plotDescription: "C" });
    script = insertScriptShot(script, 1);
    script = updateScriptShot(script, script.rows[1].id, { plotDescription: "B" });
    expect(script.rows.map((row) => row.plotDescription)).toEqual(["A", "B", "C"]);

    script = duplicateScriptShot(script, script.rows[1].id);
    expect(script.rows.map((row) => row.plotDescription)).toEqual(["A", "B", "B", "C"]);
    expect(script.rows.map((row) => row.shotNumber)).toEqual([1, 2, 3, 4]);
    expect(new Set(script.rows.map((row) => row.id)).size).toBe(4);

    script = moveScriptShotToTarget(script, script.rows[3].id, script.rows[0].id);
    expect(script.rows.map((row) => row.plotDescription)).toEqual(["C", "A", "B", "B"]);
    expect(script.rows.map((row) => row.shotNumber)).toEqual([1, 2, 3, 4]);
});

test("normalizes and applies persisted shot filters", () => {
    let script = addScriptShot(addScriptShot(createEmptyScriptV2()));
    script = updateScriptShot(script, script.rows[0].id, { plotDescription: "雨夜车站", durationSeconds: 4, characters: ["林默"] });
    script = updateScriptShot(script, script.rows[1].id, { plotDescription: "晴天码头", durationSeconds: 9, characters: ["顾川"] });
    script = updateScriptFilters(script, [{ id: "f1", column: "plot", operator: "contains", value: "雨" }]);
    expect(filterScriptShots(script).map((row) => row.plotDescription)).toEqual(["雨夜车站"]);

    script = updateScriptFilters(script, [{ id: "f2", column: "duration", operator: "greater", value: "5" }]);
    expect(filterScriptShots(script).map((row) => row.plotDescription)).toEqual(["晴天码头"]);

    script = updateScriptFilters(script, [
        { id: "f3", column: "characters", operator: "equals", value: "林默" },
        { id: "f4", column: "duration", operator: "less", value: "5" },
    ]);
    expect(filterScriptShots(script).map((row) => row.plotDescription)).toEqual(["雨夜车站"]);

    expect(normalizeScriptFilters([
        { id: "bad", column: "unknown", operator: "contains", value: "x" },
        { id: "f5", column: "plot", operator: "contains", value: "保留" },
        { id: "f5", column: "dialogue", operator: "equals", value: "去重" },
    ])).toEqual([
        { id: "f5", column: "plot", operator: "contains", value: "保留" },
        { id: "f5-2", column: "dialogue", operator: "equals", value: "去重" },
    ]);
});

test("exposes the twelve LibTV shot-size presets with stable values", () => {
    expect(SCRIPT_V2_SHOT_SIZES.map((shotSize) => shotSize.value)).toEqual([
        "大远景",
        "远景",
        "全景",
        "中远景",
        "中景",
        "中近景",
        "近景",
        "特写",
        "大特写",
        "头肩景",
        "半身景",
        "全身景",
    ]);
    expect(new Set(SCRIPT_V2_SHOT_SIZES.map((shotSize) => shotSize.labelKey)).size).toBe(12);
});

test("composes local prompts and keeps restorable shot history", () => {
    let script = addScriptShot(createEmptyScriptV2());
    const shotId = script.rows[0].id;
    script = updateScriptMeta(script, { theme: "雨夜追踪", styleDescription: "冷色电影感", aspectRatio: "16:9" });
    script = updateScriptShot(script, shotId, {
        shotSize: "中近景",
        plotDescription: "林默在雨夜车站回头",
        characters: ["林默"],
        propTags: ["旧伞"],
        cameraMovement: "缓慢推近",
        lightingAndAtmosphere: "冷蓝逆光",
    });
    expect(buildScriptShotPrompt(script, script.rows[0])).toContain("景别：中近景");
    expect(buildScriptShotPrompt(script, script.rows[0])).toContain("角色：林默");

    script = composeAllScriptPrompts(script, 1000);
    let shot = script.rows[0];
    const composedPrompt = shot.imageGenerationPrompt || "";
    expect(composedPrompt).toContain("画面：林默在雨夜车站回头");
    expect(shot.promptVersion).toBe(1);
    expect(shot.promptSource).toBe("composed");
    expect(scriptShotPromptStatus(script, shot)).toBe("ready");

    script = updateScriptShot(script, shotId, { plotDescription: "林默跑向站台" });
    expect(scriptShotPromptStatus(script, script.rows[0])).toBe("stale");
    script = updateScriptPrompt(script, shotId, "手动修正的最终提示词", "manual", 2000);
    shot = script.rows[0];
    expect(shot.promptVersion).toBe(2);
    expect(shot.promptHistory?.[0]).toMatchObject({ version: 1, prompt: composedPrompt, source: "composed" });
    expect(scriptShotPromptStatus(script, shot)).toBe("ready");

    script = restoreScriptPrompt(script, shotId, 1, 3000);
    shot = script.rows[0];
    expect(shot.imageGenerationPrompt).toBe(composedPrompt);
    expect(shot.promptVersion).toBe(3);
    expect(shot.promptSource).toBe("restored");
    expect(shot.promptHistory?.map((entry) => entry.version)).toEqual([2, 1]);
    expect(validateScriptPrompt("   ")).toEqual(["empty"]);
    expect(validateScriptPrompt("x".repeat(SCRIPT_PROMPT_MAX_LENGTH + 1))).toEqual(["tooLong"]);
});

test("normalizes local script assets and keeps names and ids stable", () => {
    const assets = normalizeScriptAssets({
        characters: [
            { id: "same", name: " 林默 ", description: " 主角 ", referenceAssetId: " image-1 ", referenceTitle: " 林默立绘 ", status: "draft" },
            { id: "same", name: "顾川" },
            { id: "duplicate-name", name: "林默" },
            { id: "", name: "阿九" },
        ],
        scenes: [{ id: "scene-1", name: "雨夜车站" }],
        props: "invalid",
    });

    expect(assets.characters.map((asset) => asset.id)).toEqual(["same", "same-2", "asset-characters-4"]);
    expect(assets.characters.map((asset) => asset.name)).toEqual(["林默", "顾川", "阿九"]);
    expect(assets.characters[0]).toMatchObject({
        description: "主角",
        status: "ready",
        referenceAssetId: "image-1",
        referenceTitle: "林默立绘",
    });
    expect(assets.scenes).toHaveLength(1);
    expect(assets.props).toEqual([]);

    const script = normalizeScriptV2({
        assets,
        rows: [{ id: "shot-a", shotNumber: 1, durationSeconds: 4, plotDescription: "", characterAssetIds: ["same", "same", ""], sceneAssetIds: ["scene-1"] }],
    });
    expect(script.rows[0].characterAssetIds).toEqual(["same"]);
    expect(script.rows[0].sceneAssetIds).toEqual(["scene-1"]);
});

test("syncs character and prop entities from shot tags without duplicating ids", () => {
    let script = addScriptShot(createEmptyScriptV2());
    const shotId = script.rows[0].id;
    script = addScriptAsset(script, "scenes", "雨夜车站");
    const sceneAssetId = script.assets?.scenes[0].id || "";
    script = updateScriptShot(script, shotId, {
        characters: ["林默", "顾川"],
        propTags: ["旧伞"],
        sceneAssetIds: [sceneAssetId, "missing-scene"],
    });

    script = syncScriptAssetsFromShots(script);
    expect(script.assets?.characters.map((asset) => asset.name)).toEqual(["林默", "顾川"]);
    expect(script.assets?.props.map((asset) => asset.name)).toEqual(["旧伞"]);
    expect(script.rows[0].characterAssetIds).toHaveLength(2);
    expect(script.rows[0].propAssetIds).toEqual([script.assets?.props[0].id as string]);
    expect(script.rows[0].sceneAssetIds).toEqual([sceneAssetId]);

    const firstCharacterId = script.assets?.characters[0].id;
    script = updateScriptShot(script, shotId, { sceneAssetIds: [sceneAssetId, firstCharacterId || ""] });
    script = syncScriptAssetsFromShots(script);
    expect(script.rows[0].sceneAssetIds).toEqual([sceneAssetId]);
    script = syncScriptAssetsFromShots(script);
    expect(script.assets?.characters).toHaveLength(2);
    expect(script.assets?.characters[0].id).toBe(firstCharacterId);
});

test("adds, binds, unbinds and removes shot-linked assets", () => {
    let script = addScriptShot(createEmptyScriptV2());
    const shotId = script.rows[0].id;
    script = updateScriptShot(script, shotId, { characters: ["林默"], propTags: ["旧伞"] });

    script = addScriptAsset(script, "characters", "林默");
    const character = script.assets?.characters[0];
    expect(character).toBeDefined();
    expect(script.rows[0].characterAssetIds).toEqual([character?.id]);
    expect(addScriptAsset(script, "characters", " 林默 ")).toBe(script);

    script = bindScriptAssetReference(script, "characters", character?.id || "", {
        referenceAssetId: "image-1",
        referenceTitle: "林默立绘",
        referenceStorageKey: "image:key",
    });
    expect(script.assets?.characters[0]).toMatchObject({
        status: "ready",
        referenceAssetId: "image-1",
        referenceTitle: "林默立绘",
        referenceStorageKey: "image:key",
    });

    script = bindScriptAssetReference(script, "characters", character?.id || "", null);
    expect(script.assets?.characters[0].status).toBe("draft");
    expect(script.assets?.characters[0].referenceAssetId).toBeUndefined();

    script = addScriptAsset(script, "props", "旧伞");
    const propId = script.assets?.props[0].id;
    expect(script.rows[0].propAssetIds).toEqual([propId]);
    script = removeScriptAsset(script, "characters", character?.id || "");
    expect(script.assets?.characters).toEqual([]);
    expect(script.rows[0].characters).toEqual([]);
    expect(script.rows[0].characterAssetIds).toEqual([]);
    expect(syncScriptAssetsFromShots(script).assets?.characters).toEqual([]);
    script = removeScriptAsset(script, "props", propId || "");
    expect(script.assets?.props).toEqual([]);
    expect(script.rows[0].propTags).toEqual([]);
    expect(script.rows[0].propAssetIds).toEqual([]);
    expect(syncScriptAssetsFromShots(script).assets?.props).toEqual([]);
});

test("clears stale asset ids when shot tags are edited", () => {
    let script = addScriptShot(createEmptyScriptV2());
    const shotId = script.rows[0].id;
    script = updateScriptShot(script, shotId, { characters: ["林默", "顾川"], propTags: ["旧伞", "录音笔"] });
    script = syncScriptAssetsFromShots(script);
    const linMoId = script.assets?.characters.find((asset) => asset.name === "林默")?.id;
    const umbrellaId = script.assets?.props.find((asset) => asset.name === "旧伞")?.id;
    expect(script.rows[0].characterAssetIds).toHaveLength(2);
    expect(script.rows[0].propAssetIds).toHaveLength(2);

    script = updateScriptShot(script, shotId, { characters: ["顾川"], propTags: ["录音笔"] });
    expect(script.rows[0].characterAssetIds).not.toContain(linMoId);
    expect(script.rows[0].propAssetIds).not.toContain(umbrellaId);
    expect(script.rows[0].characterAssetIds).toHaveLength(1);
    expect(script.rows[0].propAssetIds).toHaveLength(1);
});

test("marks an externally deleted reference as missing without changing the saved status", () => {
    const draft = { id: "character-1", name: "林默", status: "draft" as const };
    const bound = { ...draft, status: "ready" as const, referenceAssetId: "image-1" };

    expect(scriptAssetAvailability(draft, new Set())).toBe("draft");
    expect(scriptAssetAvailability(bound, null)).toBe("ready");
    expect(scriptAssetAvailability(bound, new Set(["image-1"]))).toBe("ready");
    expect(scriptAssetAvailability(bound, new Set())).toBe("missing");
    expect(bound.status).toBe("ready");
});

test("removes shared tags from every shot and unlinks deleted scenes", () => {
    let script = addScriptShot(createEmptyScriptV2());
    script = addScriptShot(script);
    const [firstShot, secondShot] = script.rows;
    script = updateScriptShot(script, firstShot.id, { propTags: ["旧伞"], characters: ["林默"] });
    script = updateScriptShot(script, secondShot.id, { propTags: ["旧伞"], characters: ["林默"] });
    script = syncScriptAssetsFromShots(script);

    const propId = script.assets?.props[0].id || "";
    const characterId = script.assets?.characters[0].id || "";
    script = removeScriptAsset(script, "props", propId);
    script = removeScriptAsset(script, "characters", characterId);
    expect(script.rows.every((row) => row.propTags?.length === 0 && row.characterAssetIds?.length === 0)).toBe(true);
    expect(script.rows.every((row) => row.characters?.length === 0)).toBe(true);
    expect(syncScriptAssetsFromShots(script).assets).toMatchObject({ characters: [], props: [] });

    script = addScriptAsset(script, "scenes", "雨夜车站");
    const sceneId = script.assets?.scenes[0].id || "";
    script = updateScriptShot(script, firstShot.id, { sceneAssetIds: [sceneId] });
    script = updateScriptShot(script, secondShot.id, { sceneAssetIds: [sceneId] });
    script = removeScriptAsset(script, "scenes", sceneId);
    expect(script.rows.every((row) => row.sceneAssetIds?.length === 0)).toBe(true);
});
