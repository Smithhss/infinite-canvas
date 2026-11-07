import { expect, test } from "bun:test";

import { aspectRatioValue, storyboardStitchBlockedReason, storyboardStitchPlan } from "@/lib/canvas/storyboard-stitch";

test("2x2 landscape grid uses the long edge at 2K", () => {
    const plan = storyboardStitchPlan({ count: 4, columns: 2, rows: 2, aspectRatio: "16:9", resolution: "2k" });
    expect(plan?.width).toBe(2048);
    expect(plan?.height).toBe(1152);
    expect(plan?.cellWidth).toBe(1024);
    expect(plan?.cellHeight).toBe(576);
});

test("portrait grids use height as the long edge", () => {
    const plan = storyboardStitchPlan({ count: 4, columns: 2, rows: 2, aspectRatio: "9:16", resolution: "2k" });
    expect(plan?.height).toBe(2048);
    expect(plan?.width).toBe(1152);
    expect(plan?.cellWidth).toBe(576);
    expect(plan?.cellHeight).toBe(1024);
});

test("5x5 4K grid stays near 4096 wide", () => {
    const plan = storyboardStitchPlan({ count: 25, columns: 5, rows: 5, aspectRatio: "16:9", resolution: "4k" });
    expect(plan?.width).toBe(4095);
    expect(plan?.height).toBe(2300);
    expect(plan?.cells).toHaveLength(25);
    expect(plan?.cells[0]).toMatchObject({ x: 0, y: 0, width: 819, height: 460 });
    expect(plan?.cells[6]).toMatchObject({ column: 1, row: 1, x: 819, y: 460 });
});

test("missing rows are derived and overflow is rejected", () => {
    expect(storyboardStitchPlan({ count: 3, columns: 2, aspectRatio: "1:1", resolution: "2k" })).toMatchObject({ rows: 2, width: 2048, height: 2048 });
    expect(storyboardStitchPlan({ count: 5, columns: 2, rows: 2, aspectRatio: "16:9", resolution: "2k" })).toBeNull();
    expect(storyboardStitchPlan({ count: 0, columns: 2, aspectRatio: "16:9", resolution: "2k" })).toBeNull();
});

test("invalid ratios fall back to 16:9", () => {
    expect(aspectRatioValue("bad")).toBeCloseTo(16 / 9, 5);
    expect(aspectRatioValue("4:3")).toBeCloseTo(4 / 3, 5);
});

test("stitching waits for every storyboard shot", () => {
    expect(storyboardStitchBlockedReason([])).toBe("empty");
    expect(storyboardStitchBlockedReason([{ status: "done" }, { status: "pending" }])).toBe("unfinished");
    expect(storyboardStitchBlockedReason([{ status: "done" }, { status: "done" }])).toBeNull();
});
