import { expect, test } from "bun:test";

import {
    AGENT_MEMORY_CONTEXT_INSTRUCTION,
    AGENT_MEMORY_CONTEXT_MARKER,
    AGENT_MEMORY_MAX_BYTES,
    agentMemoryContextBytes,
    enabledAgentMemoryEntries,
    normalizeAgentMemorySnapshot,
    promptWithAgentMemory,
    withoutAgentMemoryContext,
    type AgentMemoryEntry,
} from "../src/lib/agent/agent-memory";

const entries: AgentMemoryEntry[] = [
    { id: "one", title: "视觉偏好", content: "优先使用自然光和低饱和色彩。", enabled: true, createdAt: 1, updatedAt: 3 },
    { id: "two", title: "停用条目", content: "这条不应发送。", enabled: false, createdAt: 1, updatedAt: 2 },
];

test("memory snapshots keep only complete entries and drop duplicates", () => {
    expect(normalizeAgentMemorySnapshot({
        version: 1,
        updatedAt: 4,
        entries: [
            entries[0],
            entries[0],
            { ...entries[1], title: "" },
            { ...entries[1], id: "" },
            "invalid",
        ],
    })).toEqual({ version: 1, updatedAt: 4, entries: [entries[0]] });
    expect(normalizeAgentMemorySnapshot({ version: 2, entries: [] })).toBeNull();
    expect(normalizeAgentMemorySnapshot({ entries: [] })).toBeNull();
});

test("only enabled memories are appended as hidden Agent context", () => {
    const prompt = promptWithAgentMemory("继续优化分镜", entries);
    expect(prompt).toContain("继续优化分镜");
    expect(prompt).toContain(AGENT_MEMORY_CONTEXT_MARKER);
    expect(prompt).toContain("视觉偏好");
    expect(prompt).not.toContain("这条不应发送");
    expect(prompt).toEndWith(AGENT_MEMORY_CONTEXT_INSTRUCTION);
    expect(withoutAgentMemoryContext(prompt!)).toBe("继续优化分镜");
    expect(enabledAgentMemoryEntries(entries)).toEqual([entries[0]]);
    expect(agentMemoryContextBytes(entries)).toBe(new TextEncoder().encode(promptWithAgentMemory("", entries)!).byteLength);
});

test("memory context fails closed above the existing 256KiB text limit", () => {
    const oversized = [{ ...entries[0], content: "a".repeat(AGENT_MEMORY_MAX_BYTES) }];
    expect(promptWithAgentMemory("继续", oversized)).toBeNull();
    expect(promptWithAgentMemory("继续", [])).toBe("继续");
    expect(withoutAgentMemoryContext("用户正文")).toBe("用户正文");
});
