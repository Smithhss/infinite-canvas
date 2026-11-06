import type { CanvasProject } from "@/stores/canvas/use-canvas-store";
import type { Asset } from "@/stores/use-asset-store";

export function recentCanvasProjects(projects: CanvasProject[], limit = 4) {
    return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export function latestCoverAssets(assets: Asset[], limit = 4) {
    return [...assets]
        .filter((asset) => Boolean(asset.coverUrl))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
}

export function formatProjectDate(iso: string, locale: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}
