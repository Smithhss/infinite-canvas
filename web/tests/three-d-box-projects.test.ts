import { expect, test } from "bun:test";

import { createDirectorProject } from "../src/lib/canvas/director-project";
import { getThreeDBoxProjectTitle, getThreeDBoxProjects } from "../src/lib/canvas/three-d-box-projects";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";

function project(id: string, updatedAt: string, withDirector: boolean): CanvasProject {
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
        viewport: { x: 0, y: 0, k: 1 },
        director: withDirector ? createDirectorProject() : undefined,
    };
}

test("3D-BOX lists only director projects and keeps the newest first", () => {
    const projects = [project("older", "2026-11-01T00:00:00.000Z", true), project("canvas", "2026-11-03T00:00:00.000Z", false), project("newer", "2026-11-04T00:00:00.000Z", true)];

    expect(getThreeDBoxProjects(projects).map((item) => item.id)).toEqual(["newer", "older"]);
});

test("3D-BOX derives a bounded project title without changing the prompt", () => {
    const prompt = "预演一段城市街头的警匪追车戏\n第二行不应进入标题";

    expect(getThreeDBoxProjectTitle(prompt, "未命名 3D-BOX")).toBe("预演一段城市街头的警匪追车戏");
    expect(getThreeDBoxProjectTitle("   \n  ", "未命名 3D-BOX")).toBe("未命名 3D-BOX");
    expect(getThreeDBoxProjectTitle("场".repeat(60), "未命名 3D-BOX")).toHaveLength(47);
});
