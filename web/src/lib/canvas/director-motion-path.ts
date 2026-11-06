import {
    DIRECTOR_MAX_PATH_POINTS,
    type DirectorMotionPath,
    type DirectorPathNode,
    type DirectorPathNodeKind,
    type DirectorProjectState,
    type DirectorVector3,
} from "@/lib/canvas/director-project";

type DirectorMotionPathPatch = Partial<Pick<DirectorMotionPath, "name" | "closed">>;
type DirectorPathNodePatch = Partial<Pick<DirectorPathNode, "name" | "parentId" | "visible" | "locked" | "transform">>;
export const DIRECTOR_MOTION_PATH_SAMPLES_PER_SPAN = 12;

export function createDirectorMotionPath(index: number): DirectorMotionPath {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `motion-path-${Date.now().toString(36)}-${safeIndex}`,
        name: `Path ${safeIndex + 1}`,
        closed: false,
        nodes: [],
    };
}

export function createDirectorPathNode(pathId: string, kind: DirectorPathNodeKind, index: number): DirectorPathNode {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `path-${kind}-${Date.now().toString(36)}-${safeIndex}`,
        name: kind === "waypoint" ? `WP ${safeIndex + 1}` : `${kind === "aim" ? "Aim" : "Focus"} ${safeIndex + 1}`,
        kind,
        parentId: pathId,
        visible: true,
        locked: false,
        transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
        },
    };
}

export function getAvailableDirectorPathNodeParents(path: DirectorMotionPath, nodeId: string) {
    const blocked = new Set([nodeId]);
    let changed = true;
    while (changed) {
        changed = false;
        path.nodes.forEach((node) => {
            if (blocked.has(node.parentId) && !blocked.has(node.id)) {
                blocked.add(node.id);
                changed = true;
            }
        });
    }
    return path.nodes.filter((node) => !blocked.has(node.id));
}

export function addDirectorPathNode(project: DirectorProjectState, pathId: string, node: DirectorPathNode): DirectorProjectState {
    return mapMotionPath(project, pathId, (path) => {
        if (path.nodes.length >= DIRECTOR_MAX_PATH_POINTS || path.nodes.some((item) => item.id === node.id)) return path;
        const parentId = node.parentId === path.id || path.nodes.some((item) => item.id === node.parentId) ? node.parentId : path.id;
        return { ...path, nodes: [...path.nodes, { ...node, parentId }] };
    });
}

export function updateDirectorMotionPath(project: DirectorProjectState, pathId: string, patch: DirectorMotionPathPatch): DirectorProjectState {
    return mapMotionPath(project, pathId, (path) => ({ ...path, ...patch }));
}

export function updateDirectorPathNode(project: DirectorProjectState, pathId: string, nodeId: string, patch: DirectorPathNodePatch): DirectorProjectState {
    return mapMotionPath(project, pathId, (path) => {
        const node = path.nodes.find((item) => item.id === nodeId);
        if (!node || (node.locked && patch.locked !== false)) return path;
        if (patch.parentId !== undefined && !isAvailableParent(path, nodeId, patch.parentId)) return path;
        return {
            ...path,
            nodes: path.nodes.map((item) => (item.id === nodeId ? { ...item, ...patch } : item)),
        };
    });
}

export function removeDirectorPathNode(project: DirectorProjectState, pathId: string, nodeId: string): DirectorProjectState {
    return mapMotionPath(project, pathId, (path) => {
        const node = path.nodes.find((item) => item.id === nodeId);
        if (!node || node.locked) return path;
        return {
            ...path,
            nodes: path.nodes
                .filter((item) => item.id !== nodeId)
                .map((item) => (item.parentId === nodeId ? { ...item, parentId: node.parentId } : item)),
        };
    });
}

export function removeDirectorMotionPath(project: DirectorProjectState, pathId: string): DirectorProjectState {
    const motionPaths = project.animation.motionPaths.filter((path) => path.id !== pathId);
    if (motionPaths.length === project.animation.motionPaths.length) return project;
    const camera = { ...project.camera };
    if (camera.motionPathId === pathId) delete camera.motionPathId;
    return {
        ...project,
        camera,
        animation: {
            ...project.animation,
            motionPaths,
            cameraTracks: project.animation.cameraTracks.map((track) => (
                track.motionPathId === pathId ? { ...track, motionPathId: null } : track
            )),
        },
    };
}

export function isDirectorPathNodeVisible(node: DirectorPathNode, path: DirectorMotionPath) {
    const nodes = new Map(path.nodes.map((item) => [item.id, item]));
    const visited = new Set<string>();
    let current: DirectorPathNode | undefined = node;
    while (current) {
        if (!current.visible || visited.has(current.id)) return false;
        visited.add(current.id);
        current = current.parentId === path.id ? undefined : nodes.get(current.parentId);
    }
    return true;
}

export function sampleDirectorMotionPath(path: DirectorMotionPath, segmentsPerSpan = DIRECTOR_MOTION_PATH_SAMPLES_PER_SPAN): DirectorVector3[] {
    const points = path.nodes
        .filter((node) => node.kind === "waypoint" && isDirectorPathNodeVisible(node, path))
        .map((node) => node.transform.position);
    if (points.length < 2) return points.map((point) => ({ ...point }));

    const segments = Math.max(1, Math.min(32, Math.floor(segmentsPerSpan)));
    const closed = path.closed && points.length >= 3;
    const segmentCount = closed ? points.length : points.length - 1;
    const samples: DirectorVector3[] = [];
    for (let index = 0; index < segmentCount; index += 1) {
        const p0 = closed ? points[(index - 1 + points.length) % points.length] : points[Math.max(0, index - 1)];
        const p1 = points[index];
        const p2 = points[(index + 1) % points.length];
        const p3 = closed ? points[(index + 2) % points.length] : points[Math.min(points.length - 1, index + 2)];
        for (let step = 0; step < segments; step += 1) {
            samples.push(catmullRomPoint(p0, p1, p2, p3, step / segments));
        }
    }
    samples.push({ ...(closed ? points[0] : points[points.length - 1]) });
    return samples;
}

export function interpolateDirectorMotionPathSamples(samples: DirectorVector3[], progress: number): DirectorVector3 | null {
    if (!samples.length) return null;
    const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const exact = clamped * (samples.length - 1);
    const leftIndex = Math.floor(exact);
    const rightIndex = Math.min(samples.length - 1, leftIndex + 1);
    const amount = exact - leftIndex;
    const left = samples[leftIndex];
    const right = samples[rightIndex];
    return {
        x: left.x + (right.x - left.x) * amount,
        y: left.y + (right.y - left.y) * amount,
        z: left.z + (right.z - left.z) * amount,
    };
}

function mapMotionPath(project: DirectorProjectState, pathId: string, update: (path: DirectorMotionPath) => DirectorMotionPath) {
    let changed = false;
    const motionPaths = project.animation.motionPaths.map((path) => {
        if (path.id !== pathId) return path;
        const next = update(path);
        if (next !== path) changed = true;
        return next;
    });
    return changed ? { ...project, animation: { ...project.animation, motionPaths } } : project;
}

function isAvailableParent(path: DirectorMotionPath, nodeId: string, parentId: string) {
    return parentId === path.id || getAvailableDirectorPathNodeParents(path, nodeId).some((node) => node.id === parentId);
}

function catmullRomPoint(p0: DirectorVector3, p1: DirectorVector3, p2: DirectorVector3, p3: DirectorVector3, t: number): DirectorVector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
    };
}
