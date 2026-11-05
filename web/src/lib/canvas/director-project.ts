import { normalizePanoramaSource } from "@/lib/canvas/panorama-source";

export const DIRECTOR_PROJECT_VERSION = 2 as const;
export const DIRECTOR_MAX_OBJECTS = 40;
export const DIRECTOR_MAX_SCENE_NODES = 80;
export const DIRECTOR_MAX_CAMERA_TRACKS = 8;
export const DIRECTOR_MAX_KEYFRAMES = 240;
export const DIRECTOR_MAX_MOTION_PATHS = 8;
export const DIRECTOR_MAX_PATH_POINTS = 120;
export const DIRECTOR_MIN_ANIMATION_DURATION = 1;
export const DIRECTOR_MAX_ANIMATION_DURATION = 15;
export const DIRECTOR_DEFAULT_ANIMATION_DURATION = 10;
export const DIRECTOR_DEFAULT_FOV = 50;
export const DIRECTOR_MIN_FOV = 15;
export const DIRECTOR_MAX_FOV = 90;
export const DIRECTOR_MAX_GLB_BYTES = 100 * 1024 * 1024;
export const DIRECTOR_MAX_CAPTURE_BYTES = 20 * 1024 * 1024;

export class UnsupportedDirectorProjectVersionError extends Error {
    constructor(readonly version: unknown) {
        super(`Unsupported director project version: ${String(version)}`);
        this.name = "UnsupportedDirectorProjectVersionError";
    }
}

export type DirectorVector3 = {
    x: number;
    y: number;
    z: number;
};

export type DirectorQuaternion = {
    x: number;
    y: number;
    z: number;
    w: number;
};

export type DirectorCamera = {
    position: DirectorVector3;
    target: DirectorVector3;
    fov: number;
    zoom: number;
    quaternion?: DirectorQuaternion;
    lookAtTarget?: string;
    followTargetId?: string;
    motionPathId?: string;
};

export type DirectorObjectKind = "box" | "sphere" | "cylinder" | "cone";
export type DirectorBackground = "studio" | "night" | "sunset";
export type DirectorSceneNodeKind = "group" | "asset" | "light" | "aim" | "focus";

export type DirectorObject = {
    id: string;
    name?: string;
    parentId?: string;
    kind: DirectorObjectKind;
    position: DirectorVector3;
    rotationY: number;
    scale: number;
    color: string;
};

export type DirectorTransform = {
    position: DirectorVector3;
    rotation: DirectorVector3;
    scale: DirectorVector3;
};

export type DirectorSceneNode = {
    id: string;
    name: string;
    kind: DirectorSceneNodeKind;
    parentId: string | null;
    visible: boolean;
    locked: boolean;
    transform: DirectorTransform;
    asset?: {
        fileName: string;
        byteSize: number;
        storageKey?: string;
    };
};

export type DirectorEasing = "linear" | "easeIn" | "easeOut" | "easeInOut" | "smooth" | "custom";

export type DirectorCubicBezier = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

export type DirectorCameraKeyframe = {
    time: number;
    position: DirectorVector3;
    quaternion?: DirectorQuaternion;
    lookAt?: DirectorVector3;
    fov?: number;
    easing: DirectorEasing;
    bezier?: DirectorCubicBezier;
};

export type DirectorCameraTrack = {
    id: string;
    name: string;
    cameraId: string;
    keyframes: DirectorCameraKeyframe[];
};

export type DirectorPathNodeKind = "aim" | "focus" | "waypoint";

export type DirectorPathNode = {
    id: string;
    name: string;
    kind: DirectorPathNodeKind;
    parentId: string;
    visible: boolean;
    locked: boolean;
    transform: DirectorTransform;
};

export type DirectorMotionPath = {
    id: string;
    name: string;
    closed: boolean;
    nodes: DirectorPathNode[];
};

export type DirectorAnimation = {
    duration: number;
    activeCameraTrackId?: string;
    cameraTracks: DirectorCameraTrack[];
    motionPaths: DirectorMotionPath[];
};

export type DirectorEnvironment = {
    panoramaUrl?: string;
    skyColor: string;
    groundVisible: boolean;
    groundOpacity: number;
    groundHeight: number;
    panoramaRotationY: number;
    panoramaRadius: number;
    sceneScale: number;
    sceneTranslation: DirectorVector3;
    sceneRotation: DirectorVector3;
};

export type DirectorProjectState = {
    version: typeof DIRECTOR_PROJECT_VERSION;
    camera: DirectorCamera;
    objects: DirectorObject[];
    background: DirectorBackground;
    sceneNodes: DirectorSceneNode[];
    animation: DirectorAnimation;
    environment: DirectorEnvironment;
};

const objectKinds = new Set<DirectorObjectKind>(["box", "sphere", "cylinder", "cone"]);
const backgrounds = new Set<DirectorBackground>(["studio", "night", "sunset"]);
const sceneNodeKinds = new Set<DirectorSceneNodeKind>(["group", "asset", "light", "aim", "focus"]);
const pathNodeKinds = new Set<DirectorPathNodeKind>(["aim", "focus", "waypoint"]);
const easings = new Set<DirectorEasing>(["linear", "easeIn", "easeOut", "easeInOut", "smooth", "custom"]);
const hexColor = /^#[0-9a-f]{6}$/i;
const objectId = /^[a-z0-9_-]{1,64}$/i;

export function normalizeDirectorColor(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const color = value.trim();
    if (hexColor.test(color)) return color.toLowerCase();

    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgb) return null;
    const channels = rgb.slice(1).map(Number);
    if (channels.some((channel) => channel > 255)) return null;
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function isSupportedDirectorProjectVersion(version: unknown) {
    return version == null || version === 1 || version === DIRECTOR_PROJECT_VERSION;
}

export function createDirectorProject(): DirectorProjectState {
    return {
        version: DIRECTOR_PROJECT_VERSION,
        camera: {
            position: { x: 8, y: 5.5, z: 10 },
            target: { x: 0, y: 0.8, z: 0 },
            fov: DIRECTOR_DEFAULT_FOV,
            zoom: 1,
        },
        objects: [],
        background: "studio",
        sceneNodes: [],
        animation: {
            duration: DIRECTOR_DEFAULT_ANIMATION_DURATION,
            cameraTracks: [],
            motionPaths: [],
        },
        environment: createDirectorEnvironment(),
    };
}

export function normalizeDirectorProject(value: unknown): DirectorProjectState {
    const fallback = createDirectorProject();
    if (!value || typeof value !== "object") return fallback;
    const source = value as Partial<DirectorProjectState>;
    const version = (value as { version?: unknown }).version;
    if (!isSupportedDirectorProjectVersion(version)) {
        throw new UnsupportedDirectorProjectVersionError(version);
    }
    const legacy = version !== DIRECTOR_PROJECT_VERSION;
    const cameraFallback = legacy ? { ...fallback.camera, fov: 42 } : fallback.camera;
    const camera = source.camera && typeof source.camera === "object" ? source.camera : cameraFallback;
    const objects = normalizeObjects(source.objects);
    const sceneNodes = normalizeSceneNodes(source.sceneNodes);
    const sceneNodeIds = new Set(sceneNodes.map((node) => node.id));
    const normalizedObjects = objects.map((object) => object.parentId && !sceneNodeIds.has(object.parentId) ? withoutObjectParent(object) : object);
    const targetIds = new Set([...normalizedObjects.map((object) => object.id), ...sceneNodes.map((node) => node.id)]);
    const animation = normalizeAnimation(source.animation);
    const motionPathIds = new Set(animation.motionPaths.map((path) => path.id));

    return {
        version: DIRECTOR_PROJECT_VERSION,
        camera: {
            position: normalizeVector(camera.position, { x: 24, y: 16, z: 24 }, fallback.camera.position),
            target: normalizeVector(camera.target, { x: 12, y: 8, z: 12 }, fallback.camera.target),
            fov: clampNumber(camera.fov, DIRECTOR_MIN_FOV, DIRECTOR_MAX_FOV, cameraFallback.fov),
            zoom: clampNumber(camera.zoom, 0.1, 5, 1),
            ...normalizeOptionalQuaternion(camera.quaternion),
            ...normalizeOptionalTargetField("lookAtTarget", camera.lookAtTarget, targetIds),
            ...normalizeOptionalTargetField("followTargetId", camera.followTargetId, targetIds),
            ...normalizeOptionalTargetField("motionPathId", camera.motionPathId, motionPathIds),
        },
        objects: normalizedObjects,
        background: backgrounds.has(source.background as DirectorBackground) ? (source.background as DirectorBackground) : fallback.background,
        sceneNodes,
        animation,
        environment: normalizeEnvironment(source.environment, legacy),
    };
}

export function createDirectorObject(kind: DirectorObjectKind, index: number): DirectorObject {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `${kind}-${Date.now().toString(36)}-${safeIndex}`,
        kind,
        position: { x: (safeIndex % 5) - 2, y: kind === "sphere" ? 0.8 : 1, z: Math.floor(safeIndex / 5) - 1 },
        rotationY: 0,
        scale: 1,
        color: ["#f97316", "#38bdf8", "#a3e635", "#f472b6"][safeIndex % 4],
    };
}

export function createDirectorSceneNode(kind: DirectorSceneNodeKind, index: number, parentId: string | null = null): DirectorSceneNode {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `scene-${kind}-${Date.now().toString(36)}-${safeIndex}`,
        name: `${kind === "group" ? "Group" : "Node"} ${safeIndex + 1}`,
        kind,
        parentId: normalizeOptionalId(parentId),
        visible: true,
        locked: false,
        transform: normalizeTransform(undefined),
    };
}

export function isValidDirectorCapture(dataUrl: string) {
    if (!/^data:image\/png;base64,[a-z0-9+/=\r\n]+$/i.test(dataUrl)) return false;
    const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return Math.floor((payload.length * 3) / 4) <= DIRECTOR_MAX_CAPTURE_BYTES;
}

export function hasValidDirectorGlbHeader(buffer: ArrayBuffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 12 || buffer.byteLength > DIRECTOR_MAX_GLB_BYTES) return false;
    const view = new DataView(buffer);
    return view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === buffer.byteLength;
}

function createDirectorEnvironment(): DirectorEnvironment {
    return {
        skyColor: "#060608",
        groundVisible: true,
        groundOpacity: 0.4,
        groundHeight: 0,
        panoramaRotationY: 0,
        panoramaRadius: 60,
        sceneScale: 3,
        sceneTranslation: { x: 0, y: 0, z: 0 },
        sceneRotation: { x: 0, y: 0, z: 0 },
    };
}

function normalizeEnvironment(value: unknown, legacy = false): DirectorEnvironment {
    const fallback = createDirectorEnvironment();
    if (!value || typeof value !== "object") return legacy ? { ...fallback, groundOpacity: 1 } : fallback;
    const source = value as Partial<DirectorEnvironment>;
    const panoramaUrl = normalizePanoramaSource(source.panoramaUrl);
    return {
        ...(panoramaUrl ? { panoramaUrl } : {}),
        skyColor: normalizeDirectorColor(source.skyColor) ?? fallback.skyColor,
        groundVisible: typeof source.groundVisible === "boolean" ? source.groundVisible : fallback.groundVisible,
        groundOpacity: clampNumber(source.groundOpacity, 0, 1, legacy ? 1 : fallback.groundOpacity),
        groundHeight: clampNumber(source.groundHeight, -8, 8, fallback.groundHeight),
        panoramaRotationY: clampAngle(source.panoramaRotationY, fallback.panoramaRotationY),
        panoramaRadius: clampNumber(source.panoramaRadius, 1, 500, fallback.panoramaRadius),
        sceneScale: clampNumber(source.sceneScale, 0.01, 100, fallback.sceneScale),
        sceneTranslation: normalizeVector(source.sceneTranslation, { x: 1000, y: 1000, z: 1000 }, fallback.sceneTranslation, -1000),
        sceneRotation: normalizeVector(source.sceneRotation, { x: 360, y: 360, z: 360 }, fallback.sceneRotation, -360),
    };
}

function normalizeAnimation(value: unknown): DirectorAnimation {
    const source = value && typeof value === "object" ? (value as Partial<DirectorAnimation>) : {};
    const duration = clampNumber(source.duration, DIRECTOR_MIN_ANIMATION_DURATION, DIRECTOR_MAX_ANIMATION_DURATION, DIRECTOR_DEFAULT_ANIMATION_DURATION);
    const cameraTracks = Array.isArray(source.cameraTracks) ? normalizeCameraTracks(source.cameraTracks, duration) : [];
    const seenPaths = new Set<string>();
    const motionPaths = Array.isArray(source.motionPaths)
        ? source.motionPaths.slice(0, DIRECTOR_MAX_MOTION_PATHS).flatMap((item, index) => {
              const path = normalizeMotionPath(item, index);
              if (!path || seenPaths.has(path.id)) return [];
              seenPaths.add(path.id);
              return [path];
          })
        : [];
    const activeCameraTrackId = typeof source.activeCameraTrackId === "string" && cameraTracks.some((track) => track.id === source.activeCameraTrackId) ? source.activeCameraTrackId : undefined;
    return {
        duration,
        ...(activeCameraTrackId ? { activeCameraTrackId } : {}),
        cameraTracks,
        motionPaths,
    };
}

function normalizeCameraTracks(value: unknown[], duration: number): DirectorCameraTrack[] {
    const seen = new Set<string>();
    return value.slice(0, DIRECTOR_MAX_CAMERA_TRACKS).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const source = item as Partial<DirectorCameraTrack>;
        const id = normalizeId(source.id, `camera-track-${index + 1}`);
        if (seen.has(id)) return [];
        seen.add(id);
        const keyframes = Array.isArray(source.keyframes)
            ? source.keyframes
                  .slice(0, DIRECTOR_MAX_KEYFRAMES)
                  .flatMap((keyframe, keyframeIndex) => normalizeCameraKeyframe(keyframe, keyframeIndex, duration))
                  .sort((left, right) => left.time - right.time || left.order - right.order)
                  .map(({ order: _order, ...keyframe }) => keyframe)
            : [];
        return [{
            id,
            name: normalizeName(source.name, `Camera ${index + 1}`),
            cameraId: normalizeId(source.cameraId, "camera-main"),
            keyframes,
        }];
    });
}

function normalizeCameraKeyframe(value: unknown, index: number, duration: number): Array<DirectorCameraKeyframe & { order: number }> {
    if (!value || typeof value !== "object") return [];
    const source = value as Partial<DirectorCameraKeyframe> & { order?: number };
    const quaternion = normalizeOptionalQuaternion(source.quaternion);
    return [{
        time: clampNumber(source.time, 0, duration, 0),
        position: normalizeVector(source.position, { x: 24, y: 16, z: 24 }, { x: 0, y: 0, z: 0 }),
        ...quaternion,
        ...(source.lookAt ? { lookAt: normalizeVector(source.lookAt, { x: 12, y: 8, z: 12 }, { x: 0, y: 0, z: 0 }) } : {}),
        ...(source.fov !== undefined ? { fov: clampNumber(source.fov, DIRECTOR_MIN_FOV, DIRECTOR_MAX_FOV, DIRECTOR_DEFAULT_FOV) } : {}),
        easing: easings.has(source.easing as DirectorEasing) ? (source.easing as DirectorEasing) : "linear",
        ...normalizeOptionalBezier(source.bezier),
        order: index,
    }];
}

function normalizeOptionalBezier(value: unknown): { bezier?: DirectorCubicBezier } {
    if (!value || typeof value !== "object") return {};
    const source = value as Partial<DirectorCubicBezier>;
    return {
        bezier: {
            x1: clampNumber(source.x1, 0, 1, 0.42),
            y1: clampNumber(source.y1, 0, 1, 0),
            x2: clampNumber(source.x2, 0, 1, 0.58),
            y2: clampNumber(source.y2, 0, 1, 1),
        },
    };
}

function normalizeMotionPath(value: unknown, index: number): DirectorMotionPath | null {
    if (!value || typeof value !== "object") return null;
    const source = value as Partial<DirectorMotionPath> & { points?: unknown[] };
    const id = normalizeId(source.id, `motion-path-${index + 1}`);
    const legacyNodes = Array.isArray(source.points)
        ? source.points.slice(0, DIRECTOR_MAX_PATH_POINTS).map((point, pointIndex) => ({
              id: `${id}-wp-${pointIndex + 1}`,
              name: `WP ${pointIndex + 1}`,
              kind: "waypoint",
              parentId: id,
              transform: { position: point },
          }))
        : [];
    const sourceNodes = Array.isArray(source.nodes) ? source.nodes : legacyNodes;
    const seen = new Set<string>();
    const nodes = sourceNodes.slice(0, DIRECTOR_MAX_PATH_POINTS).flatMap((node, nodeIndex) => {
        if (!node || typeof node !== "object") return [];
        const item = node as Partial<DirectorPathNode>;
        const nodeId = normalizeId(item.id, `${id}-node-${nodeIndex + 1}`);
        if (seen.has(nodeId) || nodeId === id) return [];
        seen.add(nodeId);
        const kind = pathNodeKinds.has(item.kind as DirectorPathNodeKind) ? (item.kind as DirectorPathNodeKind) : "waypoint";
        return [{
            id: nodeId,
            name: normalizeName(item.name, kind === "waypoint" ? `WP ${nodeIndex + 1}` : `Node ${nodeIndex + 1}`),
            kind,
            parentId: id,
            visible: item.visible !== false,
            locked: item.locked === true,
            transform: normalizeTransform(item.transform),
        }];
    });
    const validParents = new Set([id, ...nodes.map((node) => node.id)]);
    const assignedParents = new Set<string>();
    sourceNodes.slice(0, DIRECTOR_MAX_PATH_POINTS).forEach((node, nodeIndex) => {
        if (!node || typeof node !== "object") return;
        const item = node as Partial<DirectorPathNode>;
        const nodeId = normalizeId(item.id, `${id}-node-${nodeIndex + 1}`);
        const normalized = nodes.find((candidate) => candidate.id === nodeId);
        if (!normalized || assignedParents.has(nodeId)) return;
        assignedParents.add(nodeId);
        normalized.parentId = normalizeOptionalId(item.parentId) && validParents.has(item.parentId!) ? item.parentId! : id;
    });
    const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
    nodes.forEach((node) => {
        if (hasPathNodeCycle(node.id, id, parents)) parents.set(node.id, id);
    });
    return {
        id,
        name: normalizeName(source.name, `Path ${index + 1}`),
        closed: source.closed === true,
        nodes: nodes.map((node) => ({ ...node, parentId: parents.get(node.id) ?? id })),
    };
}

function hasPathNodeCycle(id: string, pathId: string, parents: Map<string, string>) {
    const visited = new Set([id]);
    let current = parents.get(id) || pathId;
    while (current && current !== pathId) {
        if (visited.has(current)) return true;
        visited.add(current);
        current = parents.get(current) || pathId;
    }
    return false;
}

function normalizeSceneNodes(value: unknown): DirectorSceneNode[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const nodes = value.slice(0, DIRECTOR_MAX_SCENE_NODES).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const source = item as Partial<DirectorSceneNode>;
        const id = normalizeId(source.id, `scene-node-${index + 1}`);
        if (seen.has(id)) return [];
        seen.add(id);
        const kind = sceneNodeKinds.has(source.kind as DirectorSceneNodeKind) ? (source.kind as DirectorSceneNodeKind) : "group";
        return [{
            id,
            name: normalizeName(source.name, kind === "group" ? `Group ${index + 1}` : `Node ${index + 1}`),
            kind,
            parentId: normalizeOptionalId(source.parentId),
            visible: source.visible !== false,
            locked: source.locked === true,
            transform: normalizeTransform(source.transform),
            ...(kind === "asset" && normalizeAsset(source.asset) ? { asset: normalizeAsset(source.asset)! } : {}),
        }];
    });
    const ids = new Set(nodes.map((node) => node.id));
    const parents = new Map(nodes.map((node) => [
        node.id,
        node.parentId && node.parentId !== node.id && ids.has(node.parentId) ? node.parentId : null,
    ]));
    nodes.forEach((node) => {
        if (hasSceneNodeCycle(node.id, parents)) parents.set(node.id, null);
    });
    return nodes.map((node) => ({ ...node, parentId: parents.get(node.id) ?? null }));
}

function hasSceneNodeCycle(id: string, parents: Map<string, string | null>) {
    const visited = new Set([id]);
    let current = parents.get(id) ?? null;
    while (current) {
        if (visited.has(current)) return true;
        visited.add(current);
        current = parents.get(current) ?? null;
    }
    return false;
}

function normalizeTransform(value: unknown): DirectorTransform {
    const source = value && typeof value === "object" ? (value as Partial<DirectorTransform>) : {};
    return {
        position: normalizeVector(source.position, { x: 24, y: 16, z: 24 }, { x: 0, y: 0, z: 0 }),
        rotation: normalizeVector(source.rotation, { x: 360, y: 360, z: 360 }, { x: 0, y: 0, z: 0 }, -360),
        scale: normalizeVector(source.scale, { x: 100, y: 100, z: 100 }, { x: 1, y: 1, z: 1 }, 0.01),
    };
}

function normalizeAsset(value: unknown): DirectorSceneNode["asset"] | null {
    if (!value || typeof value !== "object") return null;
    const source = value as NonNullable<DirectorSceneNode["asset"]>;
    if (typeof source.fileName !== "string" || !/\.glb$/i.test(source.fileName.trim())) return null;
    if (typeof source.byteSize !== "number" || !Number.isInteger(source.byteSize) || source.byteSize < 1 || source.byteSize > DIRECTOR_MAX_GLB_BYTES) return null;
    return {
        fileName: normalizeName(source.fileName, "asset.glb", 120),
        byteSize: source.byteSize,
        ...(typeof source.storageKey === "string" && /^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(source.storageKey) ? { storageKey: source.storageKey } : {}),
    };
}

function normalizeOptionalQuaternion(value: unknown) {
    if (!value || typeof value !== "object") return {};
    const source = value as Partial<DirectorQuaternion>;
    if (![source.x, source.y, source.z, source.w].every((item) => typeof item === "number" && Number.isFinite(item))) return {};
    const length = Math.hypot(source.x!, source.y!, source.z!, source.w!);
    if (length < 0.000001) return {};
    return {
        quaternion: {
            x: source.x! / length,
            y: source.y! / length,
            z: source.z! / length,
            w: source.w! / length,
        },
    };
}

function normalizeOptionalIdField<Key extends "lookAtTarget" | "followTargetId" | "motionPathId">(key: Key, value: unknown): Partial<Record<Key, string>> {
    const id = normalizeOptionalId(value);
    return id ? { [key]: id } as Partial<Record<Key, string>> : {};
}

function normalizeOptionalTargetField<Key extends "lookAtTarget" | "followTargetId" | "motionPathId">(key: Key, value: unknown, targetIds: Set<string>): Partial<Record<Key, string>> {
    const field = normalizeOptionalIdField(key, value);
    return field[key] && targetIds.has(field[key]) ? field : {};
}

function normalizeOptionalId(value: unknown) {
    return typeof value === "string" && objectId.test(value) ? value : null;
}

function normalizeId(value: unknown, fallback: string) {
    return normalizeOptionalId(value) ?? fallback;
}

function normalizeName(value: unknown, fallback: string, maxLength = 60) {
    if (typeof value !== "string") return fallback;
    const name = value.trim().replace(/\s+/g, " ");
    return name ? name.slice(0, maxLength) : fallback;
}

function clampAngle(value: unknown, fallback: number) {
    return clampNumber(value, -360, 360, fallback);
}

function normalizeObject(value: unknown, index: number): DirectorObject[] {
    if (!value || typeof value !== "object") return [];
    const source = value as Partial<DirectorObject>;
    const kind = objectKinds.has(source.kind as DirectorObjectKind) ? (source.kind as DirectorObjectKind) : "box";
    const id = typeof source.id === "string" && objectId.test(source.id) ? source.id : `${kind}-${index + 1}`;
    const name = normalizeName(source.name, "");
    const parentId = normalizeOptionalId(source.parentId);
    return [{
        id,
        ...(name ? { name } : {}),
        ...(parentId ? { parentId } : {}),
        kind,
        position: normalizeVector(source.position, { x: 8, y: 6, z: 8 }, { x: 8, y: 6, z: 8 }, 0),
        rotationY: clampNumber(source.rotationY, -180, 180, 0),
        scale: clampNumber(source.scale, 0.2, 3, 1),
        color: normalizeDirectorColor(source.color) ?? "#f97316",
    }];
}

function normalizeObjects(value: unknown): DirectorObject[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.slice(0, DIRECTOR_MAX_OBJECTS).flatMap((item, index) => {
        const objects = normalizeObject(item, index);
        const object = objects[0];
        if (!object || seen.has(object.id)) return [];
        seen.add(object.id);
        return [object];
    });
}

function withoutObjectParent(object: DirectorObject) {
    const { parentId: _parentId, ...rest } = object;
    return rest;
}

function normalizeVector(value: unknown, limit: DirectorVector3, fallback: DirectorVector3, yMin = -8): DirectorVector3 {
    const source = value && typeof value === "object" ? (value as Partial<DirectorVector3>) : {};
    return {
        x: clampNumber(source.x, -limit.x, limit.x, fallback.x),
        y: clampNumber(source.y, yMin, limit.y, fallback.y),
        z: clampNumber(source.z, -limit.z, limit.z, fallback.z),
    };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
