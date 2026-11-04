import assert from "node:assert/strict";
import test from "node:test";

import { ClaudeAttachmentError, claudePromptWithImages, normalizeClaudeImageAttachments, withAttachmentContext, withoutAttachmentContext, withoutClaudeModelContext } from "./claude-attachments.js";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==";

test("Claude 图片附件只保留受支持字段并按文件签名确定类型", () => {
    assert.deepEqual(normalizeClaudeImageAttachments([{
        id: " image-1 ",
        name: " reference.png ",
        type: "text/plain",
        size: 42,
        width: 320,
        height: 180,
        dataUrl: PNG_DATA_URL,
        ignored: "not-forwarded",
    }]), [{
        id: "image-1",
        name: "reference.png",
        type: "image/png",
        size: 42,
        width: 320,
        height: 180,
        dataUrl: PNG_DATA_URL,
    }]);
});

test("Claude 图片附件拒绝错误结构、超量、非法类型和超限载荷", () => {
    assert.throws(() => normalizeClaudeImageAttachments({}), ClaudeAttachmentError);
    assert.throws(() => normalizeClaudeImageAttachments(Array.from({ length: 7 }, () => ({ dataUrl: "data:image/png;base64,YQ==" }))), /最多 6 张/);
    assert.throws(() => normalizeClaudeImageAttachments([
        { id: "same", dataUrl: PNG_DATA_URL },
        { id: "same", dataUrl: PNG_DATA_URL },
    ]), /ID 重复/);
    assert.throws(() => normalizeClaudeImageAttachments([{ dataUrl: "data:image/svg+xml;base64,YQ==" }]), /不是受支持/);
    assert.throws(() => normalizeClaudeImageAttachments([{ dataUrl: "data:image/png;base64,aW1hZ2U=" }]), /文件内容与声明/);
    assert.throws(() => normalizeClaudeImageAttachments([{ dataUrl: `data:image/png;base64,${"a".repeat(28 * 1024 * 1024)}` }]), /超过 28MB/);
});

test("Claude 图片输入保留文本顺序并使用原生 base64 图片块", async () => {
    const prompt = claudePromptWithImages("比较两张图", [
        { dataUrl: "data:image/png;base64,aW1hZ2UtMQ==" },
        { dataUrl: "data:image/webp;base64,aW1hZ2UtMg==" },
    ], "8ebaf34b-7110-4bd7-a194-3888f03f7bf0");
    assert.equal(typeof prompt, "object");
    const messages = [];
    for await (const message of prompt as AsyncIterable<unknown>) messages.push(message);
    assert.deepEqual(messages, [{
        type: "user",
        uuid: "8ebaf34b-7110-4bd7-a194-3888f03f7bf0",
        parent_tool_use_id: null,
        message: {
            role: "user",
            content: [
                { type: "text", text: "比较两张图" },
                { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1hZ2UtMQ==" } },
                { type: "image", source: { type: "base64", media_type: "image/webp", data: "aW1hZ2UtMg==" } },
            ],
        },
    }]);
});

test("没有图片时 Claude 仍使用稳定 UUID 绑定文本消息", async () => {
    const prompt = claudePromptWithImages("只处理文本", [], "8ebaf34b-7110-4bd7-a194-3888f03f7bf0");
    const messages = [];
    for await (const message of prompt) messages.push(message);
    assert.deepEqual(messages, [{
        type: "user",
        uuid: "8ebaf34b-7110-4bd7-a194-3888f03f7bf0",
        parent_tool_use_id: null,
        message: {
            role: "user",
            content: [{ type: "text", text: "只处理文本" }],
        },
    }]);
});

test("Claude 历史隐藏仅供模型执行的附件上下文", () => {
    const prompt = withAttachmentContext("比较两张图", [
        { id: "image-1", name: "first.png" },
        { id: "image-2", name: "second.png" },
    ]);
    assert.match(prompt, /attachmentId=image-1/);
    assert.equal(withoutAttachmentContext(prompt), "比较两张图");
    assert.equal(withoutAttachmentContext("保留原文"), "保留原文");
    const canvasContext = "\n\n本轮引用的当前画布素材：\n1. mention=\"@Image_1\", nodeId=\"node-1\", title=\"参考图\", type=image\n需要读取或操作这些素材时，先调用 canvas_get_state，并使用上面的 nodeId 精确定位，不要按标题猜测节点。";
    assert.equal(withoutClaudeModelContext(`比较两张图${canvasContext}`), "比较两张图");
    assert.equal(withoutClaudeModelContext(withAttachmentContext(`比较两张图${canvasContext}`, [
        { id: "image-1", name: "first.png" },
        { id: "image-2", name: "second.png" },
    ])), "比较两张图");
    assert.equal(withoutClaudeModelContext(`比较两张图${canvasContext}\n`), "比较两张图");
});
