import {
    DIRECTOR_DEFAULT_FOV,
    DIRECTOR_MAX_ANIMATION_DURATION,
    DIRECTOR_MAX_CAMERA_TRACKS,
    DIRECTOR_MAX_KEYFRAMES,
    DIRECTOR_MIN_ANIMATION_DURATION,
    type DirectorCameraKeyframe,
    type DirectorCameraTrack,
    type DirectorCubicBezier,
    type DirectorEasing,
    type DirectorProjectState,
    type DirectorQuaternion,
    type DirectorVector3,
} from "@/lib/canvas/director-project";

export const DIRECTOR_MAIN_CAMERA_TRACK_ID = "camera-track-main";
export const DIRECTOR_DEFAULT_CUSTOM_EASING: DirectorCubicBezier = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };

export type DirectorCameraTrackSettings = {
    fov: number;
    lookAtTarget?: string;
    followTargetId?: string;
};

export function getDirectorCameraTrack(project: DirectorProjectState): DirectorCameraTrack | null {
    return project.animation.cameraTracks.find((track) => track.id === project.animation.activeCameraTrackId)
        ?? project.animation.cameraTracks[0]
        ?? null;
}

export function getDirectorCameraTrackSettings(project: DirectorProjectState): DirectorCameraTrackSettings {
    const track = getDirectorCameraTrack(project);
    if (!track) {
        return {
            fov: project.camera.fov,
            ...(project.camera.lookAtTarget ? { lookAtTarget: project.camera.lookAtTarget } : {}),
            ...(project.camera.followTargetId ? { followTargetId: project.camera.followTargetId } : {}),
        };
    }
    return {
        fov: track.fov,
        ...(track.lookAtTarget ? { lookAtTarget: track.lookAtTarget } : {}),
        ...(track.followTargetId ? { followTargetId: track.followTargetId } : {}),
    };
}

export function createDirectorCameraTrack(index: number, settings?: DirectorCameraTrackSettings): DirectorCameraTrack {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `camera-track-${Date.now().toString(36)}-${safeIndex}`,
        name: `Camera ${safeIndex + 1}`,
        cameraId: "camera-main",
        fov: settings?.fov ?? DIRECTOR_DEFAULT_FOV,
        lookAtTarget: settings?.lookAtTarget ?? null,
        followTargetId: settings?.followTargetId ?? null,
        keyframes: [],
    };
}

export function addDirectorCameraTrack(project: DirectorProjectState, track: DirectorCameraTrack): DirectorProjectState {
    if (project.animation.cameraTracks.length >= DIRECTOR_MAX_CAMERA_TRACKS || project.animation.cameraTracks.some((item) => item.id === track.id)) {
        return project;
    }
    return {
        ...project,
        animation: {
            ...project.animation,
            activeCameraTrackId: track.id,
            cameraTracks: [...project.animation.cameraTracks, { ...track, keyframes: [...track.keyframes] }],
        },
    };
}

export function setDirectorActiveCameraTrack(project: DirectorProjectState, trackId: string): DirectorProjectState {
    if (!project.animation.cameraTracks.some((track) => track.id === trackId) || project.animation.activeCameraTrackId === trackId) return project;
    return { ...project, animation: { ...project.animation, activeCameraTrackId: trackId } };
}

export function updateDirectorCameraTrack(project: DirectorProjectState, trackId: string, patch: Partial<Pick<DirectorCameraTrack, "name" | "fov">>): DirectorProjectState {
    if (!project.animation.cameraTracks.some((track) => track.id === trackId)) return project;
    return {
        ...project,
        animation: {
            ...project.animation,
            cameraTracks: project.animation.cameraTracks.map((track) => track.id === trackId ? { ...track, ...patch } : track),
        },
    };
}

export function setDirectorCameraTrackTarget(
    project: DirectorProjectState,
    trackId: string,
    key: "lookAtTarget" | "followTargetId",
    value: string | null,
): DirectorProjectState {
    if (!project.animation.cameraTracks.some((track) => track.id === trackId)) return project;
    return {
        ...project,
        animation: {
            ...project.animation,
            cameraTracks: project.animation.cameraTracks.map((track) => track.id === trackId ? { ...track, [key]: value } : track),
        },
    };
}

export function clearDirectorCameraTargets(project: DirectorProjectState, ids: Set<string>): DirectorProjectState {
    const camera = { ...project.camera };
    if (camera.lookAtTarget && ids.has(camera.lookAtTarget)) delete camera.lookAtTarget;
    if (camera.followTargetId && ids.has(camera.followTargetId)) delete camera.followTargetId;
    return {
        ...project,
        camera,
        animation: {
            ...project.animation,
            cameraTracks: project.animation.cameraTracks.map((track) => ({
                ...track,
                lookAtTarget: track.lookAtTarget && ids.has(track.lookAtTarget) ? null : track.lookAtTarget,
                followTargetId: track.followTargetId && ids.has(track.followTargetId) ? null : track.followTargetId,
            })),
        },
    };
}

export function removeDirectorCameraTrack(project: DirectorProjectState, trackId: string): DirectorProjectState {
    const index = project.animation.cameraTracks.findIndex((track) => track.id === trackId);
    if (index < 0 || project.animation.cameraTracks.length <= 1) return project;
    const cameraTracks = project.animation.cameraTracks.filter((track) => track.id !== trackId);
    const activeCameraTrackId = project.animation.activeCameraTrackId === trackId
        ? cameraTracks[Math.min(index, cameraTracks.length - 1)].id
        : project.animation.activeCameraTrackId;
    return {
        ...project,
        animation: {
            ...project.animation,
            ...(activeCameraTrackId ? { activeCameraTrackId } : {}),
            cameraTracks,
        },
    };
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
        ...(keyframe.bezier ? { bezier: normalizeBezier(keyframe.bezier) } : {}),
        easing: normalizeEasing(keyframe.easing),
    };
    const currentTrack = getDirectorCameraTrack(project);
    const activeTrackId = currentTrack?.id || DIRECTOR_MAIN_CAMERA_TRACK_ID;
    const track = currentTrack || {
        id: activeTrackId,
        name: "Camera 1",
        cameraId: "camera-main",
        fov: project.camera.fov,
        lookAtTarget: project.camera.lookAtTarget ?? null,
        followTargetId: project.camera.followTargetId ?? null,
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
    patch: Partial<Pick<DirectorCameraKeyframe, "time" | "fov" | "easing" | "bezier">>,
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
    const easedProgress = getDirectorEasingProgress(progress, right.easing, right.bezier);
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
        ...(keyframe.bezier ? { bezier: { ...keyframe.bezier } } : {}),
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

export function getDirectorEasingProgress(progress: number, easing: DirectorEasing, bezier?: DirectorCubicBezier): number {
    const value = clamp(progress, 0, 1, 0);
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    if (easing === "easeIn") return value * value;
    if (easing === "easeOut") return 1 - (1 - value) * (1 - value);
    if (easing === "easeInOut" || easing === "smooth") return value * value * (3 - 2 * value);
    if (easing === "custom") return sampleBezierProgress(value, normalizeBezier(bezier));
    return value;
}

export function sampleDirectorEasingCurve(easing: DirectorEasing, bezier?: DirectorCubicBezier, steps = 24) {
    const count = Math.max(2, Math.min(64, Math.round(steps)));
    return Array.from({ length: count + 1 }, (_, index) => {
        const x = index / count;
        return { x, y: getDirectorEasingProgress(x, easing, bezier) };
    });
}

function sampleBezierProgress(progress: number, bezier: DirectorCubicBezier) {
    let lower = 0;
    let upper = 1;
    for (let index = 0; index < 20; index += 1) {
        const time = (lower + upper) / 2;
        if (cubicBezierCoordinate(time, bezier.x1, bezier.x2) < progress) {
            lower = time;
        } else {
            upper = time;
        }
    }
    return clamp(cubicBezierCoordinate((lower + upper) / 2, bezier.y1, bezier.y2), 0, 1, 0);
}

function cubicBezierCoordinate(time: number, first: number, second: number) {
    const inverse = 1 - time;
    return 3 * inverse * inverse * time * first + 3 * inverse * time * time * second + time * time * time;
}

function normalizeBezier(value?: DirectorCubicBezier): DirectorCubicBezier {
    return {
        x1: clamp(value?.x1, 0, 1, DIRECTOR_DEFAULT_CUSTOM_EASING.x1),
        y1: clamp(value?.y1, 0, 1, DIRECTOR_DEFAULT_CUSTOM_EASING.y1),
        x2: clamp(value?.x2, 0, 1, DIRECTOR_DEFAULT_CUSTOM_EASING.x2),
        y2: clamp(value?.y2, 0, 1, DIRECTOR_DEFAULT_CUSTOM_EASING.y2),
    };
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
