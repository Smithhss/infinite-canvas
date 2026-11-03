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
