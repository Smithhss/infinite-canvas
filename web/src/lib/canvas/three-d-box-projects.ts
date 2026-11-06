import { isSupportedDirectorProjectVersion, type DirectorBackground } from "@/lib/canvas/director-project";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

const backgrounds = new Set<DirectorBackground>(["studio", "night", "sunset"]);

export function getThreeDBoxProjects(projects: CanvasProject[]) {
    return projects.filter((project) => Boolean(project.director)).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function getThreeDBoxProjectPreview(director: unknown) {
    const source = director && typeof director === "object" ? (director as { version?: unknown; background?: unknown; objects?: unknown }) : {};
    const supported = isSupportedDirectorProjectVersion(source.version);
    return {
        background: supported && backgrounds.has(source.background as DirectorBackground) ? (source.background as DirectorBackground) : "studio" as DirectorBackground,
        objectCount: supported && Array.isArray(source.objects) ? source.objects.filter((item) => Boolean(item) && typeof item === "object").length : 0,
        unsupportedVersion: supported ? null : source.version,
    };
}

export function getThreeDBoxProjectTitle(prompt: string, fallback: string) {
    const firstLine = prompt.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, " ").trim();
    if (!firstLine) return fallback;
    return firstLine.length > 44 ? `${firstLine.slice(0, 44).trim()}...` : firstLine;
}
