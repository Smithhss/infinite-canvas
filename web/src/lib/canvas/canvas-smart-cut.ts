export const SMART_CUT_MIN_CLIP_MS = 100;
export const SMART_CUT_MAX_CLIPS = 12;

export type SmartCutClip = {
    id: string;
    sourceId?: string;
    title: string;
    src: string;
    durationMs: number;
    startMs: number;
    endMs: number;
};

export function normalizeSmartCutClip(clip: SmartCutClip): SmartCutClip | null {
    const durationMs = Math.max(0, Math.round(clip.durationMs));
    if (durationMs < SMART_CUT_MIN_CLIP_MS) return null;
    const startMs = clamp(Math.round(clip.startMs), 0, Math.max(0, durationMs - SMART_CUT_MIN_CLIP_MS));
    const endMs = clamp(Math.round(clip.endMs), startMs + SMART_CUT_MIN_CLIP_MS, durationMs);
    if (endMs - startMs < SMART_CUT_MIN_CLIP_MS) return null;
    return { ...clip, durationMs, startMs, endMs };
}

export function normalizeSmartCutClips(clips: SmartCutClip[]) {
    return clips.slice(0, SMART_CUT_MAX_CLIPS).flatMap((clip) => {
        const normalized = normalizeSmartCutClip(clip);
        return normalized ? [normalized] : [];
    });
}

export function smartCutDurationMs(clips: SmartCutClip[]) {
    return normalizeSmartCutClips(clips).reduce((total, clip) => total + clip.endMs - clip.startMs, 0);
}

export function moveSmartCutClip(clips: SmartCutClip[], index: number, delta: -1 | 1) {
    const target = index + delta;
    if (index < 0 || index >= clips.length || target < 0 || target >= clips.length) return clips;
    const next = [...clips];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function formatSmartCutTime(value: number) {
    const totalMs = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalMs / 60_000);
    const seconds = Math.floor((totalMs % 60_000) / 1000);
    const tenths = Math.floor((totalMs % 1000) / 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
