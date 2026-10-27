import { nanoid } from "nanoid";

export type WorkflowVariableType = "text" | "textarea" | "number" | "select" | "boolean";
export type WorkflowTaskType = "image" | "video";

export type WorkflowVariable = {
    id: string;
    key: string;
    label: string;
    type: WorkflowVariableType;
    required: boolean;
    defaultValue: string;
    options: string[];
    placeholder?: string;
};

export type WorkflowParams = {
    size: string;
    quality: string;
    count: number;
    background?: string;
    seconds?: string;
    resolution?: string;
};

export type WorkflowTemplate = {
    schemaVersion: 1;
    id: string;
    name: string;
    description: string;
    taskType: WorkflowTaskType;
    promptTemplate: string;
    variables: WorkflowVariable[];
    model: string;
    params: WorkflowParams;
    createdAt: string;
    updatedAt: string;
};

export type WorkflowValidation = {
    ok: boolean;
    missingKeys: string[];
    errors: string[];
};

export type WorkflowBudget = {
    generations: number;
    calls: number;
    taskCount: number;
    estimatedQuota?: number;
};

const MAX_VARIABLES = 50;
const MAX_PROMPT_LENGTH = 30_000;
const MAX_OPTIONS = 20;
const VARIABLE_TYPES: WorkflowVariableType[] = ["text", "textarea", "number", "select", "boolean"];

function textValue(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function safeKey(value: unknown, fallback: string) {
    const normalized = textValue(value, 64).trim().replace(/[^\w.-]/g, "_");
    return normalized || fallback;
}

function normalizeVariable(value: unknown, index: number): WorkflowVariable | null {
    if (!value || typeof value !== "object") return null;
    const source = value as Record<string, unknown>;
    const key = safeKey(source.key, "");
    if (!key) return null;
    const type = VARIABLE_TYPES.includes(source.type as WorkflowVariableType)
        ? source.type as WorkflowVariableType
        : "text";
    const placeholder = textValue(source.placeholder, 200);
    return {
        id: textValue(source.id, 128) || `variable-${index + 1}`,
        key,
        label: textValue(source.label, 80) || key,
        type,
        required: source.required === true,
        defaultValue: textValue(source.defaultValue, MAX_PROMPT_LENGTH),
        options: Array.isArray(source.options)
            ? source.options.map((option) => textValue(option, 200)).filter(Boolean).slice(0, MAX_OPTIONS)
            : [],
        ...(placeholder ? { placeholder } : {}),
    };
}

export function normalizeWorkflowTemplate(value: unknown): WorkflowTemplate {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const rawVariables = Array.isArray(source.variables) ? source.variables.slice(0, MAX_VARIABLES) : [];
    const variables = rawVariables
        .map(normalizeVariable)
        .filter((variable): variable is WorkflowVariable => Boolean(variable));
    const params = source.params && typeof source.params === "object" ? source.params as Record<string, unknown> : {};
    const createdAt = textValue(source.createdAt, 40) || new Date().toISOString();
    const updatedAt = textValue(source.updatedAt, 40) || createdAt;

    return {
        schemaVersion: 1,
        id: textValue(source.id, 128) || nanoid(),
        name: textValue(source.name, 120).trim() || "未命名工作流",
        description: textValue(source.description, 2_000),
        taskType: source.taskType === "video" ? "video" : "image",
        promptTemplate: textValue(source.promptTemplate, MAX_PROMPT_LENGTH),
        variables,
        model: textValue(source.model, 256),
        params: {
            size: textValue(params.size, 64) || "1:1",
            quality: textValue(params.quality, 64) || "auto",
            count: Math.max(1, Math.min(15, Math.floor(Number(params.count) || 1))),
            ...(textValue(params.background, 64) ? { background: textValue(params.background, 64) } : {}),
            ...(textValue(params.seconds, 16) ? { seconds: textValue(params.seconds, 16) } : {}),
            ...(textValue(params.resolution, 16) ? { resolution: textValue(params.resolution, 16) } : {}),
        },
        createdAt,
        updatedAt,
    };
}

export function createBlankWorkflow(): WorkflowTemplate {
    const now = new Date().toISOString();
    return {
        schemaVersion: 1,
        id: nanoid(),
        name: "新建工作流",
        description: "",
        taskType: "image",
        promptTemplate: "",
        variables: [],
        model: "",
        params: { size: "1:1", quality: "auto", count: 1 },
        createdAt: now,
        updatedAt: now,
    };
}

export function renderWorkflowPrompt(template: WorkflowTemplate, values: Record<string, string>) {
    return template.promptTemplate.replace(/{{\s*([\w.-]+)\s*}}/g, (_match, key: string) => values[key]?.trim() || "");
}

export function validateWorkflowInputs(template: WorkflowTemplate, values: Record<string, string>): WorkflowValidation {
    const errors: string[] = [];
    const missingKeys: string[] = [];
    for (const variable of template.variables) {
        const value = String(values[variable.key] || "").trim();
        if (variable.required && !value) {
            missingKeys.push(variable.key);
            errors.push(`missing:${variable.key}`);
            continue;
        }
        if (value && variable.type === "number" && !Number.isFinite(Number(value))) errors.push(`invalid-number:${variable.key}`);
        if (value && variable.type === "select" && variable.options.length && !variable.options.includes(value)) errors.push(`invalid-option:${variable.key}`);
    }
    if (!renderWorkflowPrompt(template, values).trim()) errors.push("prompt-empty");
    return { ok: errors.length === 0, missingKeys, errors };
}

export function createWorkflowBudget(template: WorkflowTemplate, generatedCount: number, taskCount = 1): WorkflowBudget {
    const generations = Math.max(1, Math.min(15, Math.floor(generatedCount) || 1));
    return {
        generations,
        calls: template.taskType === "image" ? generations : 1,
        taskCount: Math.max(1, Math.floor(taskCount) || 1),
    };
}
