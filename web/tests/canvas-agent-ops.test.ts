import { afterAll, expect, test } from "bun:test";

import type { CanvasAgentSnapshot } from "../src/lib/canvas/canvas-agent-ops";
import { installTestLocalStorage } from "./test-local-storage";

const restoreStorage = installTestLocalStorage();
afterAll(restoreStorage);

const { applyCanvasAgentOps, protectLockedCanvasSnapshot } = await import("../src/lib/canvas/canvas-agent-ops");

const snapshot: CanvasAgentSnapshot = {
    projectId: "project",
    title: "Canvas",
    nodes: [
        { id: "locked", type: "text", title: "Locked", position: { x: 0, y: 0 }, width: 100, height: 80, locked: true, metadata: { content: "keep" } },
        { id: "open", type: "text", title: "Open", position: { x: 120, y: 0 }, width: 100, height: 80, metadata: { content: "change" } },
    ],
    connections: [{ id: "connection", fromNodeId: "locked", toNodeId: "open" }],
    selectedNodeIds: [],
    viewport: { x: 0, y: 0, k: 1 },
};

test("agent operations cannot mutate or remove locked nodes and their connections", () => {
    const next = applyCanvasAgentOps(snapshot, [
        { type: "update_node", id: "locked", patch: { title: "Changed" } },
        { type: "delete_node", ids: ["locked"] },
        { type: "delete_connections", all: true },
        { type: "connect_nodes", fromNodeId: "open", toNodeId: "locked" },
    ]);

    expect(next.nodes).toEqual(snapshot.nodes);
    expect(next.connections).toEqual(snapshot.connections);
});

test("agent undo snapshots preserve nodes locked after the original operation", () => {
    const current: CanvasAgentSnapshot = {
        ...snapshot,
        nodes: [snapshot.nodes[0]],
        connections: [],
    };
    const beforeLock: CanvasAgentSnapshot = {
        ...snapshot,
        nodes: [{ ...snapshot.nodes[0], locked: false, title: "Before lock" }, snapshot.nodes[1]],
        connections: [{ id: "new-connection", fromNodeId: "open", toNodeId: "locked" }],
    };

    const next = protectLockedCanvasSnapshot(beforeLock, current);
    expect(next.nodes[0]).toEqual(current.nodes[0]);
    expect(next.nodes.some((node) => node.id === "open")).toBe(true);
});
