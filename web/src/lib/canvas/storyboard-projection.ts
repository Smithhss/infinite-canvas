import { CanvasNodeType, type CanvasNodeData, type CanvasNodeStatus, type CanvasScriptV2, type CanvasStoryboardCategory } from "@/types/canvas";

export type StoryboardItemKind = "script" | "text" | "image" | "video";

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
