import { normalizeWorkflowTemplate, type WorkflowTemplate } from "./creative-workflow";

export const WORKFLOW_EXPORT_VERSION = 1 as const;
export const MAX_WORKFLOW_IMPORT_BYTES = 10 * 1024 * 1024;

export type WorkflowExportFile = {
    app: "infinite-canvas";
    version: typeof WORKFLOW_EXPORT_VERSION;
    workflows: WorkflowTemplate[];
};

export function serializeWorkflowExport(workflows: WorkflowTemplate[]) {
    const file: WorkflowExportFile = {
        app: "infinite-canvas",
        version: WORKFLOW_EXPORT_VERSION,
        workflows: workflows.map((workflow) => normalizeWorkflowTemplate(workflow)),
    };
    return JSON.stringify(file, null, 2);
}

export function parseWorkflowExport(text: string): WorkflowTemplate[] {
    if (new TextEncoder().encode(text).byteLength > MAX_WORKFLOW_IMPORT_BYTES) throw new Error("file-too-large");
    const source = JSON.parse(text) as Partial<WorkflowExportFile>;
    if (source.app !== "infinite-canvas" || source.version !== WORKFLOW_EXPORT_VERSION || !Array.isArray(source.workflows)) {
        throw new Error("unsupported-version");
    }
    const workflows = source.workflows.map(normalizeWorkflowTemplate);
    const ids = new Set<string>();
    for (const workflow of workflows) {
        if (ids.has(workflow.id)) throw new Error("duplicate-workflow-id");
        ids.add(workflow.id);
    }
    return workflows;
}
