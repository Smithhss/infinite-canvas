import { afterAll, expect, test } from "bun:test";

const values = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
    },
});
afterAll(() => {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
});

const { selectBuiltinImageModel } = await import("../src/lib/canvas/builtin-canvas-agent/media");

const config = {
    imageModel: "default::gpt-image-2",
    channels: [
        {
            id: "default",
            name: "Test",
            baseUrl: "http://127.0.0.1:4010",
            apiKey: "test-key",
            apiFormat: "openai" as const,
            models: [
                { name: "gpt-image-2", capability: "image" as const },
                { name: "gpt-5.5", capability: "text" as const },
            ],
        },
    ],
};

test("built-in agent only accepts ready image models for media actions", () => {
    expect(selectBuiltinImageModel(config as never)).toBe("default::gpt-image-2");
    expect(selectBuiltinImageModel(config as never, "default::gpt-image-2")).toBe("default::gpt-image-2");
    expect(() => selectBuiltinImageModel(config as never, "default::gpt-5.5")).toThrow("image-model-invalid");
});

test("built-in agent rejects image models without channel credentials", () => {
    const unavailable = {
        ...config,
        channels: [{ ...config.channels[0], apiKey: "" }],
    };
    expect(() => selectBuiltinImageModel(unavailable as never)).toThrow("image-model-not-ready");
});
