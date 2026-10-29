import { expect, test } from "bun:test";

import {
    DIRECTOR_MAX_OBJECTS,
    createDirectorProject,
    createDirectorObject,
    isValidDirectorCapture,
    normalizeDirectorColor,
    normalizeDirectorProject,
} from "../src/lib/canvas/director-project";

test("creates a bounded default director project", () => {
    const project = createDirectorProject();
    expect(project.version).toBe(1);
    expect(project.objects).toEqual([]);
    expect(project.background).toBe("studio");
});

test("normalizes only allowlisted director fields", () => {
    const project = normalizeDirectorProject({
        version: 99,
        camera: {
            position: { x: 100, y: -100, z: 3, script: "<script>" },
            target: { x: 1, y: 2, z: 3 },
        },
        objects: [
            {
                id: "hero-box",
                kind: "box",
                position: { x: -20, y: 2, z: 99 },
                rotationY: 900,
                scale: 10,
                color: "#F97316",
                url: "https://example.com/model.glb",
            },
        ],
        background: "sunset",
        remoteUrl: "https://example.com/director",
    });

    expect(project.version).toBe(1);
    expect(project.camera.position).toEqual({ x: 24, y: -8, z: 3 });
    expect(project.objects[0]).toEqual({
        id: "hero-box",
        kind: "box",
        position: { x: -8, y: 2, z: 8 },
        rotationY: 180,
        scale: 3,
        color: "#f97316",
    });
    expect("remoteUrl" in project).toBe(false);
    expect("url" in project.objects[0]).toBe(false);
});

test("rejects invalid objects and caps object count", () => {
    const objects = Array.from({ length: DIRECTOR_MAX_OBJECTS + 8 }, (_, index) => ({
        id: `object-${index}`,
        kind: index === 0 ? "model" : "sphere",
        position: { x: index, y: 1, z: 0 },
        rotationY: 0,
        scale: 1,
        color: "red",
    }));
    const project = normalizeDirectorProject({ objects, background: "unknown" });

    expect(project.objects).toHaveLength(DIRECTOR_MAX_OBJECTS);
    expect(project.objects[0].kind).toBe("box");
    expect(project.objects[0].color).toBe("#f97316");
    expect(project.background).toBe("studio");
});

test("normalizes partial legacy director state with safe defaults", () => {
    const project = normalizeDirectorProject({
        camera: {},
        objects: [{ id: "legacy-box", kind: "box" }],
    });

    expect(project.camera).toEqual(createDirectorProject().camera);
    expect(project.objects[0]).toEqual({
        id: "legacy-box",
        kind: "box",
        position: { x: 8, y: 6, z: 8 },
        rotationY: 0,
        scale: 1,
        color: "#f97316",
    });
    expect(project.background).toBe("studio");
});

test("creates unique placeholder object ids", () => {
    const first = createDirectorObject("cylinder", 1);
    const second = createDirectorObject("cylinder", 2);
    expect(first.id).not.toBe(second.id);
    expect(first.kind).toBe("cylinder");
});

test("normalizes ColorPicker css colors to director hex values", () => {
    expect(normalizeDirectorColor("rgb(255, 51, 102)")).toBe("#ff3366");
    expect(normalizeDirectorColor(" #Ff3366 ")).toBe("#ff3366");
    expect(normalizeDirectorColor("rgba(255, 51, 102, 0.5)")).toBeNull();
    expect(normalizeDirectorColor("linear-gradient(90deg, red, blue)")).toBeNull();
});

test("accepts only bounded png capture data urls", () => {
    expect(isValidDirectorCapture("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isValidDirectorCapture("data:image/jpeg;base64,/9j/4AAQ")).toBe(false);
    expect(isValidDirectorCapture("https://example.com/capture.png")).toBe(false);
    expect(isValidDirectorCapture(`data:image/png;base64,${"A".repeat(28 * 1024 * 1024)}`)).toBe(false);
});
