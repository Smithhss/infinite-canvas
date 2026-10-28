export type QuickCreateMode = "image" | "video";

export type QuickCreateDraft = {
    mode: QuickCreateMode;
    prompt: string;
    model?: string;
    workflow?: string;
    run: false;
};

const MAX_PROMPT_LENGTH = 600;
const MAX_MODEL_LENGTH = 160;
const MAX_WORKFLOW_LENGTH = 120;
const INVALID_TEXT_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const WORKFLOW_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;

function cleanText(value: string, maxLength: number) {
    return value.replace(INVALID_TEXT_CHARS, "").trim().slice(0, maxLength);
}

function cleanModel(value: string | undefined) {
    if (!value) return undefined;
    const model = value.trim();
    if (!model || model.length > MAX_MODEL_LENGTH || model.replace(INVALID_TEXT_CHARS, "") !== model) return undefined;
    return model;
}

function cleanWorkflow(value: string | undefined) {
    if (!value) return undefined;
    const workflow = value.trim();
    if (!workflow || workflow.length > MAX_WORKFLOW_LENGTH || workflow.replace(INVALID_TEXT_CHARS, "") !== workflow) return undefined;
    return WORKFLOW_PATTERN.test(workflow) ? workflow : undefined;
}

export function buildQuickCreateUrl(draft: QuickCreateDraft) {
    const params = new URLSearchParams({ mode: draft.mode });
    const prompt = cleanText(draft.prompt, MAX_PROMPT_LENGTH);
    const model = cleanModel(draft.model);
    const workflow = cleanWorkflow(draft.workflow);

    if (prompt) params.set("prompt", prompt);
    if (model) params.set("model", model);
    if (workflow) params.set("workflow", workflow);

    return `/${draft.mode}?${params.toString()}`;
}

export function readQuickCreateDraft(searchParams: URLSearchParams): QuickCreateDraft | null {
    const mode = searchParams.get("mode");
    if (mode !== "image" && mode !== "video") return null;

    const prompt = cleanText(searchParams.get("prompt") || "", MAX_PROMPT_LENGTH);
    if (!prompt) return null;

    const draft: QuickCreateDraft = { mode, prompt, run: false };
    const model = cleanModel(searchParams.get("model") || undefined);
    const workflow = cleanWorkflow(searchParams.get("workflow") || undefined);
    if (model) draft.model = model;
    if (workflow) draft.workflow = workflow;
    return draft;
}
