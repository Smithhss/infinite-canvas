import { expect, test } from "bun:test";

import { buildQuickCreateUrl, clearQuickCreateDraft, readQuickCreateDraft, storeQuickCreateDraft, type QuickCreateDraft } from "../src/lib/quick-create";

function createStorage() {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
        removeItem: (key: string) => {
            values.delete(key);
        },
    };
}

test("stores a quick create draft outside the URL", () => {
    const storage = createStorage();
    const draft: QuickCreateDraft = { mode: "image", prompt: "白色小猫", model: "gpt-image-2" };

    expect(storeQuickCreateDraft(draft, storage)).toBe(true);
    expect(buildQuickCreateUrl("image")).toBe("/image");
    expect(readQuickCreateDraft(storage)).toEqual(draft);
});

test("keeps video drafts mode-scoped and never auto-runs", () => {
    const storage = createStorage();
    const draft: QuickCreateDraft = { mode: "video", prompt: "镜头推进" };

    expect(storeQuickCreateDraft(draft, storage)).toBe(true);
    expect(buildQuickCreateUrl("video")).toBe("/video");
    expect(readQuickCreateDraft(storage)).toEqual(draft);
});

test("normalizes stored values and ignores sensitive or unknown fields", () => {
    const storage = createStorage();
    storage.setItem("infinite-canvas:quick-create", JSON.stringify({ mode: "video", prompt: `a\u0000${"x".repeat(700)}`, model: "kling-v26-pro", apiKey: "secret", token: "secret" }));

    const draft = readQuickCreateDraft(storage);
    expect(draft?.mode).toBe("video");
    expect(draft?.prompt).toHaveLength(600);
    expect(draft?.prompt).not.toContain("\u0000");
    expect(draft?.model).toBe("kling-v26-pro");
    expect(JSON.stringify(draft)).not.toContain("secret");
});

test("rejects invalid or empty stored drafts", () => {
    const storage = createStorage();
    expect(storeQuickCreateDraft({ mode: "image", prompt: "   " }, storage)).toBe(false);
    expect(readQuickCreateDraft(storage)).toBeNull();

    storage.setItem("infinite-canvas:quick-create", "{broken");
    expect(readQuickCreateDraft(storage)).toBeNull();
});

test("clears only the matching studio draft", () => {
    const storage = createStorage();
    expect(storeQuickCreateDraft({ mode: "image", prompt: "猫" }, storage)).toBe(true);
    clearQuickCreateDraft("video", storage);
    expect(readQuickCreateDraft(storage)?.prompt).toBe("猫");
    clearQuickCreateDraft("image", storage);
    expect(readQuickCreateDraft(storage)).toBeNull();
});
