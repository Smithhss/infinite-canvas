import type { CanvasGenerationReference } from "@/types/canvas";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

type ReferenceInput = {
    images?: ReferenceImage[];
    videos?: ReferenceVideo[];
    audios?: ReferenceAudio[];
};

export function buildGenerationReferences(input: ReferenceInput): CanvasGenerationReference[] {
    return [
        ...(input.images || []).flatMap((image) => reference("image", image.name, image.storageKey, image.url)),
        ...(input.videos || []).flatMap((video) => reference("video", video.name, video.storageKey, video.url)),
        ...(input.audios || []).flatMap((audio) => reference("audio", audio.name, audio.storageKey, audio.url)),
    ];
}

function reference(kind: CanvasGenerationReference["kind"], title: string, storageKey?: string, url?: string): CanvasGenerationReference[] {
    const persistedUrl = url && !/^(blob|data):/.test(url) ? url : undefined;
    return [{ kind, title, ...(storageKey ? { storageKey } : {}), ...(persistedUrl ? { url: persistedUrl } : {}) }];
}
