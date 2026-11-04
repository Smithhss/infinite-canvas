import crypto from "node:crypto";

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { AgentAttachment } from "./types.js";

const MAX_IMAGES = 6;
const MAX_PAYLOAD_LENGTH = 28 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:(image\/(?:gif|jpe?g|png|webp));base64,([a-z0-9+/]+={0,2})$/i;
const ATTACHMENT_CONTEXT_MARKER = "\n\n本轮可用图片附件（顺序与图片输入一致）：\n";
const ATTACHMENT_CONTEXT_INSTRUCTION = "\n需要把附件放入画布或作为生成参考图时，先调用 canvas_create_attachment_nodes，再使用返回的画布节点 ID 创建生成流程。";
const CANVAS_CONTEXT_MARKER = "\n\n本轮引用的当前画布素材：\n";
const CANVAS_CONTEXT_INSTRUCTION = "\n需要读取或操作这些素材时，先调用 canvas_get_state，并使用上面的 nodeId 精确定位，不要按标题猜测节点。";

/** 拒绝无法安全转换为 Claude Messages API 图片块的附件。 */
export class ClaudeAttachmentError extends Error {}

/** 校验网页提交的 Claude 图片附件，并去除未使用字段。 */
export function normalizeClaudeImageAttachments(value: unknown): AgentAttachment[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new ClaudeAttachmentError("Claude 图片附件格式无效");
    if (value.length > MAX_IMAGES) throw new ClaudeAttachmentError(`Claude 图片附件最多 ${MAX_IMAGES} 张`);

    let payloadLength = 0;
    const seenIds = new Set<string>();
    return value.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new ClaudeAttachmentError("Claude 图片附件格式无效");
        const source = item as Record<string, unknown>;
        const dataUrl = typeof source.dataUrl === "string" ? source.dataUrl.trim() : "";
        const match = dataUrl.match(IMAGE_DATA_URL);
        if (!match) throw new ClaudeAttachmentError(`第 ${index + 1} 张图片不是受支持的 PNG、JPEG、GIF 或 WebP data URL`);
        payloadLength += dataUrl.length;
        if (payloadLength > MAX_PAYLOAD_LENGTH) throw new ClaudeAttachmentError("Claude 图片附件超过 28MB");

        const type = validateImagePayload(match[1], match[2], index);
        const id = text(source.id, 200) || crypto.randomUUID();
        if (seenIds.has(id)) throw new ClaudeAttachmentError(`Claude 图片附件 ID 重复：${id}`);
        seenIds.add(id);
        const name = text(source.name, 500) || `图片 ${index + 1}`;
        return {
            id,
            name,
            type,
            size: nonNegativeNumber(source.size),
            width: positiveNumber(source.width, 1024),
            height: positiveNumber(source.height, 1024),
            dataUrl,
        };
    });
}

/** 将输入转换为带稳定 UUID 的 Claude SDK 原生消息，供历史元数据绑定。 */
export function claudePromptWithImages(prompt: string, attachments: AgentAttachment[], messageId: string): AsyncIterable<SDKUserMessage> {
    const message: SDKUserMessage = {
        type: "user",
        uuid: messageId as SDKUserMessage["uuid"],
        parent_tool_use_id: null,
        message: {
            role: "user",
            content: [
                { type: "text", text: prompt },
                ...attachments.map((item) => {
                    const match = item.dataUrl?.match(IMAGE_DATA_URL);
                    if (!match) throw new ClaudeAttachmentError("Claude 图片附件内容无效");
                    return {
                        type: "image" as const,
                        source: {
                            type: "base64" as const,
                            media_type: claudeImageType(match[1]),
                            data: match[2],
                        },
                    };
                }),
            ],
        },
    };
    return (async function* () {
        yield message;
    })();
}

/** 给模型追加附件与画布工具提示，不改变网页历史中显示的用户原文。 */
export function withAttachmentContext(prompt: string, attachments: Array<{ id: string; name: string }>) {
    if (!attachments.length) return prompt;
    const list = attachments.map((item, index) => `${index + 1}. attachmentId=${item.id}, name=${JSON.stringify(item.name)}`).join("\n");
    return `${prompt}${ATTACHMENT_CONTEXT_MARKER}${list}${ATTACHMENT_CONTEXT_INSTRUCTION}`;
}

/** 从 Claude 会话记录恢复用户原文，隐藏仅供模型执行的附件上下文。 */
export function withoutAttachmentContext(value: string) {
    const visible = value.trimEnd();
    if (!visible.endsWith(ATTACHMENT_CONTEXT_INSTRUCTION)) return visible;
    const index = visible.lastIndexOf(ATTACHMENT_CONTEXT_MARKER);
    return index < 0 ? visible : visible.slice(0, index);
}

/** 从 Claude 会话记录恢复用户原文，隐藏附件和画布引用两类模型上下文。 */
export function withoutClaudeModelContext(value: string) {
    const withoutAttachments = withoutAttachmentContext(value);
    if (!withoutAttachments.endsWith(CANVAS_CONTEXT_INSTRUCTION)) return withoutAttachments;
    const index = withoutAttachments.lastIndexOf(CANVAS_CONTEXT_MARKER);
    return index < 0 ? withoutAttachments : withoutAttachments.slice(0, index);
}

function claudeImageType(value: string) {
    const type = value.toLowerCase();
    return (type === "image/jpg" ? "image/jpeg" : type) as "image/gif" | "image/jpeg" | "image/png" | "image/webp";
}

function validateImagePayload(declaredType: string, encoded: string, index: number) {
    let bytes: Buffer;
    try {
        bytes = Buffer.from(encoded, "base64");
    } catch {
        throw new ClaudeAttachmentError(`第 ${index + 1} 张图片的 base64 内容无效`);
    }
    if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
        throw new ClaudeAttachmentError(`第 ${index + 1} 张图片的 base64 内容无效`);
    }
    const actualType = imageTypeFromBytes(bytes);
    if (!actualType || actualType !== claudeImageType(declaredType)) {
        throw new ClaudeAttachmentError(`第 ${index + 1} 张图片的文件内容与声明的类型不一致`);
    }
    return actualType;
}

function imageTypeFromBytes(bytes: Buffer): "image/gif" | "image/jpeg" | "image/png" | "image/webp" | undefined {
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
    if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return undefined;
}

function text(value: unknown, limit: number) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function nonNegativeNumber(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function positiveNumber(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}
