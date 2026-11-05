import type {
    CanvasScriptColumnKey,
    CanvasScriptColumnVisibility,
    CanvasScriptFilter,
    CanvasScriptFilterOperator,
    CanvasScriptShot,
    CanvasScriptViewMode,
    CanvasScriptV2,
} from "@/types/canvas";

import { normalizeScriptPreset } from "./script-preset";

const DEFAULT_SHOT_DURATION_SECONDS = 4;

export const SCRIPT_V2_COLUMNS: Array<{ key: CanvasScriptColumnKey; labelKey: string; defaultVisible: boolean; width: string }> = [
    { key: "shotNumber", labelKey: "shotNumber", defaultVisible: true, width: "64px" },
    { key: "duration", labelKey: "duration", defaultVisible: true, width: "92px" },
    { key: "plot", labelKey: "plot", defaultVisible: true, width: "280px" },
    { key: "characters", labelKey: "characters", defaultVisible: false, width: "180px" },
    { key: "videoReference", labelKey: "videoReference", defaultVisible: false, width: "180px" },
    { key: "shotSize", labelKey: "shotSize", defaultVisible: true, width: "110px" },
    { key: "emotion", labelKey: "emotion", defaultVisible: false, width: "120px" },
    { key: "props", labelKey: "props", defaultVisible: false, width: "150px" },
    { key: "cameraMovement", labelKey: "cameraMovement", defaultVisible: true, width: "150px" },
    { key: "lighting", labelKey: "lighting", defaultVisible: true, width: "170px" },
    { key: "audio", labelKey: "audio", defaultVisible: true, width: "150px" },
    { key: "dialogue", labelKey: "dialogue", defaultVisible: true, width: "190px" },
    { key: "imagePrompt", labelKey: "imagePrompt", defaultVisible: true, width: "240px" },
    { key: "videoPrompt", labelKey: "videoPrompt", defaultVisible: false, width: "240px" },
    { key: "imageToVideoPrompt", labelKey: "imageToVideoPrompt", defaultVisible: false, width: "240px" },
];

export const SCRIPT_V2_ROW_COLORS = ["red", "orange", "green", "blue", "violet"] as const;
export const SCRIPT_FILTER_OPERATORS: CanvasScriptFilterOperator[] = ["contains", "equals", "greater", "less"];

function createShotId() {
    return `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createFilterId() {
    return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyScriptV2(): CanvasScriptV2 {
    return { version: 1, theme: "", aspectRatio: "16:9", styleDescription: "", originalStoryText: "", rows: [] };
}

export function createScriptFilter(column: CanvasScriptColumnKey = "plot"): CanvasScriptFilter {
    return { id: createFilterId(), column, operator: "contains", value: "" };
}

export function createScriptShot(shotNumber: number): CanvasScriptShot {
    return {
        id: createShotId(),
        shotNumber,
        durationSeconds: DEFAULT_SHOT_DURATION_SECONDS,
        plotDescription: "",
        characters: [],
        videoReference: "",
        shotSize: "",
        emotion: "",
        propTags: [],
        cameraMovement: "",
        dialogue: "",
        lightingAndAtmosphere: "",
        audioEffects: "",
        imageGenerationPrompt: "",
        videoMotionPrompt: "",
        imageToVideoMotionPrompt: "",
    };
}

export function normalizeScriptColumnVisibility(value?: CanvasScriptColumnVisibility | null): Required<CanvasScriptColumnVisibility> {
    return Object.fromEntries(SCRIPT_V2_COLUMNS.map(({ key, defaultVisible }) => [key, typeof value?.[key] === "boolean" ? value[key] : defaultVisible])) as Record<CanvasScriptColumnKey, boolean>;
}

function normalizeStringList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

export function normalizeScriptFilters(value: unknown): CanvasScriptFilter[] {
    if (!Array.isArray(value)) return [];
    const columns = new Set(SCRIPT_V2_COLUMNS.map((column) => column.key));
    const operators = new Set<CanvasScriptFilterOperator>(SCRIPT_FILTER_OPERATORS);
    const ids = new Set<string>();
    return value
        .slice(0, 20)
        .flatMap((item, index) => {
            if (!item || typeof item !== "object") return [];
            const candidate = item as Partial<CanvasScriptFilter>;
            if (!candidate.column || !columns.has(candidate.column) || !candidate.operator || !operators.has(candidate.operator)) return [];
            let id = typeof candidate.id === "string" ? candidate.id.trim().slice(0, 120) : "";
            if (!id) id = `filter-${index + 1}`;
            if (ids.has(id)) {
                const base = id;
                let suffix = 2;
                while (ids.has(`${base}-${suffix}`)) suffix += 1;
                id = `${base}-${suffix}`;
            }
            ids.add(id);
            return [{
                id,
                column: candidate.column,
                operator: candidate.operator,
                value: typeof candidate.value === "string" ? candidate.value.slice(0, 500) : "",
            }];
        });
}

function renumberShots(rows: CanvasScriptShot[]) {
    return rows.map((row, index) => ({ ...row, shotNumber: index + 1 }));
}

export function normalizeScriptV2(script?: Partial<CanvasScriptV2> | null): CanvasScriptV2 {
    const rows = Array.isArray(script?.rows)
        ? script.rows.map((row, index) => ({
              id: row?.id || `shot-${index + 1}`,
              shotNumber: index + 1,
              durationSeconds: Number.isFinite(row?.durationSeconds) && Number(row.durationSeconds) > 0 ? Number(row.durationSeconds) : DEFAULT_SHOT_DURATION_SECONDS,
              plotDescription: row?.plotDescription || "",
              characters: normalizeStringList(row?.characters),
              videoReference: row?.videoReference || "",
              shotSize: row?.shotSize || "",
              emotion: row?.emotion || "",
              propTags: normalizeStringList(row?.propTags),
              cameraMovement: row?.cameraMovement || "",
              dialogue: row?.dialogue || "",
              lightingAndAtmosphere: row?.lightingAndAtmosphere || "",
              audioEffects: row?.audioEffects || "",
              imageGenerationPrompt: row?.imageGenerationPrompt || "",
              videoMotionPrompt: row?.videoMotionPrompt || "",
              imageToVideoMotionPrompt: row?.imageToVideoMotionPrompt || "",
              color: SCRIPT_V2_ROW_COLORS.includes(row?.color as (typeof SCRIPT_V2_ROW_COLORS)[number]) ? row.color : undefined,
          }))
        : [];
    return {
        version: 1,
        theme: script?.theme || "",
        aspectRatio: script?.aspectRatio || "16:9",
        styleDescription: script?.styleDescription || "",
        originalStoryText: script?.originalStoryText || "",
        preset: script?.preset ? normalizeScriptPreset(script.preset) : undefined,
        viewMode: script?.viewMode === "creative" || script?.viewMode === "asset" ? script.viewMode : "table",
        columnVisibility: normalizeScriptColumnVisibility(script?.columnVisibility),
        filters: normalizeScriptFilters(script?.filters),
        rows,
    };
}

export function updateScriptMeta(script: CanvasScriptV2, patch: Partial<Pick<CanvasScriptV2, "theme" | "aspectRatio" | "styleDescription" | "originalStoryText">>): CanvasScriptV2 {
    return { ...script, ...patch };
}

export function updateScriptViewMode(script: CanvasScriptV2, viewMode: CanvasScriptViewMode): CanvasScriptV2 {
    return { ...script, viewMode };
}

export function updateScriptColumnVisibility(script: CanvasScriptV2, column: CanvasScriptColumnKey, visible: boolean): CanvasScriptV2 {
    return { ...script, columnVisibility: { ...normalizeScriptColumnVisibility(script.columnVisibility), [column]: visible } };
}

export function updateScriptFilters(script: CanvasScriptV2, filters: CanvasScriptFilter[]): CanvasScriptV2 {
    return { ...script, filters: normalizeScriptFilters(filters) };
}

export function addScriptShot(script: CanvasScriptV2): CanvasScriptV2 {
    return insertScriptShot(script, script.rows.length);
}

export function insertScriptShot(script: CanvasScriptV2, index = script.rows.length): CanvasScriptV2 {
    const rows = [...script.rows];
    const insertAt = Math.max(0, Math.min(rows.length, Math.trunc(index)));
    rows.splice(insertAt, 0, createScriptShot(insertAt + 1));
    return { ...script, rows: renumberShots(rows) };
}

export function duplicateScriptShot(script: CanvasScriptV2, shotId: string): CanvasScriptV2 {
    const index = script.rows.findIndex((row) => row.id === shotId);
    if (index < 0) return script;
    const source = script.rows[index];
    const rows = [...script.rows];
    rows.splice(index + 1, 0, {
        ...source,
        id: createShotId(),
        characters: source.characters ? [...source.characters] : undefined,
        propTags: source.propTags ? [...source.propTags] : undefined,
    });
    return { ...script, rows: renumberShots(rows) };
}

export function moveScriptShotToTarget(script: CanvasScriptV2, shotId: string, targetShotId: string): CanvasScriptV2 {
    const from = script.rows.findIndex((row) => row.id === shotId);
    const to = script.rows.findIndex((row) => row.id === targetShotId);
    if (from < 0 || to < 0 || from === to) return script;
    const rows = [...script.rows];
    const [moved] = rows.splice(from, 1);
    rows.splice(to, 0, moved);
    return { ...script, rows: renumberShots(rows) };
}

export function updateScriptShot(script: CanvasScriptV2, shotId: string, patch: Partial<Omit<CanvasScriptShot, "id" | "shotNumber">>): CanvasScriptV2 {
    return { ...script, rows: script.rows.map((row) => (row.id === shotId ? { ...row, ...patch } : row)) };
}

export function removeScriptShot(script: CanvasScriptV2, shotId: string): CanvasScriptV2 {
    return {
        ...script,
        rows: renumberShots(script.rows.filter((row) => row.id !== shotId)),
    };
}

export function scriptDurationSeconds(script: CanvasScriptV2) {
    return script.rows.reduce((total, row) => total + (Number.isFinite(row.durationSeconds) ? row.durationSeconds : 0), 0);
}

function scriptShotColumnText(row: CanvasScriptShot, column: CanvasScriptColumnKey) {
    if (column === "shotNumber") return String(row.shotNumber);
    if (column === "duration") return String(row.durationSeconds);
    if (column === "plot") return row.plotDescription;
    if (column === "characters") return (row.characters || []).join("、");
    if (column === "videoReference") return row.videoReference || "";
    if (column === "shotSize") return row.shotSize || "";
    if (column === "emotion") return row.emotion || "";
    if (column === "props") return (row.propTags || []).join("、");
    if (column === "cameraMovement") return row.cameraMovement || "";
    if (column === "lighting") return row.lightingAndAtmosphere || "";
    if (column === "audio") return row.audioEffects || "";
    if (column === "dialogue") return row.dialogue || "";
    if (column === "imagePrompt") return row.imageGenerationPrompt || "";
    if (column === "videoPrompt") return row.videoMotionPrompt || "";
    if (column === "imageToVideoPrompt") return row.imageToVideoMotionPrompt || "";
    return "";
}

function compareFilterValue(left: string, right: string) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (left.trim() && right.trim() && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function filterScriptShots(script: CanvasScriptV2) {
    const filters = normalizeScriptFilters(script.filters).filter((filter) => filter.value.trim());
    if (!filters.length) return script.rows;
    return script.rows.filter((row) =>
        filters.every((filter) => {
            const left = scriptShotColumnText(row, filter.column);
            const right = filter.value.trim();
            if (filter.operator === "contains") return left.toLocaleLowerCase().includes(right.toLocaleLowerCase());
            if (filter.operator === "equals") return left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
            if (filter.operator === "greater") return compareFilterValue(left, right) > 0;
            return compareFilterValue(left, right) < 0;
        }),
    );
}
