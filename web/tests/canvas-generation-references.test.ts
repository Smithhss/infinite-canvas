import { expect, test } from "bun:test";

import { buildGenerationReferences } from "../src/lib/canvas/canvas-generation-reference";
import { buildImageGenerationMetadata } from "../src/lib/canvas/canvas-node-factory";
import type { AiConfig } from "../src/stores/use-config-store";

test("persists ordered generation references without inline data URLs", () => {
    const references = buildGenerationReferences({
        images: [
            { id: "local", name: "local.png", type: "image/png", dataUrl: "blob:local", storageKey: "image:local" },
            { id: "remote", name: "remote.png", type: "image/png", dataUrl: "blob:remote", url: "https://example.com/remote.png" },
            { id: "inline", name: "inline.png", type: "image/png", dataUrl: "data:image/png;base64,secret" },
        ],
    });

    expect(references).toEqual([
        { kind: "image", title: "local.png", storageKey: "image:local" },
        { kind: "image", title: "remote.png", url: "https://example.com/remote.png" },
        { kind: "image", title: "inline.png" },
    ]);
    expect(JSON.stringify(references)).not.toContain("data:image");
});

test("keeps image, video and audio references in their generation order", () => {
    expect(
        buildGenerationReferences({
            images: [{ id: "image", name: "image.png", type: "image/png", dataUrl: "blob:image", storageKey: "image:image" }],
            videos: [{ id: "video", name: "video.mp4", type: "video/mp4", url: "blob:video", storageKey: "video:video" }],
            audios: [{ id: "audio", name: "audio.mp3", type: "audio/mpeg", url: "blob:audio", storageKey: "audio:audio" }],
        }),
    ).toEqual([
        { kind: "image", title: "image.png", storageKey: "image:image" },
        { kind: "video", title: "video.mp4", storageKey: "video:video" },
        { kind: "audio", title: "audio.mp3", storageKey: "audio:audio" },
    ]);
});

test("does not persist inline media URLs", () => {
    expect(
        buildGenerationReferences({
            images: [{ id: "inline", name: "inline.png", type: "image/png", dataUrl: "data:image/png;base64,secret" }],
            videos: [{ id: "inline-video", name: "inline.mp4", type: "video/mp4", url: "data:video/mp4;base64,secret" }],
            audios: [{ id: "inline-audio", name: "inline.mp3", type: "audio/mpeg", url: "data:audio/mpeg;base64,secret" }],
        }),
    ).toEqual([
        { kind: "image", title: "inline.png" },
        { kind: "video", title: "inline.mp4" },
        { kind: "audio", title: "inline.mp3" },
    ]);
});

test("image generation metadata keeps stable references alongside legacy urls", () => {
    const metadata = buildImageGenerationMetadata("edit", { model: "qa-model", size: "2k", quality: "high", background: "" } as AiConfig, 2, [
        { id: "local", name: "local.png", type: "image/png", dataUrl: "blob:local", storageKey: "image:local" },
        { id: "remote", name: "remote.png", type: "image/png", dataUrl: "blob:remote", url: "https://example.com/remote.png" },
    ]);

    expect(metadata.references).toEqual(["image:local", "https://example.com/remote.png"]);
    expect(metadata.generationReferences).toEqual([
        { kind: "image", title: "local.png", storageKey: "image:local" },
        { kind: "image", title: "remote.png", url: "https://example.com/remote.png" },
    ]);
});
