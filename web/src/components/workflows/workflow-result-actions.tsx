import { Download, Images, LayoutDashboard } from "lucide-react";
import { App, Button, Image } from "antd";
import { saveAs } from "file-saver";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { createCanvasNode, imageMetadata } from "@/lib/canvas/canvas-node-factory";
import { workflowResultToAsset } from "@/lib/creative-workflow-assets";
import type { WorkflowGeneratedImage } from "@/lib/creative-workflow-runner";
import { uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useCanvasStore } from "@/stores/canvas/use-canvas-store";
import { CanvasNodeType } from "@/types/canvas";

export function WorkflowResultActions({
    images,
    workflowName,
    runId,
}: {
    images: WorkflowGeneratedImage[];
    workflowName: string;
    runId: string;
}) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const addAsset = useAssetStore((state) => state.addAsset);
    const createProject = useCanvasStore((state) => state.createProject);
    const updateProject = useCanvasStore((state) => state.updateProject);

    const saveAsset = async (image: WorkflowGeneratedImage, index: number) => {
        try {
            const stored = await uploadImage(image.dataUrl);
            if (!stored.storageKey) throw new Error("missing-storage-key");
            addAsset(workflowResultToAsset({
                title: `${workflowName} ${index + 1}`,
                storageKey: stored.storageKey,
                dataUrl: stored.url,
                width: stored.width,
                height: stored.height,
                bytes: stored.bytes,
                mimeType: stored.mimeType,
                source: `workflow:${runId}`,
            }));
            message.success(t("common.addedToAssets"));
        } catch {
            message.error(t("workflow.assetSaveFailed"));
        }
    };

    const addCanvas = async (image: WorkflowGeneratedImage) => {
        try {
            const stored = await uploadImage(image.dataUrl);
            const projectId = createProject(`${workflowName} · ${new Date().toLocaleDateString()}`);
            const node = createCanvasNode(CanvasNodeType.Image, { x: 0, y: 0 }, imageMetadata(stored));
            updateProject(projectId, { nodes: [node], connections: [] });
            navigate(`/canvas/${projectId}`);
        } catch {
            message.error(t("workflow.canvasAddFailed"));
        }
    };

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {images.map((image, index) => (
                <article key={image.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
                    <Image src={image.dataUrl} alt={`${workflowName} ${index + 1}`} className="aspect-square object-cover" />
                    <div className="space-y-3 p-3">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-stone-700 dark:text-stone-200">{workflowName} {index + 1}</p>
                            <p className="mt-1 truncate font-mono text-[10px] text-stone-400">{image.requestId || t("workflow.noRequestId")}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Button size="small" icon={<Images className="size-3.5" />} onClick={() => void saveAsset(image, index)}>{t("workflow.addAsset")}</Button>
                            <Button size="small" icon={<LayoutDashboard className="size-3.5" />} onClick={() => void addCanvas(image)}>{t("workflow.addCanvas")}</Button>
                            <Button size="small" type="text" icon={<Download className="size-3.5" />} aria-label={t("common.download")} onClick={() => saveAs(image.dataUrl, `${workflowName}-${index + 1}.png`)} />
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}
