import { expect, test } from "bun:test";

import { createDirectorProject, normalizeDirectorProject } from "../src/lib/canvas/director-project";
import { DIRECTOR_MAX_TREE_DEPTH, buildDirectorSceneTree } from "../src/lib/canvas/director-scene-tree";

test("builds camera, grouped scene nodes, nested path nodes and objects", () => {
    const project = normalizeDirectorProject({
        ...createDirectorProject(),
        objects: [
            { id: "hero-box", name: "Hero prop", kind: "box", parentId: "group-a", position: { x: 1, y: 1, z: 1 } },
            { id: "loose-sphere", kind: "sphere", position: { x: 1, y: 1, z: 1 } },
        ],
        sceneNodes: [
            { id: "group-a", name: "Set", kind: "group", parentId: null },
            { id: "light-key", name: "Key Light", kind: "light", parentId: "group-a" },
            { id: "aim-camera", name: "Aim", kind: "aim", parentId: "group-a" },
        ],
        animation: {
            duration: 10,
            motionPaths: [{
                id: "path-a",
                name: "Camera Path",
                nodes: [
                    { id: "path-aim", name: "Path Aim", kind: "aim", parentId: "path-a" },
                    { id: "path-wp", name: "WP 1", kind: "waypoint", parentId: "path-aim" },
                ],
            }],
        },
    });

    const tree = buildDirectorSceneTree(project);
    expect(tree.map((entry) => [entry.kind, entry.depth])).toEqual([
        ["camera", 0],
        ["group", 0],
        ["object", 1],
        ["light", 1],
        ["aim", 1],
        ["path", 0],
        ["aim", 1],
        ["waypoint", 2],
        ["object", 0],
    ]);
    expect(tree.find((entry) => entry.kind === "object")?.objectId).toBe("hero-box");
    expect(tree.find((entry) => entry.kind === "object")?.label).toBe("Hero prop");
});

test("caps scene-tree display depth without dropping nested entries", () => {
    const sceneNodes = Array.from({ length: DIRECTOR_MAX_TREE_DEPTH + 4 }, (_, index) => ({
        id: `group-${index}`,
        name: `Group ${index}`,
        kind: "group",
        parentId: index === 0 ? null : `group-${index - 1}`,
    }));
    const project = normalizeDirectorProject({ sceneNodes });

    const tree = buildDirectorSceneTree(project).filter((entry) => entry.kind === "group");
    expect(tree).toHaveLength(sceneNodes.length);
    expect(tree[DIRECTOR_MAX_TREE_DEPTH].depth).toBe(DIRECTOR_MAX_TREE_DEPTH);
    expect(tree.at(-1)?.depth).toBe(DIRECTOR_MAX_TREE_DEPTH);
});

test("keeps an unnormalized scene-node cycle visible", () => {
    const project = {
        ...createDirectorProject(),
        sceneNodes: [
            { id: "group-a", name: "Group A", kind: "group" as const, parentId: "group-b", visible: true, locked: false, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
            { id: "group-b", name: "Group B", kind: "group" as const, parentId: "group-a", visible: true, locked: false, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } } },
        ],
    };

    const tree = buildDirectorSceneTree(project).filter((entry) => entry.kind === "group");
    expect(tree.map((entry) => entry.label)).toEqual(["Group A", "Group B"]);
});
