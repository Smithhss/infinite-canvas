import crypto from "node:crypto";

import { createSdkMcpServer, query, tool, type McpServerConfig, type ModelInfo, type Options as ClaudeSdkOptions } from "@anthropic-ai/claude-agent-sdk";

import { toolDescriptions, toolInputSchemas, toolNames, type ToolName } from "../canvas/schemas.js";
import { AGENT_PROMPT, loadConfig, type CanvasAgentConfig, VERSION } from "../config.js";
import { redactAgentLog } from "../utils/agent-runtime.js";
import { errorMessage } from "../utils/value.js";
import { ClaudeEventState } from "./claude-events.js";
import type { AgentEmit } from "./types.js";
import { callCanvasAgentTool } from "../server/mcp.js";

type ClaudeSdkQuery = AsyncIterable<unknown> & {
    interrupt?: () => Promise<unknown>;
    close?: () => void;
    supportedModels?: () => Promise<ModelInfo[]>;
};
type QueryFactory = (params: { prompt: string; options: ClaudeSdkOptions }) => ClaudeSdkQuery;
type McpServerFactory = () => McpServerConfig;
type RunOptions = {
    clientId: string;
    cwd: string;
    threadId?: string;
    sessionId?: string;
    model?: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    onFinish?: () => void;
};
type ActiveRun = {
    runId: string;
    clientId: string;
    query: ClaudeSdkQuery;
    abort: AbortController;
    state: ClaudeEventState;
    emit: AgentEmit;
    options: RunOptions;
};

/** 使用 Claude Agent SDK 运行画布 Agent，并管理会话与中断。 */
export class ClaudeSdkAdapter {
    private active = new Map<string, ActiveRun>();

    constructor(
        private queryFactory: QueryFactory = query,
        private mcpServerFactory: McpServerFactory = defaultMcpServer,
        private runIdFactory: () => string = crypto.randomUUID,
    ) {}

    /** 返回当前是否有 Claude turn 正在运行。 */
    get busy() {
        return this.active.size > 0;
    }

    /** 通过 SDK 原生初始化响应读取当前账号可用模型，不提交用户任务。 */
    async listModels(cwd: string) {
        const abort = new AbortController();
        const activeQuery = this.queryFactory({
            prompt: "",
            options: {
                abortController: abort,
                cwd,
                settingSources: [],
                permissionMode: "dontAsk",
                strictMcpConfig: true,
                mcpServers: {},
                tools: [],
                env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `canvas-agent/${VERSION}` },
            } satisfies ClaudeSdkOptions,
        });
        try {
            if (!activeQuery.supportedModels) throw new Error("当前 Claude Agent SDK 不支持读取模型列表");
            return (await activeQuery.supportedModels()).map((model) => ({
                id: model.value,
                model: model.value,
                displayName: model.displayName,
                description: model.description,
                supportedReasoningEfforts: [],
            }));
        } finally {
            activeQuery.close?.();
        }
    }

    /** 启动一轮 SDK 调用；事件通过 SSE 异步返回。 */
    async run(prompt: string, emit: AgentEmit, options: RunOptions) {
        if (!prompt.trim()) throw new Error("请输入任务内容");
        if (this.active.size) throw new Error("Claude 正在执行其他任务，请先停止当前任务");
        const runId = this.runIdFactory();
        const abort = new AbortController();
        const state = new ClaudeEventState({ clientId: options.clientId, threadId: options.threadId || options.sessionId || runId, turnId: runId });
        let activeQuery: ClaudeSdkQuery;
        try {
            activeQuery = this.queryFactory({ prompt, options: this.queryOptions(abort, options) });
        } catch (error) {
            state.fail(error, emit);
            options.onFinish?.();
            return { runId, sessionId: state.sessionId };
        }
        const run: ActiveRun = { runId, clientId: options.clientId, query: activeQuery, abort, state, emit, options };
        this.active.set(runId, run);
        void this.consume(run);
        return { runId, sessionId: state.sessionId };
    }

    /** 只中断发起请求的网页所拥有的 Claude turn。 */
    async interrupt(clientId: string, runId = "") {
        const run = runId ? this.active.get(runId) : [...this.active.values()].find((item) => item.clientId === clientId);
        if (!run || run.clientId !== clientId) return false;
        run.state.interrupted(run.emit);
        void run.query.interrupt?.().catch(() => undefined);
        run.abort.abort();
        run.query.close?.();
        return true;
    }

    private queryOptions(abort: AbortController, options: RunOptions) {
        const mcpServer = this.mcpServerFactory();
        return {
            abortController: abort,
            cwd: options.cwd,
            systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: AGENT_PROMPT, snapshot: true },
            includePartialMessages: true,
            persistSession: true,
            permissionMode: "dontAsk" as const,
            settingSources: [],
            strictMcpConfig: true,
            mcpServers: { "infinite-canvas": mcpServer },
            allowedTools: ["mcp__infinite-canvas__*"],
            tools: [],
            ...(options.sessionId ? { resume: options.sessionId } : {}),
            ...(options.model ? { model: options.model } : {}),
            ...(options.effort ? { effort: options.effort } : {}),
            env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `canvas-agent/${VERSION}` },
        } satisfies ClaudeSdkOptions;
    }

    private async consume(run: ActiveRun) {
        try {
            for await (const message of run.query) run.state.handle(message, run.emit);
            if (run.abort.signal.aborted) run.state.interrupted(run.emit);
            else run.state.finish(run.emit);
        } catch (error) {
            if (run.abort.signal.aborted) run.state.interrupted(run.emit);
            else run.state.fail(error, run.emit);
        } finally {
            this.active.delete(run.runId);
            try {
                run.query.close?.();
            } catch {
                // 查询结束后释放资源失败不应覆盖已经发送的终态。
            }
            run.options.onFinish?.();
        }
    }
}

/** 创建只暴露画布工具的进程内 MCP Server。 */
export function createCanvasMcpServer(config: CanvasAgentConfig) {
    const tools = toolNames.map((name: ToolName) => tool(
        name,
        toolDescriptions[name],
        toolInputSchemas[name].shape,
        async (input) => {
            try {
                const result = await callCanvasAgentTool(config, name, input);
                return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
            } catch (error) {
                return { isError: true, content: [{ type: "text" as const, text: redactAgentLog(errorMessage(error)) }] };
            }
        },
        { alwaysLoad: true },
    ));
    return createSdkMcpServer({ name: "infinite-canvas", version: VERSION, instructions: AGENT_PROMPT, tools, alwaysLoad: true });
}

function defaultMcpServer() {
    return createCanvasMcpServer(loadConfig(true));
}
