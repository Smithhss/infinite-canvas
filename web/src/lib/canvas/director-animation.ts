import {
    DIRECTOR_MAX_ANIMATION_DURATION,
    DIRECTOR_MAX_KEYFRAMES,
    DIRECTOR_MIN_ANIMATION_DURATION,
    type DirectorCameraKeyframe,
    type DirectorCameraTrack,
    type DirectorEasing,
    type DirectorProjectState,
    type DirectorQuaternion,
    type DirectorVector3,
} from "@/lib/canvas/director-project";

export const DIRECTOR_MAIN_CAMERA_TRACK_ID = "camera-track-main";

export function getDirectorCameraTrack(project: DirectorProjectState): DirectorCameraTrack | null {
    return project.animation.cameraTracks.find((track) => track.id === project.animation.activeCameraTrackId)
        ?? project.animation.cameraTracks[0]
        ?? null;
}

export function upsertDirectorCameraKeyframe(project: DirectorProjectState, keyframe: DirectorCameraKeyframe): DirectorProjectState {
    const time = roundTime(clamp(keyframe.time, 0, project.animation.duration, 0));
    const nextKeyframe = {
        ...keyframe,
        time,
        position: cloneVector(keyframe.position),
        ...(keyframe.lookAt ? { lookAt: cloneVector(keyframe.lookAt) } : {}),
        ...(keyframe.quaternion ? { quaternion: normalizeQuaternion(keyframe.quaternion) } : {}),
        ...(keyframe.fov !== undefined ? { fov: clamp(keyframe.fov, 15, 90, 50) } : {}),
        easing: normalizeEasing(keyframe.easing),
    };
    const currentTrack = getDirectorCameraTrack(project);
    const activeTrackId = currentTrack?.id || DIRECTOR_MAIN_CAMERA_TRACK_ID;
    const track = currentTrack || {
        id: activeTrackId,
        name: "Camera 1",
        cameraId: "camera-main",
        keyframes: [],
    };
    const keyframes = sortAndDedupeKeyframes([
        ...track.keyframes.filter((item) => Math.abs(item.time - time) > 0.0001),
        nextKeyframe,
    ]).slice(0, DIRECTOR_MAX_KEYFRAMES);
    const cameraTracks = project.animation.cameraTracks.some((item) => item.id === activeTrackId)
        ? project.animation.cameraTracks.map((item) => item.id === activeTrackId ? { ...item, keyframes } : item)
        : [...project.animation.cameraTracks, { ...track, keyframes }];

    return {
        ...project,
        animation: {
            ...project.animation,
            activeCameraTrackId: activeTrackId,
            cameraTracks,
        },
    };
}

export function removeDirectorCameraKeyframe(project: DirectorProjectState, time: number): DirectorProjectState {
    const currentTrack = getDirectorCameraTrack(project);
    if (!currentTrack) return project;
    const keyframes = currentTrack.keyframes.filter((item) => Math.abs(item.time - time) > 0.0001);
    if (keyframes.length === currentTrack.keyframes.length) return project;
    return {
        ...project,
        animation: {
            ...project.animation,
            cameraTracks: project.animation.cameraTracks.map((track) => track.id === currentTrack.id ? { ...track, keyframes } : track),
        },
    };
}

export function updateDirectorCameraKeyframe(
    project: DirectorProjectState,
    time: number,
    patch: Partial<Pick<DirectorCameraKeyframe, "time" | "fov" | "easing">>,
): DirectorProjectState {
    const keyframe = getDirectorCameraTrack(project)?.keyframes.find((item) => Math.abs(item.time - time) <= 0.0001);
    if (!keyframe) return project;
    const withoutCurrent = removeDirectorCameraKeyframe(project, time);
    return upsertDirectorCameraKeyframe(withoutCurrent, {
        ...keyframe,
        ...patch,
        time: patch.time ?? keyframe.time,
    });
}

export function setDirectorAnimationDuration(project: DirectorProjectState, value: number): DirectorProjectState {
    const duration = clamp(value, DIRECTOR_MIN_ANIMATION_DURATION, DIRECTOR_MAX_ANIMATION_DURATION, project.animation.duration);
    return {
        ...project,
        animation: {
            ...project.animation,
            duration,
            cameraTracks: project.animation.cameraTracks.map((track) => ({
                ...track,
                keyframes: sortAndDedupeKeyframes(track.keyframes.map((keyframe) => ({
                    ...keyframe,
                    time: roundTime(Math.min(keyframe.time, duration)),
                }))),
            })),
        },
    };
}

export function sampleDirectorCameraTrack(track: DirectorCameraTrack | null, time: number): DirectorCameraKeyframe | null {
    if (!track?.keyframes.length) return null;
    const keyframes = [...track.keyframes].sort((left, right) => left.time - right.time);
    const clampedTime = clamp(time, keyframes[0].time, keyframes[keyframes.length - 1].time, keyframes[0].time);
    if (clampedTime <= keyframes[0].time) return cloneKeyframe(keyframes[0]);
    if (clampedTime >= keyframes[keyframes.length - 1].time) return cloneKeyframe(keyframes[keyframes.length - 1]);

    const rightIndex = keyframes.findIndex((keyframe) => keyframe.time > clampedTime);
    const right = keyframes[rightIndex];
    const left = keyframes[rightIndex - 1];
    const progress = (clampedTime - left.time) / Math.max(0.0001, right.time - left.time);
    const easedProgress = applyEasing(progress, right.easing);
    return {
        ...cloneKeyframe(left),
        time: clampedTime,
        position: lerpVector(left.position, right.position, easedProgress),
        ...(left.lookAt && right.lookAt ? { lookAt: lerpVector(left.lookAt, right.lookAt, easedProgress) } : {}),
        ...(left.quaternion && right.quaternion ? { quaternion: lerpQuaternion(left.quaternion, right.quaternion, easedProgress) } : {}),
        ...(left.fov !== undefined && right.fov !== undefined ? { fov: lerp(left.fov, right.fov, easedProgress) } : {}),
        easing: right.easing,
    };
}

function sortAndDedupeKeyframes(keyframes: DirectorCameraKeyframe[]) {
    const deduped = new Map<number, DirectorCameraKeyframe>();
    keyframes.forEach((keyframe) => {
        const time = roundTime(keyframe.time);
        deduped.set(time, { ...keyframe, time });
    });
    return [...deduped.values()].sort((left, right) => left.time - right.time);
}

function cloneKeyframe(keyframe: DirectorCameraKeyframe): DirectorCameraKeyframe {
    return {
        ...keyframe,
        position: cloneVector(keyframe.position),
        ...(keyframe.lookAt ? { lookAt: cloneVector(keyframe.lookAt) } : {}),
        ...(keyframe.quaternion ? { quaternion: { ...keyframe.quaternion } } : {}),
    };
}

function cloneVector(value: DirectorVector3): DirectorVector3 {
    return { x: value.x, y: value.y, z: value.z };
}

function lerpVector(left: DirectorVector3, right: DirectorVector3, progress: number): DirectorVector3 {
    return {
        x: lerp(left.x, right.x, progress),
        y: lerp(left.y, right.y, progress),
        z: lerp(left.z, right.z, progress),
    };
}

function lerpQuaternion(left: DirectorQuaternion, right: DirectorQuaternion, progress: number): DirectorQuaternion {
    const dot = left.x * right.x + left.y * right.y + left.z * right.z + left.w * right.w;
    const direction = dot < 0 ? -1 : 1;
    return normalizeQuaternion({
        x: lerp(left.x, right.x * direction, progress),
        y: lerp(left.y, right.y * direction, progress),
        z: lerp(left.z, right.z * direction, progress),
        w: lerp(left.w, right.w * direction, progress),
    });
}

function normalizeQuaternion(value: DirectorQuaternion): DirectorQuaternion {
    const length = Math.hypot(value.x, value.y, value.z, value.w);
    if (length < 0.000001) return { x: 0, y: 0, z: 0, w: 1 };
    return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

function applyEasing(progress: number, easing: DirectorEasing) {
    if (easing === "easeIn") return progress * progress;
    if (easing === "easeOut") return 1 - (1 - progress) * (1 - progress);
    if (easing === "easeInOut" || easing === "smooth") return progress * progress * (3 - 2 * progress);
    return progress;
}

function normalizeEasing(value: unknown): DirectorEasing {
    return value === "easeIn" || value === "easeOut" || value === "easeInOut" || value === "smooth" || value === "custom" ? value : "linear";
}

function roundTime(value: number) {
    return Math.round(value * 100) / 100;
}

function lerp(left: number, right: number, progress: number) {
    return left + (right - left) * progress;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
