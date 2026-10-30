export const DIRECTOR_PROJECT_VERSION = 1 as const;
export const DIRECTOR_MAX_OBJECTS = 40;
export const DIRECTOR_MAX_CAPTURE_BYTES = 20 * 1024 * 1024;

export type DirectorVector3 = {
    x: number;
    y: number;
    z: number;
};

export type DirectorCamera = {
    position: DirectorVector3;
    target: DirectorVector3;
};

export type DirectorObjectKind = "box" | "sphere" | "cylinder" | "cone";
export type DirectorBackground = "studio" | "night" | "sunset";

export type DirectorObject = {
    id: string;
    kind: DirectorObjectKind;
    position: DirectorVector3;
    rotationY: number;
    scale: number;
    color: string;
};

export type DirectorProjectState = {
    version: typeof DIRECTOR_PROJECT_VERSION;
    camera: DirectorCamera;
    objects: DirectorObject[];
    background: DirectorBackground;
};

const objectKinds = new Set<DirectorObjectKind>(["box", "sphere", "cylinder", "cone"]);
const backgrounds = new Set<DirectorBackground>(["studio", "night", "sunset"]);
const hexColor = /^#[0-9a-f]{6}$/i;
const objectId = /^[a-z0-9_-]{1,64}$/i;

export function normalizeDirectorColor(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const color = value.trim();
    if (hexColor.test(color)) return color.toLowerCase();

    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!rgb) return null;
    const channels = rgb.slice(1).map(Number);
    if (channels.some((channel) => channel > 255)) return null;
    return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function createDirectorProject(): DirectorProjectState {
    return {
        version: DIRECTOR_PROJECT_VERSION,
        camera: {
            position: { x: 8, y: 5.5, z: 10 },
            target: { x: 0, y: 0.8, z: 0 },
        },
        objects: [],
        background: "studio",
    };
}

export function normalizeDirectorProject(value: unknown): DirectorProjectState {
    const fallback = createDirectorProject();
    if (!value || typeof value !== "object") return fallback;
    const source = value as Partial<DirectorProjectState>;
    const camera = source.camera && typeof source.camera === "object" ? source.camera : fallback.camera;
    const objects = Array.isArray(source.objects) ? source.objects.slice(0, DIRECTOR_MAX_OBJECTS).flatMap((item, index) => normalizeObject(item, index)) : [];

    return {
        version: DIRECTOR_PROJECT_VERSION,
        camera: {
            position: normalizeVector(camera.position, { x: 24, y: 16, z: 24 }, fallback.camera.position),
            target: normalizeVector(camera.target, { x: 12, y: 8, z: 12 }, fallback.camera.target),
        },
        objects,
        background: backgrounds.has(source.background as DirectorBackground) ? (source.background as DirectorBackground) : fallback.background,
    };
}

export function createDirectorObject(kind: DirectorObjectKind, index: number): DirectorObject {
    const safeIndex = Math.max(0, Math.floor(index));
    return {
        id: `${kind}-${Date.now().toString(36)}-${safeIndex}`,
        kind,
        position: { x: (safeIndex % 5) - 2, y: kind === "sphere" ? 0.8 : 1, z: Math.floor(safeIndex / 5) - 1 },
        rotationY: 0,
        scale: 1,
        color: ["#f97316", "#38bdf8", "#a3e635", "#f472b6"][safeIndex % 4],
    };
}

export function isValidDirectorCapture(dataUrl: string) {
    if (!/^data:image\/png;base64,[a-z0-9+/=\r\n]+$/i.test(dataUrl)) return false;
    const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return Math.floor((payload.length * 3) / 4) <= DIRECTOR_MAX_CAPTURE_BYTES;
}

function normalizeObject(value: unknown, index: number): DirectorObject[] {
    if (!value || typeof value !== "object") return [];
    const source = value as Partial<DirectorObject>;
    const kind = objectKinds.has(source.kind as DirectorObjectKind) ? (source.kind as DirectorObjectKind) : "box";
    const id = typeof source.id === "string" && objectId.test(source.id) ? source.id : `${kind}-${index + 1}`;
    return [
        {
            id,
            kind,
            position: normalizeVector(source.position, { x: 8, y: 6, z: 8 }, { x: 8, y: 6, z: 8 }, 0),
            rotationY: clampNumber(source.rotationY, -180, 180, 0),
            scale: clampNumber(source.scale, 0.2, 3, 1),
            color: normalizeDirectorColor(source.color) ?? "#f97316",
        },
    ];
}

function normalizeVector(value: unknown, limit: DirectorVector3, fallback: DirectorVector3, yMin = -8): DirectorVector3 {
    const source = value && typeof value === "object" ? (value as Partial<DirectorVector3>) : {};
    return {
        x: clampNumber(source.x, -limit.x, limit.x, fallback.x),
        y: clampNumber(source.y, yMin, limit.y, fallback.y),
        z: clampNumber(source.z, -limit.z, limit.z, fallback.z),
    };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
