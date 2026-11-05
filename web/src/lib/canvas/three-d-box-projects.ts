import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

export function getThreeDBoxProjects(projects: CanvasProject[]) {
    return projects.filter((project) => Boolean(project.director)).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function getThreeDBoxProjectTitle(prompt: string, fallback: string) {
    const firstLine = prompt.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, " ").trim();
    if (!firstLine) return fallback;
    return firstLine.length > 44 ? `${firstLine.slice(0, 44).trim()}...` : firstLine;
}
