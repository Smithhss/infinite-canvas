import {
    DIRECTOR_MAX_PATH_POINTS,
    type DirectorMotionPath,
    type DirectorPathNode,
    type DirectorPathNodeKind,
    type DirectorProjectState,
} from "@/lib/canvas/director-project";

type DirectorMotionPathPatch = Partial<Pick<DirectorMotionPath, "name" | "closed">>;
type DirectorPathNodePatch = Partial<Pick<DirectorPathNode, "name" | "parentId" | "visible" | "locked" | "transform">>;

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
    return { ...project, animation: { ...project.animation, motionPaths } };
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
