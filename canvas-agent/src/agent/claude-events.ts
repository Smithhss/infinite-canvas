import { redactAgentLog } from "../utils/agent-runtime.js";
import { errorMessage } from "../utils/value.js";
import type { AgentEmit } from "./types.js";

type RecordValue = Record<string, unknown>;
type BlockKind = "text" | "thinking" | "tool_use";
type BlockState = {
    id: string;
    messageId: string;
    kind: BlockKind;
    text: string;
    tool?: string;
    server?: string;
    arguments?: unknown;
    completed: boolean;
    reconciled: boolean;
};

/** 将 Claude Agent SDK 消息转换为网页侧边栏可消费的事件。 */
export class ClaudeEventState {
    private threadId: string;
    private started = false;
    private finished = false;
    private currentMessageId = "";
    private blocks = new Map<string, BlockState>();
    private indexBlocks = new Map<string, string>();
    private textItems = 0;

    constructor(private context: { clientId: string; threadId: string; turnId: string }) {
        this.threadId = context.threadId;
    }

    /** 返回 SDK 会话 ID，供调用方持久化并继续同一会话。 */
    get sessionId() {
        return this.threadId;
    }

    /** 处理一条 SDK 消息并输出归一化事件。 */
    handle(message: unknown, emit: AgentEmit) {
        if (this.finished) return;
        const value = record(message);
        const sessionId = text(value.session_id);
        if (sessionId && sessionId !== this.threadId) this.threadId = sessionId;
        const type = text(value.type);
        if (type === "system" && text(value.subtype) === "init") {
            this.start(emit);
            return;
        }
        if (type === "stream_event") {
            this.start(emit);
            this.handleStreamEvent(value, emit);
            return;
        }
        if (type === "assistant") {
            this.start(emit);
            this.handleAssistant(value, emit);
            return;
        }
        if (type === "user") {
            this.start(emit);
            this.handleUser(value, emit);
            return;
        }
        if (type === "result") {
            this.start(emit);
            this.handleResult(value, emit);
        }
    }

    /** 输出一次中断终态。 */
    interrupted(emit: AgentEmit) {
        if (this.finished) return;
        this.start(emit);
        this.complete(emit, "interrupted");
    }

    /** 输出一次失败终态，重复调用不会产生第二条错误。 */
    fail(error: unknown, emit: AgentEmit) {
        if (this.finished) return;
        this.start(emit);
        this.complete(emit, "failed", errorMessage(error));
    }

    /** 迭代器自然结束但没有 result 时补一个失败终态。 */
    finish(emit: AgentEmit) {
        if (this.finished) return;
        this.fail(new Error("Claude SDK 未返回完成结果"), emit);
    }

    private start(emit: AgentEmit) {
        if (this.started) return;
        this.started = true;
        this.emit(emit, "thread.started", { thread_id: this.threadId, session_id: this.threadId });
        this.emit(emit, "turn.started", { turn_id: this.context.turnId });
    }

    private handleStreamEvent(message: RecordValue, emit: AgentEmit) {
        const event = record(message.event);
        const type = text(event.type);
        if (type === "message_start") {
            this.currentMessageId = text(record(event.message).id);
            return;
        }
        const index = number(event.index);
        if (type === "content_block_start") {
            this.startBlock(index, record(event.content_block), emit);
            return;
        }
        if (type === "content_block_delta") {
            const block = this.blockByIndex(index);
            if (!block) return;
            const delta = record(event.delta);
            const deltaType = text(delta.type);
            if (deltaType === "text_delta") this.appendText(block, text(delta.text), "agent_message", emit);
            if (deltaType === "thinking_delta") this.appendText(block, text(delta.thinking), "reasoning", emit);
            return;
        }
        if (type === "content_block_stop") {
            const block = this.blockByIndex(index);
            if (block && block.kind !== "tool_use") this.completeTextBlock(block, emit);
        }
    }

    private startBlock(index: number, value: RecordValue, emit: AgentEmit) {
        const kind = value.type === "thinking" ? "thinking" : value.type === "tool_use" ? "tool_use" : value.type === "text" ? "text" : null;
        if (!kind) return;
        const id = text(value.id) || `${this.currentMessageId || "stream"}:${index}`;
        const tool = kind === "tool_use" ? toolIdentity(text(value.name)) : undefined;
        const block: BlockState = {
            id,
            messageId: this.currentMessageId,
            kind,
            text: "",
            ...(tool ? { tool: tool.tool, server: tool.server } : {}),
            completed: false,
            reconciled: false,
        };
        this.blocks.set(id, block);
        this.indexBlocks.set(this.blockIndex(index), id);
        if (kind === "text") {
            this.textItems += 1;
            this.emit(emit, "item.started", { item: { id, type: "agent_message", text: "" } });
        }
        if (kind === "thinking") this.emit(emit, "item.started", { item: { id, type: "reasoning", summary: "" } });
    }

    private appendText(block: BlockState, delta: string, type: "agent_message" | "reasoning", emit: AgentEmit) {
        if (!delta) return;
        block.text += delta;
        this.emit(emit, "item.updated", { item: { id: block.id, type, delta } });
    }

    private completeTextBlock(block: BlockState, emit: AgentEmit) {
        if (block.completed) return;
        block.completed = true;
        if (block.kind === "text") {
            this.emit(emit, "item.completed", { item: { id: block.id, type: "agent_message", text: block.text } });
        }
        if (block.kind === "thinking") {
            this.emit(emit, "item.completed", { item: { id: block.id, type: "reasoning", summary: block.text } });
        }
    }

    private handleAssistant(message: RecordValue, emit: AgentEmit) {
        const body = record(message.message);
        const messageId = text(body.id) || this.currentMessageId;
        if (messageId) this.currentMessageId = messageId;
        const content = array(body.content);
        content.forEach((value, index) => {
            const block = record(value);
            const type = text(block.type);
            if (type !== "text" && type !== "thinking" && type !== "tool_use") return;
            const kind = type === "text" ? "text" : type === "thinking" ? "thinking" : "tool_use";
            const state = kind === "tool_use" ? this.findToolBlock(text(block.id)) : this.findTextBlock(kind, messageId);
            if (kind === "text") {
                const textValue = text(block.text);
                if (state) {
                    state.reconciled = true;
                    state.text = textValue || state.text;
                    this.completeTextBlock(state, emit);
                    return;
                }
                this.textItems += 1;
                const id = text(block.id) || `${messageId || "assistant"}:${index}`;
                this.emit(emit, "item.completed", { item: { id, type: "agent_message", text: textValue } });
                return;
            }
            if (kind === "thinking") {
                const summary = text(block.thinking);
                if (state) {
                    state.reconciled = true;
                    state.text = summary || state.text;
                    this.completeTextBlock(state, emit);
                    return;
                }
                const id = text(block.id) || `${messageId || "assistant"}:${index}`;
                this.emit(emit, "item.completed", { item: { id, type: "reasoning", summary } });
                return;
            }
            this.startTool(block, state, messageId, index, emit);
        });
    }

    private startTool(block: RecordValue, state: BlockState | undefined, messageId: string, index: number, emit: AgentEmit) {
        const rawName = text(block.name);
        const identity = toolIdentity(rawName);
        const id = text(block.id) || state?.id || `${messageId || "assistant"}:${index}`;
        const input = block.input === undefined ? {} : block.input;
        const toolBlock = state || {
            id,
            messageId,
            kind: "tool_use" as const,
            text: "",
            completed: false,
            reconciled: false,
        };
        toolBlock.tool = identity.tool;
        toolBlock.server = identity.server;
        toolBlock.arguments = input;
        this.blocks.set(id, toolBlock);
        this.emit(emit, "item.started", {
            item: toolItem(id, identity.tool, identity.server, input, "inProgress"),
        });
    }

    private handleUser(message: RecordValue, emit: AgentEmit) {
        const content = array(record(message.message).content);
        content.forEach((value) => {
            const block = record(value);
            if (text(block.type) !== "tool_result") return;
            const id = text(block.tool_use_id);
            if (!id) return;
            const state = this.blocks.get(id);
            if (state?.completed) return;
            const result = toolResult(block.content);
            const failed = block.is_error === true;
            const tool = state?.tool || id;
            const server = state?.server || "";
            const argumentsValue = state?.arguments || {};
            if (state) state.completed = true;
            this.emit(emit, "item.completed", {
                item: {
                    ...toolItem(id, tool, server, argumentsValue, failed ? "failed" : "completed"),
                    success: !failed,
                    result,
                    ...(failed ? { error: { message: redactAgentLog(toolResultText(block.content) || "工具执行失败") } } : {}),
                },
            });
        });
    }

    private handleResult(message: RecordValue, emit: AgentEmit) {
        const usage = normalizeUsage(message);
        this.emit(emit, "usage.updated", { usage });
        const failed = message.is_error === true || text(message.subtype) !== "success";
        if (!failed && !this.textItems) {
            const result = text(message.result);
            if (result) {
                this.textItems += 1;
                this.emit(emit, "item.completed", { item: { id: `result:${this.context.turnId}`, type: "agent_message", text: result } });
            }
        }
        const error = failed ? text(array(message.errors).map(text).filter(Boolean).join("\n")) || text(message.result) || `Claude 执行失败：${text(message.subtype) || "unknown"}` : "";
        this.complete(emit, failed ? "failed" : "completed", error, usage, number(message.duration_ms));
    }

    private complete(emit: AgentEmit, status: "completed" | "failed" | "interrupted", error = "", usage = this.emptyUsage(), durationMs = 0) {
        if (this.finished) return;
        this.finished = true;
        this.emit(emit, "turn.completed", {
            status,
            usage,
            ...(durationMs ? { duration_ms: durationMs } : {}),
            ...(error ? { error: { message: redactAgentLog(error) } } : {}),
        });
        emit("agent_done", this.scope({ agent: "claude", status, usage, ...(durationMs ? { duration_ms: durationMs } : {}), ...(error ? { error: { message: redactAgentLog(error) } } : {}) }));
    }

    /** 完整 assistant 消息按块到达，文本块没有稳定 ID，只能按同消息中的未对账块顺序匹配。 */
    private findTextBlock(kind: "text" | "thinking", messageId: string) {
        return [...this.blocks.values()].find((block) => block.kind === kind && block.messageId === messageId && !block.reconciled);
    }

    private findToolBlock(id: string) {
        return id ? this.blocks.get(id) : undefined;
    }

    private blockByIndex(index: number) {
        const id = this.indexBlocks.get(this.blockIndex(index));
        return id ? this.blocks.get(id) : undefined;
    }

    private blockIndex(index: number, messageId = this.currentMessageId) {
        return `${messageId || "stream"}:${index}`;
    }

    private emit(emit: AgentEmit, type: string, payload: RecordValue) {
        emit("agent_event", this.scope({ agent: "claude", type, ...payload }));
    }

    private scope(payload: RecordValue) {
        return { ...payload, threadId: this.threadId, thread_id: this.threadId, turnId: this.context.turnId, turn_id: this.context.turnId, sourceClientId: this.context.clientId };
    }

    private emptyUsage() {
        return { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
    }
}

function normalizeUsage(message: RecordValue) {
    const usage = record(message.usage);
    return {
        input_tokens: number(usage.input_tokens),
        cached_input_tokens: number(usage.cache_read_input_tokens),
        cache_creation_input_tokens: number(usage.cache_creation_input_tokens),
        output_tokens: number(usage.output_tokens),
        cost_usd: number(message.total_cost_usd),
        model_usage: record(message.modelUsage),
    };
}

function toolIdentity(rawName: string) {
    const parts = rawName.split("__");
    return {
        tool: parts.length > 2 ? parts.slice(2).join("__") : rawName,
        server: parts.length > 2 ? parts[1] : "",
    };
}

function toolItem(id: string, tool: string, server: string, input: unknown, status: string) {
    return {
        id,
        type: server ? "mcp_tool_call" : "dynamic_tool_call",
        tool,
        ...(server ? { server } : {}),
        arguments: input,
        status,
    };
}

function toolResult(content: unknown) {
    if (Array.isArray(content)) return { content };
    if (typeof content === "string") return { content: [{ type: "text", text: content }] };
    return content === undefined ? { content: [] } : { content: [{ type: "text", text: JSON.stringify(content) }] };
}

function toolResultText(content: unknown) {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content.map((item) => text(record(item).text)).filter(Boolean).join("\n");
}

function record(value: unknown): RecordValue {
    return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
    return typeof value === "string" ? value : "";
}

function number(value: unknown) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
}
