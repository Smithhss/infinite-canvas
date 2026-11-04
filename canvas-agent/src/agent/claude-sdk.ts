import crypto from "node:crypto";

import { createSdkMcpServer, query, tool, type CanUseTool, type McpServerConfig, type ModelInfo, type Options as ClaudeSdkOptions, type PermissionResult, type SlashCommand } from "@anthropic-ai/claude-agent-sdk";

import { toolDescriptions, toolInputSchemas, toolNames, type ToolName } from "../canvas/schemas.js";
import { AGENT_PROMPT, loadConfig, type CanvasAgentConfig, VERSION } from "../config.js";
import { redactAgentLog } from "../utils/agent-runtime.js";
import { errorMessage } from "../utils/value.js";
import { ClaudeEventState } from "./claude-events.js";
import type { AgentEmit, AgentPermissionMode } from "./types.js";
import { callCanvasAgentTool } from "../server/mcp.js";
import { listProjectClaudeSkillNames } from "./claude-skills.js";

type ClaudeSdkQuery = AsyncIterable<unknown> & {
    interrupt?: () => Promise<unknown>;
    close?: () => void;
    supportedModels?: () => Promise<ModelInfo[]>;
    supportedCommands?: () => Promise<SlashCommand[]>;
};
type QueryFactory = (params: { prompt: string; options: ClaudeSdkOptions }) => ClaudeSdkQuery;
type McpServerFactory = () => McpServerConfig;
type RunOptions = {
    clientId: string;
    cwd: string;
    threadId?: string;
    sessionId?: string;
    model?: string;
    permissionMode?: AgentPermissionMode;
    skill?: string;
    effort?: "low" | "medium" | "high" | "xhigh" | "max";
    onFinish?: () => void;
};
type PermissionDecision = "accept" | "acceptForSession" | "decline";
type PendingPermission = {
    requestId: string;
    runId: string;
    clientId: string;
    toolName: string;
    emit: AgentEmit;
    signal: AbortSignal;
    resolve: (result: PermissionResult) => void;
    onAbort: () => void;
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

const CLAUDE_WRITE_TOOLS = new Set<ToolName>([
    "site_navigate",
    "canvas_apply_ops",
    "canvas_create_node",
    "canvas_create_attachment_nodes",
    "canvas_create_text_node",
    "canvas_create_text_nodes",
    "canvas_create_config_node",
    "canvas_create_image_prompt_flow",
    "canvas_create_generation_flow",
    "canvas_generate_text",
    "canvas_generate_image",
    "canvas_generate_video",
    "canvas_generate_audio",
    "canvas_update_node",
    "canvas_update_node_text",
    "canvas_move_nodes",
    "canvas_resize_node",
    "canvas_delete_nodes",
    "canvas_connect_nodes",
    "canvas_select_nodes",
    "canvas_set_viewport",
    "canvas_run_generation",
    "workbench_image_generate",
    "workbench_video_generate",
    "assets_add",
]);

/** 使用 Claude Agent SDK 运行画布 Agent，并管理会话与中断。 */
export class ClaudeSdkAdapter {
    private active = new Map<string, ActiveRun>();
    private permissions = new Map<string, PendingPermission>();
    private sessionApprovals = new Map<string, Set<ToolName>>();

    constructor(
        private queryFactory: QueryFactory = query,
        private mcpServerFactory: McpServerFactory = defaultMcpServer,
        private runIdFactory: () => string = crypto.randomUUID,
    ) {}

    /** 返回当前是否有 Claude turn 正在运行。 */
    get busy() {
        return this.active.size > 0;
    }

    /** 将网页的权限决定交还给等待中的 SDK 工具调用。 */
    resolvePermission(clientId: string, requestId: string, decision: PermissionDecision) {
        const pending = this.permissions.get(requestId);
        if (!pending || pending.clientId !== clientId) return false;
        this.permissions.delete(requestId);
        pending.signal.removeEventListener("abort", pending.onAbort);
        const accepted = decision !== "decline";
        if (decision === "acceptForSession") {
            const run = this.active.get(pending.runId);
            if (run) {
                const approved = this.sessionApprovals.get(run.state.sessionId) || new Set<ToolName>();
                approved.add(pending.toolName as ToolName);
                this.sessionApprovals.set(run.state.sessionId, approved);
            }
        }
        pending.emit("claude_approval_resolved", { requestId, provider: "claude", toolName: pending.toolName, decision });
        pending.resolve(accepted
            ? { behavior: "allow", decisionClassification: decision === "acceptForSession" ? "user_permanent" : "user_temporary" }
            : { behavior: "deny", message: "用户拒绝了这次 Claude 画布工具调用", decisionClassification: "user_reject" });
        return true;
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

    /** 从 SDK 原生初始化响应读取项目内非内置 Skill，不提交用户任务。 */
    async listSkills(cwd: string) {
        const projectSkills = await listProjectClaudeSkillNames(cwd);
        if (!projectSkills.length) return [];
        const abort = new AbortController();
        const activeQuery = this.queryFactory({
            prompt: "",
            options: {
                abortController: abort,
                cwd,
                settingSources: ["project"],
                settings: { disableAllHooks: true },
                permissionMode: "dontAsk",
                strictMcpConfig: true,
                mcpServers: {},
                tools: [],
                skills: projectSkills,
                env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `canvas-agent/${VERSION}` },
            } satisfies ClaudeSdkOptions,
        });
        try {
            if (!activeQuery.supportedCommands) throw new Error("当前 Claude Agent SDK 不支持读取 Skill 列表");
            const commands = await activeQuery.supportedCommands();
            const projectSkillNames = new Set(projectSkills);
            const skills = new Map<string, { name: string; description: string }>();
            commands.forEach((command) => {
                const name = command.name.trim();
                if (command.builtin || !projectSkillNames.has(name) || skills.has(name)) return;
                skills.set(name, { name, description: command.description.trim() });
            });
            return [...skills.values()].sort((left, right) => left.name.localeCompare(right.name));
        } finally {
            activeQuery.close?.();
        }
    }

    /** 启动一轮 SDK 调用；事件通过 SSE 异步返回。 */
    async run(prompt: string, emit: AgentEmit, options: RunOptions) {
        if (!prompt.trim()) throw new Error("请输入任务内容");
        if (this.active.size) throw new Error("Claude 正在执行其他任务，请先停止当前任务");
        if (options.skill && !(await listProjectClaudeSkillNames(options.cwd)).includes(options.skill)) throw new Error("Claude Skill 不存在或不可用");
        const runId = this.runIdFactory();
        const abort = new AbortController();
        const state = new ClaudeEventState({ clientId: options.clientId, threadId: options.threadId || options.sessionId || runId, turnId: runId });
        let activeQuery: ClaudeSdkQuery;
        try {
            activeQuery = this.queryFactory({ prompt, options: this.queryOptions(abort, options, runId, emit) });
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
        this.rejectPermissions(run.runId, "Claude 任务已停止");
        void run.query.interrupt?.().catch(() => undefined);
        run.abort.abort();
        run.query.close?.();
        return true;
    }

    private queryOptions(abort: AbortController, options: RunOptions, runId: string, emit: AgentEmit) {
        const permissionMode = options.permissionMode || "request";
        const skill = options.skill?.trim();
        const projectSkill = Boolean(skill);
        const mcpServer = this.mcpServer(permissionMode);
        const sdkPermissionMode = claudePermissionMode(permissionMode);
        const usePermissionCallback = sdkPermissionMode === "default" || sdkPermissionMode === "auto";
        return {
            abortController: abort,
            cwd: options.cwd,
            systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: AGENT_PROMPT, snapshot: true },
            includePartialMessages: true,
            persistSession: true,
            permissionMode: sdkPermissionMode,
            ...(sdkPermissionMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
            settingSources: projectSkill ? ["project"] : [],
            ...(projectSkill ? { settings: { disableAllHooks: true } } : {}),
            strictMcpConfig: true,
            mcpServers: { "infinite-canvas": mcpServer },
            allowedTools: sdkPermissionMode === "bypassPermissions" ? ["mcp__infinite-canvas__*", ...(projectSkill ? ["Skill"] : [])] : [],
            tools: projectSkill ? ["Skill"] : [],
            skills: skill ? [skill] : [],
            ...(options.sessionId ? { resume: options.sessionId } : {}),
            ...(options.model ? { model: options.model } : {}),
            ...(options.effort ? { effort: options.effort } : {}),
            ...(usePermissionCallback ? { canUseTool: this.canUseTool(runId, options.clientId, emit) } : {}),
            env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: `canvas-agent/${VERSION}` },
        } satisfies ClaudeSdkOptions;
    }

    /** 将 SDK MCP 写入工具标记为逐次审批，读工具仍由 callback 自动放行。 */
    private mcpServer(permissionMode: AgentPermissionMode) {
        const server = this.mcpServerFactory();
        if (permissionMode !== "request" || server.type !== "sdk") return server;
        return {
            ...server,
            tools: [...CLAUDE_WRITE_TOOLS].map((name) => ({ name, permission_policy: "always_ask" as const })),
        };
    }

    private canUseTool(runId: string, clientId: string, emit: AgentEmit): CanUseTool {
        return async (toolName, input, options) => {
            const canvasTool = toolName.replace(/^mcp__infinite-canvas__/, "") as ToolName;
            if (!CLAUDE_WRITE_TOOLS.has(canvasTool)) return { behavior: "allow" };
            const run = this.active.get(runId);
            if (run && this.sessionApprovals.get(run.state.sessionId)?.has(canvasTool)) return { behavior: "allow", decisionClassification: "user_permanent" };
            const requestId = options.requestId;
            if (!requestId) return { behavior: "deny", message: "Claude SDK 未提供权限请求 ID", decisionClassification: "user_reject" };
            return await new Promise<PermissionResult>((resolve) => {
                const pending: PendingPermission = {
                    requestId,
                    runId,
                    clientId,
                    toolName: canvasTool,
                    emit,
                    signal: options.signal,
                    resolve,
                    onAbort: () => {
                        if (!this.permissions.delete(requestId)) return;
                        emit("claude_approval_resolved", { requestId, provider: "claude", toolName: canvasTool, decision: "decline" });
                        resolve({ behavior: "deny", message: "Claude 任务已停止", decisionClassification: "user_reject" });
                    },
                };
                this.permissions.set(requestId, pending);
                options.signal.addEventListener("abort", pending.onAbort, { once: true });
                emit("claude_approval", {
                    requestId,
                    provider: "claude",
                    method: "claude/permission",
                    toolName: canvasTool,
                    toolInput: input,
                    title: options.title,
                    description: options.description,
                    reason: options.decisionReason,
                    displayName: options.displayName,
                    toolUseId: options.toolUseID,
                    threadId: this.active.get(runId)?.state.sessionId || runId,
                    turnId: runId,
                });
            });
        };
    }

    private rejectPermissions(runId: string, message: string) {
        [...this.permissions.values()].filter((item) => item.runId === runId).forEach((item) => {
            this.permissions.delete(item.requestId);
            item.signal.removeEventListener("abort", item.onAbort);
            item.emit("claude_approval_resolved", { requestId: item.requestId, provider: "claude", toolName: item.toolName, decision: "decline" });
            item.resolve({ behavior: "deny", message, decisionClassification: "user_reject" });
        });
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
            this.rejectPermissions(run.runId, "Claude 任务已结束");
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

function claudePermissionMode(mode: AgentPermissionMode): "default" | "auto" | "bypassPermissions" {
    if (mode === "automatic") return "auto";
    if (mode === "full") return "bypassPermissions";
    return "default";
}
