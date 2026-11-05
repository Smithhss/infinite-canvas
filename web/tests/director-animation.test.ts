import { expect, test } from "bun:test";

import {
    getDirectorCameraTrack,
    removeDirectorCameraKeyframe,
    sampleDirectorCameraTrack,
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
