import { afterAll, expect, test } from "bun:test";

import { FEATURE_FLAG_DEFAULTS, isFeatureEnabled, parseFeatureFlag } from "../src/constant/feature-flags";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterAll(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
});

test("new capabilities are disabled by default", () => {
    expect(FEATURE_FLAG_DEFAULTS.creativeWorkflow).toBe(false);
    expect(FEATURE_FLAG_DEFAULTS.builtinCanvasAgent).toBe(false);
    expect(FEATURE_FLAG_DEFAULTS.director3d).toBe(false);
    expect(FEATURE_FLAG_DEFAULTS.panorama).toBe(false);
    expect(FEATURE_FLAG_DEFAULTS.quickCreate).toBe(false);
    expect(FEATURE_FLAG_DEFAULTS.fytBackend).toBe(false);
});

test("feature flag values accept explicit true and false forms", () => {
    expect(parseFeatureFlag("1")).toBe(true);
    expect(parseFeatureFlag("true")).toBe(true);
    expect(parseFeatureFlag("0")).toBe(false);
    expect(parseFeatureFlag("false")).toBe(false);
    expect(parseFeatureFlag(null)).toBe(false);
});

test("query values override runtime configuration", () => {
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            location: { search: "?ff_creativeWorkflow=0" },
            __RUNTIME_CONFIG__: { FEATURE_FLAGS: { creativeWorkflow: "1" } },
        },
    });

    expect(isFeatureEnabled("creativeWorkflow")).toBe(false);
});

test("runtime configuration overrides disabled defaults", () => {
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            location: { search: "" },
            __RUNTIME_CONFIG__: { FEATURE_FLAGS: { quickCreate: "true" } },
        },
    });

    expect(isFeatureEnabled("quickCreate")).toBe(true);
});
