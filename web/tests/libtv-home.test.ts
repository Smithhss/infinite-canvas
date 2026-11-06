import { expect, test } from "bun:test";

import { formatProjectDate, latestCoverAssets, recentCanvasProjects } from "../src/pages/home/libtv/libtv-home-data";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";

function project(id: string, updatedAt: string): CanvasProject {
    return {
        id,
        title: id,
        createdAt: updatedAt,
        updatedAt,
        nodes: [],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "dots",
        showImageInfo: false,
        viewport: { x: 0, y: 0, zoom: 1 },
    };
}

const assets = [
    { id: "a1", kind: "image", title: "a1", coverUrl: "cover-a1", tags: [], createdAt: "2026-11-01", updatedAt: "2026-11-01", data: { dataUrl: "", width: 1, height: 1, bytes: 1, mimeType: "image/png" } },
    { id: "a2", kind: "video", title: "a2", coverUrl: "cover-a2", tags: [], createdAt: "2026-11-05", updatedAt: "2026-11-05", data: { url: "", width: 1, height: 1, bytes: 1, mimeType: "video/mp4" } },
    { id: "a3", kind: "text", title: "a3", coverUrl: "", tags: [], createdAt: "2026-11-06", updatedAt: "2026-11-06", data: { content: "" } },
] as never;

test("recent projects are ordered by updatedAt and capped", () => {
    const projects = [project("old", "2026-10-01"), project("new", "2026-11-06"), project("mid", "2026-11-02")];
    expect(recentCanvasProjects(projects, 2).map((item) => item.id)).toEqual(["new", "mid"]);
});

test("latest assets skip items without a cover", () => {
    expect(latestCoverAssets(assets, 4).map((item) => item.id)).toEqual(["a2", "a1"]);
});

test("project date formats and rejects invalid input", () => {
    expect(formatProjectDate("2026-11-06T08:00:00Z", "zh")).toContain("2026");
    expect(formatProjectDate("not-a-date", "zh")).toBe("");
});
