import { afterAll, afterEach, expect, test } from "bun:test";

import {
    appSessionStorageKey,
    appStorageKey,
    appStorageRecordKey,
    getStorageNamespaceOverride,
    isManagedLegacyStorageKey,
    readAppStorageItem,
    removeAppStorageItem,
    setActiveStorageNamespace,
    STORAGE_NAMESPACE_OVERRIDE_KEY,
    writeAppStorageItem,
} from "../src/lib/storage-namespace";
import { installTestLocalStorage } from "./test-local-storage";

const restoreStorage = installTestLocalStorage();

afterEach(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key) localStorage.removeItem(key);
    }
    setActiveStorageNamespace("current");
});

test("maps persistent and session keys into the versioned namespace", () => {
    expect(appStorageKey("canvas-agent-provider")).toBe("infinite-canvas:v1:canvas-agent-provider");
    expect(appStorageKey("infinite-canvas:theme_store")).toBe("infinite-canvas:v1:theme_store");
    expect(appStorageKey("infinite-canvas:v1:theme_store")).toBe("infinite-canvas:v1:theme_store");
    expect(appSessionStorageKey("canvas-agent-client-id")).toBe("infinite-canvas:v1:canvas-agent-client-id");
});

test("maps localForage record keys without changing legacy access", () => {
    setActiveStorageNamespace("current");
    expect(appStorageRecordKey("infinite-canvas:canvas_store")).toBe("canvas_store");

    setActiveStorageNamespace("legacy");
    expect(appStorageRecordKey("infinite-canvas:canvas_store")).toBe("infinite-canvas:canvas_store");
});

test("current namespace reads legacy settings but writes only to the new key", () => {
    localStorage.setItem("canvas-agent-provider", "codex");
    setActiveStorageNamespace("current");

    expect(readAppStorageItem("canvas-agent-provider")).toBe("codex");
    writeAppStorageItem("canvas-agent-provider", "claude");

    expect(localStorage.getItem("infinite-canvas:v1:canvas-agent-provider")).toBe("claude");
    expect(localStorage.getItem("canvas-agent-provider")).toBe("codex");
});

test("legacy recovery mode reads and writes only the legacy key", () => {
    localStorage.setItem("infinite-canvas:v1:canvas-agent-provider", "claude");
    localStorage.setItem("canvas-agent-provider", "codex");
    setActiveStorageNamespace("legacy");

    expect(readAppStorageItem("canvas-agent-provider")).toBe("codex");
    writeAppStorageItem("canvas-agent-provider", "codex-updated");
    expect(localStorage.getItem("canvas-agent-provider")).toBe("codex-updated");
    expect(localStorage.getItem("infinite-canvas:v1:canvas-agent-provider")).toBe("claude");
});

test("removing a setting clears both namespace copies", () => {
    localStorage.setItem("canvas-workspace-view", "workflow");
    localStorage.setItem("infinite-canvas:v1:canvas-workspace-view", "storyboard");

    removeAppStorageItem("canvas-workspace-view");

    expect(localStorage.getItem("canvas-workspace-view")).toBeNull();
    expect(localStorage.getItem("infinite-canvas:v1:canvas-workspace-view")).toBeNull();
});

test("managed preference detection excludes current keys and unrelated site data", () => {
    expect(isManagedLegacyStorageKey("infinite-canvas:theme_store")).toBe(true);
    expect(isManagedLegacyStorageKey("canvas-agent-provider")).toBe(true);
    expect(isManagedLegacyStorageKey("canvas-storyboard-collapsed:project")).toBe(true);
    expect(isManagedLegacyStorageKey("canvas-storyboard-layout:project")).toBe(true);
    expect(isManagedLegacyStorageKey("libtv-sidebar-collapsed")).toBe(true);
    expect(isManagedLegacyStorageKey("infinite-canvas:v1:theme_store")).toBe(false);
    expect(isManagedLegacyStorageKey("unrelated")).toBe(false);
});

test("manual recovery override accepts only known namespace values", () => {
    localStorage.setItem(STORAGE_NAMESPACE_OVERRIDE_KEY, "legacy");
    expect(getStorageNamespaceOverride()).toBe("legacy");
    localStorage.setItem(STORAGE_NAMESPACE_OVERRIDE_KEY, "unknown");
    expect(getStorageNamespaceOverride()).toBeNull();
});

afterAll(() => {
    restoreStorage();
});
