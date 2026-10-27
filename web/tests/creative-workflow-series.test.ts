import { expect, test } from "bun:test";

import {
    buildSeriesPromptRequest,
    MAX_WORKFLOW_SERIES_CONCURRENCY,
    parseSeriesPromptDrafts,
    runSeriesDrafts,
} from "../src/lib/creative-workflow-series";

test("parses strict JSON series drafts and clamps concurrency", () => {
    const drafts = parseSeriesPromptDrafts(JSON.stringify({ items: [
        { title: "封面", prompt: "一张封面图" },
        { title: "细节", prompt: "一张细节图" },
    ] }), 2);
    expect(drafts).toHaveLength(2);
    expect(drafts[1].title).toBe("细节");
    expect(MAX_WORKFLOW_SERIES_CONCURRENCY).toBe(3);
});

test("falls back to a single safe draft when model output is invalid", () => {
    const drafts = parseSeriesPromptDrafts("not json", 4, "基础提示词");
    expect(drafts).toHaveLength(1);
    expect(drafts[0].prompt).toBe("基础提示词");
});

test("builds a text-only series request", () => {
    const messages = buildSeriesPromptRequest({ count: 3, basePrompt: "一只猫" });
    expect(messages[0].content).toContain("严格 JSON");
    expect(messages[1].content).toContain("一只猫");
});

test("series runner observes at most three concurrent tasks", async () => {
    let active = 0;
    let peak = 0;
    const controller = new AbortController();
    const results = await runSeriesDrafts({
        drafts: Array.from({ length: 6 }, (_, index) => ({ id: String(index), title: String(index), prompt: String(index) })),
        concurrency: 6,
        signal: controller.signal,
        runOne: async () => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
        },
    });
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(peak).toBe(3);
});
