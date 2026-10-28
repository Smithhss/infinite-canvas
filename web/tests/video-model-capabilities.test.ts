import { expect, test } from "bun:test";

import { defaultVideoModelCapabilities, inferVideoModelCapabilities, resolveVideoCapabilities } from "../src/lib/video-model-capabilities";

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
