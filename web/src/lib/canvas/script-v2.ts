import type { CanvasScriptColumnKey, CanvasScriptColumnVisibility, CanvasScriptShot, CanvasScriptViewMode, CanvasScriptV2 } from "@/types/canvas";

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

function createShotId() {
    return `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyScriptV2(): CanvasScriptV2 {
    return { version: 1, theme: "", aspectRatio: "16:9", styleDescription: "", originalStoryText: "", rows: [] };
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

export function addScriptShot(script: CanvasScriptV2): CanvasScriptV2 {
    return { ...script, rows: [...script.rows, createScriptShot(script.rows.length + 1)] };
}

export function updateScriptShot(script: CanvasScriptV2, shotId: string, patch: Partial<Omit<CanvasScriptShot, "id" | "shotNumber">>): CanvasScriptV2 {
    return { ...script, rows: script.rows.map((row) => (row.id === shotId ? { ...row, ...patch } : row)) };
}

export function removeScriptShot(script: CanvasScriptV2, shotId: string): CanvasScriptV2 {
    return {
        ...script,
        rows: script.rows.filter((row) => row.id !== shotId).map((row, index) => ({ ...row, shotNumber: index + 1 })),
    };
}

export function scriptDurationSeconds(script: CanvasScriptV2) {
    return script.rows.reduce((total, row) => total + (Number.isFinite(row.durationSeconds) ? row.durationSeconds : 0), 0);
}
