import { AGENT_MAX_ATTACHMENT_PAYLOAD_BYTES, AGENT_MAX_ATTACHMENTS } from "@/lib/agent/agent-limits";
import { buildCanvasResourceReferences, type CanvasResourceReference } from "@/lib/canvas/canvas-resource-references";
import type { StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { getDataUrlByteSize, readImageMeta } from "@/lib/image-utils";
import { imageToDataUrl, previewUrlFor } from "@/services/image-storage";
import type { AgentAttachment } from "@/stores/use-agent-store";
import type { CanvasNodeData } from "@/types/canvas";

type StoryboardAgentTransferOptions = {
    attachments: AgentAttachment[];
    canvasReferences: CanvasResourceReference[];
};

export type StoryboardAgentTransferResult = {
    attachments: AgentAttachment[];
    canvasReferences: CanvasResourceReference[];
    addedAttachments: number;
    addedReferences: number;
    skippedImages: number;
    failedImages: number;
};

export async function buildStoryboardAgentTransfer(items: StoryboardItem[], nodes: CanvasNodeData[], options: StoryboardAgentTransferOptions): Promise<StoryboardAgentTransferResult> {
    const attachments = [...options.attachments];
    const attachmentIds = new Set(attachments.map((attachment) => attachment.id));
    const attachmentDataUrls = new Set(attachments.map((attachment) => attachment.dataUrl).filter(Boolean));
    let payloadBytes = attachments.reduce((total, item) => total + item.dataUrl.length, 0);
    let addedAttachments = 0;
    let skippedImages = 0;
    let failedImages = 0;

    for (const item of items.filter((candidate) => candidate.kind === "image")) {
        const attachmentId = `storyboard:${item.id}`;
        if (attachmentIds.has(attachmentId)) continue;
        if (attachments.length >= AGENT_MAX_ATTACHMENTS) {
            skippedImages += 1;
            continue;
        }
        const source = previewUrlFor(item.storageKey) || item.content || "";
        if (!source && !item.storageKey) {
            failedImages += 1;
            continue;
        }
        try {
            const dataUrl = await imageToDataUrl({ storageKey: item.storageKey, url: source });
            if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid image");
            if (attachmentDataUrls.has(dataUrl) || payloadBytes + dataUrl.length > AGENT_MAX_ATTACHMENT_PAYLOAD_BYTES) {
                skippedImages += 1;
                continue;
            }
            const meta = await readImageMeta(dataUrl);
            attachments.push({
                id: attachmentId,
                name: item.title,
                type: meta.mimeType,
                size: getDataUrlByteSize(dataUrl),
                width: item.width || meta.width,
                height: item.height || meta.height,
                url: dataUrl,
                dataUrl,
            });
            attachmentIds.add(attachmentId);
            attachmentDataUrls.add(dataUrl);
            payloadBytes += dataUrl.length;
            addedAttachments += 1;
        } catch {
            failedImages += 1;
        }
    }

    const selectedReferenceNodeIds = new Set(items.filter((item) => item.kind !== "image").map((item) => item.nodeId));
    const referencesByNode = new Map(options.canvasReferences.map((reference) => [reference.nodeId, reference]));
    let addedReferences = 0;
    for (const reference of buildCanvasResourceReferences(nodes)) {
        if (reference.kind === "image" || !selectedReferenceNodeIds.has(reference.nodeId) || referencesByNode.has(reference.nodeId)) continue;
        referencesByNode.set(reference.nodeId, reference);
        addedReferences += 1;
    }

    return {
        attachments,
        canvasReferences: [...referencesByNode.values()],
        addedAttachments,
        addedReferences,
        skippedImages,
        failedImages,
    };
}
