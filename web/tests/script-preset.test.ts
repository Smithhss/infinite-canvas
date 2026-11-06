import { expect, test } from "bun:test";

import {
    applyScriptPresetTemplate,
    applyScriptPresetToScript,
    buildScriptPresetPrompt,
    buildScriptPresetSummary,
    normalizeScriptPreset,
    toggleScriptPresetOption,
    toggleScriptPresetSingle,
} from "../src/lib/canvas/script-preset";
import { createEmptyScriptV2 } from "../src/lib/canvas/script-v2";

test("enforces selection limits and supports deselecting an item", () => {
    let result = toggleScriptPresetOption([], "男频", 2);
    result = toggleScriptPresetOption(result.values, "女频", 2);
    const blocked = toggleScriptPresetOption(result.values, "泛人群", 2);
    const removed = toggleScriptPresetOption(result.values, "男频", 2);

    expect(result.values).toEqual(["男频", "女频"]);
    expect(blocked).toEqual({ values: ["男频", "女频"], changed: false, limitReached: true });
    expect(removed).toEqual({ values: ["女频"], changed: true, limitReached: false });
});

test("single-choice fields toggle back to automatic", () => {
    expect(toggleScriptPresetSingle(undefined, "三幕式")).toBe("三幕式");
    expect(toggleScriptPresetSingle("三幕式", "三幕式")).toBeUndefined();
    expect(toggleScriptPresetSingle("三幕式", "五幕式")).toBe("五幕式");
});

test("normalizes persisted presets without allowing invalid or oversized values", () => {
    const preset = normalizeScriptPreset({
        genre: "玄幻修仙",
        fusedGenre: "不存在",
        audience: ["男频", "男频", "女频", "泛人群"],
        characters: ["小人物", "天才", "双强", "专业型", "修士", "龙王", "医者"],
        eras: ["架空", "古代", "现代"],
        hooks: ["收集升级", "隐藏身份", "视觉奇观", "重生复仇"],
        artStyle: "自定义",
        customArtStyle: "  水墨霓虹  ",
        episodes: 0,
        structure: "英雄旅程",
    });

    expect(preset.audience).toEqual(["男频", "女频"]);
    expect(preset.characters).toEqual(["小人物", "天才", "双强", "专业型", "修士"]);
    expect(preset.eras).toEqual(["架空", "古代"]);
    expect(preset.hooks).toEqual(["收集升级", "隐藏身份", "视觉奇观"]);
    expect(preset.fusedGenre).toBeUndefined();
    expect(preset.customArtStyle).toBe("水墨霓虹");
    expect(preset.episodes).toBe(20);
});

test("top presets fill structured settings without touching script rows", () => {
    const preset = applyScriptPresetTemplate("rule-mystery");
    const script = createEmptyScriptV2();
    script.rows.push({
        id: "shot-1",
        shotNumber: 1,
        durationSeconds: 4,
        plotDescription: "主角进入异常楼道",
    });

    const next = applyScriptPresetToScript(script, preset);

    expect(next.preset).toMatchObject({ genre: "惊悚怪谈", fusedGenre: "悬疑推理", structure: "单元结构" });
    expect(next.rows).toBe(script.rows);
    expect(next.rows[0].plotDescription).toBe("主角进入异常楼道");
});

test("builds a stable structured summary and non-generating prompt", () => {
    const preset = applyScriptPresetTemplate("heritage-visual");
    const summary = buildScriptPresetSummary(preset);
    const prompt = buildScriptPresetPrompt(preset);

    expect(summary).toContain("题材：文旅非遗");
    expect(summary).toContain("目标受众：泛人群、出海");
    expect(summary).toContain("画风：国风壁画");
    expect(summary).toContain("剧本结构：12 集 · 单元结构");
    expect(prompt).toContain("不要直接生成付费图片或视频");
    expect(buildScriptPresetSummary(preset)).toBe(summary);
});
