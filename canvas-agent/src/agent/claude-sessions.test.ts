import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClaudeHistory } from "./claude-sessions.js";
import { AGENT_MEMORY_CONTEXT_INSTRUCTION, AGENT_MEMORY_CONTEXT_MARKER } from "./memory-context.js";

test("Claude history keeps text and tool summaries without local-only fields", () => {
    const history = normalizeClaudeHistory("session-1", [
        {
            uuid: "user-1",
            type: "user",
            message: { role: "user", content: [{ type: "text", text: "画出雨夜街角" }] },
        },
        {
            uuid: "assistant-1",
            type: "assistant",
            message: {
                role: "assistant",
                content: [
                    { type: "thinking", thinking: "不应进入可见历史" },
                    { type: "text", text: "我先读取画布。" },
                    { type: "tool_use", id: "tool-1", name: "canvas_get_state", input: { apiKey: "secret" } },
                ],
            },
        },
        {
            uuid: "user-2",
            type: "user",
            message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tool-1", content: "ok" }] },
        },
    ]);

    assert.deepEqual(history, [
        { id: "claude-history:user-1:0", itemId: "claude-history:user-1:0", threadId: "session-1", turnId: "user-1", role: "user", text: "画出雨夜街角" },
        { id: "claude-history:assistant-1:1", itemId: "claude-history:assistant-1:1", threadId: "session-1", turnId: "", role: "assistant", title: "Claude", text: "我先读取画布。" },
        {
            id: "claude-history:assistant-1:2",
            itemId: "claude-history:assistant-1:2",
            threadId: "session-1",
            turnId: "",
            role: "tool",
            title: "canvas_get_state",
            text: "canvas_get_state",
            detail: { kind: "tool", status: "completed" },
        },
    ]);
    assert.doesNotMatch(JSON.stringify(history), /secret|apiKey/);
});

test("Claude history accepts plain string messages and ignores unknown blocks", () => {
    const history = normalizeClaudeHistory("session-2", [
        { uuid: "user-1", type: "user", message: { content: "继续完善场景" } },
        { uuid: "assistant-1", type: "assistant", message: { content: [{ type: "image", source: {} }] } },
        { uuid: "system-1", type: "system", message: { content: "hidden" } },
    ]);

    assert.deepEqual(history.map(({ role, text }) => ({ role, text })), [{ role: "user", text: "继续完善场景" }]);
});

test("Claude history hides canvas reference context", () => {
    const prompt = [
        "沿用这张参考图",
        "本轮引用的当前画布素材：",
        '1. mention="@Image_1", nodeId="node-1", title="参考图", type=image',
        "需要读取或操作这些素材时，先调用 canvas_get_state，并使用上面的 nodeId 精确定位，不要按标题猜测节点。",
    ].join("\n\n");
    const history = normalizeClaudeHistory("session-canvas", [
        { uuid: "user-1", type: "user", message: { content: [{ type: "text", text: prompt }] } },
    ]);

    assert.deepEqual(history.map(({ text }) => text), ["沿用这张参考图"]);
});

test("Claude history marks failed and unmatched tools without exposing tool payloads", () => {
    const history = normalizeClaudeHistory("session-3", [
        {
            uuid: "assistant-1",
            type: "assistant",
            message: { content: [
                { type: "tool_use", id: "tool-failed", name: "site_navigate", input: { url: "https://example.com/?token=secret" } },
                { type: "tool_use", id: "tool-pending", name: "canvas_get_state", input: {} },
            ] },
        },
        {
            uuid: "user-1",
            type: "user",
            message: { content: [{ type: "tool_result", tool_use_id: "tool-failed", is_error: true, content: "Authorization: Bearer secret" }] },
        },
    ]);

    assert.deepEqual(history.map(({ detail }) => detail?.status), ["failed", "unknown"]);
    assert.doesNotMatch(JSON.stringify(history), /example\.com|Authorization|token=secret/);
});

test("Claude user history exposes the original prompt without model-only attachment context", () => {
    const history = normalizeClaudeHistory("session-4", [{
        uuid: "user-attachment",
        type: "user",
        message: { content: [{
            type: "text",
            text: "比较两张图\n\n本轮可用图片附件（顺序与图片输入一致）：\n1. attachmentId=image-1, name=\"first.png\"\n需要把附件放入画布或作为生成参考图时，先调用 canvas_create_attachment_nodes，再使用返回的画布节点 ID 创建生成流程。",
        }] },
    }]);

    assert.deepEqual(history.map(({ turnId, text }) => ({ turnId, text })), [{ turnId: "user-attachment", text: "比较两张图" }]);
});

test("Claude history hides local Agent memory context", () => {
    const prompt = `继续优化这个分镜${AGENT_MEMORY_CONTEXT_MARKER}1. 标题：视觉偏好\n优先使用自然光和低饱和色彩。${AGENT_MEMORY_CONTEXT_INSTRUCTION}`;
    const history = normalizeClaudeHistory("session-memory", [
        { uuid: "user-memory", type: "user", message: { content: [{ type: "text", text: prompt }] } },
    ]);

    assert.deepEqual(history.map(({ text }) => text), ["继续优化这个分镜"]);
});
