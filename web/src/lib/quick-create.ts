export type QuickCreateMode = "image" | "video";

export type QuickCreateDraft = {
    mode: QuickCreateMode;
    prompt: string;
    model?: string;
};

type QuickCreateStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const QUICK_CREATE_STORAGE_KEY = "infinite-canvas:quick-create";
const MAX_PROMPT_LENGTH = 600;
const MAX_MODEL_LENGTH = 160;
const INVALID_TEXT_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function cleanText(value: string, maxLength: number) {
    return value.replace(INVALID_TEXT_CHARS, "").trim().slice(0, maxLength);
}

function cleanModel(value: string | undefined) {
    if (!value) return undefined;
    const model = value.trim();
    if (!model || model.length > MAX_MODEL_LENGTH || model.replace(INVALID_TEXT_CHARS, "") !== model) return undefined;
    return model;
}

function normalizeDraft(input: QuickCreateDraft): QuickCreateDraft | null {
    if (input.mode !== "image" && input.mode !== "video") return null;
    const prompt = cleanText(String(input.prompt || ""), MAX_PROMPT_LENGTH);
    if (!prompt) return null;

    const draft: QuickCreateDraft = { mode: input.mode, prompt };
    const model = cleanModel(input.model);
    if (model) draft.model = model;
    return draft;
}

function resolveSessionStorage(): QuickCreateStorage | null {
    if (typeof window === "undefined") return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

export function buildQuickCreateUrl(mode: QuickCreateMode) {
    return `/${mode}`;
}

export function storeQuickCreateDraft(draft: QuickCreateDraft, storage: QuickCreateStorage | null = resolveSessionStorage()) {
    const normalized = normalizeDraft(draft);
    if (!storage || !normalized) return false;
    try {
        storage.setItem(QUICK_CREATE_STORAGE_KEY, JSON.stringify(normalized));
        return true;
    } catch {
        return false;
    }
}

export function readQuickCreateDraft(storage: QuickCreateStorage | null = resolveSessionStorage()): QuickCreateDraft | null {
    if (!storage) return null;
    try {
        const value = storage.getItem(QUICK_CREATE_STORAGE_KEY);
        if (!value) return null;
        const parsed = JSON.parse(value) as Partial<QuickCreateDraft>;
        return normalizeDraft(parsed as QuickCreateDraft);
    } catch {
        return null;
    }
}

export function clearQuickCreateDraft(mode?: QuickCreateMode, storage: QuickCreateStorage | null = resolveSessionStorage()) {
    if (!storage) return;
    try {
        if (!mode || readQuickCreateDraft(storage)?.mode === mode) storage.removeItem(QUICK_CREATE_STORAGE_KEY);
    } catch {
        /* Ignore unavailable session storage. */
    }
}
