export type ApiParams = Record<string, string | string[] | number | number[] | undefined>;

const REQUEST_ID_HEADERS = ["x-oneapi-request-id", "x-request-id", "request-id"];

/** Read a server request ID without inventing one when the upstream does not return it. */
export function readRequestId(headers: unknown) {
    if (!headers || typeof headers !== "object") return "";
    const values = headers as { get?: (name: string) => unknown; [key: string]: unknown };
    for (const name of REQUEST_ID_HEADERS) {
        const value = values.get?.(name) ?? values[name] ?? values[name.toUpperCase()];
        const requestId = Array.isArray(value) ? value[0] : value;
        if (typeof requestId === "string" && requestId.trim()) return requestId.trim();
    }
    return "";
}

export function notifyRequestId(onRequestId: ((requestId: string) => void) | undefined, headers: unknown) {
    const requestId = readRequestId(headers);
    if (requestId) onRequestId?.(requestId);
    return requestId;
}

export function compactApiParams(params: ApiParams) {
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && (!Array.isArray(value) || value.length > 0))) as ApiParams;
}

export function serializeApiParams(params?: ApiParams) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((item) => queryParams.append(key, String(item)));
        else queryParams.set(key, String(value));
    }
    return queryParams;
}
