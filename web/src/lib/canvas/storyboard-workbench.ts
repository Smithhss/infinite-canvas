import type { StoryboardItem } from "@/lib/canvas/storyboard-projection";
import type { CanvasStoryboardCategory } from "@/types/canvas";

export type StoryboardLibraryCategory = "all" | CanvasStoryboardCategory;

export const STORYBOARD_LIBRARY_CATEGORIES = ["all", "character", "scene", "prop", "other"] as const satisfies StoryboardLibraryCategory[];

export function filterStoryboardLibraryItems(items: StoryboardItem[], { keyword, category }: { keyword: string; category: StoryboardLibraryCategory }) {
    const query = keyword.trim().toLowerCase();
    return items.filter((item) => {
        if (category !== "all" && item.category !== category) return false;
        if (!query) return true;
        return [item.title, item.groupTitle, item.content, item.prompt, item.model].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
}

export function groupStoryboardLibraryItems(items: StoryboardItem[]) {
    return {
        script: items.filter((item) => item.kind === "script"),
        text: items.filter((item) => item.kind === "text"),
        image: items.filter((item) => item.kind === "image"),
        video: items.filter((item) => item.kind === "video"),
    };
}
