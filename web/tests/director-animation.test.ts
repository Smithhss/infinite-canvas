import { expect, test } from "bun:test";

import {
    getDirectorEasingProgress,
    getDirectorCameraTrack,
    removeDirectorCameraKeyframe,
    sampleDirectorCameraTrack,
    sampleDirectorEasingCurve,
    setDirectorAnimationDuration,
    updateDirectorCameraKeyframe,
    upsertDirectorCameraKeyframe,
} from "../src/lib/canvas/director-animation";
import { createDirectorProject, type DirectorCameraKeyframe } from "../src/lib/canvas/director-project";

function keyframe(time: number, x: number, fov = 50): DirectorCameraKeyframe {
    return {
        time,
        position: { x, y: 2, z: 3 },
        lookAt: { x: 0, y: 1, z: 0 },
        fov,
        easing: "linear",
    };
}

test("creates one active camera track and keeps keyframes sorted by time", () => {
    const project = upsertDirectorCameraKeyframe(upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(6, 6)), keyframe(2, 2));
    const track = getDirectorCameraTrack(project);

    expect(project.animation.activeCameraTrackId).toBe(track?.id);
    expect(project.animation.cameraTracks).toHaveLength(1);
    expect(track?.keyframes.map((item) => item.time)).toEqual([2, 6]);
});

test("replaces a camera keyframe at the same rounded time", () => {
    const project = upsertDirectorCameraKeyframe(upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(2.001, 2)), keyframe(2.004, 5, 60));
    const track = getDirectorCameraTrack(project);

    expect(track?.keyframes).toHaveLength(1);
    expect(track?.keyframes[0]).toMatchObject({ time: 2, position: { x: 5 }, fov: 60 });
});

test("samples camera position, target and FOV between keyframes", () => {
    const project = upsertDirectorCameraKeyframe(upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(0, 0, 40)), keyframe(10, 10, 80));
    const sample = sampleDirectorCameraTrack(getDirectorCameraTrack(project), 5);

    expect(sample?.time).toBe(5);
    expect(sample?.position.x).toBe(5);
    expect(sample?.lookAt).toEqual({ x: 0, y: 1, z: 0 });
    expect(sample?.fov).toBe(60);
});

test("removes a keyframe and clamps the timeline duration", () => {
    let project = upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(12, 12));
    project = upsertDirectorCameraKeyframe(project, keyframe(4, 4));
    project = setDirectorAnimationDuration(project, 8);
    project = removeDirectorCameraKeyframe(project, 4);

    expect(project.animation.duration).toBe(8);
    expect(getDirectorCameraTrack(project)?.keyframes.map((item) => item.time)).toEqual([8]);
});

test("retimes and changes the easing of an existing keyframe", () => {
    let project = upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(2, 2));
    project = updateDirectorCameraKeyframe(project, 2, { time: 7, easing: "easeOut" });
    const track = getDirectorCameraTrack(project);

    expect(track?.keyframes).toHaveLength(1);
    expect(track?.keyframes[0]).toMatchObject({ time: 7, easing: "easeOut", position: { x: 2 } });
});

test("uses custom cubic-bezier easing for camera interpolation", () => {
    let project = upsertDirectorCameraKeyframe(createDirectorProject(), keyframe(0, 0));
    project = upsertDirectorCameraKeyframe(project, {
        ...keyframe(10, 10),
        easing: "custom",
        bezier: { x1: 0.9, y1: 0, x2: 1, y2: 0.1 },
    });

    const half = getDirectorEasingProgress(0.5, "custom", { x1: 0.9, y1: 0, x2: 1, y2: 0.1 });
    const sample = sampleDirectorCameraTrack(getDirectorCameraTrack(project), 5);
    const curve = sampleDirectorEasingCurve("custom", { x1: 0.9, y1: 0, x2: 1, y2: 0.1 }, 16);

    expect(half).toBeLessThan(0.5);
    expect(sample?.position.x).toBeLessThan(5);
    expect(curve).toHaveLength(17);
    expect(curve[0]).toEqual({ x: 0, y: 0 });
    expect(curve[curve.length - 1]).toEqual({ x: 1, y: 1 });
    expect(curve.every((point) => point.y >= 0 && point.y <= 1)).toBe(true);
});
