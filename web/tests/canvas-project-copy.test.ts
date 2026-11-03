import { expect, test } from "bun:test";

import { duplicateCanvasProject } from "../src/lib/canvas/canvas-project-copy";
import type { CanvasProject } from "../src/stores/canvas/use-canvas-store";

const source: CanvasProject = {
    id: "source",
    title: "Source",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    nodes: [{ id: "node", type: "text", title: "Node", position: { x: 1, y: 2 }, width: 100, height: 80, metadata: { content: "hello" } }],
    connections: [],
    chatSessions: [],
    activeChatId: null,
    backgroundMode: "blank",
    showImageInfo: false,
    viewport: { x: 10, y: 20, k: 1 },
};

test("duplicateCanvasProject creates an independent project copy", () => {
    const copy = duplicateCanvasProject(source, { id: "copy", title: "Source copy", now: "2026-01-03T00:00:00.000Z" });

    expect(copy.id).toBe("copy");
    expect(copy.title).toBe("Source copy");
    expect(copy.createdAt).toBe("2026-01-03T00:00:00.000Z");
    expect(copy.updatedAt).toBe("2026-01-03T00:00:00.000Z");

    copy.nodes[0].position.x = 99;
    copy.nodes[0].metadata!.content = "changed";
    expect(source.nodes[0].position.x).toBe(1);
    expect(source.nodes[0].metadata?.content).toBe("hello");
});
