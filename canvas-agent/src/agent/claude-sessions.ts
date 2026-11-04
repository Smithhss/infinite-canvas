import { deleteSession, getSessionInfo, getSessionMessages, listSessions } from "@anthropic-ai/claude-agent-sdk";

import { withoutClaudeModelContext } from "./claude-attachments.js";

type JsonRecord = Record<string, unknown>;

export type ClaudeThreadSummary = {
    id: string;
    preview: string;
    name?: string;
    cwd?: string;
    createdAt?: number;
    updatedAt?: number;
};

export type ClaudeHistoryMessage = {
    id: string;
    itemId: string;
    threadId: string;
    turnId: string;
    role: "user" | "assistant" | "tool";
    title?: string;
    text: string;
    detail?: { kind: "tool"; status: "completed" | "failed" | "unknown" };
};

/** 列出当前工作空间可由 Claude Agent SDK 恢复的会话。 */
export async function listClaudeThreads(cwd: string): Promise<ClaudeThreadSummary[]> {
    const sessions = await listSessions({ dir: cwd, includeProgrammatic: true });
    return sessions
        .map((session) => ({
            id: session.sessionId,
            preview: visiblePreview(session.firstPrompt, session.summary),
            name: session.customTitle || withoutClaudeModelContext(session.summary || ""),
            cwd: session.cwd || cwd,
            createdAt: seconds(session.createdAt || session.lastModified),
            updatedAt: seconds(session.lastModified),
        }))
        .filter((session) => session.preview || session.name);
}

/** 读取会话消息；目录校验失败时拒绝访问其他项目的 Claude 会话。 */
export async function readClaudeThread(sessionId: string, cwd: string) {
    const info = await getSessionInfo(sessionId, { dir: cwd });
    if (!info) return null;
    const messages = await getSessionMessages(sessionId, { dir: cwd });
    return {
        thread: {
            id: info.sessionId,
            preview: visiblePreview(info.firstPrompt, info.summary),
            name: info.customTitle || withoutClaudeModelContext(info.summary || ""),
            cwd: info.cwd || cwd,
            createdAt: seconds(info.createdAt || info.lastModified),
            updatedAt: seconds(info.lastModified),
        } satisfies ClaudeThreadSummary,
        messages: normalizeClaudeHistory(sessionId, messages),
    };
}

/** 删除当前工作空间内的 Claude 会话。 */
export async function deleteClaudeThread(sessionId: string, cwd: string) {
    const info = await getSessionInfo(sessionId, { dir: cwd });
    if (!info) return false;
    await deleteSession(sessionId, { dir: cwd });
    return true;
}

/** 只保留网页历史能安全展示的文本和工具摘要，不上传本地路径或附件。 */
export function normalizeClaudeHistory(sessionId: string, messages: unknown[]): ClaudeHistoryMessage[] {
    const history: ClaudeHistoryMessage[] = [];
    const toolStatuses = claudeToolStatuses(messages);
    for (const item of messages) {
        const record = object(item);
        const uuid = text(record.uuid);
        const role = text(record.type);
        if (!uuid || (role !== "user" && role !== "assistant")) continue;
        const content = object(record.message).content;
        const blocks = Array.isArray(content) ? content : [{ type: "text", text: typeof content === "string" ? content : "" }];
        blocks.forEach((value, index) => {
            const block = object(value);
            const type = text(block.type);
            if (type === "text") {
                const body = text(block.text);
                const visibleBody = role === "user" ? withoutClaudeModelContext(body) : body;
                if (visibleBody) history.push(historyItem(sessionId, uuid, index, role, visibleBody));
                return;
            }
            if (role !== "assistant" || type !== "tool_use") return;
            const name = text(block.name) || "tool";
            history.push({
                ...historyItem(sessionId, uuid, index, "tool", name),
                title: name,
                detail: { kind: "tool", status: toolStatuses.get(text(block.id)) || "unknown" },
            });
        });
    }
    return history;
}

function visiblePreview(primary?: string, fallback?: string) {
    return withoutClaudeModelContext(primary || "") || withoutClaudeModelContext(fallback || "");
}

function claudeToolStatuses(messages: unknown[]) {
    const statuses = new Map<string, "completed" | "failed">();
    for (const item of messages) {
        const record = object(item);
        if (text(record.type) !== "user") continue;
        const content = object(record.message).content;
        if (!Array.isArray(content)) continue;
        content.forEach((value) => {
            const block = object(value);
            const toolUseId = text(block.tool_use_id);
            if (text(block.type) === "tool_result" && toolUseId) statuses.set(toolUseId, block.is_error === true ? "failed" : "completed");
        });
    }
    return statuses;
}

function historyItem(sessionId: string, uuid: string, index: number, role: "user" | "assistant" | "tool", body: string): ClaudeHistoryMessage {
    const id = `claude-history:${uuid}:${index}`;
    return {
        id,
        itemId: id,
        threadId: sessionId,
        turnId: role === "user" ? uuid : "",
        role,
        ...(role === "assistant" ? { title: "Claude" } : {}),
        text: body,
    };
}

function seconds(value: number | undefined) {
    return value ? Math.floor(value / 1000) : undefined;
}

function object(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
    return typeof value === "string" ? value : "";
}
