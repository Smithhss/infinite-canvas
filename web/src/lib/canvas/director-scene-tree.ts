import type { DirectorObject, DirectorProjectState, DirectorSceneNode, DirectorSceneNodeKind } from "@/lib/canvas/director-project";

export type DirectorSceneTreeKind = "camera" | "object" | "path" | "waypoint" | DirectorSceneNodeKind;
export const DIRECTOR_MAX_TREE_DEPTH = 8;

export type DirectorSceneTreeEntry = {
    id: string;
    label: string;
    kind: DirectorSceneTreeKind;
    depth: number;
    objectId?: string;
};

export function buildDirectorSceneTree(project: DirectorProjectState): DirectorSceneTreeEntry[] {
    const entries: DirectorSceneTreeEntry[] = [{ id: "camera:main", label: "Camera", kind: "camera", depth: 0 }];
    const sceneNodeIds = new Set(project.sceneNodes.map((node) => node.id));
    const objectsByParent = new Map<string | null, Array<{ object: DirectorObject; index: number }>>();
    project.objects.forEach((object, index) => {
        const parentId = object.parentId && sceneNodeIds.has(object.parentId) ? object.parentId : null;
        const group = objectsByParent.get(parentId) || [];
        group.push({ object, index });
        objectsByParent.set(parentId, group);
    });
    const appendObjects = (parentId: string | null, depth: number) => {
        (objectsByParent.get(parentId) || []).forEach(({ object, index }) => {
            entries.push({
                id: `object:${object.id}`,
                label: objectName(object, index),
                kind: "object",
                depth: clampTreeDepth(depth),
                objectId: object.id,
            });
        });
    };

    const nodesByParent = new Map<string | null, DirectorSceneNode[]>();
    project.sceneNodes.forEach((node) => {
        const parentId = node.parentId && sceneNodeIds.has(node.parentId) ? node.parentId : null;
        const group = nodesByParent.get(parentId) || [];
        group.push(node);
        nodesByParent.set(parentId, group);
    });
    const visitedSceneNodes = new Set<string>();
    const appendSceneNode = (node: DirectorSceneNode, depth: number) => {
        if (visitedSceneNodes.has(node.id)) return;
        visitedSceneNodes.add(node.id);
        const safeDepth = clampTreeDepth(depth);
        entries.push({ id: `scene:${node.id}`, label: node.name, kind: node.kind, depth: safeDepth });
        appendObjects(node.id, safeDepth + 1);
        appendSceneNodes(node.id, safeDepth + 1);
    };
    const appendSceneNodes = (parentId: string | null, depth: number) => {
        (nodesByParent.get(parentId) || []).forEach((node) => appendSceneNode(node, depth));
    };
    appendSceneNodes(null, 0);
    project.sceneNodes.forEach((node) => {
        if (!visitedSceneNodes.has(node.id)) appendSceneNode(node, 0);
    });

    project.animation.motionPaths.forEach((path) => {
        entries.push({ id: `path:${path.id}`, label: path.name, kind: "path", depth: 0 });
        const pathNodeIds = new Set(path.nodes.map((node) => node.id));
        const pathNodesByParent = new Map<string, typeof path.nodes>();
        path.nodes.forEach((node) => {
            const parentId = node.parentId === path.id || pathNodeIds.has(node.parentId) ? node.parentId : path.id;
            const group = pathNodesByParent.get(parentId) || [];
            group.push(node);
            pathNodesByParent.set(parentId, group);
        });
        const visitedPathNodes = new Set<string>();
        const appendPathNode = (node: (typeof path.nodes)[number], depth: number) => {
            if (visitedPathNodes.has(node.id)) return;
            visitedPathNodes.add(node.id);
            const safeDepth = clampTreeDepth(depth);
            entries.push({
                id: `path:${path.id}:node:${node.id}`,
                label: node.name,
                kind: node.kind,
                depth: safeDepth,
            });
            appendPathNodes(node.id, safeDepth + 1);
        };
        const appendPathNodes = (parentId: string, depth: number) => {
            (pathNodesByParent.get(parentId) || []).forEach((node) => appendPathNode(node, depth));
        };
        appendPathNodes(path.id, 1);
        path.nodes.forEach((node) => {
            if (!visitedPathNodes.has(node.id)) appendPathNode(node, 1);
        });
    });

    appendObjects(null, 0);
    return entries;
}

function objectName(object: DirectorObject, index: number) {
    if (object.name) return object.name;
    return object.kind === "box" ? `Cube ${index + 1}` : `${object.kind[0].toUpperCase()}${object.kind.slice(1)} ${index + 1}`;
}

function clampTreeDepth(depth: number) {
    return Math.min(DIRECTOR_MAX_TREE_DEPTH, Math.max(0, depth));
}
