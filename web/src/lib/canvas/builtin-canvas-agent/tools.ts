export const BUILTIN_CANVAS_AGENT_TOOLS = [
    "get_canvas_summary",
    "get_selected_nodes",
    "get_node",
    "create_text_node",
    "update_text_node",
    "move_nodes",
    "connect_nodes",
    "delete_nodes",
    "generate_image",
    "edit_image",
    "run_node",
] as const;

export type BuiltinCanvasAgentToolName = (typeof BUILTIN_CANVAS_AGENT_TOOLS)[number];

export type BuiltinCanvasAgentToolCall = {
    id: string;
    name: BuiltinCanvasAgentToolName;
    arguments: unknown;
};

export type ParsedBuiltinCanvasAgentJson = {
    content: string;
    actions: BuiltinCanvasAgentToolCall[];
};

export type BuiltinCanvasAgentToolDefinition = {
    type: "function";
    function: {
        name: BuiltinCanvasAgentToolName;
        description: string;
        parameters: Record<string, unknown>;
        strict: true;
    };
};

const EMPTY_PARAMETERS = {
    type: "object",
    properties: {},
    additionalProperties: false,
};

const positionSchema = {
    type: "object",
    properties: {
        x: { type: "number" },
        y: { type: "number" },
    },
    required: ["x", "y"],
    additionalProperties: false,
};

const definitions: Record<BuiltinCanvasAgentToolName, Omit<BuiltinCanvasAgentToolDefinition["function"], "name">> = {
    get_canvas_summary: {
        description: "读取当前画布的节点数量、类型、选中项和连线摘要。",
        parameters: EMPTY_PARAMETERS,
        strict: true,
    },
    get_selected_nodes: {
        description: "读取当前选中画布节点的脱敏摘要。",
        parameters: EMPTY_PARAMETERS,
        strict: true,
    },
    get_node: {
        description: "按节点 ID 读取单个画布节点的脱敏摘要。",
        parameters: {
            type: "object",
            properties: { id: { type: "string", minLength: 1, maxLength: 200 } },
            required: ["id"],
            additionalProperties: false,
        },
        strict: true,
    },
    create_text_node: {
        description: "创建一个文本节点。",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", minLength: 1, maxLength: 120 },
                content: { type: "string", minLength: 1, maxLength: 20000 },
                position: positionSchema,
            },
            required: ["title", "content", "position"],
            additionalProperties: false,
        },
        strict: true,
    },
    update_text_node: {
        description: "修改一个文本节点的标题或正文。",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", minLength: 1, maxLength: 200 },
                title: { type: "string", minLength: 1, maxLength: 120 },
                content: { type: "string", maxLength: 20000 },
            },
            required: ["id"],
            additionalProperties: false,
        },
        strict: true,
    },
    move_nodes: {
        description: "移动一个或多个现有节点。",
        parameters: {
            type: "object",
            properties: {
                positions: {
                    type: "array",
                    minItems: 1,
                    maxItems: 100,
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string", minLength: 1, maxLength: 200 },
                            x: { type: "number" },
                            y: { type: "number" },
                        },
                        required: ["id", "x", "y"],
                        additionalProperties: false,
                    },
                },
            },
            required: ["positions"],
            additionalProperties: false,
        },
        strict: true,
    },
    connect_nodes: {
        description: "连接两个现有节点。",
        parameters: {
            type: "object",
            properties: {
                fromNodeId: { type: "string", minLength: 1, maxLength: 200 },
                toNodeId: { type: "string", minLength: 1, maxLength: 200 },
            },
            required: ["fromNodeId", "toNodeId"],
            additionalProperties: false,
        },
        strict: true,
    },
    delete_nodes: {
        description: "删除一个或多个节点。",
        parameters: {
            type: "object",
            properties: {
                ids: {
                    type: "array",
                    minItems: 1,
                    maxItems: 100,
                    items: { type: "string", minLength: 1, maxLength: 200 },
                    uniqueItems: true,
                },
            },
            required: ["ids"],
            additionalProperties: false,
        },
        strict: true,
    },
    generate_image: {
        description: "调用当前配置的图片模型生成一张或多张图片，会产生模型费用；model 可省略，填写时必须是当前已配置的图片模型。",
        parameters: {
            type: "object",
            properties: {
                prompt: { type: "string", minLength: 1, maxLength: 20000 },
                count: { type: "integer", minimum: 1, maximum: 15 },
                model: { type: "string", minLength: 1, maxLength: 300 },
            },
            required: ["prompt"],
            additionalProperties: false,
        },
        strict: true,
    },
    edit_image: {
        description: "以画布中现有图片节点为参考编辑图片，会产生模型费用；model 可省略，填写时必须是当前已配置的图片模型。",
        parameters: {
            type: "object",
            properties: {
                prompt: { type: "string", minLength: 1, maxLength: 20000 },
                sourceNodeIds: {
                    type: "array",
                    minItems: 1,
                    maxItems: 6,
                    items: { type: "string", minLength: 1, maxLength: 200 },
                    uniqueItems: true,
                },
                count: { type: "integer", minimum: 1, maximum: 15 },
                model: { type: "string", minLength: 1, maxLength: 300 },
            },
            required: ["prompt", "sourceNodeIds"],
            additionalProperties: false,
        },
        strict: true,
    },
    run_node: {
        description: "运行现有文本、图片、视频或音频节点的生成流程。",
        parameters: {
            type: "object",
            properties: {
                nodeId: { type: "string", minLength: 1, maxLength: 200 },
                mode: { type: "string", enum: ["text", "image", "video", "audio"] },
                prompt: { type: "string", maxLength: 20000 },
            },
            required: ["nodeId"],
            additionalProperties: false,
        },
        strict: true,
    },
};

export const BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS: BuiltinCanvasAgentToolDefinition[] = BUILTIN_CANVAS_AGENT_TOOLS.map((name) => ({
    type: "function",
    function: { name, ...definitions[name] },
}));

export function isBuiltinCanvasAgentToolName(value: string): value is BuiltinCanvasAgentToolName {
    return (BUILTIN_CANVAS_AGENT_TOOLS as readonly string[]).includes(value);
}

export function parseBuiltinCanvasAgentJson(text: string): ParsedBuiltinCanvasAgentJson {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("empty-agent-json");
    const unfenced = trimmed.startsWith("```") && trimmed.endsWith("```") ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : trimmed;

    let payload: unknown;
    try {
        payload = JSON.parse(unfenced);
    } catch {
        throw new Error("invalid-agent-json");
    }
    if (!isRecord(payload)) throw new Error("invalid-agent-json");

    const allowedTopLevel = new Set(["content", "actions"]);
    if (Object.keys(payload).some((key) => !allowedTopLevel.has(key))) throw new Error("unknown-field");

    const rawActions = Array.isArray(payload) ? payload : payload.actions;
    if (!Array.isArray(rawActions)) throw new Error("actions-required");
    if (rawActions.length > 24) throw new Error("too-many-actions");

    const actions = rawActions.map((item, index): BuiltinCanvasAgentToolCall => {
        if (!isRecord(item)) throw new Error("invalid-action");
        const extraKeys = Object.keys(item).filter((key) => !["id", "name", "arguments", "args"].includes(key));
        if (extraKeys.length) throw new Error("unknown-field");
        const name = typeof item.name === "string" ? item.name : "";
        if (!isBuiltinCanvasAgentToolName(name)) throw new Error(`unsupported-tool:${name || "unknown"}`);
        if (item.arguments !== undefined && item.args !== undefined) throw new Error("ambiguous-arguments");
        const rawArguments = item.arguments ?? item.args ?? {};
        const args = typeof rawArguments === "string" ? parseArguments(rawArguments) : rawArguments;
        if (!isRecord(args)) throw new Error("arguments-required");
        return {
            id: typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 200) : `action-${index + 1}`,
            name,
            arguments: args,
        };
    });

    return {
        content: typeof payload.content === "string" ? payload.content.trim().slice(0, 20000) : "",
        actions,
    };
}

function parseArguments(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error("invalid-arguments-json");
    }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
