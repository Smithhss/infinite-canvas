import type { WorkflowRun, WorkflowRunStatus } from "./creative-workflow-runner";

export type { WorkflowRun } from "./creative-workflow-runner";

export const MAX_WORKFLOW_RUNS = 200;
const RUN_STATUSES: WorkflowRunStatus[] = ["queued", "running", "succeeded", "partial", "failed", "canceled"];

function text(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function stringRecord(value: unknown) {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .slice(0, 50)
            .map(([key, item]) => [text(key, 64), text(item, 30_000)]),
    );
}

export function normalizeWorkflowRuns(input: unknown): WorkflowRun[] {
    if (!Array.isArray(input)) return [];
    return input.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const run = item as Partial<WorkflowRun>;
        if (!run.id || !run.templateId || !run.status || !run.startedAt || !RUN_STATUSES.includes(run.status)) return [];
        return [{
            id: text(run.id, 128),
            templateId: text(run.templateId, 128),
            templateName: text(run.templateName, 120) || "工作流",
            status: run.status,
            inputs: stringRecord(run.inputs),
            referenceKeys: Array.isArray(run.referenceKeys) ? run.referenceKeys.map((key) => text(key, 256)).filter(Boolean).slice(0, 20) : [],
            requestIds: Array.isArray(run.requestIds) ? run.requestIds.map((id) => text(id, 256)).filter(Boolean).slice(0, 100) : [],
            taskIds: Array.isArray(run.taskIds) ? run.taskIds.map((id) => text(id, 256)).filter(Boolean).slice(0, 100) : [],
            generations: Math.max(0, Math.floor(Number(run.generations) || 0)),
            startedAt: text(run.startedAt, 40),
            ...(run.endedAt ? { endedAt: text(run.endedAt, 40) } : {}),
            ...(run.error ? { error: text(run.error, 2_000) } : {}),
        }];
    }).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, MAX_WORKFLOW_RUNS);
}

export function appendWorkflowRun(runs: WorkflowRun[], run: WorkflowRun) {
    return normalizeWorkflowRuns([run, ...runs]);
}
