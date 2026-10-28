import { expect, test } from "bun:test";

import { defaultVideoModelCapabilities, inferVideoModelCapabilities, resolveVideoCapabilities } from "../src/lib/video-model-capabilities";

if (!globalThis.localStorage) {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        },
    });
}
const { buildGeminiVideoParameters, buildPluginVideoParams, buildVideoTaskBody } = await import("../src/services/api/video");
const { normalizeChannelModels } = await import("../src/stores/use-config-store");

test("keeps unknown models conservative", () => {
    const caps = inferVideoModelCapabilities("unknown-video");
    expect(caps.modes).toEqual(["text-to-video"]);
    expect(caps.maxReferenceImages).toBe(0);
    expect(caps.supportsMultiShot).toBe(false);
    expect(caps.supportsAudio).toBe(false);
});

test("recognizes capability hints without claiming verification", () => {
    const caps = inferVideoModelCapabilities("kling-v26-pro");
    expect(caps.modes).toContain("image-to-video");
    expect(caps.modes).toContain("first-last-frame");
    expect(caps.supportsMultiShot).toBe(true);
    expect(caps.supportsAudio).toBe(true);
});

test("returns a fresh minimal capability object", () => {
    const first = defaultVideoModelCapabilities();
    first.modes.push("image-to-video");
    expect(defaultVideoModelCapabilities().modes).toEqual(["text-to-video"]);
});

test("channel overrides take precedence for the selected channel only", () => {
    const config = {
        channels: [
            {
                id: "known",
                models: [
                    {
                        name: "custom-video",
                        capability: "video" as const,
                        videoCapabilities: {
                            modes: ["text-to-video" as const, "reference-audio" as const],
                            maxReferenceImages: 2,
                            supportsAudio: true,
                        },
                    },
                ],
            },
            { id: "other", models: [{ name: "custom-video", capability: "video" as const }] },
        ],
    };

    const selected = resolveVideoCapabilities(config, "known::custom-video");
    expect(selected.modes).toEqual(["text-to-video", "reference-audio"]);
    expect(selected.maxReferenceImages).toBe(2);
    expect(selected.supportsAudio).toBe(true);

    const other = resolveVideoCapabilities(config, "other::custom-video");
    expect(other.modes).toEqual(["text-to-video"]);
    expect(other.maxReferenceImages).toBe(0);
});

test("does not send unsupported provider-specific fields to a generic video model", () => {
    const body = buildVideoTaskBody({
        model: "generic-video",
        prompt: "走路",
        capabilities: defaultVideoModelCapabilities(),
        config: {
            videoNegativePrompt: "模糊",
            videoMultiShot: "true",
            videoMultiPrompt: "近景\n远景",
        },
    });
    expect(body.has("negative_prompt")).toBe(false);
    expect(body.has("multi_shot")).toBe(false);
    expect(body.has("multi_prompt")).toBe(false);
    expect(body.has("generate_audio")).toBe(false);
    expect(body.has("mode")).toBe(false);
});

test("sends capability-gated Kling fields and clamps duration", () => {
    const body = buildVideoTaskBody({
        model: "kling-v26-pro",
        prompt: "海边慢镜头",
        capabilities: inferVideoModelCapabilities("kling-v26-pro"),
        config: {
            videoSeconds: "30",
            videoNegativePrompt: "低清晰度",
            videoMultiShot: "true",
            videoMultiPrompt: "近景\n远景",
        },
    });
    expect(body.get("seconds")).toBe("10");
    expect(body.get("negative_prompt")).toBe("低清晰度");
    expect(body.get("multi_shot")).toBe("true");
    expect(body.get("shot_type")).toBe("customize");
    expect(body.get("multi_prompt")).toContain('"index":1');
    expect(body.has("generate_audio")).toBe(true);
});

test("rejects reference images before a request when the model declares no support", () => {
    expect(() =>
        buildVideoTaskBody({
            model: "generic-video",
            prompt: "走路",
            capabilities: defaultVideoModelCapabilities(),
            images: [new File(["image"], "ref.png", { type: "image/png" })],
        }),
    ).toThrow();
});

test("normalizes saved video capability overrides on channel models", () => {
    const [model] = normalizeChannelModels([
        {
            name: "custom-video",
            capability: "video",
            videoCapabilities: { modes: ["text-to-video", "image-to-video"], maxSeconds: 7 },
        },
    ]);
    expect(model.videoCapabilities?.modes).toEqual(["text-to-video", "image-to-video"]);
    expect(model.videoCapabilities?.maxSeconds).toBe(7);
});

test("plugin and Gemini requests clamp duration and omit unsupported fields", () => {
    const plugin = buildPluginVideoParams(
        {
            videoSeconds: "30",
            size: "16:9",
            vquality: "720",
            videoGenerateAudio: "true",
            videoWatermark: "true",
            videoMode: "frames",
            videoNegativePrompt: "低清晰度",
            videoMultiShot: "true",
            videoMultiPrompt: "近景\n远景",
        },
        0,
        inferVideoModelCapabilities("kling-v26-pro"),
    );
    expect(plugin.seconds).toBe("10");
    expect(plugin.generateAudio).toBe(true);
    expect(plugin.watermark).toBe(true);
    expect(plugin.mode).toBeUndefined();

    const generic = buildPluginVideoParams(
        {
            videoSeconds: "30",
            size: "16:9",
            vquality: "720",
            videoGenerateAudio: "true",
            videoWatermark: "true",
            videoMode: "frames",
            videoNegativePrompt: "低清晰度",
            videoMultiShot: "true",
            videoMultiPrompt: "近景\n远景",
        },
        0,
        defaultVideoModelCapabilities(),
    );
    expect(generic.seconds).toBe("6");
    expect("generateAudio" in generic).toBe(false);
    expect("watermark" in generic).toBe(false);
    expect("mode" in generic).toBe(false);
    expect("negativePrompt" in generic).toBe(false);
    expect("multiShot" in generic).toBe(false);

    const gemini = buildGeminiVideoParameters(
        {
            videoSeconds: "30",
            size: "16:9",
            vquality: "720",
            videoGenerateAudio: "true",
            videoWatermark: "true",
            videoMode: "frames",
            videoNegativePrompt: "低清晰度",
            videoMultiShot: "true",
            videoMultiPrompt: "近景\n远景",
        },
        inferVideoModelCapabilities("veo-3"),
    );
    expect(gemini.durationSeconds).toBe(8);
    expect("generateAudio" in gemini).toBe(false);
    expect("addWatermark" in gemini).toBe(false);
    expect("negativePrompt" in gemini).toBe(false);
    expect("multiShot" in gemini).toBe(false);
});
