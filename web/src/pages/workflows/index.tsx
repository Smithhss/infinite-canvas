import { useEffect, useRef, useState } from "react";
import { App, Button } from "antd";
import { Download, FileUp, History, Plus, Workflow } from "lucide-react";
import { saveAs } from "file-saver";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { WorkflowRunHistory } from "@/components/workflows/workflow-run-history";
import { WorkflowTemplateCard } from "@/components/workflows/workflow-template-card";
import { WorkflowTemplateForm } from "@/components/workflows/workflow-template-form";
import { isFeatureEnabled } from "@/constant/feature-flags";
import { parseWorkflowExport, serializeWorkflowExport } from "@/lib/creative-workflow-storage";
import NotFound from "@/pages/not-found";
import { useConfigStore } from "@/stores/use-config-store";
import { useWorkflowStore } from "@/stores/use-workflow-store";

export default function WorkflowsPage() {
    const { message, modal } = App.useApp();
    const { t } = useTranslation();
    useLocation();
    const config = useConfigStore((state) => state.config);
    const hydrated = useWorkflowStore((state) => state.hydrated);
    const workflows = useWorkflowStore((state) => state.workflows);
    const createWorkflow = useWorkflowStore((state) => state.createWorkflow);
    const removeWorkflow = useWorkflowStore((state) => state.removeWorkflow);
    const replaceWorkflows = useWorkflowStore((state) => state.replaceWorkflows);
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedId, setSelectedId] = useState("");
    const [historyOpen, setHistoryOpen] = useState(false);

    useEffect(() => {
        if (!hydrated) return;
        if (selectedId && workflows.some((workflow) => workflow.id === selectedId)) return;
        setSelectedId(workflows[0]?.id || "");
    }, [hydrated, selectedId, workflows]);

    if (!isFeatureEnabled("creativeWorkflow")) return <NotFound />;

    const selected = workflows.find((workflow) => workflow.id === selectedId);
    const create = () => setSelectedId(createWorkflow());
    const exportAll = () => {
        if (!workflows.length) {
            message.warning(t("workflow.nothingToExport"));
            return;
        }
        saveAs(new Blob([serializeWorkflowExport(workflows)], { type: "application/json" }), "infinite-canvas-workflows.json");
    };
    const importFile = async (file?: File) => {
        if (!file) return;
        try {
            const imported = parseWorkflowExport(await file.text());
            replaceWorkflows(imported);
            setSelectedId(imported[0]?.id || "");
            message.success(t("workflow.imported", { count: imported.length }));
        } catch (error) {
            const key = error instanceof Error ? error.message : "";
            message.error(t(key === "file-too-large" ? "workflow.importTooLarge" : key === "duplicate-workflow-id" ? "workflow.importDuplicate" : "workflow.importFailed"));
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };
    const confirmDelete = (id: string) => {
        const workflow = workflows.find((item) => item.id === id);
        modal.confirm({
            title: t("workflow.deleteTitle"),
            content: t("workflow.deleteDescription", { name: workflow?.name || "" }),
            okText: t("common.delete"),
            okButtonProps: { danger: true },
            cancelText: t("common.cancel"),
            onOk: () => {
                removeWorkflow(id);
                if (selectedId === id) setSelectedId("");
            },
        });
    };

    return (
        <main className="h-full overflow-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto w-full max-w-[1480px] px-5 py-8 lg:px-7">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6 dark:border-stone-800">
                    <div>
                        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
                            <Workflow className="size-3.5" />
                            {t("workflow.pageLabel")}
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("workflow.pageTitle")}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{t("workflow.pageDescription")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button icon={<History className="size-4" />} onClick={() => setHistoryOpen(true)}>{t("workflow.history")}</Button>
                        <Button icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>{t("workflow.import")}</Button>
                        <Button icon={<Download className="size-4" />} onClick={exportAll}>{t("workflow.export")}</Button>
                        <Button type="primary" icon={<Plus className="size-4" />} onClick={create}>{t("workflow.create")}</Button>
                    </div>
                </header>

                <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />

                {!hydrated ? (
                    <section className="flex min-h-96 items-center justify-center text-sm text-stone-500">{t("workflow.loading")}</section>
                ) : workflows.length ? (
                    <div className="mt-6 grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
                        <aside className="space-y-3">
                            {workflows.map((workflow) => (
                                <WorkflowTemplateCard
                                    key={workflow.id}
                                    workflow={workflow}
                                    config={config}
                                    selected={workflow.id === selectedId}
                                    onSelect={() => setSelectedId(workflow.id)}
                                    onDelete={() => confirmDelete(workflow.id)}
                                />
                            ))}
                        </aside>
                        {selected ? <WorkflowTemplateForm key={selected.id} workflow={selected} /> : null}
                    </div>
                ) : (
                    <section className="flex min-h-[480px] flex-col items-center justify-center border-b border-stone-200 text-center dark:border-stone-800">
                        <span className="grid size-14 place-items-center rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
                            <Workflow className="size-6 text-stone-400" />
                        </span>
                        <h2 className="mt-5 text-xl font-medium">{t("workflow.emptyTitle")}</h2>
                        <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">{t("workflow.emptyDescription")}</p>
                        <Button className="mt-6" type="primary" icon={<Plus className="size-4" />} onClick={create}>{t("workflow.create")}</Button>
                    </section>
                )}
            </div>
            <WorkflowRunHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
        </main>
    );
}
