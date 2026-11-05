import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ClaudeSdkAdapter, createCanvasMcpServer } from "./claude-sdk.js";

test("SDK Adapter 使用隔离配置并只允许画布 MCP", async () => {
    let received: Record<string, unknown> | undefined;
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            received = options as unknown as Record<string, unknown>;
            return Object.assign((async function* () {
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => undefined });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
        () => "turn-1",
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    const run = await adapter.run("读取画布", (type, payload) => events.push({ type, payload }), {
        clientId: "client-1",
        cwd: "/tmp/canvas",
        sessionId: "session-resume",
        model: "claude-sonnet-4-5",
        effort: "high",
    });
    assert.equal(run.runId, "turn-1");
    assert.deepEqual(received?.tools, []);
    assert.deepEqual(received?.settingSources, []);
    assert.equal(received?.strictMcpConfig, true);
    assert.equal(received?.permissionMode, "default");
    assert.deepEqual(received?.allowedTools, []);
    assert.equal(typeof received?.canUseTool, "function");
    assert.equal(received?.includePartialMessages, true);
    assert.equal(received?.resume, "session-resume");
    assert.equal(received?.model, "claude-sonnet-4-5");
    assert.equal(received?.effort, "high");
    await waitFor(() => !adapter.busy);
    assert.equal(events.filter((item) => item.type === "agent_done").length, 1);
});

test("Claude run 在网页启动前已断开时拒绝创建无人控制的任务", async () => {
    let queried = false;
    const adapter = new ClaudeSdkAdapter(({ options }) => {
        queried = true;
        return Object.assign((async function* () {
            yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
        })(), { close: () => undefined });
    });

    await assert.rejects(adapter.run("读取画布", () => undefined, {
        clientId: "client-1",
        cwd: "/tmp/canvas",
        isClientActive: () => false,
    }), /网页已断开/);
    assert.equal(queried, false);
    assert.equal(adapter.busy, false);
});

test("Claude 在启动校验期间断线会取消占位且不再创建查询", async () => {
    const cwd = await projectWithSkill("cancel-skill");
    let queried = false;
    const adapter = new ClaudeSdkAdapter(({ options }) => {
        queried = true;
        return Object.assign((async function* () {
            yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
        })(), { close: () => undefined });
    });
    try {
        const running = adapter.run("/cancel-skill 写入画布", () => undefined, {
            clientId: "client-1",
            cwd,
            skill: "cancel-skill",
            isClientActive: () => true,
        });
        assert.equal(await adapter.interrupt("client-1"), true);
        assert.equal((await running).runId.length > 0, true);
        assert.equal(queried, false);
        assert.equal(adapter.busy, false);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test("Claude 占位后未进入 run 就取消时不会留下永久 busy 状态", async () => {
    const adapter = new ClaudeSdkAdapter(() => {
        throw new Error("不应创建查询");
    });
    adapter.reserve("client-1");
    assert.equal(adapter.busy, true);
    assert.equal(await adapter.interrupt("client-1"), true);
    assert.equal(adapter.busy, false);
});

test("请求模式把 Claude 写工具转入网页审批，并支持本会话批准", async () => {
    let canUseTool: any;
    let release = () => undefined;
    const waiting = new Promise<void>((resolve) => {
        release = resolve;
    });
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            canUseTool = options.canUseTool;
            return Object.assign((async function* () {
                yield { type: "system", subtype: "init", session_id: "session-1" };
                await waiting;
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => release() });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
        () => "turn-1",
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    await adapter.run("写入画布", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "request" });
    assert.equal(typeof canUseTool, "function");
    const signal = new AbortController().signal;
    const result = canUseTool("mcp__infinite-canvas__canvas_apply_ops", { ops: [] }, {
        signal,
        requestId: "permission-1",
        toolUseID: "tool-1",
        title: "Claude 想修改画布",
    });
    await waitFor(() => events.some((item) => item.type === "claude_approval"));
    assert.equal(adapter.resolvePermission("client-2", "permission-1", "accept"), false);
    assert.equal(adapter.resolvePermission("client-1", "permission-1", "acceptForSession"), true);
    assert.deepEqual(await result, { behavior: "allow", decisionClassification: "user_permanent" });
    assert.ok(events.some((item) => item.type === "claude_approval_resolved" && (item.payload as Record<string, unknown>).decision === "acceptForSession"));
    const next = await canUseTool("mcp__infinite-canvas__canvas_apply_ops", { ops: [] }, {
        signal,
        requestId: "permission-2",
        toolUseID: "tool-2",
    });
    assert.deepEqual(next, { behavior: "allow", decisionClassification: "user_permanent" });
    assert.equal(events.filter((item) => item.type === "claude_approval").length, 1);
    release();
    await waitFor(() => !adapter.busy);
});

test("本会话批准在同一 Claude SDK 会话的后续 turn 继续生效", async () => {
    let canUseTool: any;
    let turn = 0;
    let finishFirst = () => undefined;
    let finishSecond = () => undefined;
    const firstWaiting = new Promise<void>((resolve) => {
        finishFirst = resolve;
    });
    const secondWaiting = new Promise<void>((resolve) => {
        finishSecond = resolve;
    });
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            canUseTool = options.canUseTool;
            turn += 1;
            const waiting = turn === 1 ? firstWaiting : secondWaiting;
            const finish = turn === 1 ? finishFirst : finishSecond;
            return Object.assign((async function* () {
                yield { type: "system", subtype: "init", session_id: "session-1" };
                await waiting;
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: finish });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    await adapter.run("第一次写入", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "request" });
    const first = canUseTool("mcp__infinite-canvas__canvas_apply_ops", { ops: [] }, { signal: new AbortController().signal, requestId: "permission-1" });
    await waitFor(() => events.some((item) => item.type === "claude_approval"));
    assert.equal(adapter.resolvePermission("client-1", "permission-1", "acceptForSession"), true);
    assert.equal((await first).behavior, "allow");
    finishFirst();
    await waitFor(() => !adapter.busy);

    await adapter.run("第二次写入", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", sessionId: "session-1", permissionMode: "request" });
    assert.deepEqual(await canUseTool("mcp__infinite-canvas__canvas_apply_ops", { ops: [] }, { signal: new AbortController().signal, requestId: "permission-2" }), {
        behavior: "allow",
        decisionClassification: "user_permanent",
    });
    assert.equal(events.filter((item) => item.type === "claude_approval").length, 1);
    finishSecond();
    await waitFor(() => !adapter.busy);
});

test("拒绝 Claude 审批会把原生权限结果返回给 SDK", async () => {
    let canUseTool: any;
    let finish = () => undefined;
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            canUseTool = options.canUseTool;
            const waiting = new Promise<void>((resolve) => {
                finish = resolve;
            });
            return Object.assign((async function* () {
                yield { type: "system", subtype: "init", session_id: "session-1" };
                await waiting;
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => finish() });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    await adapter.run("删除画布", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "request" });
    const pending = canUseTool("mcp__infinite-canvas__canvas_delete_nodes", { nodeIds: ["node-1"] }, { signal: new AbortController().signal, requestId: "permission-1" });
    await waitFor(() => events.some((item) => item.type === "claude_approval"));
    assert.equal(adapter.resolvePermission("client-1", "permission-1", "decline"), true);
    assert.deepEqual(await pending, { behavior: "deny", message: "用户拒绝了这次 Claude 画布工具调用", decisionClassification: "user_reject" });
    assert.ok(events.some((item) => item.type === "claude_approval_resolved" && (item.payload as Record<string, unknown>).decision === "decline"));
    finish();
    await waitFor(() => !adapter.busy);
});

test("停止 Claude turn 会拒绝未决审批并通知网页", async () => {
    let canUseTool: any;
    let finish = () => undefined;
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            canUseTool = options.canUseTool;
            const waiting = new Promise<void>((resolve) => {
                finish = resolve;
            });
            return Object.assign((async function* () {
                yield { type: "system", subtype: "init", session_id: "session-1" };
                await waiting;
            })(), {
                interrupt: async () => undefined,
                close: () => finish(),
            });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
        () => "turn-1",
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    await adapter.run("等待审批", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "request" });
    const pending = canUseTool("mcp__infinite-canvas__canvas_apply_ops", { ops: [] }, { signal: new AbortController().signal, requestId: "permission-1" });
    await waitFor(() => events.some((item) => item.type === "claude_approval"));
    assert.equal(await adapter.interrupt("client-1", "turn-1"), true);
    assert.deepEqual(await pending, { behavior: "deny", message: "Claude 任务已停止", decisionClassification: "user_reject" });
    assert.ok(events.some((item) => item.type === "claude_approval_resolved" && (item.payload as Record<string, unknown>).decision === "decline"));
    await waitFor(() => !adapter.busy);
});

test("Claude 权限模式映射到 SDK 原生模式", async () => {
    const received: Array<Record<string, unknown>> = [];
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            received.push(options as unknown as Record<string, unknown>);
            return Object.assign((async function* () {
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => undefined });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    await adapter.run("自动审批", () => undefined, { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "automatic" });
    await waitFor(() => !adapter.busy);
    await adapter.run("完全访问", () => undefined, { clientId: "client-1", cwd: "/tmp/canvas", permissionMode: "full" });
    await waitFor(() => !adapter.busy);
    assert.equal(received[0]?.permissionMode, "auto");
    assert.equal(typeof received[0]?.canUseTool, "function");
    assert.equal(received[1]?.permissionMode, "bypassPermissions");
    assert.equal(received[1]?.allowDangerouslySkipPermissions, true);
    assert.deepEqual(received[1]?.allowedTools, ["mcp__infinite-canvas__*"]);
});

test("画布 MCP Server 能按 Zod 4 Schema 注册", () => {
    const server = createCanvasMcpServer({ url: "http://127.0.0.1:17371", token: "test-token" });
    assert.equal(server.type, "sdk");
    assert.equal(server.name, "infinite-canvas");
});

test("模型列表使用 SDK 原生能力且不执行用户任务", async () => {
    let receivedPrompt = "";
    let receivedOptions: Record<string, unknown> | undefined;
    let closed = 0;
    const adapter = new ClaudeSdkAdapter(
        ({ prompt, options }) => {
            receivedPrompt = typeof prompt === "string" ? prompt : "<stream>";
            receivedOptions = options as unknown as Record<string, unknown>;
            return Object.assign((async function* () {
                throw new Error("模型列表不应消费生成事件");
            })(), {
                supportedModels: async () => [
                    { value: "sonnet", resolvedModel: "claude-sonnet-5", displayName: "Sonnet", description: "均衡模型" },
                    { value: "opus", displayName: "Opus", description: "高能力模型" },
                ],
                close: () => {
                    closed += 1;
                },
            });
        },
    );
    assert.deepEqual(await adapter.listModels("/tmp/canvas"), [
        { id: "sonnet", model: "sonnet", displayName: "Sonnet", description: "均衡模型", supportedReasoningEfforts: [] },
        { id: "opus", model: "opus", displayName: "Opus", description: "高能力模型", supportedReasoningEfforts: [] },
    ]);
    assert.equal(receivedPrompt, "");
    assert.equal(receivedOptions?.cwd, "/tmp/canvas");
    assert.deepEqual(receivedOptions?.settingSources, []);
    assert.deepEqual(receivedOptions?.tools, []);
    assert.equal(closed, 1);
});

test("模型列表读取失败时不伪造模型并释放查询", async () => {
    let closed = 0;
    const adapter = new ClaudeSdkAdapter(() => Object.assign((async function* () {
        yield undefined;
    })(), {
        supportedModels: async () => {
            throw new Error("模型读取失败");
        },
        close: () => {
            closed += 1;
        },
    }));
    await assert.rejects(adapter.listModels("/tmp/canvas"), /模型读取失败/);
    assert.equal(closed, 1);
});

test("Skill 列表读取项目内非内置命令且不执行用户任务", async () => {
    const cwd = await projectWithSkill("probe-skill");
    let receivedPrompt = "";
    let receivedOptions: Record<string, unknown> | undefined;
    let closed = 0;
    const adapter = new ClaudeSdkAdapter(
        ({ prompt, options }) => {
            receivedPrompt = typeof prompt === "string" ? prompt : "<stream>";
            receivedOptions = options as unknown as Record<string, unknown>;
            return Object.assign((async function* () {
                throw new Error("Skill 列表不应消费生成事件");
            })(), {
                supportedCommands: async () => [
                    { name: "probe-skill", description: "项目 Skill", argumentHint: "", builtin: false },
                    { name: "help", description: "内置命令", argumentHint: "", builtin: true },
                    { name: "outside-skill", description: "项目外命令", argumentHint: "", builtin: false },
                    { name: "probe-skill", description: "重复项", argumentHint: "", builtin: false },
                ],
                close: () => {
                    closed += 1;
                },
            });
        },
    );
    try {
        assert.deepEqual(await adapter.listSkills(cwd), [{ name: "probe-skill", description: "项目 Skill" }]);
        assert.equal(receivedPrompt, "");
        assert.equal(receivedOptions?.cwd, cwd);
        assert.deepEqual(receivedOptions?.settingSources, ["project"]);
        assert.deepEqual(receivedOptions?.settings, { disableAllHooks: true });
        assert.deepEqual(receivedOptions?.tools, []);
        assert.deepEqual(receivedOptions?.skills, ["probe-skill"]);
        assert.equal(closed, 1);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test("选择 Claude Skill 时只开放 Skill 与画布 MCP，并禁用项目 hooks", async () => {
    const cwd = await projectWithSkill("probe-skill");
    let received: Record<string, unknown> | undefined;
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            received = options as unknown as Record<string, unknown>;
            return Object.assign((async function* () {
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => undefined });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    try {
        await adapter.run("/probe-skill 写入画布", () => undefined, { clientId: "client-1", cwd, permissionMode: "request", skill: "probe-skill" });
        await waitFor(() => !adapter.busy);
        assert.deepEqual(received?.settingSources, ["project"]);
        assert.deepEqual(received?.settings, { disableAllHooks: true });
        assert.deepEqual(received?.tools, ["Skill"]);
        assert.deepEqual(received?.skills, ["probe-skill"]);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test("同时选择多个 Claude Skill 时全部传给 SDK", async () => {
    const cwd = await projectWithSkills("probe-skill", "copy-review");
    let received: Record<string, unknown> | undefined;
    const adapter = new ClaudeSdkAdapter(
        ({ options }) => {
            received = options as unknown as Record<string, unknown>;
            return Object.assign((async function* () {
                yield { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => undefined });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    try {
        await adapter.run("/probe-skill /copy-review 写入画布", () => undefined, { clientId: "client-1", cwd, permissionMode: "request", skill: ["probe-skill", "copy-review"] });
        await waitFor(() => !adapter.busy);
        assert.deepEqual(received?.settingSources, ["project"]);
        assert.deepEqual(received?.tools, ["Skill"]);
        assert.deepEqual(received?.skills, ["probe-skill", "copy-review"]);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test("没有项目 Skill 时不启动 Claude 查询，未知 Skill 也会被拒绝", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-claude-empty-"));
    let queries = 0;
    const adapter = new ClaudeSdkAdapter(() => {
        queries += 1;
        return Object.assign((async function* () {
            yield undefined;
        })(), { close: () => undefined });
    });
    try {
        assert.deepEqual(await adapter.listSkills(cwd), []);
        await assert.rejects(adapter.run("/unknown 写入画布", () => undefined, { clientId: "client-1", cwd, skill: "unknown" }), /Skill 不存在或不可用/);
        assert.equal(queries, 0);
    } finally {
        await fs.rm(cwd, { recursive: true, force: true });
    }
});

test("Claude 图片附件使用 SDK 原生图文消息并通知真实会话 ID", async () => {
    const messageId = "8ebaf34b-7110-4bd7-a194-3888f03f7bf0";
    let receivedPrompt: unknown;
    let sessionId = "";
    const adapter = new ClaudeSdkAdapter(
        ({ prompt }) => {
            receivedPrompt = prompt;
            return Object.assign((async function* () {
                yield { type: "system", subtype: "init", session_id: "session-image" };
                yield { type: "result", session_id: "session-image", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} };
            })(), { close: () => undefined });
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
    );
    await adapter.run("查看参考图", () => undefined, {
        clientId: "client-1",
        cwd: "/tmp/canvas",
        messageId,
        onSessionId: (value) => {
            sessionId = value;
        },
    }, [{
        id: "attachment-1",
        name: "reference.png",
        type: "image/png",
        size: 12,
        width: 320,
        height: 180,
        dataUrl: "data:image/png;base64,aW1hZ2U=",
    }]);

    assert.equal(typeof (receivedPrompt as AsyncIterable<unknown>)[Symbol.asyncIterator], "function");
    const iterator = (receivedPrompt as AsyncIterable<Record<string, any>>)[Symbol.asyncIterator]();
    const first = await iterator.next();
    assert.equal(first.done, false);
    assert.equal(first.value?.uuid, messageId);
    assert.deepEqual(first.value?.message, {
        role: "user",
        content: [
            { type: "text", text: "查看参考图" },
            { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" } },
        ],
    });
    assert.equal((await iterator.next()).done, true);
    await waitFor(() => !adapter.busy);
    assert.equal(sessionId, "session-image");
});

test("中断只作用于发起网页且完成后释放运行状态", async () => {
    let interrupted = 0;
    let closed = 0;
    let release = () => undefined;
    const waiting = new Promise<void>((resolve) => {
        release = resolve;
    });
    const adapter = new ClaudeSdkAdapter(
        () => Object.assign((async function* () {
            yield { type: "system", subtype: "init", session_id: "session-1" };
            await waiting;
        })(), {
            interrupt: async () => {
                interrupted += 1;
            },
            close: () => {
                closed += 1;
                release();
            },
        }),
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
        () => "turn-1",
    );
    let finished = 0;
    await adapter.run("等待", () => undefined, { clientId: "client-1", cwd: "/tmp/canvas", onFinish: () => (finished += 1) });
    await waitFor(() => adapter.busy);
    assert.equal(await adapter.interrupt("client-2", "turn-1"), false);
    assert.equal(await adapter.interrupt("client-1", "turn-1"), true);
    assert.equal(interrupted, 1);
    await waitFor(() => !adapter.busy);
    assert.equal(closed >= 1, true);
    assert.equal(finished, 1);
    assert.equal(await adapter.interrupt("client-1", "turn-1"), false);
});

test("SDK 启动异常也会发送一次失败终态", async () => {
    const adapter = new ClaudeSdkAdapter(
        () => {
            throw new Error("token=secret123");
        },
        () => ({ type: "sdk", name: "infinite-canvas", instance: {} } as never),
        () => "turn-1",
    );
    const events: Array<{ type: string; payload: unknown }> = [];
    let finished = 0;
    await adapter.run("失败", (type, payload) => events.push({ type, payload }), { clientId: "client-1", cwd: "/tmp/canvas", onFinish: () => (finished += 1) });
    const terminal = events.filter((item) => item.type === "agent_event" && (item.payload as Record<string, unknown>).type === "turn.completed");
    assert.equal(terminal.length, 1);
    assert.equal(((terminal[0].payload as Record<string, unknown>).error as Record<string, unknown>).message, "token=[REDACTED]");
    assert.equal(finished, 1);
    assert.equal(adapter.busy, false);
});

async function waitFor(predicate: () => boolean) {
    for (let index = 0; index < 50; index += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error("timed out");
}

async function projectWithSkill(name: string) {
    return await projectWithSkills(name);
}

async function projectWithSkills(...names: string[]) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "canvas-claude-skill-"));
    for (const name of names) {
        const skillDir = path.join(root, ".claude", "skills", name);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: 测试 Skill\n---\n\n按项目规则执行。\n`);
    }
    return root;
}
