import type { AiTextMessage } from "@/services/api/image";
import { runWithConcurrency } from "./creative-workflow-runner";

export const MAX_WORKFLOW_SERIES_CONCURRENCY = 3;
export const MAX_WORKFLOW_SERIES_ITEMS = 20;

export type SeriesPromptDraft = {
    id: string;
    title: string;
    prompt: string;
};

export function buildSeriesPromptRequest(input: {
    count: number;
    basePrompt: string;
    instructions?: string;
}): AiTextMessage[] {
    const count = Math.max(1, Math.min(MAX_WORKFLOW_SERIES_ITEMS, Math.floor(input.count) || 1));
    return [
        {
            role: "system",
            content: "你是创意工作流提示词规划器。只输出严格 JSON，不输出 Markdown、解释或额外文本。",
        },
        {
            role: "user",
            content: `请基于基础提示词，规划 ${count} 张互相关联但内容不重复的系列图。${input.instructions?.trim() ? `额外要求：${input.instructions.trim()}。` : ""}
只返回如下结构：
{"items":[{"title":"短标题","prompt":"可直接用于图片模型的完整提示词"}]}

基础提示词：
${input.basePrompt}`,
        },
    ];
}

export function parseSeriesPromptDrafts(text: string, requestedCount: number, fallbackPrompt = ""): SeriesPromptDraft[] {
    const count = Math.max(1, Math.min(MAX_WORKFLOW_SERIES_ITEMS, Math.floor(requestedCount) || 1));
    try {
        const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const source = JSON.parse(normalized) as { items?: unknown };
        const items = Array.isArray(source.items) ? source.items : [];
        const drafts = items.flatMap((item, index) => {
            if (!item || typeof item !== "object") return [];
            const value = item as Record<string, unknown>;
            const prompt = typeof value.prompt === "string" ? value.prompt.trim().slice(0, 30_000) : "";
            if (!prompt) return [];
            return [{
                id: `series-${index + 1}`,
                title: (typeof value.title === "string" ? value.title.trim() : "").slice(0, 80) || `系列图 ${index + 1}`,
                prompt,
            }];
        }).slice(0, count);
        if (drafts.length) return drafts;
    } catch {
        // Invalid model output falls back to the user's reviewed prompt below.
    }
    return fallbackPrompt.trim() ? [{ id: "series-1", title: "基础提示词", prompt: fallbackPrompt.trim().slice(0, 30_000) }] : [];
}

export async function runSeriesDrafts<T>(input: {
    drafts: SeriesPromptDraft[];
    concurrency: number;
    runOne: (draft: SeriesPromptDraft, signal: AbortSignal) => Promise<T>;
    signal: AbortSignal;
}) {
    return runWithConcurrency({
        items: input.drafts,
        concurrency: Math.max(1, Math.min(MAX_WORKFLOW_SERIES_CONCURRENCY, input.concurrency)),
        signal: input.signal,
        runOne: input.runOne,
    });
}
