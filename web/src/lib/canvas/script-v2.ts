import type {
    CanvasScriptAssetEntity,
    CanvasScriptAssetKind,
    CanvasScriptAssets,
    CanvasScriptAssetReference,
    CanvasScriptColumnKey,
    CanvasScriptColumnVisibility,
    CanvasScriptFilter,
    CanvasScriptFilterOperator,
    CanvasScriptPromptSource,
    CanvasScriptPromptVersion,
    CanvasScriptShot,
    CanvasScriptViewMode,
    CanvasScriptV2,
} from "@/types/canvas";

import { normalizeScriptPreset } from "./script-preset";

const DEFAULT_SHOT_DURATION_SECONDS = 4;
export const SCRIPT_PROMPT_HISTORY_LIMIT = 20;
export const SCRIPT_PROMPT_MAX_LENGTH = 8000;
const SCRIPT_ASSET_LIMIT = 200;
const SCRIPT_ASSET_KINDS: CanvasScriptAssetKind[] = ["characters", "scenes", "props"];

export const SCRIPT_V2_COLUMNS: Array<{ key: CanvasScriptColumnKey; labelKey: string; defaultVisible: boolean; width: string }> = [
    { key: "shotNumber", labelKey: "shotNumber", defaultVisible: true, width: "64px" },
    { key: "duration", labelKey: "duration", defaultVisible: true, width: "92px" },
    { key: "plot", labelKey: "plot", defaultVisible: true, width: "280px" },
    { key: "shotSize", labelKey: "shotSize", defaultVisible: true, width: "110px" },
    { key: "lighting", labelKey: "lighting", defaultVisible: true, width: "170px" },
    { key: "dialogue", labelKey: "dialogue", defaultVisible: true, width: "190px" },
    { key: "audio", labelKey: "audio", defaultVisible: true, width: "150px" },
    { key: "cameraMovement", labelKey: "cameraMovement", defaultVisible: true, width: "150px" },
    { key: "imagePrompt", labelKey: "imagePrompt", defaultVisible: true, width: "240px" },
    { key: "characters", labelKey: "characters", defaultVisible: false, width: "180px" },
    { key: "videoReference", labelKey: "videoReference", defaultVisible: false, width: "180px" },
    { key: "emotion", labelKey: "emotion", defaultVisible: false, width: "120px" },
    { key: "props", labelKey: "props", defaultVisible: false, width: "150px" },
    { key: "videoPrompt", labelKey: "videoPrompt", defaultVisible: false, width: "240px" },
    { key: "imageToVideoPrompt", labelKey: "imageToVideoPrompt", defaultVisible: false, width: "240px" },
];

export const SCRIPT_V2_SHOT_SIZES = [
    { value: "大远景", labelKey: "extremeLong" },
    { value: "远景", labelKey: "long" },
    { value: "全景", labelKey: "full" },
    { value: "中远景", labelKey: "mediumLong" },
    { value: "中景", labelKey: "medium" },
    { value: "中近景", labelKey: "mediumClose" },
    { value: "近景", labelKey: "close" },
    { value: "特写", labelKey: "closeUp" },
    { value: "大特写", labelKey: "extremeCloseUp" },
    { value: "头肩景", labelKey: "headShoulder" },
    { value: "半身景", labelKey: "halfBody" },
    { value: "全身景", labelKey: "fullBody" },
] as const;

export const SCRIPT_V2_ROW_COLORS = ["red", "orange", "green", "blue", "violet"] as const;
export const SCRIPT_FILTER_OPERATORS: CanvasScriptFilterOperator[] = ["contains", "equals", "greater", "less"];

function createShotId() {
    return `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createFilterId() {
    return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createAssetId(kind: CanvasScriptAssetKind) {
    return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

const SCRIPT_PROMPT_SOURCES = new Set<CanvasScriptPromptSource>(["composed", "manual", "restored"]);

function normalizePromptHistory(value: unknown): CanvasScriptPromptVersion[] {
    if (!Array.isArray(value)) return [];
    const versions = new Set<number>();
    return value
        .flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const candidate = item as Partial<CanvasScriptPromptVersion>;
            const prompt = typeof candidate.prompt === "string" ? candidate.prompt.trim().slice(0, SCRIPT_PROMPT_MAX_LENGTH) : "";
            const version = Number.isFinite(candidate.version) ? Math.max(1, Math.trunc(Number(candidate.version))) : 0;
            if (!prompt || !version || versions.has(version)) return [];
            versions.add(version);
            return [{
                version,
                prompt,
                source: SCRIPT_PROMPT_SOURCES.has(candidate.source as CanvasScriptPromptSource) ? candidate.source as CanvasScriptPromptSource : "manual",
                createdAt: Number.isFinite(candidate.createdAt) ? Math.max(0, Math.trunc(Number(candidate.createdAt))) : 0,
            }];
        })
        .sort((left, right) => right.version - left.version)
        .slice(0, SCRIPT_PROMPT_HISTORY_LIMIT);
}

function normalizeScriptAssetList(value: unknown, kind: CanvasScriptAssetKind): CanvasScriptAssetEntity[] {
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    const names = new Set<string>();
    return value
        .slice(0, SCRIPT_ASSET_LIMIT)
        .flatMap((item, index) => {
            if (!item || typeof item !== "object") return [];
            const candidate = item as Partial<CanvasScriptAssetEntity>;
            const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 120) : "";
            const normalizedName = name.toLocaleLowerCase();
            if (!name || names.has(normalizedName)) return [];
            let id = typeof candidate.id === "string" ? candidate.id.trim().slice(0, 160) : "";
            if (!id) id = `asset-${kind}-${index + 1}`;
            if (ids.has(id)) {
                const base = id;
                let suffix = 2;
                while (ids.has(`${base}-${suffix}`)) suffix += 1;
                id = `${base}-${suffix}`;
            }
            ids.add(id);
            names.add(normalizedName);
            const referenceAssetId = typeof candidate.referenceAssetId === "string" ? candidate.referenceAssetId.trim().slice(0, 160) : "";
            return [{
                id,
                name,
                description: typeof candidate.description === "string" ? candidate.description.trim().slice(0, 500) : undefined,
                status: referenceAssetId ? "ready" : "draft",
                referenceAssetId: referenceAssetId || undefined,
                referenceTitle: typeof candidate.referenceTitle === "string" ? candidate.referenceTitle.trim().slice(0, 160) : undefined,
                referenceStorageKey: typeof candidate.referenceStorageKey === "string" ? candidate.referenceStorageKey.trim().slice(0, 240) : undefined,
            }];
        });
}

export function normalizeScriptAssets(value: unknown): CanvasScriptAssets {
    const candidate = value && typeof value === "object" ? value as Partial<Record<CanvasScriptAssetKind, unknown>> : {};
    return {
        characters: normalizeScriptAssetList(candidate.characters, "characters"),
        scenes: normalizeScriptAssetList(candidate.scenes, "scenes"),
        props: normalizeScriptAssetList(candidate.props, "props"),
    };
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
              characterAssetIds: normalizeStringList(row?.characterAssetIds),
              sceneAssetIds: normalizeStringList(row?.sceneAssetIds),
              videoReference: row?.videoReference || "",
              shotSize: row?.shotSize || "",
              emotion: row?.emotion || "",
              propTags: normalizeStringList(row?.propTags),
              propAssetIds: normalizeStringList(row?.propAssetIds),
              cameraMovement: row?.cameraMovement || "",
              dialogue: row?.dialogue || "",
              lightingAndAtmosphere: row?.lightingAndAtmosphere || "",
              audioEffects: row?.audioEffects || "",
              imageGenerationPrompt: row?.imageGenerationPrompt || "",
              promptVersion: Number.isFinite(row?.promptVersion) ? Math.max(1, Math.trunc(Number(row.promptVersion))) : undefined,
              promptHistory: normalizePromptHistory(row?.promptHistory),
              promptSource: SCRIPT_PROMPT_SOURCES.has(row?.promptSource as CanvasScriptPromptSource) ? row?.promptSource : undefined,
              promptSourceHash: row?.promptSourceHash || undefined,
              promptUpdatedAt: Number.isFinite(row?.promptUpdatedAt) ? Math.max(0, Math.trunc(Number(row.promptUpdatedAt))) : undefined,
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
        assets: normalizeScriptAssets(script?.assets),
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

function normalizedAssetName(value: string) {
    return value.trim().toLocaleLowerCase();
}

function mergeScriptAssets(assets: CanvasScriptAssetEntity[], kind: CanvasScriptAssetKind, names: string[]) {
    const next = [...assets];
    const known = new Set(next.map((asset) => normalizedAssetName(asset.name)));
    for (const rawName of names) {
        const name = rawName.trim().slice(0, 120);
        const key = normalizedAssetName(name);
        if (!name || known.has(key) || next.length >= SCRIPT_ASSET_LIMIT) continue;
        known.add(key);
        next.push({ id: createAssetId(kind), name, status: "draft" });
    }
    return next;
}

function assetIdsForNames(names: string[] | undefined, assets: CanvasScriptAssetEntity[]) {
    const byName = new Map(assets.map((asset) => [normalizedAssetName(asset.name), asset.id]));
    return [...new Set((names || []).map((name) => byName.get(normalizedAssetName(name))).filter((id): id is string => Boolean(id)))];
}

export function syncScriptAssetsFromShots(script: CanvasScriptV2) {
    const current = normalizeScriptAssets(script.assets);
    const assets: CanvasScriptAssets = {
        characters: mergeScriptAssets(current.characters, "characters", script.rows.flatMap((row) => row.characters || [])),
        scenes: current.scenes,
        props: mergeScriptAssets(current.props, "props", script.rows.flatMap((row) => row.propTags || [])),
    };
    const validIds = Object.fromEntries(
        SCRIPT_ASSET_KINDS.map((kind) => [kind, new Set(assets[kind].map((asset) => asset.id))]),
    ) as Record<CanvasScriptAssetKind, Set<string>>;
    return {
        ...script,
        assets,
        rows: script.rows.map((row) => ({
            ...row,
            characterAssetIds: assetIdsForNames(row.characters, assets.characters),
            sceneAssetIds: (row.sceneAssetIds || []).filter((id) => validIds.scenes.has(id)),
            propAssetIds: assetIdsForNames(row.propTags, assets.props),
        })),
    };
}

export function scriptAssetAvailability(asset: CanvasScriptAssetEntity, availableReferenceIds: ReadonlySet<string> | null) {
    if (!availableReferenceIds) return asset.status;
    if (asset.referenceAssetId && !availableReferenceIds.has(asset.referenceAssetId)) return "missing" as const;
    return asset.status;
}

export function addScriptAsset(script: CanvasScriptV2, kind: CanvasScriptAssetKind, rawName: string) {
    const name = rawName.trim().slice(0, 120);
    if (!name) return script;
    const assets = normalizeScriptAssets(script.assets);
    if (assets[kind].length >= SCRIPT_ASSET_LIMIT || assets[kind].some((asset) => normalizedAssetName(asset.name) === normalizedAssetName(name))) return script;
    const asset: CanvasScriptAssetEntity = { id: createAssetId(kind), name, status: "draft" };
    const nextAssets = { ...assets, [kind]: [...assets[kind], asset] };
    const rows = script.rows.map((row) => {
        if (kind === "characters" && (row.characters || []).some((value) => normalizedAssetName(value) === normalizedAssetName(name))) {
            return { ...row, characterAssetIds: [...new Set([...(row.characterAssetIds || []), asset.id])] };
        }
        if (kind === "props" && (row.propTags || []).some((value) => normalizedAssetName(value) === normalizedAssetName(name))) {
            return { ...row, propAssetIds: [...new Set([...(row.propAssetIds || []), asset.id])] };
        }
        return row;
    });
    return { ...script, assets: nextAssets, rows };
}

export function bindScriptAssetReference(
    script: CanvasScriptV2,
    kind: CanvasScriptAssetKind,
    assetId: string,
    reference?: CanvasScriptAssetReference | null,
) {
    const assets = normalizeScriptAssets(script.assets);
    return {
        ...script,
        assets: {
            ...assets,
            [kind]: assets[kind].map((asset) => asset.id === assetId ? {
                ...asset,
                status: reference ? "ready" : "draft",
                referenceAssetId: reference?.referenceAssetId,
                referenceTitle: reference?.referenceTitle,
                referenceStorageKey: reference?.referenceStorageKey,
            } : asset),
        },
    };
}

export function removeScriptAsset(script: CanvasScriptV2, kind: CanvasScriptAssetKind, assetId: string) {
    const assets = normalizeScriptAssets(script.assets);
    const assetName = assets[kind].find((asset) => asset.id === assetId)?.name;
    return {
        ...script,
        assets: { ...assets, [kind]: assets[kind].filter((asset) => asset.id !== assetId) },
        rows: script.rows.map((row) => {
            if (kind === "characters") {
                return {
                    ...row,
                    characters: assetName ? (row.characters || []).filter((name) => normalizedAssetName(name) !== normalizedAssetName(assetName)) : row.characters,
                    characterAssetIds: (row.characterAssetIds || []).filter((id) => id !== assetId),
                };
            }
            if (kind === "scenes") return { ...row, sceneAssetIds: (row.sceneAssetIds || []).filter((id) => id !== assetId) };
            return {
                ...row,
                propTags: assetName ? (row.propTags || []).filter((name) => normalizedAssetName(name) !== normalizedAssetName(assetName)) : row.propTags,
                propAssetIds: (row.propAssetIds || []).filter((id) => id !== assetId),
            };
        }),
    };
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
    const assets = normalizeScriptAssets(script.assets);
    return {
        ...script,
        rows: script.rows.map((row) => {
            if (row.id !== shotId) return row;
            const next = { ...row, ...patch };
            if (Object.prototype.hasOwnProperty.call(patch, "characters") && !Object.prototype.hasOwnProperty.call(patch, "characterAssetIds")) {
                next.characterAssetIds = assetIdsForNames(next.characters, assets.characters);
            }
            if (Object.prototype.hasOwnProperty.call(patch, "propTags") && !Object.prototype.hasOwnProperty.call(patch, "propAssetIds")) {
                next.propAssetIds = assetIdsForNames(next.propTags, assets.props);
            }
            return next;
        }),
    };
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

function hashScriptPromptSource(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function scriptShotPromptSourceHash(script: CanvasScriptV2, shot: CanvasScriptShot) {
    return hashScriptPromptSource(JSON.stringify({
        theme: script.theme || "",
        aspectRatio: script.aspectRatio || "",
        styleDescription: script.styleDescription || "",
        shotSize: shot.shotSize || "",
        plotDescription: shot.plotDescription || "",
        characters: shot.characters || [],
        propTags: shot.propTags || [],
        cameraMovement: shot.cameraMovement || "",
        lightingAndAtmosphere: shot.lightingAndAtmosphere || "",
    }));
}

export function buildScriptShotPrompt(script: CanvasScriptV2, shot: CanvasScriptShot) {
    const segments = [
        script.theme ? `主题：${script.theme}` : "",
        script.styleDescription ? `视觉风格：${script.styleDescription}` : "",
        shot.shotSize ? `景别：${shot.shotSize}` : "",
        shot.plotDescription ? `画面：${shot.plotDescription}` : "",
        shot.characters?.length ? `角色：${shot.characters.join("、")}` : "",
        shot.propTags?.length ? `道具：${shot.propTags.join("、")}` : "",
        shot.cameraMovement ? `运镜：${shot.cameraMovement}` : "",
        shot.lightingAndAtmosphere ? `光影氛围：${shot.lightingAndAtmosphere}` : "",
        script.aspectRatio ? `画幅：${script.aspectRatio}` : "",
    ];
    return segments.filter(Boolean).join("\n").trim();
}

export function validateScriptPrompt(value: string) {
    const prompt = value.trim();
    if (!prompt) return ["empty"] as const;
    if (prompt.length > SCRIPT_PROMPT_MAX_LENGTH) return ["tooLong"] as const;
    return [] as const;
}

export function scriptShotPromptStatus(script: CanvasScriptV2, shot: CanvasScriptShot): "draft" | "ready" | "stale" {
    if (!shot.imageGenerationPrompt?.trim()) return "draft";
    if (!shot.promptSourceHash) return "ready";
    return shot.promptSourceHash === scriptShotPromptSourceHash(script, shot) ? "ready" : "stale";
}

function withScriptShotPrompt(
    script: CanvasScriptV2,
    shot: CanvasScriptShot,
    prompt: string,
    source: CanvasScriptPromptSource,
    now: number,
) {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return shot;
    const nextHash = scriptShotPromptSourceHash(script, shot);
    const currentPrompt = (shot.imageGenerationPrompt || "").trim();
    if (normalizedPrompt === currentPrompt) {
        return {
            ...shot,
            promptSource: shot.promptSource || source,
            promptSourceHash: nextHash,
            promptUpdatedAt: now,
        };
    }

    const history = normalizePromptHistory(shot.promptHistory);
    const currentVersion = Math.max(shot.promptVersion || 0, history[0]?.version || 0);
    const archived = currentPrompt
        ? [{
              version: Math.max(1, currentVersion),
              prompt: currentPrompt,
              source: shot.promptSource || "manual",
              createdAt: shot.promptUpdatedAt || now,
          }]
        : [];
    const nextVersion = Math.max(currentVersion, archived[0]?.version || 0) + 1;
    return {
        ...shot,
        imageGenerationPrompt: normalizedPrompt,
        promptVersion: nextVersion,
        promptHistory: normalizePromptHistory([...archived, ...history]).slice(0, SCRIPT_PROMPT_HISTORY_LIMIT),
        promptSource: source,
        promptSourceHash: nextHash,
        promptUpdatedAt: now,
    };
}

export function updateScriptPrompt(
    script: CanvasScriptV2,
    shotId: string,
    prompt: string,
    source: CanvasScriptPromptSource = "manual",
    now = Date.now(),
) {
    return {
        ...script,
        rows: script.rows.map((row) => (row.id === shotId ? withScriptShotPrompt(script, row, prompt, source, now) : row)),
    };
}

export function composeAllScriptPrompts(script: CanvasScriptV2, now = Date.now()) {
    let changed = false;
    const rows = script.rows.map((row) => {
        const prompt = buildScriptShotPrompt(script, row);
        if (!prompt) return row;
        const next = withScriptShotPrompt(script, row, prompt, "composed", now);
        if (next !== row) changed = true;
        return next;
    });
    return changed ? { ...script, rows } : script;
}

export function restoreScriptPrompt(script: CanvasScriptV2, shotId: string, version: number, now = Date.now()) {
    const shot = script.rows.find((row) => row.id === shotId);
    const target = normalizePromptHistory(shot?.promptHistory).find((entry) => entry.version === version);
    if (!shot || !target) return script;
    return updateScriptPrompt(script, shotId, target.prompt, "restored", now);
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
