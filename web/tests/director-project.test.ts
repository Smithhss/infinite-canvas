import { expect, test } from "bun:test";

import {
    DIRECTOR_DEFAULT_ANIMATION_DURATION,
    DIRECTOR_MAX_GLB_BYTES,
    DIRECTOR_MAX_OBJECTS,
    DIRECTOR_MAX_PATH_POINTS,
    DIRECTOR_PROJECT_VERSION,
    createDirectorProject,
    createDirectorObject,
    createDirectorSceneNode,
    hasValidDirectorGlbHeader,
    isValidDirectorCapture,
    normalizeDirectorColor,
    normalizeDirectorProject,
    UnsupportedDirectorProjectVersionError,
} from "../src/lib/canvas/director-project";

test("creates a bounded default director project", () => {
    const project = createDirectorProject();
    expect(project.version).toBe(DIRECTOR_PROJECT_VERSION);
    expect(project.objects).toEqual([]);
    expect(project.background).toBe("studio");
    expect(project.camera.fov).toBe(50);
    expect(project.camera.zoom).toBe(1);
    expect(project.animation.duration).toBe(DIRECTOR_DEFAULT_ANIMATION_DURATION);
    expect(project.environment.groundOpacity).toBe(0.4);
});

test("uses legacy visual defaults only for unversioned and v1 projects", () => {
    const unversioned = normalizeDirectorProject({});
    const legacy = normalizeDirectorProject({ version: 1 });
    const current = normalizeDirectorProject({ version: DIRECTOR_PROJECT_VERSION });

    expect(unversioned.camera.fov).toBe(42);
    expect(unversioned.environment.groundOpacity).toBe(1);
    expect(legacy.camera.fov).toBe(42);
    expect(legacy.environment.groundOpacity).toBe(1);
    expect(current.camera.fov).toBe(50);
    expect(current.environment.groundOpacity).toBe(0.4);
});

test("normalizes only allowlisted director fields", () => {
    const project = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
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

    expect(project.version).toBe(DIRECTOR_PROJECT_VERSION);
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

test("fails closed for projects from a newer director version", () => {
    expect(() => normalizeDirectorProject({ version: DIRECTOR_PROJECT_VERSION + 1 })).toThrow(UnsupportedDirectorProjectVersionError);
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

    expect(project.camera).toEqual({
        position: { x: 8, y: 5.5, z: 10 },
        target: { x: 0, y: 0.8, z: 0 },
        fov: 42,
        zoom: 1,
    });
    expect(project.objects[0]).toEqual({
        id: "legacy-box",
        kind: "box",
        position: { x: 8, y: 6, z: 8 },
        rotationY: 0,
        scale: 1,
        color: "#f97316",
    });
    expect(project.background).toBe("studio");
    expect(project.sceneNodes).toEqual([]);
    expect(project.animation.duration).toBe(DIRECTOR_DEFAULT_ANIMATION_DURATION);
    expect(project.environment.groundOpacity).toBe(1);
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

test("normalizes camera FOV, zoom and quaternion boundaries", () => {
    const project = normalizeDirectorProject({
        camera: {
            fov: 120,
            zoom: 0,
            quaternion: { x: 0, y: 0, z: 0, w: 2 },
        },
    });

    expect(project.camera.fov).toBe(90);
    expect(project.camera.zoom).toBe(0.1);
    expect(project.camera.quaternion).toEqual({ x: 0, y: 0, z: 0, w: 1 });
});

test("keeps camera targets only while the referenced scene item exists", () => {
    const project = normalizeDirectorProject({
        camera: { lookAtTarget: "hero-box", followTargetId: "group-a" },
        objects: [{ id: "hero-box", kind: "box", position: { x: 0, y: 1, z: 0 } }],
        sceneNodes: [{ id: "group-a", name: "Set", kind: "group" }],
    });
    expect(project.camera.lookAtTarget).toBe("hero-box");
    expect(project.camera.followTargetId).toBe("group-a");

    const missing = normalizeDirectorProject({
        camera: { lookAtTarget: "missing-object", followTargetId: "missing-group" },
        objects: [{ id: "hero-box", kind: "box", position: { x: 0, y: 1, z: 0 } }],
    });
    expect(missing.camera.lookAtTarget).toBeUndefined();
    expect(missing.camera.followTargetId).toBeUndefined();
});

test("normalizes independent camera-track settings and falls back for legacy tracks", () => {
    const project = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
        camera: { fov: 60, lookAtTarget: "hero-box", followTargetId: "missing-group" },
        objects: [{ id: "hero-box", kind: "box", position: { x: 0, y: 1, z: 0 } }],
        sceneNodes: [{ id: "group-a", name: "Set", kind: "group" }],
        animation: {
            cameraTracks: [
                { id: "legacy-track", keyframes: [] },
                {
                    id: "custom-track",
                    position: { x: 4, y: 3, z: 2 },
                    target: { x: 1, y: 0.5, z: 0 },
                    fov: 120,
                    zoom: 4,
                    lookAtTarget: "missing-object",
                    followTargetId: "group-a",
                    keyframes: [],
                },
            ],
        },
    });

    expect(project.animation.activeCameraTrackId).toBe("legacy-track");
    expect(project.animation.cameraTracks[0]).toMatchObject({
        position: { x: 8, y: 5.5, z: 10 },
        target: { x: 0, y: 0.8, z: 0 },
        fov: 60,
        zoom: 1,
        lookAtTarget: "hero-box",
        followTargetId: null,
    });
    expect(project.animation.cameraTracks[1]).toMatchObject({
        position: { x: 4, y: 3, z: 2 },
        target: { x: 1, y: 0.5, z: 0 },
        fov: 90,
        zoom: 4,
        lookAtTarget: null,
        followTargetId: "group-a",
    });
});

test("keeps a camera motion path only while the path exists", () => {
    const project = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
        camera: { motionPathId: "path-a" },
        animation: { motionPaths: [{ id: "path-a", nodes: [] }] },
    });
    expect(project.camera.motionPathId).toBe("path-a");

    const missing = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
        camera: { motionPathId: "path-missing" },
        animation: { motionPaths: [{ id: "path-a", nodes: [] }] },
    });
    expect(missing.camera.motionPathId).toBeUndefined();
});

test("normalizes independent camera-track motion paths", () => {
    const project = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
        camera: { motionPathId: "path-a" },
        animation: {
            motionPaths: [{ id: "path-a", nodes: [] }, { id: "path-b", nodes: [] }],
            cameraTracks: [
                { id: "legacy-track", keyframes: [] },
                { id: "custom-track", motionPathId: "path-b", keyframes: [] },
                { id: "missing-track", motionPathId: "path-missing", keyframes: [] },
            ],
        },
    });

    expect(project.animation.cameraTracks.map((track) => track.motionPathId)).toEqual(["path-a", "path-b", null]);
});

test("normalizes custom camera easing control points", () => {
    const project = normalizeDirectorProject({
        version: DIRECTOR_PROJECT_VERSION,
        animation: {
            cameraTracks: [{
                id: "camera-track-main",
                keyframes: [{
                    time: 0,
                    position: { x: 1, y: 2, z: 3 },
                    easing: "custom",
                    bezier: { x1: -1, y1: 2, x2: 0.3, y2: 0.7 },
                }],
            }],
        },
    });

    expect(project.animation.cameraTracks[0].keyframes[0].bezier).toEqual({ x1: 0, y1: 1, x2: 0.3, y2: 0.7 });
});

test("normalizes a local panorama environment and rejects remote sources", () => {
    const project = normalizeDirectorProject({
        environment: {
            panoramaUrl: "data:image/png;base64,AAAA",
            panoramaRotationY: 450,
            panoramaRadius: 0,
        },
    });
    expect(project.environment.panoramaUrl).toBe("data:image/png;base64,AAAA");
    expect(project.environment.panoramaRotationY).toBe(360);
    expect(project.environment.panoramaRadius).toBe(1);

    const remote = normalizeDirectorProject({ environment: { panoramaUrl: "https://example.com/panorama.png" } });
    expect(remote.environment.panoramaUrl).toBeUndefined();
});

test("keeps a real scene hierarchy and breaks parent cycles", () => {
    const project = normalizeDirectorProject({
        sceneNodes: [
            { id: "group-a", name: " Group A ", kind: "group", parentId: "group-b" },
            { id: "group-b", name: "Group B", kind: "group", parentId: "group-a" },
            { id: "light-key", name: "Key Light", kind: "light", parentId: "group-a" },
            { id: "asset-glb", name: "GLB Asset", kind: "asset", parentId: "missing", asset: { fileName: "scene.glb", byteSize: 3890196, storageKey: "director-glb:abc123" } },
        ],
    });

    expect(project.sceneNodes.map((node) => node.kind)).toEqual(["group", "group", "light", "asset"]);
    expect(project.sceneNodes[0].parentId).toBeNull();
    expect(project.sceneNodes[1].parentId).toBe("group-a");
    expect(project.sceneNodes[2].parentId).toBe("group-a");
    expect(project.sceneNodes[3].parentId).toBeNull();
    expect(project.sceneNodes[3].asset).toEqual({ fileName: "scene.glb", byteSize: 3890196, storageKey: "director-glb:abc123" });
});

test("creates a bounded scene group with an optional parent", () => {
    const group = createDirectorSceneNode("group", 2, "group-parent");
    expect(group).toMatchObject({
        name: "Group 3",
        kind: "group",
        parentId: "group-parent",
        visible: true,
        locked: false,
        transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
        },
    });
    expect(group.id).toMatch(/^scene-group-/);
});

test("rejects non-GLB or oversized scene asset metadata", () => {
    const project = normalizeDirectorProject({
        sceneNodes: [
            { id: "splat", kind: "asset", asset: { fileName: "scene.spz", byteSize: 1024 } },
            { id: "oversized", kind: "asset", asset: { fileName: "scene.glb", byteSize: DIRECTOR_MAX_GLB_BYTES + 1 } },
            { id: "remote", kind: "asset", asset: { fileName: "scene.glb", byteSize: 1024, storageKey: "https://example.com/scene.glb" } },
        ],
    });

    expect(project.sceneNodes[0].asset).toBeUndefined();
    expect(project.sceneNodes[1].asset).toBeUndefined();
    expect(project.sceneNodes[2].asset).toEqual({ fileName: "scene.glb", byteSize: 1024 });
});

test("normalizes camera keyframes and migrates legacy motion-path points", () => {
    const points = Array.from({ length: DIRECTOR_MAX_PATH_POINTS + 6 }, (_, index) => ({ x: index, y: 1, z: 0 }));
    const project = normalizeDirectorProject({
        animation: {
            duration: 30,
            cameraTracks: [
                {
                    id: "camera-track",
                    cameraId: "camera-main",
                    keyframes: [
                        { time: 20, position: { x: 20, y: 2, z: 0 }, fov: 100, easing: "easeIn" },
                        { time: -4, position: { x: -4, y: 2, z: 0 }, easing: "unknown" },
                    ],
                },
            ],
            motionPaths: [{ id: "path-a", points, closed: true }],
        },
    });

    expect(project.animation.duration).toBe(15);
    expect(project.animation.cameraTracks[0].keyframes.map((keyframe) => keyframe.time)).toEqual([0, 15]);
    expect(project.animation.cameraTracks[0].keyframes[1].fov).toBe(90);
    expect(project.animation.cameraTracks[0].keyframes[0].easing).toBe("linear");
    expect(project.animation.motionPaths[0].nodes).toHaveLength(DIRECTOR_MAX_PATH_POINTS);
    expect(project.animation.motionPaths[0].nodes[2].transform.position.x).toBe(2);
    expect(project.animation.motionPaths[0].closed).toBe(true);
});

test("keeps hierarchical path nodes and breaks path-node cycles", () => {
    const project = normalizeDirectorProject({
        animation: {
            motionPaths: [{
                id: "path-a",
                name: "Camera Path",
                nodes: [
                    { id: "path-aim", name: "Aim", kind: "aim", parentId: "path-focus" },
                    { id: "path-focus", name: "Focus", kind: "focus", parentId: "path-aim" },
                    { id: "path-wp", name: "WP 1", kind: "waypoint", parentId: "path-aim" },
                ],
            }],
        },
    });

    const path = project.animation.motionPaths[0];
    expect(path.nodes.map((node) => node.kind)).toEqual(["aim", "focus", "waypoint"]);
    expect(path.nodes[0].parentId).toBe("path-a");
    expect(path.nodes[1].parentId).toBe("path-aim");
    expect(path.nodes[2].parentId).toBe("path-aim");
});

test("deduplicates scene, object, path and path-node identifiers", () => {
    const project = normalizeDirectorProject({
        objects: [
            { id: "same-object", kind: "box" },
            { id: "same-object", kind: "sphere" },
        ],
        sceneNodes: [
            { id: "same-scene", name: "First", kind: "group" },
            { id: "same-scene", name: "Second", kind: "group" },
        ],
        animation: {
            motionPaths: [
                { id: "same-path", nodes: [{ id: "same-node", kind: "waypoint" }, { id: "same-node", kind: "waypoint" }] },
                { id: "same-path", nodes: [] },
            ],
        },
    });

    expect(project.objects).toHaveLength(1);
    expect(project.sceneNodes).toHaveLength(1);
    expect(project.animation.motionPaths).toHaveLength(1);
    expect(project.animation.motionPaths[0].nodes).toHaveLength(1);
});

test("keeps the first duplicate path node hierarchy", () => {
    const project = normalizeDirectorProject({
        animation: {
            motionPaths: [{
                id: "path-a",
                nodes: [
                    { id: "parent-node", kind: "aim", parentId: "path-a" },
                    { id: "duplicate", kind: "waypoint", parentId: "parent-node" },
                    { id: "duplicate", kind: "focus", parentId: "path-a" },
                ],
            }],
        },
    });

    expect(project.animation.motionPaths[0].nodes).toHaveLength(2);
    expect(project.animation.motionPaths[0].nodes[1]).toMatchObject({ id: "duplicate", kind: "waypoint", parentId: "parent-node" });
});

test("accepts only bounded GLB 2 buffers with the glTF magic header", () => {
    const valid = new ArrayBuffer(12);
    const view = new DataView(valid);
    view.setUint32(0, 0x46546c67, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, valid.byteLength, true);
    expect(hasValidDirectorGlbHeader(valid)).toBe(true);

    const glb1 = valid.slice(0);
    new DataView(glb1).setUint32(4, 1, true);
    expect(hasValidDirectorGlbHeader(glb1)).toBe(false);
    const wrongLength = valid.slice(0);
    new DataView(wrongLength).setUint32(8, 24, true);
    expect(hasValidDirectorGlbHeader(wrongLength)).toBe(false);
    expect(hasValidDirectorGlbHeader(new ArrayBuffer(8))).toBe(false);
    expect(hasValidDirectorGlbHeader(new ArrayBuffer(DIRECTOR_MAX_GLB_BYTES + 1))).toBe(false);
});
