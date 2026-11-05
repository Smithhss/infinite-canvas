import { expect, test } from "bun:test";

import { formatSmartCutTime, moveSmartCutClip, normalizeSmartCutClip, normalizeSmartCutClips, smartCutDurationMs, SMART_CUT_MAX_CLIPS, type SmartCutClip } from "../src/lib/canvas/canvas-smart-cut";

function clip(id: string, durationMs: number, startMs = 0, endMs = durationMs): SmartCutClip {
    return { id, title: id, src: `blob:${id}`, durationMs, startMs, endMs };
}

test("smart cut clamps trim ranges and drops unusable clips", () => {
    expect(normalizeSmartCutClip(clip("valid", 2000, -10, 5000))).toMatchObject({ startMs: 0, endMs: 2000 });
    expect(normalizeSmartCutClip(clip("short", 99))).toBeNull();
    expect(normalizeSmartCutClip(clip("small-window", 2000, 500, 520))).toMatchObject({ startMs: 500, endMs: 600 });
});

test("smart cut preserves clip order, caps the sequence, and totals trimmed duration", () => {
    const clips = Array.from({ length: SMART_CUT_MAX_CLIPS + 2 }, (_, index) => clip(String(index), 1000, 100, 700));
    const normalized = normalizeSmartCutClips(clips);

    expect(normalized).toHaveLength(SMART_CUT_MAX_CLIPS);
    expect(normalized.map((item) => item.id).slice(0, 3)).toEqual(["0", "1", "2"]);
    expect(smartCutDurationMs(normalized)).toBe(SMART_CUT_MAX_CLIPS * 600);
});

test("smart cut reorders only valid neighboring clips and formats fractional seconds", () => {
    const clips = [clip("a", 1000), clip("b", 1000), clip("c", 1000)];

    expect(moveSmartCutClip(clips, 1, -1).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(moveSmartCutClip(clips, 0, -1)).toBe(clips);
    expect(moveSmartCutClip(clips, 2, 1)).toBe(clips);
    expect(formatSmartCutTime(65_400)).toBe("01:05.4");
    expect(formatSmartCutTime(65_399)).toBe("01:05.3");
    expect(formatSmartCutTime(65_999)).toBe("01:05.9");
});
