import assert from "node:assert/strict";
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
    assert.deepEqual(received?.allowedTools, ["mcp__infinite-canvas__*"]);
    assert.deepEqual(received?.settingSources, []);
    assert.equal(received?.strictMcpConfig, true);
    assert.equal(received?.permissionMode, "dontAsk");
    assert.equal(received?.includePartialMessages, true);
    assert.equal(received?.resume, "session-resume");
    assert.equal(received?.model, "claude-sonnet-4-5");
    assert.equal(received?.effort, "high");
    await waitFor(() => !adapter.busy);
    assert.equal(events.filter((item) => item.type === "agent_done").length, 1);
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
            receivedPrompt = prompt;
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
