import { App, Button, Drawer, Tag } from "antd";
import { History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { executeWorkflow, type WorkflowRun } from "@/lib/creative-workflow-runner";
import { createWorkflowImageAdapter } from "@/services/api/creative-workflow";
import { resolveImageUrl } from "@/services/image-storage";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useWorkflowStore } from "@/stores/use-workflow-store";
import type { ReferenceImage } from "@/types/image";

const STATUS_COLOR: Record<WorkflowRun["status"], string> = {
    queued: "default",
    running: "processing",
    succeeded: "success",
    partial: "warning",
    failed: "error",
    canceled: "default",
};

export function WorkflowRunHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const runs = useWorkflowStore((state) => state.runs);
    const workflows = useWorkflowStore((state) => state.workflows);
    const appendRun = useWorkflowStore((state) => state.appendRun);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const retry = async (run: WorkflowRun) => {
        const template = workflows.find((item) => item.id === run.templateId);
        if (!template) {
            message.error(t("workflow.templateMissing"));
            return;
        }
        const model = template.model || effectiveConfig.imageModel || effectiveConfig.model;
        if (!isAiConfigReady(effectiveConfig, model)) {
            message.warning(t("workflow.modelNotConfigured"));
            openConfigDialog(true);
            return;
        }
        setRetryingId(run.id);
        try {
            const references = await Promise.all(run.referenceKeys.map(async (storageKey, index): Promise<ReferenceImage | null> => {
                const dataUrl = await resolveImageUrl(storageKey, "");
                return dataUrl ? { id: `retry-${index}`, name: `reference-${index + 1}.png`, type: "image/png", dataUrl, storageKey } : null;
            }));
            if (references.some((reference) => !reference)) throw new Error(t("workflow.referenceMissing"));
            const next = await executeWorkflow({
                template,
                values: run.inputs,
                references: references.filter((reference): reference is ReferenceImage => Boolean(reference)),
                adapter: createWorkflowImageAdapter(effectiveConfig, model),
                count: template.params.count,
            });
            appendRun(next);
            if (next.status === "succeeded") message.success(t("workflow.retrySucceeded", { count: next.generations }));
            else message.error(next.error || t("workflow.runFailed"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("workflow.runFailed"));
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <Drawer title={t("workflow.historyTitle")} open={open} onClose={onClose} size={460}>
            {runs.length ? (
                <div className="space-y-3">
                    {runs.map((run) => (
                        <article key={run.id} className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{run.templateName}</p>
                                    <p className="mt-1 text-xs text-stone-400">{new Date(run.startedAt).toLocaleString()}</p>
                                </div>
                                <Tag color={STATUS_COLOR[run.status]}>{t(`workflow.status.${run.status}`)}</Tag>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                                <span>{t("workflow.generatedCount", { count: run.generations })}</span>
                                <span>{t("workflow.requestCount", { count: run.requestIds.length })}</span>
                            </div>
                            {run.requestIds.length ? <p className="mt-2 truncate font-mono text-[10px] text-stone-400">{run.requestIds.join(", ")}</p> : null}
                            {run.error ? <p className="mt-2 line-clamp-3 text-xs text-rose-500">{run.error}</p> : null}
                            <div className="mt-3 flex justify-end">
                                <Button size="small" icon={<RotateCcw className="size-3.5" />} loading={retryingId === run.id} onClick={() => void retry(run)}>{t("workflow.retry")}</Button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-72 flex-col items-center justify-center text-center text-stone-400">
                    <History className="size-8" />
                    <p className="mt-3 text-sm">{t("workflow.noHistory")}</p>
                </div>
            )}
        </Drawer>
    );
}
