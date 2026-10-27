import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Checkbox, Input, InputNumber, Select, Switch } from "antd";
import { CircleStop, ImagePlus, LoaderCircle, Play, Plus, Save, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useTranslation } from "react-i18next";

import { StudioModelPicker } from "@/components/studio-model-picker";
import { WorkflowBudgetSummary } from "@/components/workflows/workflow-budget-summary";
import { WorkflowResultActions } from "@/components/workflows/workflow-result-actions";
import {
    createWorkflowBudget,
    normalizeWorkflowTemplate,
    renderWorkflowPrompt,
    validateWorkflowInputs,
    type WorkflowTemplate,
    type WorkflowVariable,
    type WorkflowVariableType,
} from "@/lib/creative-workflow";
import { executeWorkflow, type WorkflowGeneratedImage, type WorkflowImageResult, type WorkflowRun } from "@/lib/creative-workflow-runner";
import { buildSeriesPromptRequest, parseSeriesPromptDrafts, runSeriesDrafts } from "@/lib/creative-workflow-series";
import { createWorkflowImageAdapter } from "@/services/api/creative-workflow";
import { requestImageQuestion } from "@/services/api/image";
import { uploadImage } from "@/services/image-storage";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useWorkflowStore } from "@/stores/use-workflow-store";
import type { ReferenceImage } from "@/types/image";

type SeriesDraftEditor = {
    id: string;
    title: string;
    prompt: string;
    selected: boolean;
};

const VARIABLE_TYPES: Array<{ value: WorkflowVariableType; label: string }> = [
    { value: "text", label: "单行文本" },
    { value: "textarea", label: "多行文本" },
    { value: "number", label: "数字" },
    { value: "select", label: "单选" },
    { value: "boolean", label: "布尔" },
];

export function WorkflowTemplateForm({ workflow }: { workflow: WorkflowTemplate }) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const effectiveConfig = useEffectiveConfig();
    const updateWorkflow = useWorkflowStore((state) => state.updateWorkflow);
    const appendRun = useWorkflowStore((state) => state.appendRun);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const [draft, setDraft] = useState(workflow);
    const [values, setValues] = useState<Record<string, string>>({});
    const [references, setReferences] = useState<ReferenceImage[]>([]);
    const [running, setRunning] = useState(false);
    const [resultRun, setResultRun] = useState<WorkflowRun | null>(null);
    const [seriesCount, setSeriesCount] = useState(3);
    const [seriesInstructions, setSeriesInstructions] = useState("");
    const [seriesLoading, setSeriesLoading] = useState(false);
    const [seriesDrafts, setSeriesDrafts] = useState<SeriesDraftEditor[]>([]);

    useEffect(() => {
        setDraft(workflow);
        setValues(Object.fromEntries(workflow.variables.map((variable) => [variable.key, variable.defaultValue])));
        setReferences([]);
        setResultRun(null);
        setSeriesDrafts([]);
        controllerRef.current?.abort();
        controllerRef.current = null;
        setRunning(false);
    }, [workflow.id]);

    const selectedSeriesDrafts = seriesDrafts.filter((item) => item.selected);
    const budget = useMemo(
        () => createWorkflowBudget(draft, selectedSeriesDrafts.length || draft.params.count, selectedSeriesDrafts.length || 1),
        [draft, selectedSeriesDrafts.length],
    );
    const selectedModel = draft.model || effectiveConfig.imageModel || effectiveConfig.model;
    const selectedTextModel = effectiveConfig.textModel;

    const patchDraft = (patch: Partial<WorkflowTemplate>) => setDraft((current) => ({ ...current, ...patch }));
    const patchParams = (patch: Partial<WorkflowTemplate["params"]>) => setDraft((current) => ({ ...current, params: { ...current.params, ...patch } }));

    const save = () => {
        const normalized = normalizeWorkflowTemplate({ ...draft, id: draft.id, updatedAt: new Date().toISOString() });
        if (!normalized.promptTemplate.trim()) {
            message.warning(t("workflow.promptRequired"));
            return;
        }
        updateWorkflow(draft.id, normalized);
        setDraft(normalized);
        message.success(t("workflow.saved"));
    };

    const addVariable = () => {
        const index = draft.variables.length + 1;
        const key = `variable_${index}`;
        const variable: WorkflowVariable = {
            id: nanoid(),
            key,
            label: t("workflow.variableLabel", { count: index }),
            type: "text",
            required: false,
            defaultValue: "",
            options: [],
        };
        patchDraft({ variables: [...draft.variables, variable] });
        setValues((current) => ({ ...current, [key]: "" }));
    };

    const patchVariable = (id: string, patch: Partial<WorkflowVariable>) => {
        const nextVariables = draft.variables.map((variable) => variable.id === id ? { ...variable, ...patch } : variable);
        const current = draft.variables.find((variable) => variable.id === id);
        const next = nextVariables.find((variable) => variable.id === id);
        if (current && next && current.key !== next.key) {
            setValues((state) => {
                const copy = { ...state };
                copy[next.key] = copy[current.key] || next.defaultValue;
                delete copy[current.key];
                return copy;
            });
        }
        patchDraft({ variables: nextVariables });
    };

    const removeVariable = (id: string) => {
        const variable = draft.variables.find((item) => item.id === id);
        patchDraft({ variables: draft.variables.filter((item) => item.id !== id) });
        if (variable) setValues((current) => {
            const copy = { ...current };
            delete copy[variable.key];
            return copy;
        });
    };

    const insertVariable = (key: string) => {
        patchDraft({ promptTemplate: `${draft.promptTemplate}${draft.promptTemplate ? " " : ""}{{${key}}}` });
    };

    const addReferences = async (files?: FileList | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) return;
        const next = await Promise.all(imageFiles.map(async (file) => {
            const image = await uploadImage(file);
            return { id: nanoid(), name: file.name, type: image.mimeType, dataUrl: image.url, storageKey: image.storageKey };
        }));
        setReferences((current) => [...current, ...next]);
    };

    const validateInputs = () => {
        const validation = validateWorkflowInputs(draft, values);
        if (!validation.ok) {
            const labels = validation.missingKeys.map((key) => draft.variables.find((variable) => variable.key === key)?.label || key);
            message.warning(labels.length ? t("workflow.missingVariables", { labels: labels.join("、") }) : t("workflow.promptRequired"));
            return false;
        }
        return true;
    };

    const validateForRun = () => {
        if (!validateInputs()) return false;
        if (!isAiConfigReady(effectiveConfig, selectedModel)) {
            message.warning(t("workflow.modelNotConfigured"));
            openConfigDialog(true);
            return false;
        }
        return true;
    };

    const beginRun = () => {
        const controller = new AbortController();
        controllerRef.current = controller;
        setRunning(true);
        return controller;
    };

    const finishRun = () => {
        controllerRef.current = null;
        setRunning(false);
    };

    const runSingle = async () => {
        if (running || !validateForRun()) return;
        const template = normalizeWorkflowTemplate({ ...draft, model: selectedModel });
        const controller = beginRun();
        try {
            const run = await executeWorkflow({
                template,
                values,
                references,
                adapter: createWorkflowImageAdapter(effectiveConfig, selectedModel),
                count: template.params.count,
                signal: controller.signal,
            });
            appendRun(run);
            setResultRun(run);
            if (run.status === "succeeded") message.success(t("workflow.runSucceeded", { count: run.generations }));
            else if (run.status === "canceled") message.info(t("common.requestCanceled"));
            else message.error(run.error || t("workflow.runFailed"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("workflow.runFailed"));
        } finally {
            finishRun();
        }
    };

    const cancelRun = () => {
        controllerRef.current?.abort();
    };

    const generateSeriesDrafts = async () => {
        if (seriesLoading || !validateInputs()) return;
        if (!isAiConfigReady(effectiveConfig, selectedTextModel)) {
            message.warning(t("workflow.textModelNotConfigured"));
            openConfigDialog(true, "channels");
            return;
        }
        setSeriesLoading(true);
        try {
            const basePrompt = renderWorkflowPrompt(draft, values);
            const text = await requestImageQuestion(
                effectiveConfig,
                buildSeriesPromptRequest({ count: seriesCount, basePrompt, instructions: seriesInstructions }),
                () => undefined,
            );
            const parsed = parseSeriesPromptDrafts(text, seriesCount, basePrompt);
            setSeriesDrafts(parsed.map((item) => ({ ...item, selected: true })));
            message.success(t("workflow.seriesDraftReady", { count: parsed.length }));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("workflow.seriesDraftFailed"));
        } finally {
            setSeriesLoading(false);
        }
    };

    const runSeries = async () => {
        if (running || !selectedSeriesDrafts.length || !validateForRun()) return;
        const template = normalizeWorkflowTemplate({ ...draft, model: selectedModel });
        const adapter = createWorkflowImageAdapter(effectiveConfig, selectedModel);
        const controller = beginRun();
        const startedAt = new Date().toISOString();
        try {
            const settled = await runSeriesDrafts<WorkflowImageResult>({
                drafts: selectedSeriesDrafts,
                concurrency: 3,
                signal: controller.signal,
                runOne: (item, signal) => adapter.generateImage({
                    prompt: item.prompt,
                    model: selectedModel,
                    params: { ...template.params, count: 1 },
                    references,
                }, signal),
            });
            const images: WorkflowGeneratedImage[] = [];
            const requestIds: string[] = [];
            const taskIds: string[] = [];
            let firstError = "";
            let fulfilled = 0;
            settled.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    fulfilled += 1;
                    if (result.value.requestId) requestIds.push(result.value.requestId);
                    taskIds.push(...(result.value.taskIds || []));
                    result.value.images.forEach((dataUrl) => images.push({
                        id: nanoid(),
                        dataUrl,
                        prompt: selectedSeriesDrafts[index].prompt,
                        ...(result.value.requestId ? { requestId: result.value.requestId } : {}),
                        taskIds: result.value.taskIds || [],
                    }));
                } else if (!firstError) {
                    firstError = result.reason instanceof Error ? result.reason.message : String(result.reason);
                }
            });
            const run: WorkflowRun = {
                id: nanoid(),
                templateId: template.id,
                templateName: template.name,
                status: controller.signal.aborted ? "canceled" : fulfilled === selectedSeriesDrafts.length ? "succeeded" : fulfilled ? "partial" : "failed",
                inputs: { ...values },
                referenceKeys: references.map((reference) => reference.storageKey || "").filter(Boolean),
                requestIds: Array.from(new Set(requestIds)),
                taskIds: Array.from(new Set(taskIds)),
                generations: images.length,
                startedAt,
                endedAt: new Date().toISOString(),
                images,
                ...(firstError ? { error: firstError } : {}),
            };
            appendRun(run);
            setResultRun(run);
            if (run.status === "succeeded") message.success(t("workflow.runSucceeded", { count: run.generations }));
            else if (run.status === "canceled") message.info(t("common.requestCanceled"));
            else message.error(run.error || t("workflow.runFailed"));
        } finally {
            finishRun();
        }
    };

    return (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
                <div className="min-w-0 flex-1">
                    <Input
                        variant="borderless"
                        value={draft.name}
                        onChange={(event) => patchDraft({ name: event.target.value })}
                        className="!px-0 !text-2xl !font-semibold"
                    />
                    <Input
                        variant="borderless"
                        value={draft.description}
                        placeholder={t("workflow.descriptionPlaceholder")}
                        onChange={(event) => patchDraft({ description: event.target.value })}
                        className="!mt-1 !px-0 !text-sm !text-stone-500"
                    />
                </div>
                <Button type="primary" icon={<Save className="size-4" />} onClick={save}>{t("common.save")}</Button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-5">
                    <div>
                        <label className="text-xs font-medium text-stone-500">{t("workflow.promptTemplate")}</label>
                        <Input.TextArea
                            value={draft.promptTemplate}
                            onChange={(event) => patchDraft({ promptTemplate: event.target.value })}
                            placeholder={t("workflow.promptPlaceholder")}
                            autoSize={{ minRows: 5, maxRows: 12 }}
                            className="mt-2"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {draft.variables.map((variable) => (
                                <Button key={variable.id} size="small" onClick={() => insertVariable(variable.key)}>{`{{${variable.key}}}`}</Button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-stone-500">{t("workflow.variables")}</label>
                            <Button size="small" icon={<Plus className="size-3.5" />} onClick={addVariable}>{t("workflow.addVariable")}</Button>
                        </div>
                        <div className="mt-2 space-y-2">
                            {draft.variables.map((variable) => (
                                <div key={variable.id} className="grid gap-2 rounded-xl border border-stone-200 p-3 sm:grid-cols-[1fr_1fr_120px_72px_36px] dark:border-stone-800">
                                    <Input value={variable.label} onChange={(event) => patchVariable(variable.id, { label: event.target.value })} placeholder={t("workflow.variableName")} />
                                    <Input value={variable.key} onChange={(event) => patchVariable(variable.id, { key: event.target.value })} placeholder="variable_key" />
                                    <Select value={variable.type} options={VARIABLE_TYPES} onChange={(type) => patchVariable(variable.id, { type })} />
                                    <label className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
                                        <Switch size="small" checked={variable.required} onChange={(required) => patchVariable(variable.id, { required })} />
                                        {t("workflow.required")}
                                    </label>
                                    <Button type="text" danger icon={<Trash2 className="size-4" />} aria-label={t("common.delete")} onClick={() => removeVariable(variable.id)} />
                                    {variable.type === "select" ? (
                                        <Input
                                            className="sm:col-span-5"
                                            value={variable.options.join(",")}
                                            placeholder={t("workflow.optionsPlaceholder")}
                                            onChange={(event) => patchVariable(variable.id, { options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                                        />
                                    ) : null}
                                </div>
                            ))}
                            {!draft.variables.length ? <p className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400 dark:border-stone-800">{t("workflow.noVariables")}</p> : null}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-stone-500">{t("workflow.inputValues")}</label>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            {draft.variables.map((variable) => (
                                <label key={variable.id} className="block">
                                    <span className="mb-1.5 flex items-center gap-1 text-xs text-stone-500">
                                        {variable.label}
                                        {variable.required ? <span className="text-rose-500">*</span> : null}
                                    </span>
                                    {variable.type === "textarea" ? (
                                        <Input.TextArea value={values[variable.key] || ""} placeholder={variable.placeholder} autoSize={{ minRows: 2, maxRows: 5 }} onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))} />
                                    ) : variable.type === "select" ? (
                                        <Select className="w-full" value={values[variable.key] || undefined} options={variable.options.map((value) => ({ value, label: value }))} onChange={(value) => setValues((current) => ({ ...current, [variable.key]: value }))} />
                                    ) : variable.type === "boolean" ? (
                                        <Select className="w-full" value={values[variable.key] || "false"} options={[{ value: "true", label: "true" }, { value: "false", label: "false" }]} onChange={(value) => setValues((current) => ({ ...current, [variable.key]: value }))} />
                                    ) : (
                                        <Input type={variable.type === "number" ? "number" : "text"} value={values[variable.key] || ""} placeholder={variable.placeholder} onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))} />
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-stone-500">{t("workflow.references")}</label>
                            <Button size="small" icon={<ImagePlus className="size-3.5" />} onClick={() => fileInputRef.current?.click()}>{t("workflow.addReference")}</Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {references.map((reference) => (
                                <div key={reference.id} className="group relative size-20 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
                                    <img src={reference.dataUrl} alt={reference.name} className="size-full object-cover" />
                                    <button type="button" className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white" onClick={() => setReferences((current) => current.filter((item) => item.id !== reference.id))} aria-label={t("common.delete")}>
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ))}
                            {!references.length ? <p className="text-xs text-stone-400">{t("workflow.noReferences")}</p> : null}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { void addReferences(event.target.files); event.target.value = ""; }} />
                    </div>
                </div>

                <aside className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-stone-500">{t("workflow.model")}</label>
                        <div className="mt-2">
                            <StudioModelPicker config={effectiveConfig} value={selectedModel} onChange={(model) => patchDraft({ model })} capability="image" fullWidth onMissingConfig={() => openConfigDialog(true)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="mb-1.5 block text-xs text-stone-500">{t("workflow.quality")}</span>
                            <Select className="w-full" value={draft.params.quality} options={["auto", "low", "medium", "high", "xhigh", "max"].map((value) => ({ value, label: value }))} onChange={(quality) => patchParams({ quality })} />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-xs text-stone-500">{t("workflow.count")}</span>
                            <InputNumber className="w-full" min={1} max={15} value={draft.params.count} onChange={(count) => patchParams({ count: Number(count) || 1 })} />
                        </label>
                    </div>
                    <label className="block">
                        <span className="mb-1.5 block text-xs text-stone-500">{t("workflow.size")}</span>
                        <Input value={draft.params.size} onChange={(event) => patchParams({ size: event.target.value })} placeholder="1:1 / 1024x1024" />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5 text-xs text-stone-600 dark:border-stone-800 dark:text-stone-300">
                        {t("workflow.transparent")}
                        <Switch size="small" checked={draft.params.background === "transparent"} onChange={(checked) => patchParams({ background: checked ? "transparent" : "" })} />
                    </label>

                    <WorkflowBudgetSummary budget={budget} />
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="primary" icon={<Play className="size-4" />} loading={running && !seriesDrafts.length} disabled={running} onClick={() => void runSingle()}>{t("workflow.run")}</Button>
                        <Button danger icon={<CircleStop className="size-4" />} disabled={!running} onClick={cancelRun}>{t("workflow.cancel")}</Button>
                    </div>
                </aside>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-800">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t("workflow.seriesTitle")}</p>
                        <p className="mt-1 text-xs text-stone-500">{t("workflow.seriesDescription")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-stone-500">
                            {t("workflow.seriesCount")}
                            <InputNumber min={1} max={20} value={seriesCount} onChange={(value) => setSeriesCount(Number(value) || 1)} />
                        </label>
                        <Button icon={<Sparkles className="size-4" />} loading={seriesLoading} disabled={running} onClick={() => void generateSeriesDrafts()}>{t("workflow.generateDrafts")}</Button>
                    </div>
                </div>
                <Input className="mt-3" value={seriesInstructions} onChange={(event) => setSeriesInstructions(event.target.value)} placeholder={t("workflow.seriesInstructions")} />
                {seriesDrafts.length ? (
                    <div className="mt-4 space-y-3">
                        {seriesDrafts.map((item, index) => (
                            <div key={item.id} className="rounded-2xl border border-stone-200 p-3 dark:border-stone-800">
                                <div className="flex items-center gap-2">
                                    <Checkbox checked={item.selected} onChange={(event) => setSeriesDrafts((current) => current.map((draftItem) => draftItem.id === item.id ? { ...draftItem, selected: event.target.checked } : draftItem))} />
                                    <Input value={item.title} onChange={(event) => setSeriesDrafts((current) => current.map((draftItem) => draftItem.id === item.id ? { ...draftItem, title: event.target.value } : draftItem))} />
                                </div>
                                <Input.TextArea className="mt-2" value={item.prompt} autoSize={{ minRows: 2, maxRows: 6 }} onChange={(event) => setSeriesDrafts((current) => current.map((draftItem) => draftItem.id === item.id ? { ...draftItem, prompt: event.target.value } : draftItem))} />
                                <p className="mt-2 text-[11px] text-stone-400">{t("workflow.seriesDraftMeta", { index: index + 1, count: selectedSeriesDrafts.length })}</p>
                            </div>
                        ))}
                        <WorkflowBudgetSummary budget={budget} />
                        <Button type="primary" icon={<WandSparkles className="size-4" />} loading={running} disabled={!selectedSeriesDrafts.length || running} onClick={() => void runSeries()}>{t("workflow.confirmSeries")}</Button>
                    </div>
                ) : null}
            </div>

            {resultRun?.images?.length ? (
                <div className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-800">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t("workflow.results")}</p>
                            <p className="mt-1 text-xs text-stone-500">{t("workflow.resultSummary", { count: resultRun.generations, status: resultRun.status })}</p>
                        </div>
                        {running ? <LoaderCircle className="size-4 animate-spin text-stone-400" /> : null}
                    </div>
                    <WorkflowResultActions images={resultRun.images} workflowName={draft.name} runId={resultRun.id} />
                </div>
            ) : null}
        </section>
    );
}
