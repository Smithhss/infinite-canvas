import { getThumbnailDimensions } from "@/lib/image-thumbnail";

export const VIDEO_POSTER_MAX_EDGE = 320;
export const VIDEO_POSTER_QUALITY = 0.75;
const VIDEO_POSTER_TIMEOUT_MS = 10_000;

export function videoPosterFrameTime(duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    return Math.min(0.1, duration / 2);
}

export async function createVideoPoster(source: string, maxEdge = VIDEO_POSTER_MAX_EDGE) {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = source;

    try {
        await waitForVideoData(video);
        const frameTime = videoPosterFrameTime(video.duration);
        if (frameTime > 0) await seekVideo(video, frameTime);

        const { width, height } = getThumbnailDimensions(video.videoWidth, video.videoHeight, maxEdge);
        if (!video.videoWidth || !video.videoHeight) return undefined;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return undefined;
        context.drawImage(video, 0, 0, width, height);
        return await canvasToBlob(canvas);
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
    }
}

function waitForVideoData(video: HTMLVideoElement) {
    return new Promise<void>((resolve, reject) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
        const timer = window.setTimeout(() => finish(new Error("Video poster timeout")), VIDEO_POSTER_TIMEOUT_MS);
        const finish = (error?: Error) => {
            window.clearTimeout(timer);
            video.removeEventListener("loadeddata", onReady);
            video.removeEventListener("error", onError);
            if (error) reject(error);
            else resolve();
        };
        const onReady = () => finish();
        const onError = () => finish(new Error("Video poster failed"));
        video.addEventListener("loadeddata", onReady, { once: true });
        video.addEventListener("error", onError, { once: true });
    });
}

function seekVideo(video: HTMLVideoElement, time: number) {
    return new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => finish(new Error("Video poster seek timeout")), VIDEO_POSTER_TIMEOUT_MS);
        const finish = (error?: Error) => {
            window.clearTimeout(timer);
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("error", onError);
            if (error) reject(error);
            else resolve();
        };
        const onSeeked = () => finish();
        const onError = () => finish(new Error("Video poster seek failed"));
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = time;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob | undefined>((resolve) => canvas.toBlob((blob) => resolve(blob || undefined), "image/webp", VIDEO_POSTER_QUALITY));
}
