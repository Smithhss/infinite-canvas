import { expect, test } from "bun:test";

import { addDirectorCameraTrack, createDirectorCameraTrack, getDirectorCameraTrack, getDirectorCameraTrackSettings, setDirectorActiveCameraTrack, setDirectorCameraTrackTarget, updateDirectorCameraTrack } from "../src/lib/canvas/director-animation";
import { DIRECTOR_CAMERA_PRESETS, DIRECTOR_SCENE_PRESETS, applyDirectorCameraPreset, applyDirectorCameraPresetById, applyDirectorScenePresetById, isDirectorScenePresetActive, matchesDirectorCameraPreset } from "../src/lib/canvas/director-presets";
import { createDirectorProject, createDirectorSceneNode, type DirectorMotionPath } from "../src/lib/canvas/director-project";

test("exposes the fourteen LibTV camera presets with exact pose data", () => {
    expect(DIRECTOR_CAMERA_PRESETS).toHaveLength(14);
    expect(DIRECTOR_CAMERA_PRESETS.map((preset) => preset.id)).toEqual([
        "front_medium",
        "front_closeup",
        "front_wide",
        "side_tracking",
        "side_close",
        "back_medium",
        "top_wide",
        "top_45",
        "low_angle",
        "low_wide",
        "over_shoulder_l",
        "over_shoulder_r",
        "birdseye",
        "dutch",
    ]);
    expect(applyDirectorCameraPresetById(createDirectorProject(), "front_closeup").camera).toMatchObject({
        position: { x: 0, y: 1.7, z: 2 },
        target: { x: 0, y: 1.6, z: 0 },
        fov: 35,
        zoom: 1,
    });
    expect(DIRECTOR_CAMERA_PRESETS.find((preset) => preset.id === "birdseye")).toMatchObject({
        position: { x: 0, y: 12, z: 0.5 },
        lookAt: { x: 0, y: 0, z: 0 },
        fov: 60,
    });
});

test("applies a camera preset to the active track and clears conflicting targets", () => {
    const first = createDirectorCameraTrack(0, {
        lookAtTarget: "hero",
        followTargetId: "hero",
        motionPathId: "path-a",
    });
    const second = createDirectorCameraTrack(1, { fov: 70 });
    let project = addDirectorCameraTrack(createDirectorProject(), first);
    project = addDirectorCameraTrack(project, second);
    project = setDirectorActiveCameraTrack(project, first.id);

    const preset = DIRECTOR_CAMERA_PRESETS.find((item) => item.id === "over_shoulder_l");
    expect(preset).toBeDefined();
    project = applyDirectorCameraPreset(project, preset!);

    expect(getDirectorCameraTrackSettings(project)).toMatchObject({
        position: { x: -0.5, y: 1.7, z: 2.5 },
        target: { x: 0.5, y: 1.6, z: 0 },
        fov: 50,
    });
    expect(getDirectorCameraTrack(project)).toMatchObject({
        lookAtTarget: null,
        followTargetId: null,
        motionPathId: null,
    });
    expect(project.animation.cameraTracks.find((track) => track.id === second.id)?.fov).toBe(70);
});

test("detects the currently applied camera preset", () => {
    const preset = DIRECTOR_CAMERA_PRESETS.find((item) => item.id === "front_medium")!;
    const project = applyDirectorScenePresetById(createDirectorProject(), "dialogue2");
    expect(matchesDirectorCameraPreset(project, preset)).toBe(true);

    const track = getDirectorCameraTrack(project)!;
    const changed = setDirectorCameraTrackTarget(project, track.id, "lookAtTarget", "preset-dialogue2-1");
    expect(matchesDirectorCameraPreset(changed, preset)).toBe(false);
    expect(matchesDirectorCameraPreset(updateDirectorCameraTrack(project, track.id, { fov: 20 }), preset)).toBe(false);
});

test("exposes nine scene presets with bounded editable objects and cameras", () => {
    expect(DIRECTOR_SCENE_PRESETS).toHaveLength(9);
    expect(DIRECTOR_SCENE_PRESETS.map((preset) => preset.id)).toEqual(["blank", "dialogue2", "dialogue3", "interview", "monologue", "lecture", "chase", "outdoor_walk", "meeting"]);
    expect(DIRECTOR_SCENE_PRESETS.find((preset) => preset.id === "blank")).toMatchObject({ objects: [], cameras: [] });
    expect(DIRECTOR_SCENE_PRESETS.find((preset) => preset.id === "interview")?.cameras).toHaveLength(2);
    expect(DIRECTOR_SCENE_PRESETS.find((preset) => preset.id === "meeting")?.objects).toHaveLength(5);
});

test("applies a scene preset without deleting imported GLB scene nodes or environment settings", () => {
    const path: DirectorMotionPath = {
        id: "path-old",
        name: "Path old",
        closed: false,
        nodes: [],
    };
    const project = {
        ...createDirectorProject(),
        sceneNodes: [createDirectorSceneNode("asset", 0)],
        environment: { ...createDirectorProject().environment, groundOpacity: 0.7 },
        animation: {
            ...createDirectorProject().animation,
            duration: 12,
            motionPaths: [path],
        },
    };
    const next = applyDirectorScenePresetById(project, "meeting", {
        objectName: (_item, index) => `Object ${index + 1}`,
        cameraName: () => "Meeting camera",
    });

    expect(next.objects).toHaveLength(5);
    expect(next.objects.every((object) => object.id.startsWith("preset-meeting-"))).toBe(true);
    expect(next.objects[0].name).toBe("Object 1");
    expect(next.animation.cameraTracks).toHaveLength(1);
    expect(next.animation.cameraTracks[0].name).toBe("Meeting camera");
    expect(next.animation.activeCameraTrackId).toBe(next.animation.cameraTracks[0].id);
    expect(next.animation.motionPaths).toEqual([]);
    expect(next.animation.duration).toBe(12);
    expect(next.sceneNodes).toEqual(project.sceneNodes);
    expect(next.environment.groundOpacity).toBe(0.7);
    expect(isDirectorScenePresetActive(next, DIRECTOR_SCENE_PRESETS.find((preset) => preset.id === "meeting")!)).toBe(true);
});

test("applies the blank scene preset and restores the default camera", () => {
    const populated = applyDirectorScenePresetById(createDirectorProject(), "dialogue2");
    const next = applyDirectorScenePresetById(populated, "blank");

    expect(next.objects).toEqual([]);
    expect(next.animation.cameraTracks).toEqual([]);
    expect(next.animation.activeCameraTrackId).toBeUndefined();
    expect(next.camera).toMatchObject({
        position: { x: 8, y: 5.5, z: 10 },
        target: { x: 0, y: 0.8, z: 0 },
        fov: 50,
        zoom: 1,
    });
});
