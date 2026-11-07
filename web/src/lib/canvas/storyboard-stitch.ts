import type { StoryboardBatchItem } from "@/lib/canvas/storyboard-batch";

export type StoryboardStitchResolution = "2k" | "4k";

export const STORYBOARD_STITCH_LONG_EDGES: Record<StoryboardStitchResolution, number> = {
    "2k": 2048,
    "4k": 4096,
};

export type StoryboardStitchCell = {
    index: number;
    column: number;
    row: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type StoryboardStitchPlan = {
    resolution: StoryboardStitchResolution;
    longEdge: number;
    count: number;
    columns: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
    width: number;
    height: number;
    cells: StoryboardStitchCell[];
};

export type StoryboardStitchBlockedReason = "empty" | "unfinished";

export function aspectRatioValue(ratio?: string) {
    const [width, height] = String(ratio || "16:9")
        .split(":")
        .map((value) => Number(value));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 16 / 9;
    return width / height;
}

export function storyboardStitchBlockedReason(items: Pick<StoryboardBatchItem, "status">[]): StoryboardStitchBlockedReason | null {
    if (!items.length) return "empty";
    if (items.some((item) => item.status !== "done")) return "unfinished";
    return null;
}

export function storyboardStitchPlan(input: {
    count: number;
    columns: number;
    rows?: number;
    aspectRatio?: string;
    resolution: StoryboardStitchResolution;
}): StoryboardStitchPlan | null {
    const count = Math.floor(input.count);
    const columns = Math.floor(input.columns);
    const rows = Math.floor(input.rows ?? Math.ceil(count / Math.max(1, columns)));
    if (count < 1 || columns < 1 || rows < 1 || count > columns * rows) return null;

    const ratio = aspectRatioValue(input.aspectRatio);
    const longEdge = STORYBOARD_STITCH_LONG_EDGES[input.resolution];
    const gridRatio = (columns * ratio) / rows;

    let cellWidth: number;
    let cellHeight: number;
    if (gridRatio >= 1) {
        cellWidth = Math.max(1, Math.floor(longEdge / columns));
        cellHeight = Math.max(1, Math.floor(cellWidth / ratio));
    } else {
        cellHeight = Math.max(1, Math.floor(longEdge / rows));
        cellWidth = Math.max(1, Math.floor(cellHeight * ratio));
    }

    const width = cellWidth * columns;
    const height = cellHeight * rows;
    const cells = Array.from({ length: count }, (_, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return {
            index,
            column,
            row,
            x: column * cellWidth,
            y: row * cellHeight,
            width: cellWidth,
            height: cellHeight,
        };
    });

    return {
        resolution: input.resolution,
        longEdge,
        count,
        columns,
        rows,
        cellWidth,
        cellHeight,
        width,
        height,
        cells,
    };
}
