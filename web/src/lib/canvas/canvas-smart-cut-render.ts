import { normalizeSmartCutClips, type SmartCutClip } from "@/lib/canvas/canvas-smart-cut";

export type SmartCutRenderResult = {
    blob: Blob;
    mimeType: string;
    extension: "webm" | "mp4";
    width: number;
    height: number;
    durationMs: number;
};

export async function probeSmartCutVideoDuration(src: string) {
    const video = createVideoElement(src, true);
    try {
        await loadVideoMetadata(video);
        return Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
    } finally {
        releaseVideo(video);
    }
}

export async function renderSmartCutVideo({ clips, signal, onProgress }: { clips: SmartCutClip[]; signal?: AbortSignal; onProgress?: (progress: number) => void }): Promise<SmartCutRenderResult> {
    const normalized = normalizeSmartCutClips(clips);
    if (!normalized.length) throw new Error("smart-cut-empty");
    if (typeof MediaRecorder === "undefined") throw new Error("smart-cut-unsupported");

    const firstVideo = createVideoElement(normalized[0].src);
    await loadVideoMetadata(firstVideo);
    const { width, height } = outputSize(firstVideo.videoWidth, firstVideo.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("smart-cut-unsupported");

    const stream = canvas.captureStream(30);
    const audioMixer = await createAudioMixer();
    if (audioMixer) stream.addTrack(audioMixer.destination.stream.getAudioTracks()[0]);
    const mimeType = supportedMimeType();
    const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 5_000_000,
        audioBitsPerSecond: 128_000,
    });
    const chunks: BlobPart[] = [];
    recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
    });
    const stopped = new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" })), { once: true });
        recorder.addEventListener("error", () => reject(new Error("smart-cut-recorder-failed")), { once: true });
    });

    let currentVideo = firstVideo;
    let elapsedMs = 0;
    const totalMs = normalized.reduce((total, clip) => total + clip.endMs - clip.startMs, 0);
    try {
        await audioMixer?.context.resume();
        recorder.start(250);
        for (let index = 0; index < normalized.length; index += 1) {
            if (signal?.aborted) throw abortError();
            const clip = normalized[index];
            if (index > 0) {
                currentVideo = createVideoElement(clip.src);
                await loadVideoMetadata(currentVideo);
            }
            await seekVideo(currentVideo, clip.startMs);
            const audioSource = audioMixer?.connect(currentVideo) || null;
            if (!audioSource) currentVideo.muted = true;
            await currentVideo.play();
            await drawVideoClip(
                context,
                currentVideo,
                clip,
                width,
                height,
                (clipTimeMs) => {
                    onProgress?.(Math.min(1, (elapsedMs + clipTimeMs) / totalMs));
                },
                signal,
            );
            currentVideo.pause();
            audioSource?.disconnect();
            elapsedMs += clip.endMs - clip.startMs;
            drawContainedVideo(context, currentVideo, width, height);
            onProgress?.(Math.min(1, elapsedMs / totalMs));
            if (index < normalized.length - 1) releaseVideo(currentVideo);
        }
        await wait(80);
        recorder.stop();
        const blob = await stopped;
        if (!blob.size) throw new Error("smart-cut-empty-output");
        return {
            blob,
            mimeType: blob.type || mimeType || "video/webm",
            extension: blob.type.includes("mp4") ? "mp4" : "webm",
            width,
            height,
            durationMs: totalMs,
        };
    } finally {
        if (recorder.state !== "inactive") recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
        releaseVideo(firstVideo);
        if (currentVideo !== firstVideo) releaseVideo(currentVideo);
        await audioMixer?.close();
    }
}

function createVideoElement(src: string, metadataOnly = false) {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = metadataOnly ? "metadata" : "auto";
    video.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    video.src = src;
    video.load();
    return video;
}

function releaseVideo(video: HTMLVideoElement) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
}

function loadVideoMetadata(video: HTMLVideoElement) {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
    const loaded = waitForVideoEvent(video, "loadedmetadata");
    video.load();
    return loaded;
}

function seekVideo(video: HTMLVideoElement, timeMs: number) {
    const time = Math.max(0, timeMs / 1000);
    if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
    if (time <= 0 && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        const loaded = waitForVideoEvent(video, "loadeddata");
        video.currentTime = 0;
        return loaded;
    }
    const seeked = waitForVideoEvent(video, "seeked");
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.001));
    return seeked;
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "seeked") {
    return new Promise<void>((resolve, reject) => {
        const finish = () => {
            cleanup();
            resolve();
        };
        const fail = () => {
            cleanup();
            reject(new Error("smart-cut-video-load-failed"));
        };
        const cleanup = () => {
            video.removeEventListener(eventName, finish);
            video.removeEventListener("error", fail);
        };
        video.addEventListener(eventName, finish, { once: true });
        video.addEventListener("error", fail, { once: true });
    });
}

function drawVideoClip(context: CanvasRenderingContext2D, video: HTMLVideoElement, clip: SmartCutClip, width: number, height: number, onTime: (timeMs: number) => void, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        let frame = 0;
        const finish = () => {
            cancelAnimationFrame(frame);
            resolve();
        };
        const draw = () => {
            if (signal?.aborted) {
                cancelAnimationFrame(frame);
                reject(abortError());
                return;
            }
            drawContainedVideo(context, video, width, height);
            const timeMs = video.currentTime * 1000;
            onTime(Math.max(0, timeMs - clip.startMs));
            if (video.ended || timeMs >= clip.endMs - 16) {
                finish();
                return;
            }
            frame = requestAnimationFrame(draw);
        };
        video.addEventListener("error", () => reject(new Error("smart-cut-playback-failed")), { once: true });
        draw();
    });
}

function drawContainedVideo(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function outputSize(sourceWidth: number, sourceHeight: number) {
    const safeWidth = sourceWidth || 1280;
    const safeHeight = sourceHeight || 720;
    const scale = Math.min(1280 / safeWidth, 720 / safeHeight, 1);
    return {
        width: even(Math.max(2, Math.round(safeWidth * scale))),
        height: even(Math.max(2, Math.round(safeHeight * scale))),
    };
}

function even(value: number) {
    return value % 2 === 0 ? value : value - 1;
}

function supportedMimeType() {
    const candidates = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

async function createAudioMixer() {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return null;
    try {
        const context = new AudioContextCtor();
        const destination = context.createMediaStreamDestination();
        return {
            context,
            destination,
            connect(video: HTMLVideoElement) {
                try {
                    const source = context.createMediaElementSource(video);
                    source.connect(destination);
                    return source;
                } catch {
                    return null;
                }
            },
            close: () => (context.state === "closed" ? Promise.resolve() : context.close()),
        };
    } catch {
        return null;
    }
}

function abortError() {
    return new DOMException("Smart cut canceled", "AbortError");
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
