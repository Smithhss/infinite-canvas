import { buildApiUrl, resolveModelRequestConfig, resolveModelScript, withLocalProxy, type AiConfig } from "@/stores/use-config-store";

import { BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS, isBuiltinCanvasAgentToolName, parseBuiltinCanvasAgentJson, type BuiltinCanvasAgentToolCall } from "@/lib/canvas/builtin-canvas-agent/tools";

export type BuiltinCanvasAgentContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type BuiltinCanvasAgentMessage =
    | { role: "system" | "user"; content: string | BuiltinCanvasAgentContentPart[] }
    | { role: "assistant"; content: string; toolCalls?: BuiltinCanvasAgentToolCall[] }
    | { role: "tool"; toolCallId: string; name: string; content: string };

export type BuiltinCanvasAgentTurn = {
    content: string;
    toolCalls: BuiltinCanvasAgentToolCall[];
    requestId?: string;
    degraded?: boolean;
};

type OpenAIToolCall = {
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
};

type OpenAIChatPayload = {
    id?: string;
    choices?: Array<{
        message?: {
            content?: string | null;
            tool_calls?: OpenAIToolCall[];
        };
    }>;
    error?: { message?: string };
    code?: number;
    msg?: string;
};

type GeminiPayload = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
            }>;
        };
    }>;
    error?: { message?: string };
};

export function selectBuiltinAgentModel(config: Pick<AiConfig, "textModel">) {
    return config.textModel.trim();
}

export function buildBuiltinAgentRequest(input: {
    config: AiConfig;
    messages: BuiltinCanvasAgentMessage[];
    systemPrompt?: string;
    degraded?: boolean;
}) {
    const selectedModel = selectBuiltinAgentModel(input.config);
    if (!selectedModel) throw new Error("text-model-required");
    const requestConfig = resolveModelRequestConfig(input.config, selectedModel);
    const messages = toOpenAIMessages(requestConfig, input.messages, input.systemPrompt, Boolean(input.degraded));
    return {
        selectedModel,
        model: requestConfig.model,
        messages,
        ...(input.degraded
            ? {}
            : {
                  tools: BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS,
                  tool_choice: "auto" as const,
              }),
        temperature: 0.2,
    };
}

export async function requestBuiltinCanvasAgentTurn(input: {
    config: AiConfig;
    messages: BuiltinCanvasAgentMessage[];
    systemPrompt?: string;
    signal?: AbortSignal;
}): Promise<BuiltinCanvasAgentTurn> {
    const selectedModel = selectBuiltinAgentModel(input.config);
    if (!selectedModel) throw new Error("text-model-required");
    if (resolveModelScript(input.config, selectedModel)) throw new Error("builtin-agent-model-script-unsupported");

    const requestConfig = resolveModelRequestConfig(input.config, selectedModel);
    const first = requestConfig.apiFormat === "gemini" ? await requestGeminiTurn(requestConfig, input, false) : await requestOpenAITurn(requestConfig, input, false);
    const hasToolResults = input.messages.some((message) => message.role === "tool");
    if (first.toolCalls.length || hasToolResults) return first;

    const fallback = requestConfig.apiFormat === "gemini" ? await requestGeminiTurn(requestConfig, input, true) : await requestOpenAITurn(requestConfig, input, true);
    const parsed = parseOptionalActionJson(fallback.content);
    return {
        ...fallback,
        toolCalls: parsed?.actions || [],
        content: parsed?.content || fallback.content,
        degraded: true,
    };
}

async function requestOpenAITurn(config: AiConfig, input: Parameters<typeof requestBuiltinCanvasAgentTurn>[0], degraded: boolean): Promise<BuiltinCanvasAgentTurn> {
    const body = buildBuiltinAgentRequest({ config, messages: input.messages, systemPrompt: input.systemPrompt, degraded });
    const response = await fetch(buildApiUrl(config.baseUrl, "/chat/completions"), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: input.signal,
    });
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || undefined;
    if (!response.ok) throw new Error(await readResponseError(response));
    const payload = (await response.json()) as OpenAIChatPayload;
    if (typeof payload.code === "number" && payload.code !== 0) throw new Error(payload.msg || "builtin-agent-request-failed");
    if (payload.error?.message) throw new Error(payload.error.message);
    const message = payload.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls || []).map((call, index) => normalizeToolCall(call.id || `call-${index + 1}`, call.function?.name || "", call.function?.arguments || "{}"));
    const content = typeof message?.content === "string" ? message.content : "";
    const embedded = parseOptionalActionJson(content);
    return {
        content: embedded?.content || content,
        toolCalls: toolCalls.length ? toolCalls : embedded?.actions || [],
        requestId,
        degraded,
    };
}

async function requestGeminiTurn(config: AiConfig, input: Parameters<typeof requestBuiltinCanvasAgentTurn>[0], degraded: boolean): Promise<BuiltinCanvasAgentTurn> {
    const body = buildGeminiRequest(config, input.messages, input.systemPrompt, degraded);
    const endpoint = `${geminiBaseUrl(config)}/models/${encodeURIComponent(config.model.replace(/^models\//, ""))}:generateContent`;
    const response = await fetch(withLocalProxy(endpoint), {
        method: "POST",
        headers: { "x-goog-api-key": config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: input.signal,
    });
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || undefined;
    if (!response.ok) throw new Error(await readResponseError(response));
    const payload = (await response.json()) as GeminiPayload;
    if (payload.error?.message) throw new Error(payload.error.message);
    const parts = payload.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
    const toolCalls = parts
        .filter((part) => part.functionCall?.name)
        .map((part, index) => normalizeToolCall(part.functionCall?.id || `call-${index + 1}`, part.functionCall?.name || "", JSON.stringify(part.functionCall?.args || {})));
    const content = parts.map((part) => part.text || "").join("");
    const embedded = parseOptionalActionJson(content);
    return {
        content: embedded?.content || content,
        toolCalls: toolCalls.length ? toolCalls : embedded?.actions || [],
        requestId,
        degraded,
    };
}

function toOpenAIMessages(config: AiConfig, messages: BuiltinCanvasAgentMessage[], skillPrompt: string | undefined, degraded: boolean) {
    const systemText = [
        config.systemPrompt.trim(),
        skillPrompt?.trim() || "",
        degraded ? "上一次请求未返回工具调用。若需要操作画布，只输出严格 JSON：{\"content\":\"简短说明\",\"actions\":[{\"name\":\"工具名\",\"arguments\":{}}]}；不需要操作时直接回答，不要输出 Markdown 或解释。" : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    return [
        ...(systemText ? [{ role: "system" as const, content: systemText }] : []),
        ...messages.map((message) => {
            if (message.role === "tool") return { role: "tool" as const, tool_call_id: message.toolCallId, content: message.content };
            if (message.role === "assistant" && message.toolCalls?.length) {
                return {
                    role: "assistant" as const,
                    content: message.content,
                    tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.arguments) } })),
                };
            }
            return { role: message.role, content: message.content };
        }),
    ];
}

function buildGeminiRequest(config: AiConfig, messages: BuiltinCanvasAgentMessage[], skillPrompt: string | undefined, degraded: boolean) {
    const systemText = [config.systemPrompt.trim(), skillPrompt?.trim() || "", degraded ? "若需要操作画布，只输出严格 JSON 对象；否则直接回答。" : ""].filter(Boolean).join("\n\n");
    const callNames = new Map<string, string>();
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = messages.flatMap((message): Array<{ role: string; parts: Array<Record<string, unknown>> }> => {
        if (message.role === "tool") {
            return [{ role: "user", parts: [{ functionResponse: { id: message.toolCallId, name: callNames.get(message.toolCallId) || message.name, response: safeJson(message.content) } }] }];
        }
        if (message.role === "assistant") {
            const parts = [
                ...(message.content ? [{ text: message.content }] : []),
                ...(message.toolCalls || []).map((call) => {
                    callNames.set(call.id, call.name);
                    return { functionCall: { id: call.id, name: call.name, args: call.arguments } };
                }),
            ];
            return parts.length ? [{ role: "model", parts: parts as Array<Record<string, unknown>> }] : [];
        }
        return [{ role: "user", parts: toGeminiParts(message.content) as Array<Record<string, unknown>> }];
    });
    return {
        contents,
        ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
        ...(degraded
            ? {}
            : {
                  tools: [
                      {
                          functionDeclarations: BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS.map((tool) => ({
                              name: tool.function.name,
                              description: tool.function.description,
                              parameters: tool.function.parameters,
                          })),
                      },
                  ],
                  toolConfig: { functionCallingConfig: { mode: "AUTO" } },
              }),
    };
}

function toGeminiParts(content: string | BuiltinCanvasAgentContentPart[]) {
    if (typeof content === "string") return [{ text: content }];
    return content.map((part) => {
        if (part.type === "text") return { text: part.text };
        const match = part.image_url.url.match(/^data:([^;,]+);base64,(.+)$/);
        return match ? { inlineData: { mimeType: match[1], data: match[2] } } : { fileData: { mimeType: "image/png", fileUri: part.image_url.url } };
    });
}

function normalizeToolCall(id: string, name: string, rawArguments: string): BuiltinCanvasAgentToolCall {
    if (!isBuiltinCanvasAgentToolName(name)) throw new Error(`unsupported-tool:${name || "unknown"}`);
    let args: unknown;
    try {
        args = JSON.parse(rawArguments || "{}");
    } catch {
        throw new Error("invalid-arguments-json");
    }
    return { id: id.slice(0, 200), name, arguments: args };
}

function parseOptionalActionJson(content: string) {
    const trimmed = content.trim();
    const candidate = trimmed.startsWith("```") || /^\{\s*"(?:content|actions)"\s*:/.test(trimmed);
    if (!candidate) return null;
    try {
        return parseBuiltinCanvasAgentJson(trimmed);
    } catch (error) {
        throw new Error(`invalid-agent-json:${error instanceof Error ? error.message : "unknown"}`);
    }
}

function safeJson(value: string) {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : { result: parsed };
    } catch {
        return { result: value };
    }
}

function geminiBaseUrl(config: Pick<AiConfig, "baseUrl">) {
    const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    return /\/v1(?:beta)?$/i.test(baseUrl) ? baseUrl : `${baseUrl}/v1beta`;
}

async function readResponseError(response: Response) {
    const text = await response.text();
    if (!text) return `builtin-agent-http-${response.status}`;
    try {
        const payload = JSON.parse(text) as { error?: { message?: string }; msg?: string };
        return payload.error?.message || payload.msg || `builtin-agent-http-${response.status}`;
    } catch {
        return text.slice(0, 300) || `builtin-agent-http-${response.status}`;
    }
}
