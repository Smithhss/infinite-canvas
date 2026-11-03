import assert from "node:assert/strict";
import test from "node:test";

import { ClaudeEventState } from "./claude-events.js";

function recorder() {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    return {
        events,
        emit: (type: string, payload: unknown) => events.push({ type, payload: payload as Record<string, unknown> }),
        agentEvents: () => events.filter((item) => item.type === "agent_event").map((item) => item.payload),
    };
}

test("流式文本只产生一条完整消息", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "draft", turnId: "turn-1" });
    [
        { type: "system", subtype: "init", session_id: "session-1" },
        { type: "stream_event", session_id: "session-1", event: { type: "message_start", message: { id: "message-1" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_start", index: 0, content_block: { type: "text", id: "text-1" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "你" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "好" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_stop", index: 0 } },
        { type: "assistant", session_id: "session-1", message: { id: "message-1", content: [{ type: "text", id: "text-1", text: "你好" }] } },
        { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "你好", duration_ms: 12, usage: { input_tokens: 2, cache_read_input_tokens: 1, output_tokens: 3 }, total_cost_usd: 0.01, modelUsage: {} },
    ].forEach((message) => state.handle(message, output.emit));

    const events = output.agentEvents();
    assert.deepEqual(events.map((item) => item.type), ["thread.started", "turn.started", "item.started", "item.updated", "item.updated", "item.completed", "usage.updated", "turn.completed"]);
    assert.equal(events.filter((item) => item.type === "item.completed" && (item.item as Record<string, unknown>).type === "agent_message").length, 1);
    assert.equal((events.find((item) => item.type === "turn.completed")?.usage as Record<string, unknown>).input_tokens, 2);
    assert.equal(events[0].thread_id, "session-1");
    assert.equal(events[0].sourceClientId, "client-1");
});

test("工具调用在 tool_result 到达后才完成", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    [
        { type: "stream_event", session_id: "session-1", event: { type: "message_start", message: { id: "message-1" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tool-1", name: "mcp__infinite-canvas__canvas_get_state", input: {} } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"mode\":\"compact\"}" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_stop", index: 0 } },
        { type: "assistant", session_id: "session-1", message: { id: "message-1", content: [{ type: "tool_use", id: "tool-1", name: "mcp__infinite-canvas__canvas_get_state", input: { mode: "compact" } }] } },
        { type: "user", session_id: "session-1", message: { content: [{ type: "tool_result", tool_use_id: "tool-1", content: [{ type: "text", text: "{\"nodes\":[]}" }] }] } },
        { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "完成", usage: {}, modelUsage: {} },
    ].forEach((message) => state.handle(message, output.emit));

    const events = output.agentEvents();
    const started = events.find((item) => item.type === "item.started" && (item.item as Record<string, unknown>).type === "mcp_tool_call");
    const completed = events.find((item) => item.type === "item.completed" && (item.item as Record<string, unknown>).type === "mcp_tool_call");
    assert.equal((started?.item as Record<string, unknown>).tool, "canvas_get_state");
    assert.deepEqual((started?.item as Record<string, unknown>).arguments, { mode: "compact" });
    assert.equal((completed?.item as Record<string, unknown>).success, true);
    assert.deepEqual((completed?.item as Record<string, unknown>).result, { content: [{ type: "text", text: "{\"nodes\":[]}" }] });
    assert.equal(events.filter((item) => item.type === "item.completed" && (item.item as Record<string, unknown>).type === "mcp_tool_call").length, 1);
});

test("同一消息的思考和文本完整块不会重复", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    [
        { type: "stream_event", session_id: "session-1", event: { type: "message_start", message: { id: "message-1" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_start", index: 0, content_block: { type: "thinking" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "先检查" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_stop", index: 0 } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_start", index: 1, content_block: { type: "text" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "已完成" } } },
        { type: "stream_event", session_id: "session-1", event: { type: "content_block_stop", index: 1 } },
        { type: "assistant", session_id: "session-1", message: { id: "message-1", content: [{ type: "thinking", thinking: "先检查", signature: "sig" }] } },
        { type: "assistant", session_id: "session-1", message: { id: "message-1", content: [{ type: "text", text: "已完成" }] } },
        { type: "result", session_id: "session-1", subtype: "success", is_error: false, result: "已完成", usage: {}, modelUsage: {} },
    ].forEach((message) => state.handle(message, output.emit));

    const completed = output.agentEvents()
        .filter((item) => item.type === "item.completed")
        .map((item) => item.item as Record<string, unknown>);
    assert.equal(completed.filter((item) => item.type === "reasoning").length, 1);
    assert.equal(completed.filter((item) => item.type === "agent_message").length, 1);
    assert.equal(new Set(completed.map((item) => item.id)).size, completed.length);
});

test("SDK 错误只发送一次并清理凭据", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    state.handle({ type: "result", session_id: "session-1", subtype: "error_during_execution", is_error: true, errors: ["token=secret123 failed"], usage: {}, modelUsage: {} }, output.emit);
    state.fail(new Error("token=second-secret"), output.emit);
    state.interrupted(output.emit);

    const events = output.events;
    const failed = events.filter((item) => item.type === "agent_event" && item.payload.type === "turn.completed" && item.payload.status === "failed");
    assert.equal(failed.length, 1);
    assert.equal(events.filter((item) => item.type === "agent_done").length, 1);
    assert.equal(events.some((item) => item.type === "agent_error"), false);
    assert.equal((failed[0].payload.error as Record<string, unknown>).message, "token=[REDACTED] failed");
});

test("工具失败结果同样清理凭据", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    state.handle({ type: "assistant", session_id: "session-1", message: { content: [{ type: "tool_use", id: "tool-1", name: "mcp__infinite-canvas__canvas_get_state", input: {} }] } }, output.emit);
    state.handle({ type: "user", session_id: "session-1", message: { content: [{ type: "tool_result", tool_use_id: "tool-1", is_error: true, content: "Authorization: Bearer secret-token" }] } }, output.emit);
    const completed = output.agentEvents().find((item) => item.type === "item.completed");
    assert.equal(((completed?.item as Record<string, unknown>).error as Record<string, unknown>).message, "Authorization: [REDACTED]");
});

test("中断终态不会重复", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    state.interrupted(output.emit);
    state.interrupted(output.emit);
    state.fail(new Error("late"), output.emit);
    const terminal = output.agentEvents().filter((item) => item.type === "turn.completed");
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0].status, "interrupted");
});

test("未知 SDK 消息不会中断事件流", () => {
    const output = recorder();
    const state = new ClaudeEventState({ clientId: "client-1", threadId: "session-1", turnId: "turn-1" });
    state.handle({ type: "future_event", session_id: "session-1", payload: { value: 1 } }, output.emit);
    assert.deepEqual(output.events, []);
});
