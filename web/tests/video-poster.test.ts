import { expect, test } from "bun:test";

import { videoPosterFrameTime } from "../src/lib/video-poster";

test("uses a frame slightly after the start for a normal video", () => {
    expect(videoPosterFrameTime(15)).toBe(0.1);
});

test("keeps very short videos inside their duration", () => {
    expect(videoPosterFrameTime(0.12)).toBe(0.06);
});

test("falls back to the first frame when duration is unavailable", () => {
    expect(videoPosterFrameTime(Number.NaN)).toBe(0);
    expect(videoPosterFrameTime(0)).toBe(0);
});
