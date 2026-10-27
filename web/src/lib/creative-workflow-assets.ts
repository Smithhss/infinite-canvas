export type WorkflowResultAssetInput = {
    title: string;
    storageKey: string;
    dataUrl: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
    source: string;
};

export function workflowResultToAsset(input: WorkflowResultAssetInput) {
    return {
        kind: "image" as const,
        title: input.title,
        coverUrl: input.dataUrl,
        tags: [] as string[],
        source: input.source,
        data: {
            dataUrl: input.dataUrl,
            storageKey: input.storageKey,
            width: input.width,
            height: input.height,
            bytes: input.bytes,
            mimeType: input.mimeType,
        },
        metadata: { source: "creative-workflow" },
    };
}
