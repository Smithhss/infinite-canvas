import type { ModelCapability, ModelChannel } from "@/stores/use-config-store";

export type VideoModelMode = "text-to-video" | "image-to-video" | "first-last-frame" | "reference-video" | "reference-audio";

export type VideoModelCapabilities = {
    modes: VideoModelMode[];
    maxReferenceImages: number;
    supportsMultiShot: boolean;
    supportsAudio: boolean;
    supportsWatermark: boolean;
    supportsNegativePrompt: boolean;
    maxSeconds: number;
};

export type VideoModelCapabilitiesOverride = Partial<VideoModelCapabilities>;

type VideoCapabilityConfig = {
    channels: Array<
        Pick<ModelChannel, "id"> & {
            models: Array<{
                name: string;
                capability?: ModelCapability;
                videoCapabilities?: VideoModelCapabilitiesOverride;
            }>;
        }
    >;
};

export const VIDEO_MODES: VideoModelMode[] = ["text-to-video", "image-to-video", "first-last-frame", "reference-video", "reference-audio"];
const CHANNEL_MODEL_SEPARATOR = "::";

export function defaultVideoModelCapabilities(): VideoModelCapabilities {
    return {
        modes: ["text-to-video"],
        maxReferenceImages: 0,
        supportsMultiShot: false,
        supportsAudio: false,
        supportsWatermark: false,
        supportsNegativePrompt: false,
        maxSeconds: 6,
    };
}

/**
 * Model names are hints, not proof of provider support. Unknown names stay on the
 * minimal capability set and every request must still be validated server-side.
 */
export function inferVideoModelCapabilities(modelName: string): VideoModelCapabilities {
    const name = modelName.toLowerCase();
    if (name.includes("kling")) {
        return {
            modes: ["text-to-video", "image-to-video", "first-last-frame", "reference-video"],
            maxReferenceImages: 4,
            supportsMultiShot: true,
            supportsAudio: /v2[.-]?6|kling-v26/.test(name),
            supportsWatermark: true,
            supportsNegativePrompt: true,
            maxSeconds: 10,
        };
    }
    if (name.includes("seedance")) {
        return {
            modes: ["text-to-video", "image-to-video", "first-last-frame", "reference-video"],
            maxReferenceImages: 4,
            supportsMultiShot: false,
            supportsAudio: false,
            supportsWatermark: false,
            supportsNegativePrompt: false,
            maxSeconds: 12,
        };
    }
    if (name.includes("veo")) {
        return {
            modes: ["text-to-video", "image-to-video"],
            maxReferenceImages: 1,
            supportsMultiShot: false,
            supportsAudio: false,
            supportsWatermark: false,
            supportsNegativePrompt: false,
            maxSeconds: 8,
        };
    }
    if (name.includes("hailuo") || name.includes("minimax")) {
        return {
            modes: ["text-to-video", "image-to-video"],
            maxReferenceImages: 1,
            supportsMultiShot: false,
            supportsAudio: false,
            supportsWatermark: false,
            supportsNegativePrompt: false,
            maxSeconds: 10,
        };
    }
    return defaultVideoModelCapabilities();
}

export function resolveVideoCapabilities(config: VideoCapabilityConfig, modelValue: string): VideoModelCapabilities {
    const { channelId, modelName } = splitModelValue(modelValue);
    const channel = channelId ? config.channels.find((item) => item.id === channelId) : config.channels.find((item) => item.models.some((model) => model.name === modelName));
    const selectedModel = channel?.models.find((model) => model.name === modelName);
    const inferred = inferVideoModelCapabilities(selectedModel?.name || modelName);
    if (!selectedModel?.videoCapabilities) return inferred;
    return mergeVideoCapabilities(inferred, selectedModel.videoCapabilities);
}

function splitModelValue(value: string) {
    const normalized = value.trim();
    const index = normalized.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return { channelId: "", modelName: normalized };
    return {
        channelId: normalized.slice(0, index),
        modelName: normalized.slice(index + CHANNEL_MODEL_SEPARATOR.length),
    };
}

function mergeVideoCapabilities(base: VideoModelCapabilities, override: VideoModelCapabilitiesOverride): VideoModelCapabilities {
    return {
        modes: normalizeModes(override.modes ?? base.modes),
        maxReferenceImages: normalizeInteger(override.maxReferenceImages, base.maxReferenceImages, 0, 20),
        supportsMultiShot: override.supportsMultiShot ?? base.supportsMultiShot,
        supportsAudio: override.supportsAudio ?? base.supportsAudio,
        supportsWatermark: override.supportsWatermark ?? base.supportsWatermark,
        supportsNegativePrompt: override.supportsNegativePrompt ?? base.supportsNegativePrompt,
        maxSeconds: normalizeInteger(override.maxSeconds, base.maxSeconds, 1, 30),
    };
}

function normalizeModes(modes: VideoModelMode[]) {
    const selected = new Set(modes.filter((mode) => VIDEO_MODES.includes(mode)));
    return VIDEO_MODES.filter((mode) => selected.has(mode));
}

function normalizeInteger(value: number | undefined, fallback: number, min: number, max: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(value as number)));
}
