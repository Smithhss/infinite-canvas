import { nanoid } from "nanoid";

import { renderWorkflowPrompt, validateWorkflowInputs, type WorkflowParams, type WorkflowTemplate } from "@/lib/creative-workflow";
import type { ReferenceImage } from "@/types/image";

export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "partial" | "failed" | "canceled";

export type WorkflowImageInput = {
    prompt: string;
    model: string;
    params: WorkflowParams;
    references: ReferenceImage[];
};

export type WorkflowImageResult = {
    images: string[];
    requestId?: string;
    taskIds?: string[];
};

export type WorkflowExecutionAdapter = {
    generateImage: (input: WorkflowImageInput, signal: AbortSignal) => Promise<WorkflowImageResult>;
};

export type WorkflowGeneratedImage = {
    id: string;
    dataUrl: string;
    prompt: string;
    requestId?: string;
    taskIds: string[];
};

export type WorkflowRun = {
    id: string;
    templateId: string;
    templateName: string;
    status: WorkflowRunStatus;
    inputs: Record<string, string>;
    referenceKeys: string[];
    requestIds: string[];
    taskIds: string[];
    generations: number;
    startedAt: string;
    endedAt?: string;
    error?: string;
    images?: WorkflowGeneratedImage[];
};

export const MAX_WORKFLOW_GENERATION_CONCURRENCY = 3;

export async function runWithConcurrency<T, R>(input: {
    items: T[];
    concurrency: number;
    signal?: AbortSignal;
    runOne: (item: T, signal: AbortSignal) => Promise<R>;
}): Promise<PromiseSettledResult<R>[]> {
    const limit = Math.max(1, Math.min(MAX_WORKFLOW_GENERATION_CONCURRENCY, Math.floor(input.concurrency) || 1));
    const signal = input.signal || new AbortController().signal;
    const results = new Array<PromiseSettledResult<R>>(input.items.length);
    let cursor = 0;

    const worker = async () => {
        while (!signal.aborted) {
            const index = cursor++;
            if (index >= input.items.length) return;
            try {
                results[index] = { status: "fulfilled", value: await input.runOne(input.items[index], signal) };
            } catch (reason) {
                results[index] = { status: "rejected", reason };
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, input.items.length) }, worker));
    for (let index = 0; index < results.length; index += 1) {
        results[index] ||= { status: "rejected", reason: new Error("canceled") };
    }
    return results;
}

export async function executeWorkflow(input: {
    template: WorkflowTemplate;
    values: Record<string, string>;
    references: ReferenceImage[];
    adapter: WorkflowExecutionAdapter;
    count: number;
    runId?: string;
    signal?: AbortSignal;
}): Promise<WorkflowRun> {
    const validation = validateWorkflowInputs(input.template, input.values);
    if (!validation.ok) throw new Error(validation.errors.join(","));
    const run: WorkflowRun = {
        id: input.runId || nanoid(),
        templateId: input.template.id,
        templateName: input.template.name,
        status: input.signal?.aborted ? "canceled" : "running",
        inputs: { ...input.values },
        referenceKeys: input.references.map((reference) => reference.storageKey || "").filter(Boolean),
        requestIds: [],
        taskIds: [],
        generations: 0,
        startedAt: new Date().toISOString(),
        images: [],
    };
    if (run.status === "canceled") return run;

    const prompt = renderWorkflowPrompt(input.template, input.values);
    const count = Math.max(1, Math.min(15, Math.floor(input.count) || 1));
    const results = await runWithConcurrency({
        items: Array.from({ length: count }, (_, index) => index),
        concurrency: MAX_WORKFLOW_GENERATION_CONCURRENCY,
        signal: input.signal,
        runOne: () => input.adapter.generateImage({
            prompt,
            model: input.template.model,
            params: { ...input.template.params, count: 1 },
            references: input.references,
        }, input.signal || new AbortController().signal),
    });

    const fulfilled = results.filter((result): result is PromiseFulfilledResult<WorkflowImageResult> => result.status === "fulfilled");
    for (const result of fulfilled) {
        if (result.value.requestId) run.requestIds.push(result.value.requestId);
        run.taskIds.push(...(result.value.taskIds || []));
        for (const dataUrl of result.value.images) {
            run.images?.push({
                id: nanoid(),
                dataUrl,
                prompt,
                ...(result.value.requestId ? { requestId: result.value.requestId } : {}),
                taskIds: result.value.taskIds || [],
            });
        }
    }
    run.requestIds = Array.from(new Set(run.requestIds));
    run.taskIds = Array.from(new Set(run.taskIds));
    run.generations = run.images?.length || 0;
    run.status = input.signal?.aborted ? "canceled" : fulfilled.length === count ? "succeeded" : fulfilled.length > 0 ? "partial" : "failed";
    run.endedAt = new Date().toISOString();
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (rejected) run.error = rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason);
    return run;
}
