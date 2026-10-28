import { expect, test } from "bun:test";

import { buildQuickCreateUrl, readQuickCreateDraft } from "../src/lib/quick-create";

test("round-trips a quick create draft through the URL", () => {
    const url = buildQuickCreateUrl({ mode: "image", prompt: "白色小猫", model: "gpt-image-2", run: false });
    const draft = readQuickCreateDraft(new URLSearchParams(url.split("?")[1]));
    expect(draft).toEqual({ mode: "image", prompt: "白色小猫", model: "gpt-image-2", run: false });
});

test("does not auto-run a quick create draft", () => {
    expect(readQuickCreateDraft(new URLSearchParams("mode=image&prompt=cat"))?.run).toBe(false);
});

test("keeps the video path and safe workflow hint", () => {
    const url = buildQuickCreateUrl({ mode: "video", prompt: "cat", workflow: "storyboard-v1", run: false });
    expect(url.startsWith("/video?")).toBe(true);
    expect(readQuickCreateDraft(new URLSearchParams(url.split("?")[1]))).toEqual({ mode: "video", prompt: "cat", workflow: "storyboard-v1", run: false });
});

test("ignores sensitive and unknown query fields", () => {
    const draft = readQuickCreateDraft(new URLSearchParams("mode=video&prompt=cat&model=kling-v26-pro&apiKey=secret&token=secret&balance=999&channelKey=secret"));
    expect(draft).toEqual({ mode: "video", prompt: "cat", model: "kling-v26-pro", run: false });
});

test("rejects invalid modes, empty prompts, and unsafe workflow values", () => {
    expect(readQuickCreateDraft(new URLSearchParams("mode=workflow&prompt=cat"))).toBeNull();
    expect(readQuickCreateDraft(new URLSearchParams("mode=image"))).toBeNull();
    expect(readQuickCreateDraft(new URLSearchParams("mode=image&prompt=cat&workflow=../../secret"))).toEqual({ mode: "image", prompt: "cat", run: false });
});

test("bounds URL values and removes control characters", () => {
    const url = buildQuickCreateUrl({
        mode: "image",
        prompt: `a\u0000${"x".repeat(700)}`,
        model: `model\u001f${"m".repeat(200)}`,
        workflow: `safe-workflow-${"w".repeat(150)}`,
        run: false,
    });
    const draft = readQuickCreateDraft(new URLSearchParams(url.split("?")[1]));

    expect(draft?.prompt).toHaveLength(600);
    expect(draft?.prompt).not.toContain("\u0000");
    expect(draft?.model).toBeUndefined();
    expect(draft?.workflow).toBeUndefined();
});
