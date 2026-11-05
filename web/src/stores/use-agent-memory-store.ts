import { create } from "zustand";

import {
    emptyAgentMemorySnapshot,
    normalizeAgentMemorySnapshot,
    promptWithAgentMemory,
    type AgentMemoryEntry,
    type AgentMemorySnapshot,
} from "@/lib/agent/agent-memory";
import { createAppStorageInstance } from "@/lib/localforage-storage";

const STORAGE_PREFIX = "workspace:";
const CHANNEL_NAME = "infinite-canvas-agent-memory";
const storage = createAppStorageInstance("agent_memory");
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

type AgentMemoryStore = AgentMemorySnapshot & {
    workspacePath: string;
    loaded: boolean;
    loading: boolean;
    loadMemories: (workspacePath: string) => Promise<void>;
    createMemory: (title: string, content: string) => Promise<void>;
    updateMemory: (id: string, title: string, content: string) => Promise<void>;
    removeMemory: (id: string) => Promise<void>;
    setMemoryEnabled: (id: string, enabled: boolean) => Promise<void>;
};

let loadSequence = 0;
let activeLoad: Promise<void> | null = null;
let activeLoadPath = "";
let persistQueue = Promise.resolve();

export const useAgentMemoryStore = create<AgentMemoryStore>((set, get) => ({
    ...emptyAgentMemorySnapshot(),
    workspacePath: "",
    loaded: false,
    loading: false,
    loadMemories: (workspacePath) => {
        const normalizedPath = workspacePath.trim();
        if (!normalizedPath) {
            set({ ...emptyAgentMemorySnapshot(), workspacePath: "", loaded: true, loading: false });
            return Promise.resolve();
        }
        if (get().workspacePath === normalizedPath && get().loaded) return Promise.resolve();
        if (activeLoad && activeLoadPath === normalizedPath) return activeLoad;
        const sequence = ++loadSequence;
        set({ ...emptyAgentMemorySnapshot(), workspacePath: normalizedPath, loaded: false, loading: true });
        const task = (async () => {
            try {
                const snapshot = normalizeAgentMemorySnapshot(await storage.getItem<unknown>(storageKey(normalizedPath))) || emptyAgentMemorySnapshot();
                if (sequence === loadSequence && get().workspacePath === normalizedPath) set({ ...snapshot, loaded: true, loading: false });
            } catch {
                if (sequence === loadSequence && get().workspacePath === normalizedPath) set({ loaded: true, loading: false });
            }
        })();
        activeLoad = task;
        activeLoadPath = normalizedPath;
        return task.finally(() => {
            if (activeLoad === task) {
                activeLoad = null;
                activeLoadPath = "";
            }
        });
    },
    createMemory: async (title, content) => {
        const now = nextTimestamp(get().updatedAt);
        const entry: AgentMemoryEntry = {
            id: createId(),
            title: requiredText(title, "请输入记忆标题"),
            content: requiredText(content, "请输入记忆内容"),
            enabled: true,
            createdAt: now,
            updatedAt: now,
        };
        await commit([entry, ...get().entries], now);
    },
    updateMemory: async (id, title, content) => {
        const current = get();
        if (!current.entries.some((entry) => entry.id === id)) throw new Error("找不到指定记忆");
        const now = nextTimestamp(current.updatedAt);
        await commit(current.entries.map((entry) => entry.id === id ? {
            ...entry,
            title: requiredText(title, "请输入记忆标题"),
            content: requiredText(content, "请输入记忆内容"),
            updatedAt: now,
        } : entry), now);
    },
    removeMemory: async (id) => {
        const current = get();
        const entries = current.entries.filter((entry) => entry.id !== id);
        if (entries.length === current.entries.length) throw new Error("找不到指定记忆");
        await commit(entries, nextTimestamp(current.updatedAt));
    },
    setMemoryEnabled: async (id, enabled) => {
        const current = get();
        if (!current.entries.some((entry) => entry.id === id)) throw new Error("找不到指定记忆");
        const now = nextTimestamp(current.updatedAt);
        await commit(current.entries.map((entry) => entry.id === id ? { ...entry, enabled, updatedAt: now } : entry), now);
    },
}));

if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
        const message = memoryMessage(event.data);
        if (!message || message.workspacePath !== useAgentMemoryStore.getState().workspacePath) return;
        const current = useAgentMemoryStore.getState();
        if (message.snapshot.updatedAt <= current.updatedAt) return;
        useAgentMemoryStore.setState({ ...message.snapshot, workspacePath: message.workspacePath, loaded: true, loading: false });
    };
}

async function commit(entries: AgentMemoryEntry[], updatedAt: number) {
    if (promptWithAgentMemory("", entries) === null) throw new Error("启用的本地记忆超过 256KiB，请停用或精简后再保存");
    const workspacePath = useAgentMemoryStore.getState().workspacePath;
    if (!workspacePath) throw new Error("请先连接本地 Agent");
    const previous = useAgentMemoryStore.getState();
    const snapshot: AgentMemorySnapshot = { version: 1, entries, updatedAt };
    useAgentMemoryStore.setState(snapshot);
    const persist = persistQueue.then(async () => {
        await storage.setItem(storageKey(workspacePath), snapshot);
        channel?.postMessage({ workspacePath, snapshot });
    });
    persistQueue = persist.catch(() => undefined);
    try {
        await persist;
    } catch (error) {
        const current = useAgentMemoryStore.getState();
        if (current.workspacePath === workspacePath && current.updatedAt === updatedAt) {
            useAgentMemoryStore.setState({ entries: previous.entries, updatedAt: previous.updatedAt });
        }
        throw error;
    }
}

function storageKey(workspacePath: string) {
    return `${STORAGE_PREFIX}${encodeURIComponent(workspacePath)}`;
}

function memoryMessage(value: unknown): { workspacePath: string; snapshot: AgentMemorySnapshot } | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const workspacePath = typeof record.workspacePath === "string" ? record.workspacePath : "";
    const snapshot = normalizeAgentMemorySnapshot(record.snapshot);
    return workspacePath && snapshot ? { workspacePath, snapshot } : null;
}

function requiredText(value: string, message: string) {
    const text = value.trim();
    if (!text) throw new Error(message);
    return text;
}

function nextTimestamp(previous: number) {
    return Math.max(Date.now(), previous + 1);
}

function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
