import { expect, test } from "bun:test";

import { DIRECTOR_MAX_PATH_POINTS, createDirectorProject } from "../src/lib/canvas/director-project";
import {
    addDirectorPathNode,
    createDirectorMotionPath,
    createDirectorPathNode,
    getAvailableDirectorPathNodeParents,
    interpolateDirectorMotionPathSamples,
    isDirectorPathNodeVisible,
    removeDirectorMotionPath,
    removeDirectorPathNode,
    sampleDirectorMotionPath,
    updateDirectorMotionPath,
    updateDirectorPathNode,
} from "../src/lib/canvas/director-motion-path";

function projectWithPath() {
    const project = createDirectorProject();
    const path = createDirectorMotionPath(0);
    return {
        ...project,
        animation: { ...project.animation, motionPaths: [path] },
    };
}

test("creates bounded motion paths and typed path nodes", () => {
    const path = createDirectorMotionPath(2);
    const waypoint = createDirectorPathNode(path.id, "waypoint", 1);
    const aim = createDirectorPathNode(path.id, "aim", 1);
    const focus = createDirectorPathNode(path.id, "focus", 1);

    expect(path).toMatchObject({ name: "Path 3", closed: false, nodes: [] });
    expect(path.id).toMatch(/^motion-path-/);
    expect(waypoint).toMatchObject({ name: "WP 2", kind: "waypoint", parentId: path.id, visible: true, locked: false });
    expect(aim.name).toBe("Aim 2");
    expect(focus.name).toBe("Focus 2");
    expect(waypoint.transform).toEqual({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
    });
});

test("adds and edits motion paths and path nodes without mutating the source", () => {
    const initial = projectWithPath();
    const pathId = initial.animation.motionPaths[0].id;
    const node = createDirectorPathNode(pathId, "waypoint", 0);
    const added = addDirectorPathNode(initial, pathId, node);
    const renamed = updateDirectorMotionPath(added, pathId, { name: "Hero Path", closed: true });
    const edited = updateDirectorPathNode(renamed, pathId, node.id, {
        name: "Entrance",
        transform: {
            position: { x: 2, y: 1, z: -3 },
            rotation: { x: 0, y: 45, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
        },
    });

    expect(initial.animation.motionPaths[0]).toMatchObject({ name: "Path 1", closed: false, nodes: [] });
    expect(edited.animation.motionPaths[0]).toMatchObject({ name: "Hero Path", closed: true });
    expect(edited.animation.motionPaths[0].nodes[0]).toMatchObject({
        name: "Entrance",
        transform: { position: { x: 2, y: 1, z: -3 }, rotation: { x: 0, y: 45, z: 0 } },
    });
});

test("caps path nodes and rejects duplicate ids", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    for (let index = 0; index < DIRECTOR_MAX_PATH_POINTS + 2; index += 1) {
        project = addDirectorPathNode(project, pathId, createDirectorPathNode(pathId, "waypoint", index));
    }

    expect(project.animation.motionPaths[0].nodes).toHaveLength(DIRECTOR_MAX_PATH_POINTS);
    const duplicate = project.animation.motionPaths[0].nodes[0];
    expect(addDirectorPathNode(project, pathId, duplicate)).toBe(project);
});

test("path parent choices exclude the node and its descendants", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const aim = createDirectorPathNode(pathId, "aim", 0);
    const child = createDirectorPathNode(pathId, "waypoint", 1);
    const sibling = createDirectorPathNode(pathId, "focus", 2);
    project = addDirectorPathNode(project, pathId, aim);
    project = addDirectorPathNode(project, pathId, child);
    project = addDirectorPathNode(project, pathId, sibling);
    project = updateDirectorPathNode(project, pathId, child.id, { parentId: aim.id });

    const path = project.animation.motionPaths[0];
    expect(getAvailableDirectorPathNodeParents(path, aim.id).map((node) => node.id)).toEqual([sibling.id]);
    expect(updateDirectorPathNode(project, pathId, aim.id, { parentId: child.id })).toBe(project);
    expect(updateDirectorPathNode(project, pathId, child.id, { parentId: child.id })).toBe(project);
});

test("locked path nodes reject edits until unlocked", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const node = createDirectorPathNode(pathId, "waypoint", 0);
    project = addDirectorPathNode(project, pathId, node);
    project = updateDirectorPathNode(project, pathId, node.id, { locked: true });

    expect(updateDirectorPathNode(project, pathId, node.id, { name: "Blocked" })).toBe(project);
    expect(removeDirectorPathNode(project, pathId, node.id)).toBe(project);

    project = updateDirectorPathNode(project, pathId, node.id, { locked: false, name: "Unlocked" });
    expect(project.animation.motionPaths[0].nodes[0]).toMatchObject({ name: "Unlocked", locked: false });
});

test("removing a path node reparents its children and removing a path clears only that path", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const parent = createDirectorPathNode(pathId, "aim", 0);
    const child = createDirectorPathNode(pathId, "waypoint", 1);
    project = addDirectorPathNode(project, pathId, parent);
    project = addDirectorPathNode(project, pathId, child);
    project = updateDirectorPathNode(project, pathId, child.id, { parentId: parent.id });

    const removedNode = removeDirectorPathNode(project, pathId, parent.id);
    expect(removedNode.animation.motionPaths[0].nodes).toHaveLength(1);
    expect(removedNode.animation.motionPaths[0].nodes[0].parentId).toBe(pathId);
    expect(removeDirectorMotionPath(removedNode, pathId).animation.motionPaths).toEqual([]);
});

test("path-node visibility inherits from every parent", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const parent = createDirectorPathNode(pathId, "aim", 0);
    const child = createDirectorPathNode(pathId, "waypoint", 1);
    project = addDirectorPathNode(project, pathId, parent);
    project = addDirectorPathNode(project, pathId, child);
    project = updateDirectorPathNode(project, pathId, child.id, { parentId: parent.id });
    const path = project.animation.motionPaths[0];

    expect(isDirectorPathNodeVisible(path.nodes[1], path)).toBe(true);
    path.nodes[0] = { ...path.nodes[0], visible: false };
    expect(isDirectorPathNodeVisible(path.nodes[1], path)).toBe(false);
    path.nodes[0] = { ...path.nodes[0], visible: true };
    path.nodes[1] = { ...path.nodes[1], visible: false };
    expect(isDirectorPathNodeVisible(path.nodes[1], path)).toBe(false);
});

test("samples visible waypoints as a Catmull-Rom curve", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const first = createDirectorPathNode(pathId, "waypoint", 0);
    const middle = createDirectorPathNode(pathId, "waypoint", 1);
    const last = createDirectorPathNode(pathId, "waypoint", 2);
    project = addDirectorPathNode(project, pathId, first);
    project = addDirectorPathNode(project, pathId, middle);
    project = addDirectorPathNode(project, pathId, last);
    project = updateDirectorPathNode(project, pathId, first.id, { transform: { ...first.transform, position: { x: 0, y: 0, z: 0 } } });
    project = updateDirectorPathNode(project, pathId, middle.id, { transform: { ...middle.transform, position: { x: 5, y: 2, z: -1 } } });
    project = updateDirectorPathNode(project, pathId, last.id, { transform: { ...last.transform, position: { x: 10, y: 0, z: 0 } } });

    const samples = sampleDirectorMotionPath(project.animation.motionPaths[0], 2);

    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(samples[2]).toEqual({ x: 5, y: 2, z: -1 });
    expect(samples[4]).toEqual({ x: 10, y: 0, z: 0 });
});

test("closes sampled paths and ignores aim or focus nodes in the curve", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const first = createDirectorPathNode(pathId, "waypoint", 0);
    const aim = createDirectorPathNode(pathId, "aim", 1);
    const second = createDirectorPathNode(pathId, "waypoint", 2);
    const third = createDirectorPathNode(pathId, "waypoint", 3);
    const focus = createDirectorPathNode(pathId, "focus", 4);
    project = addDirectorPathNode(project, pathId, first);
    project = addDirectorPathNode(project, pathId, aim);
    project = addDirectorPathNode(project, pathId, second);
    project = addDirectorPathNode(project, pathId, third);
    project = addDirectorPathNode(project, pathId, focus);
    project = updateDirectorMotionPath(project, pathId, { closed: true });

    const path = project.animation.motionPaths[0];
    const samples = sampleDirectorMotionPath(path, 1);

    expect(samples).toHaveLength(4);
    expect(samples[0]).toEqual(samples[3]);
    expect(samples[1]).toEqual({ x: 0, y: 0, z: 0 });
});

test("omits waypoints hidden by an ancestor from sampling", () => {
    let project = projectWithPath();
    const pathId = project.animation.motionPaths[0].id;
    const aim = createDirectorPathNode(pathId, "aim", 0);
    const hiddenWaypoint = createDirectorPathNode(pathId, "waypoint", 1);
    const visibleWaypoint = createDirectorPathNode(pathId, "waypoint", 2);
    project = addDirectorPathNode(project, pathId, aim);
    project = addDirectorPathNode(project, pathId, hiddenWaypoint);
    project = addDirectorPathNode(project, pathId, visibleWaypoint);
    project = updateDirectorPathNode(project, pathId, hiddenWaypoint.id, { parentId: aim.id });
    project = updateDirectorPathNode(project, pathId, aim.id, { visible: false });

    const samples = sampleDirectorMotionPath(project.animation.motionPaths[0], 2);

    expect(samples).toEqual([{ x: 0, y: 0, z: 0 }]);
});

test("interpolates camera positions and clears a removed path assignment", () => {
    const samples = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 4, z: -2 },
    ];
    expect(interpolateDirectorMotionPathSamples(samples, 0.25)).toEqual({ x: 2.5, y: 1, z: -0.5 });
    expect(interpolateDirectorMotionPathSamples(samples, 2)).toEqual({ x: 10, y: 4, z: -2 });
    expect(interpolateDirectorMotionPathSamples([], 0.5)).toBeNull();

    const initial = projectWithPath();
    const pathId = initial.animation.motionPaths[0].id;
    const assigned = { ...initial, camera: { ...initial.camera, motionPathId: pathId } };
    expect(removeDirectorMotionPath(assigned, pathId).camera.motionPathId).toBeUndefined();
});
