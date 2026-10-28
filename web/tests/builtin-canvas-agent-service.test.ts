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

const { buildBuiltinAgentRequest, requestBuiltinCanvasAgentTurn, selectBuiltinAgentModel } = await import("../src/services/api/builtin-canvas-agent");

test("built-in agent uses only the configured text model", () => {
    const config = {
        model: "default::gpt-image-2",
        imageModel: "default::gpt-image-2",
        textModel: "default::deepseek-v4-1-flash",
        baseUrl: "https://example.com",
        apiKey: "test-key",
        apiFormat: "openai" as const,
        channels: [
            {
                id: "default",
                name: "Test",
                baseUrl: "https://example.com",
                apiKey: "test-key",
                apiFormat: "openai" as const,
                models: [
                    { name: "gpt-image-2", capability: "image" as const },
                    { name: "deepseek-v4-1-flash", capability: "text" as const },
                ],
            },
        ],
        systemPrompt: "",
    };
    expect(selectBuiltinAgentModel(config)).toBe("default::deepseek-v4-1-flash");
    const request = buildBuiltinAgentRequest({ config: config as never, messages: [{ role: "user", content: "创建一张图" }] });
    expect(request.model).toBe("deepseek-v4-1-flash");
    expect(request.selectedModel).toBe("default::deepseek-v4-1-flash");
    expect(request.tools?.map((tool) => tool.function.name)).toContain("generate_image");
});

test("tool-result follow-up answers do not trigger a redundant JSON fallback", async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => {
        requests += 1;
        return new Response(JSON.stringify({ choices: [{ message: { content: "已完成" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    const config = {
        model: "default::gpt-image-2",
        imageModel: "default::gpt-image-2",
        textModel: "default::deepseek-v4-1-flash",
        baseUrl: "https://example.com",
        apiKey: "test-key",
        apiFormat: "openai" as const,
        channels: [
            {
                id: "default",
                name: "Test",
                baseUrl: "https://example.com",
                apiKey: "test-key",
                apiFormat: "openai" as const,
                models: [{ name: "deepseek-v4-1-flash", capability: "text" as const }],
            },
        ],
        systemPrompt: "",
    };
    try {
        const result = await requestBuiltinCanvasAgentTurn({
            config: config as never,
            messages: [
                { role: "user", content: "生成一张图" },
                { role: "assistant", content: "", toolCalls: [{ id: "call-1", name: "generate_image", arguments: { prompt: "cat" } }] },
                { role: "tool", toolCallId: "call-1", name: "generate_image", content: '{"ok":true}' },
            ],
        });
        expect(result.content).toBe("已完成");
        expect(requests).toBe(1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
