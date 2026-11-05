import { createDirectorCameraTrack, getDirectorCameraTrack, getDirectorCameraTrackSettings, setDirectorCameraTrackTarget, updateDirectorCameraTrack } from "@/lib/canvas/director-animation";
import { createDirectorProject, DIRECTOR_MAX_CAMERA_TRACKS, DIRECTOR_MAX_OBJECTS, type DirectorCameraTrack, type DirectorObject, type DirectorObjectKind, type DirectorProjectState, type DirectorVector3 } from "@/lib/canvas/director-project";

export type DirectorCameraPresetId = "front_medium" | "front_closeup" | "front_wide" | "side_tracking" | "side_close" | "back_medium" | "top_wide" | "top_45" | "low_angle" | "low_wide" | "over_shoulder_l" | "over_shoulder_r" | "birdseye" | "dutch";

export type DirectorCameraPreset = {
    id: DirectorCameraPresetId;
    labelKey: string;
    position: DirectorVector3;
    lookAt: DirectorVector3;
    fov: number;
};

export type DirectorScenePresetId = "blank" | "dialogue2" | "dialogue3" | "interview" | "monologue" | "lecture" | "chase" | "outdoor_walk" | "meeting";

export type DirectorScenePresetObject = {
    kind: DirectorObjectKind;
    nameKey: string;
    position: DirectorVector3;
    rotationY?: number;
    scale?: number;
    color?: string;
};

export type DirectorScenePresetCamera = {
    nameKey: string;
    presetId: DirectorCameraPresetId;
};

export type DirectorScenePreset = {
    id: DirectorScenePresetId;
    labelKey: string;
    descriptionKey: string;
    objects: DirectorScenePresetObject[];
    cameras: DirectorScenePresetCamera[];
};

export const DIRECTOR_CAMERA_PRESETS: DirectorCameraPreset[] = [
    { id: "front_medium", labelKey: "canvas.director.cameraPresetNames.frontMedium", position: { x: 0, y: 1.5, z: 4 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
    { id: "front_closeup", labelKey: "canvas.director.cameraPresetNames.frontCloseup", position: { x: 0, y: 1.7, z: 2 }, lookAt: { x: 0, y: 1.6, z: 0 }, fov: 35 },
    { id: "front_wide", labelKey: "canvas.director.cameraPresetNames.frontWide", position: { x: 0, y: 2.5, z: 8 }, lookAt: { x: 0, y: 1, z: 0 }, fov: 60 },
    { id: "side_tracking", labelKey: "canvas.director.cameraPresetNames.sideTracking", position: { x: 4, y: 1.5, z: 0 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
    { id: "side_close", labelKey: "canvas.director.cameraPresetNames.sideClose", position: { x: 2.5, y: 1.5, z: 0 }, lookAt: { x: 0, y: 1.5, z: 0 }, fov: 40 },
    { id: "back_medium", labelKey: "canvas.director.cameraPresetNames.backMedium", position: { x: 0, y: 1.5, z: -4 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
    { id: "top_wide", labelKey: "canvas.director.cameraPresetNames.topWide", position: { x: 0, y: 8, z: 3 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 55 },
    { id: "top_45", labelKey: "canvas.director.cameraPresetNames.top45", position: { x: 0, y: 5, z: 5 }, lookAt: { x: 0, y: 1, z: 0 }, fov: 50 },
    { id: "low_angle", labelKey: "canvas.director.cameraPresetNames.lowAngle", position: { x: 0, y: 0.3, z: 3 }, lookAt: { x: 0, y: 1.8, z: 0 }, fov: 45 },
    { id: "low_wide", labelKey: "canvas.director.cameraPresetNames.lowWide", position: { x: 0, y: 0.5, z: 5 }, lookAt: { x: 0, y: 1, z: 0 }, fov: 70 },
    { id: "over_shoulder_l", labelKey: "canvas.director.cameraPresetNames.overShoulderL", position: { x: -0.5, y: 1.7, z: 2.5 }, lookAt: { x: 0.5, y: 1.6, z: 0 }, fov: 50 },
    { id: "over_shoulder_r", labelKey: "canvas.director.cameraPresetNames.overShoulderR", position: { x: 0.5, y: 1.7, z: 2.5 }, lookAt: { x: -0.5, y: 1.6, z: 0 }, fov: 50 },
    { id: "birdseye", labelKey: "canvas.director.cameraPresetNames.birdseye", position: { x: 0, y: 12, z: 0.5 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 60 },
    { id: "dutch", labelKey: "canvas.director.cameraPresetNames.dutch", position: { x: 1, y: 1.5, z: 3.5 }, lookAt: { x: 0, y: 1.2, z: 0 }, fov: 50 },
];

const characterNameKey = "canvas.director.scenePresetObjects.character";
const tableNameKey = "canvas.director.scenePresetObjects.table";
const personColor = "#38bdf8";
const secondPersonColor = "#a3e635";
const thirdPersonColor = "#f472b6";
const fourthPersonColor = "#fbbf24";
const propColor = "#a8a29e";

export const DIRECTOR_SCENE_PRESETS: DirectorScenePreset[] = [
    {
        id: "blank",
        labelKey: "canvas.director.scenePresetNames.blank.label",
        descriptionKey: "canvas.director.scenePresetNames.blank.description",
        objects: [],
        cameras: [],
    },
    {
        id: "dialogue2",
        labelKey: "canvas.director.scenePresetNames.dialogue2.label",
        descriptionKey: "canvas.director.scenePresetNames.dialogue2.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -1.2, y: 0.8, z: 0 }, rotationY: 90, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 1.2, y: 0.8, z: 0 }, rotationY: -90, color: secondPersonColor },
        ],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.medium", presetId: "front_medium" }],
    },
    {
        id: "dialogue3",
        labelKey: "canvas.director.scenePresetNames.dialogue3.label",
        descriptionKey: "canvas.director.scenePresetNames.dialogue3.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: -1.2 }, rotationY: 0, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -1.4, y: 0.8, z: 1 }, rotationY: 145, color: secondPersonColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 1.4, y: 0.8, z: 1 }, rotationY: -145, color: thirdPersonColor },
        ],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.wide", presetId: "front_wide" }],
    },
    {
        id: "interview",
        labelKey: "canvas.director.scenePresetNames.interview.label",
        descriptionKey: "canvas.director.scenePresetNames.interview.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -1.4, y: 0.8, z: 0 }, rotationY: 90, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 1.4, y: 0.8, z: 0 }, rotationY: -90, color: secondPersonColor },
            { kind: "box", nameKey: tableNameKey, position: { x: 0, y: 0.45, z: 0 }, scale: 0.62, color: propColor },
        ],
        cameras: [
            { nameKey: "canvas.director.scenePresetCameras.overShoulderLeft", presetId: "over_shoulder_l" },
            { nameKey: "canvas.director.scenePresetCameras.overShoulderRight", presetId: "over_shoulder_r" },
        ],
    },
    {
        id: "monologue",
        labelKey: "canvas.director.scenePresetNames.monologue.label",
        descriptionKey: "canvas.director.scenePresetNames.monologue.description",
        objects: [{ kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: 0 }, rotationY: 0, scale: 1.08, color: personColor }],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.closeup", presetId: "front_closeup" }],
    },
    {
        id: "lecture",
        labelKey: "canvas.director.scenePresetNames.lecture.label",
        descriptionKey: "canvas.director.scenePresetNames.lecture.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: -2.2 }, rotationY: 0, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -1.6, y: 0.8, z: 1.2 }, rotationY: 180, color: secondPersonColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: 1.6 }, rotationY: 180, color: thirdPersonColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 1.6, y: 0.8, z: 1.2 }, rotationY: 180, color: fourthPersonColor },
        ],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.wide", presetId: "front_wide" }],
    },
    {
        id: "chase",
        labelKey: "canvas.director.scenePresetNames.chase.label",
        descriptionKey: "canvas.director.scenePresetNames.chase.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: 1.8 }, rotationY: 180, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: -1.8 }, rotationY: 180, color: thirdPersonColor },
        ],
        cameras: [
            { nameKey: "canvas.director.scenePresetCameras.sideTracking", presetId: "side_tracking" },
            { nameKey: "canvas.director.scenePresetCameras.lowAngle", presetId: "low_angle" },
        ],
    },
    {
        id: "outdoor_walk",
        labelKey: "canvas.director.scenePresetNames.outdoorWalk.label",
        descriptionKey: "canvas.director.scenePresetNames.outdoorWalk.description",
        objects: [
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -0.65, y: 0.8, z: 0 }, rotationY: 180, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0.65, y: 0.8, z: 0 }, rotationY: 180, color: secondPersonColor },
        ],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.sideTracking", presetId: "side_tracking" }],
    },
    {
        id: "meeting",
        labelKey: "canvas.director.scenePresetNames.meeting.label",
        descriptionKey: "canvas.director.scenePresetNames.meeting.description",
        objects: [
            { kind: "box", nameKey: tableNameKey, position: { x: 0, y: 0.5, z: 0 }, scale: 1.08, color: propColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: -1.8 }, rotationY: 0, color: personColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: -1.8, y: 0.8, z: 0 }, rotationY: 90, color: secondPersonColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 1.8, y: 0.8, z: 0 }, rotationY: -90, color: thirdPersonColor },
            { kind: "cylinder", nameKey: characterNameKey, position: { x: 0, y: 0.8, z: 1.8 }, rotationY: 180, color: fourthPersonColor },
        ],
        cameras: [{ nameKey: "canvas.director.scenePresetCameras.topWide", presetId: "top_wide" }],
    },
];

export function getDirectorCameraPreset(id: DirectorCameraPresetId) {
    return DIRECTOR_CAMERA_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function getDirectorScenePreset(id: DirectorScenePresetId) {
    return DIRECTOR_SCENE_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function applyDirectorCameraPreset(project: DirectorProjectState, preset: DirectorCameraPreset): DirectorProjectState {
    const position = cloneVector(preset.position);
    const target = cloneVector(preset.lookAt);
    const track = getDirectorCameraTrack(project);
    if (track) {
        let next = updateDirectorCameraTrack(project, track.id, {
            position,
            target,
            fov: preset.fov,
            motionPathId: null,
        });
        next = setDirectorCameraTrackTarget(next, track.id, "lookAtTarget", null);
        next = setDirectorCameraTrackTarget(next, track.id, "followTargetId", null);
        return next;
    }
    const camera = { ...project.camera };
    delete camera.lookAtTarget;
    delete camera.followTargetId;
    delete camera.motionPathId;
    return {
        ...project,
        camera: {
            ...camera,
            position,
            target,
            fov: preset.fov,
        },
    };
}

export function applyDirectorCameraPresetById(project: DirectorProjectState, id: DirectorCameraPresetId) {
    const preset = getDirectorCameraPreset(id);
    return preset ? applyDirectorCameraPreset(project, preset) : project;
}

export function applyDirectorScenePreset(
    project: DirectorProjectState,
    preset: DirectorScenePreset,
    options?: {
        objectName?: (object: DirectorScenePresetObject, index: number) => string;
        cameraName?: (camera: DirectorScenePresetCamera, index: number) => string;
    },
): DirectorProjectState {
    const objects: DirectorObject[] = preset.objects.slice(0, DIRECTOR_MAX_OBJECTS).map((item, index) => ({
        id: `preset-${preset.id}-${index + 1}`,
        ...(options?.objectName ? { name: options.objectName(item, index) } : {}),
        kind: item.kind,
        position: cloneVector(item.position),
        rotationY: item.rotationY ?? 0,
        scale: item.scale ?? 1,
        color: item.color ?? "#f97316",
    }));
    const cameraTracks: DirectorCameraTrack[] = preset.cameras.slice(0, DIRECTOR_MAX_CAMERA_TRACKS).flatMap((item, index) => {
        const cameraPreset = getDirectorCameraPreset(item.presetId);
        if (!cameraPreset) return [];
        return [
            {
                ...createDirectorCameraTrack(index, {
                    position: cameraPreset.position,
                    target: cameraPreset.lookAt,
                    fov: cameraPreset.fov,
                    clipStart: 0,
                    clipEnd: project.animation.duration,
                }),
                name: options?.cameraName?.(item, index) ?? `Camera ${index + 1}`,
            },
        ];
    });
    const firstCamera = cameraTracks[0];
    const camera = firstCamera
        ? {
              ...project.camera,
              position: cloneVector(firstCamera.position),
              target: cloneVector(firstCamera.target),
              fov: firstCamera.fov,
              zoom: firstCamera.zoom,
          }
        : createDirectorProject().camera;
    delete camera.lookAtTarget;
    delete camera.followTargetId;
    delete camera.motionPathId;
    return {
        ...project,
        camera,
        objects,
        animation: {
            ...project.animation,
            ...(firstCamera ? { activeCameraTrackId: firstCamera.id } : { activeCameraTrackId: undefined }),
            cameraTracks,
            motionPaths: [],
        },
    };
}

export function applyDirectorScenePresetById(
    project: DirectorProjectState,
    id: DirectorScenePresetId,
    options?: {
        objectName?: (object: DirectorScenePresetObject, index: number) => string;
        cameraName?: (camera: DirectorScenePresetCamera, index: number) => string;
    },
) {
    const preset = getDirectorScenePreset(id);
    return preset ? applyDirectorScenePreset(project, preset, options) : project;
}

export function matchesDirectorCameraPreset(project: DirectorProjectState, preset: DirectorCameraPreset) {
    const settings = getDirectorCameraTrackSettings(project);
    return !settings.lookAtTarget && !settings.followTargetId && !settings.motionPathId && sameVector(settings.position, preset.position) && sameVector(settings.target, preset.lookAt) && Math.abs(settings.fov - preset.fov) < 0.01;
}

export function isDirectorScenePresetActive(project: DirectorProjectState, preset: DirectorScenePreset) {
    return project.objects.length === preset.objects.length && project.objects.every((object, index) => object.id === `preset-${preset.id}-${index + 1}`);
}

function cloneVector(value: DirectorVector3): DirectorVector3 {
    return { x: value.x, y: value.y, z: value.z };
}

function sameVector(left: DirectorVector3, right: DirectorVector3) {
    return Math.abs(left.x - right.x) < 0.01 && Math.abs(left.y - right.y) < 0.01 && Math.abs(left.z - right.z) < 0.01;
}
