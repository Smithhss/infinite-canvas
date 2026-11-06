import {
    CanvasNodeType,
    type CanvasGenerationReference,
    type CanvasImageGenerationType,
    type CanvasNodeData,
    type CanvasNodeMetadata,
    type CanvasNodeStatus,
    type CanvasScriptV2,
    type CanvasStoryboardCategory,
} from "@/types/canvas";

export type StoryboardItemKind = "script" | "text" | "image" | "video";

export type StoryboardGeneration = {
    type?: CanvasImageGenerationType;
    size?: string;
    quality?: string;
    count?: number;
    background?: string;
    seconds?: string;
    vquality?: string;
    generateAudio?: string;
    watermark?: string;
    videoMode?: string;
    references: CanvasGenerationReference[];
};

export type StoryboardItem = {
    id: string;
    nodeId: string;
    kind: StoryboardItemKind;
    title: string;
    groupTitle?: string;
    status: CanvasNodeStatus;
    content?: string;
    storageKey?: string;
    prompt?: string;
    model?: string;
    width?: number;
    height?: number;
    durationMs?: number;
    isPrimary?: boolean;
    category: CanvasStoryboardCategory;
    generation?: StoryboardGeneration;
    script?: CanvasScriptV2;
};

export type StoryboardProjection = {
    script: StoryboardItem[];
    text: StoryboardItem[];
    image: StoryboardItem[];
    video: StoryboardItem[];
};

function primaryText(node: CanvasNodeData) {
    return node.metadata?.texts?.find((item) => item.id === node.metadata?.primaryTextId)?.content || node.metadata?.content || node.metadata?.prompt || "";
}

function isEmptyIdle(status: CanvasNodeStatus | undefined, content: string | undefined) {
    return !content && (!status || status === "idle");
}

export function storyboardGenerationReferences(metadata: CanvasNodeMetadata | undefined) {
    if (metadata?.generationReferences?.length) return metadata.generationReferences;
    return (metadata?.references || []).map((reference): CanvasGenerationReference => {
        const storageKey = /^(image|video|audio|text|file):/.test(reference);
        const mediaUrl = reference.match(/\.(mp4|webm|mov|mp3|wav|ogg)(?:[?#]|$)/i)?.[1]?.toLowerCase();
        const kind =
            reference.startsWith("video:") || (mediaUrl && ["mp4", "webm", "mov"].includes(mediaUrl))
                ? "video"
                : reference.startsWith("audio:") || (mediaUrl && ["mp3", "wav", "ogg"].includes(mediaUrl))
                  ? "audio"
                  : reference.startsWith("text:")
                    ? "text"
                    : "image";
        return storageKey ? { kind, storageKey: reference } : { kind, url: reference };
    });
}

function generationDetails(metadata: CanvasNodeMetadata | undefined): StoryboardGeneration | undefined {
    if (!metadata) return undefined;
    const references = storyboardGenerationReferences(metadata);
    const details: StoryboardGeneration = {
        type: metadata.generationType,
        size: metadata.size,
        quality: metadata.quality,
        count: metadata.count,
        background: metadata.background,
        seconds: metadata.seconds,
        vquality: metadata.vquality,
        generateAudio: metadata.generateAudio,
        watermark: metadata.watermark,
        videoMode: metadata.videoMode,
        references,
    };
    return Object.values(details).some((value) => (Array.isArray(value) ? value.length : value !== undefined)) ? details : undefined;
}

export function buildStoryboardProjection(nodes: CanvasNodeData[]): StoryboardProjection {
    const groups = new Map(nodes.filter((node) => node.type === CanvasNodeType.Group).map((node) => [node.id, node.title]));
    const projection: StoryboardProjection = { script: [], text: [], image: [], video: [] };

    for (const node of nodes) {
        if (node.type === CanvasNodeType.Group) continue;
        const groupTitle = node.metadata?.groupId ? groups.get(node.metadata.groupId) : undefined;
        const prompt = node.metadata?.prompt || undefined;
        const status = node.metadata?.status || "idle";
        const category = node.metadata?.storyboardCategory || "other";

        if (node.type === CanvasNodeType.Script) {
            const script = node.metadata?.scriptV2;
            const content = [
                script?.originalStoryText,
                ...(script?.rows || []).flatMap((row) => [
                    row.plotDescription,
                    ...(row.characters || []),
                    row.videoReference,
                    row.shotSize,
                    row.emotion,
                    ...(row.propTags || []),
                    row.cameraMovement,
                    row.dialogue,
                    row.lightingAndAtmosphere,
                    row.audioEffects,
                    row.imageGenerationPrompt,
                    row.videoMotionPrompt,
                    row.imageToVideoMotionPrompt,
                ]),
            ]
                .filter(Boolean)
                .join("\n");
            projection.script.push({
                id: node.id,
                nodeId: node.id,
                kind: "script",
                title: node.title,
                groupTitle,
                status,
                content,
                prompt,
                model: node.metadata?.model,
                category,
                script,
            });
            continue;
        }

        if (node.type === CanvasNodeType.Text) {
            const content = primaryText(node);
            if (!content && status === "idle") continue;
            projection.text.push({
                id: node.id,
                nodeId: node.id,
                kind: "text",
                title: node.title,
                groupTitle,
                status: node.metadata?.texts?.find((item) => item.id === node.metadata?.primaryTextId)?.status || status,
                content,
                prompt,
                model: node.metadata?.model,
                category,
                generation: generationDetails(node.metadata),
            });
            continue;
        }

        if (node.type === CanvasNodeType.Image) {
            const images = node.metadata?.images || [];
            if (images.length) {
                images.forEach((image, index) => {
                    projection.image.push({
                        id: `${node.id}:${image.id}`,
                        nodeId: node.id,
                        kind: "image",
                        title: node.title || `${index + 1}`,
                        groupTitle,
                        status: image.status,
                        content: image.content || undefined,
                        storageKey: image.storageKey,
                        prompt,
                        model: node.metadata?.model,
                        width: image.naturalWidth || node.metadata?.naturalWidth,
                        height: image.naturalHeight || node.metadata?.naturalHeight,
                        isPrimary: image.id === node.metadata?.primaryImageId,
                        category,
                        generation: generationDetails(node.metadata),
                    });
                });
            } else {
                const content = node.metadata?.content;
                if (isEmptyIdle(status, content)) continue;
                projection.image.push({
                    id: node.id,
                    nodeId: node.id,
                    kind: "image",
                    title: node.title,
                    groupTitle,
                    status,
                    content: content || undefined,
                    storageKey: node.metadata?.storageKey,
                    prompt,
                    model: node.metadata?.model,
                    width: node.metadata?.naturalWidth,
                    height: node.metadata?.naturalHeight,
                    isPrimary: true,
                    category,
                    generation: generationDetails(node.metadata),
                });
            }
            continue;
        }

        if (node.type === CanvasNodeType.Video) {
            const content = node.metadata?.content;
            if (isEmptyIdle(status, content)) continue;
            projection.video.push({
                id: node.id,
                nodeId: node.id,
                kind: "video",
                title: node.title,
                groupTitle,
                status,
                content: content || undefined,
                storageKey: node.metadata?.storageKey,
                prompt,
                model: node.metadata?.model,
                width: node.metadata?.naturalWidth,
                height: node.metadata?.naturalHeight,
                durationMs: node.metadata?.durationMs,
                category,
                generation: generationDetails(node.metadata),
            });
        }
    }

    return projection;
}

export function filterStoryboardItems(items: StoryboardItem[], keyword: string, status: CanvasNodeStatus | "all") {
    const query = keyword.trim().toLowerCase();
    return items.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!query) return true;
        return [item.title, item.groupTitle, item.content, item.prompt, item.model, JSON.stringify(item.script?.rows || [])].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
}
