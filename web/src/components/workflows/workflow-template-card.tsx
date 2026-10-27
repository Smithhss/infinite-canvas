import { Clock3, Layers3, Trash2 } from "lucide-react";
import { Button } from "antd";
import { useTranslation } from "react-i18next";

import { modelOptionLabel, type AiConfig } from "@/stores/use-config-store";
import type { WorkflowTemplate } from "@/lib/creative-workflow";
import { cn } from "@/lib/utils";

export function WorkflowTemplateCard({
    workflow,
    config,
    selected,
    onSelect,
    onDelete,
}: {
    workflow: WorkflowTemplate;
    config: AiConfig;
    selected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    return (
        <article
            className={cn(
                "group relative cursor-pointer rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm dark:bg-stone-950",
                selected ? "border-stone-900 shadow-sm dark:border-stone-100" : "border-stone-200 dark:border-stone-800",
            )}
            onClick={onSelect}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">{t("workflow.cardLabel")}</p>
                    <h3 className="mt-2 truncate text-base font-semibold text-stone-950 dark:text-stone-100">{workflow.name}</h3>
                </div>
                <Button
                    type="text"
                    danger
                    size="small"
                    className="opacity-0 transition group-hover:opacity-100"
                    icon={<Trash2 className="size-3.5" />}
                    aria-label={t("common.delete")}
                    onClick={(event) => {
                        event.stopPropagation();
                        onDelete();
                    }}
                />
            </div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-stone-500 dark:text-stone-400">{workflow.description || t("workflow.noDescription")}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                <span className="inline-flex items-center gap-1.5">
                    <Layers3 className="size-3.5" />
                    {t("workflow.variableCount", { count: workflow.variables.length })}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    <span className="truncate">{modelOptionLabel(config, workflow.model) || t("workflow.defaultModel")}</span>
                </span>
            </div>
        </article>
    );
}
