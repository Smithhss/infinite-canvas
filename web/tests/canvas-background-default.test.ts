import { beforeEach, expect, test } from "bun:test";

import { useCanvasStore } from "../src/stores/canvas/use-canvas-store";

beforeEach(() => {
    useCanvasStore.setState({ projects: [], deletedProjects: [] });
});

test("new and imported canvases default to the line grid", () => {
    const createdId = useCanvasStore.getState().createProject("New canvas");
    const importedId = useCanvasStore.getState().importProject({ title: "Imported canvas" });

    expect(useCanvasStore.getState().openProject(createdId)?.backgroundMode).toBe("lines");
    expect(useCanvasStore.getState().openProject(importedId)?.backgroundMode).toBe("lines");
});

test("an explicit grid preference is preserved", () => {
    const id = useCanvasStore.getState().importProject({ title: "Blank canvas", backgroundMode: "blank" });

    expect(useCanvasStore.getState().openProject(id)?.backgroundMode).toBe("blank");
});
