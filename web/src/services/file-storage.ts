import { nanoid } from "nanoid";

import { createAppStorageInstance } from "@/lib/localforage-storage";
import { createVideoPoster } from "@/lib/video-poster";
import { withLocalProxy } from "@/stores/use-config-store";

export type UploadedFile = { url: string; storageKey: string; bytes: number; mimeType: string; width?: number; height?: number; durationMs?: number };
type StoredVideoPoster = { version: number; blob?: Blob };

const store = createAppStorageInstance("media_files");
const posterStore = createAppStorageInstance("video_posters");
const objectUrls = new Map<string, string>();
const posterUrls = new Map<string, string>();
const posterListeners = new Set<() => void>();
const queuedPosters = new Set<string>();
const VIDEO_POSTER_VERSION = 1;
let posterRevision = 0;
let posterQueue: Promise<unknown> = Promise.resolve();

export async function uploadMediaFile(input: string | Blob, prefix = "file"): Promise<UploadedFile> {
    const blob = typeof input === "string" ? await (await fetch(withLocalProxy(input))).blob() : input;
    const storageKey = `${prefix}:${nanoid()}`;
    await store.setItem(storageKey, blob);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    const meta = blob.type.startsWith("video/") ? await readVideoMeta(url) : blob.type.startsWith("audio/") ? await readAudioMeta(url) : {};
    if (blob.type.startsWith("video/")) void queueVideoPoster(storageKey, url);
    return { url, storageKey, bytes: blob.size, mimeType: blob.type || "application/octet-stream", ...meta };
}

export async function resolveMediaUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = await store.getItem<Blob>(storageKey);
    if (!blob) return fallback;
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function getMediaBlob(storageKey: string) {
    return store.getItem<Blob>(storageKey);
}

export async function setMediaBlob(storageKey: string, blob: Blob) {
    await deleteVideoPoster(storageKey);
    await store.setItem(storageKey, blob);
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    if (blob.type.startsWith("video/")) void queueVideoPoster(storageKey, url);
    return url;
}

export async function deleteStoredMedia(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            await deleteVideoPoster(key);
            await store.removeItem(key);
        }),
    );
}

export async function cleanupUnusedMedia(usedData: unknown) {
    const usedKeys = collectMediaStorageKeys(usedData);
    const unused: string[] = [];
    await store.iterate((_value, key) => {
        if (!usedKeys.has(key)) unused.push(key);
    });
    const orphanPosters: string[] = [];
    await posterStore.iterate((_value, key) => {
        if (!usedKeys.has(key)) orphanPosters.push(key);
    });
    await Promise.all([...unused.map((key) => store.removeItem(key)), ...orphanPosters.map(deleteVideoPoster)]);
}

export function collectMediaStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.includes(":")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectMediaStorageKeys(child, keys)) : collectMediaStorageKeys(item, keys)));
    return keys;
}

export function videoPosterUrlFor(storageKey?: string) {
    return storageKey ? posterUrls.get(storageKey) : undefined;
}

export function subscribeVideoPosters(listener: () => void) {
    posterListeners.add(listener);
    return () => {
        posterListeners.delete(listener);
    };
}

export function getVideoPosterRevision() {
    return posterRevision;
}

export async function ensureVideoPoster(storageKey?: string) {
    if (!storageKey) return undefined;
    const cached = posterUrls.get(storageKey);
    if (cached) return cached;
    const stored = await posterStore.getItem<StoredVideoPoster>(storageKey).catch(() => null);
    if (stored?.version === VIDEO_POSTER_VERSION) return stored.blob ? cacheVideoPoster(storageKey, stored.blob) : undefined;
    queueVideoPoster(storageKey);
    return undefined;
}

function queueVideoPoster(storageKey: string, source?: string) {
    if (queuedPosters.has(storageKey)) return;
    queuedPosters.add(storageKey);
    posterQueue = posterQueue
        .then(async () => {
            const videoUrl = source || (await resolveMediaUrl(storageKey));
            const blob = videoUrl ? await createVideoPoster(videoUrl).catch(() => undefined) : undefined;
            await posterStore.setItem<StoredVideoPoster>(storageKey, { version: VIDEO_POSTER_VERSION, blob }).catch(() => undefined);
            if (blob) cacheVideoPoster(storageKey, blob);
        })
        .catch(() => undefined)
        .finally(() => queuedPosters.delete(storageKey));
}

function cacheVideoPoster(storageKey: string, blob: Blob) {
    const previous = posterUrls.get(storageKey);
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(blob);
    posterUrls.set(storageKey, url);
    posterRevision += 1;
    posterListeners.forEach((listener) => listener());
    return url;
}

async function deleteVideoPoster(storageKey: string) {
    const url = posterUrls.get(storageKey);
    if (url) URL.revokeObjectURL(url);
    posterUrls.delete(storageKey);
    await posterStore.removeItem(storageKey).catch(() => undefined);
    posterRevision += 1;
    posterListeners.forEach((listener) => listener());
}

function readVideoMeta(url: string) {
    return new Promise<{ width: number; height: number; durationMs?: number }>((resolve) => {
        const video = document.createElement("video");
        const done = () => resolve({ width: video.videoWidth || 1280, height: video.videoHeight || 720, durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : undefined });
        video.onloadedmetadata = done;
        video.onerror = done;
        video.src = url;
    });
}

function readAudioMeta(url: string) {
    return new Promise<{ durationMs?: number }>((resolve) => {
        const audio = document.createElement("audio");
        const done = () => resolve({ durationMs: Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : undefined });
        audio.onloadedmetadata = done;
        audio.onerror = done;
        audio.src = url;
    });
}
