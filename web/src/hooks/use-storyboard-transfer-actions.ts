import { useCallback, useState } from "react";
import { App } from "antd";
import { useTranslation } from "react-i18next";

import { exportStoryboardItems } from "@/lib/canvas/canvas-export";
import { buildStoryboardAgentTransfer } from "@/lib/canvas/storyboard-agent-transfer";
import type { StoryboardItem } from "@/lib/canvas/storyboard-projection";
import { useAgentStore } from "@/stores/use-agent-store";
import type { CanvasNodeData } from "@/types/canvas";

export function useStoryboardTransferActions(nodes: CanvasNodeData[]) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const [exporting, setExporting] = useState(false);
    const [addingToAgent, setAddingToAgent] = useState(false);

    const exportItems = useCallback(
        async (items: StoryboardItem[]) => {
            if (!items.length || exporting) return;
            setExporting(true);
            const hide = message.loading(t("canvas.storyboard.exporting"), 0);
            try {
                const result = await exportStoryboardItems(items, t("canvas.storyboard.exportName", { count: items.length }));
                if (!result.exported) {
                    message.warning(t("canvas.storyboard.exportNone", { count: result.failed }));
                } else if (result.failed) {
                    message.warning(t("canvas.storyboard.exportedPartial", { exported: result.exported, failed: result.failed }));
                } else {
                    message.success(t("canvas.storyboard.exported", { count: result.exported }));
                }
            } catch (error) {
                console.error(error);
                message.error(t("canvas.storyboard.exportFailed"));
            } finally {
                hide();
                setExporting(false);
            }
        },
        [exporting, message, t],
    );

    const addToAgent = useCallback(
        async (items: StoryboardItem[]) => {
            if (!items.length || addingToAgent) return;
            setAddingToAgent(true);
            const hide = message.loading(t("canvas.storyboard.addingToAgent"), 0);
            try {
                const state = useAgentStore.getState();
                const result = await buildStoryboardAgentTransfer(items, nodes, { attachments: state.attachments, canvasReferences: state.canvasReferences });
                if (!result.addedAttachments && !result.addedReferences) {
                    message.warning(t("canvas.storyboard.noAgentAssets"));
                } else {
                    const newReferences = result.canvasReferences.filter((reference) => !state.canvasReferences.some((current) => current.nodeId === reference.nodeId));
                    const referenceMarkers = newReferences.map((reference) => `@${reference.label}`).join(" ");
                    const prompt = [state.prompt.trim(), referenceMarkers].filter(Boolean).join(" ");
                    state.setAgentState({ attachments: result.attachments, canvasReferences: result.canvasReferences, prompt, activeTab: "chat" });
                    state.openPanel();
                    message.success(t("canvas.storyboard.addedToAgent", { attachments: result.addedAttachments, references: result.addedReferences }));
                }
                if (result.skippedImages) message.warning(t("canvas.storyboard.agentImagesSkipped", { count: result.skippedImages }));
                if (result.failedImages) message.warning(t("canvas.storyboard.agentImagesFailed", { count: result.failedImages }));
            } catch (error) {
                console.error(error);
                message.error(t("canvas.storyboard.addToAgentFailed"));
            } finally {
                hide();
                setAddingToAgent(false);
            }
        },
        [addingToAgent, message, nodes, t],
    );

    return { addToAgent, addingToAgent, exportItems, exporting };
}
