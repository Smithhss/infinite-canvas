import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export function duplicateCanvasProject(source: CanvasProject, options: { id: string; title: string; now?: string }): CanvasProject {
    const now = options.now || new Date().toISOString();
    return {
        ...structuredClone(source),
        id: options.id,
        title: options.title,
        createdAt: now,
        updatedAt: now,
    };
}
