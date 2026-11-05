import { create } from "zustand";

import { agentSkillFavoriteSnapshotsEqual, agentSkillKey, mergeAgentSkillFavoriteSnapshots, parseAgentSkillFavoriteSnapshot, type AgentSkillFavoriteSnapshot } from "@/lib/agent/agent-skill-catalog";
import { createAppStorageInstance } from "@/lib/localforage-storage";
import type { AgentSkillSummary } from "@/services/api/canvas-agent";

const STORAGE_KEY = "favorites";
const CHANNEL_NAME = "infinite-canvas-agent-skill-favorites";
const WRITE_LOCK_NAME = "infinite-canvas-agent-skill-favorites-write";
const storage = createAppStorageInstance("agent_skill_favorites");

type FavoriteStore = AgentSkillFavoriteSnapshot & {
    loaded: boolean;
    loading: boolean;
    loadFavorites: () => Promise<void>;
    toggleFavorite: (skill: AgentSkillSummary) => void;
};

let channel: BroadcastChannel | null = null;
let loadPromise: Promise<void> | null = null;
let persistQueue = Promise.resolve();
const writerId = createWriterId();

export const useAgentSkillFavoriteStore = create<FavoriteStore>((set, get) => ({
    records: {},
    updatedAt: 0,
    writerId,
    keys: [],
    loaded: false,
    loading: false,
    loadFavorites: () => {
        if (get().loaded) return Promise.resolve();
        if (loadPromise) return loadPromise;
        set({ loading: true });
        loadPromise = (async () => {
            openChannel();
            try {
                const stored = parseAgentSkillFavoriteSnapshot(await storage.getItem<unknown>(STORAGE_KEY));
                const current = get();
                set({ ...mergeAgentSkillFavoriteSnapshots(stored, current), loaded: true, loading: false });
            } catch {
                set({ loaded: true, loading: false });
            } finally {
                loadPromise = null;
            }
        })();
        return loadPromise;
    },
    toggleFavorite: (skill) => {
        const current = get();
        const key = agentSkillKey(skill);
        const record = {
            active: !current.keys.includes(key),
            updatedAt: Math.max(Date.now(), current.updatedAt + 1),
            writerId,
        };
        set(
            mergeAgentSkillFavoriteSnapshots(current, {
                records: { ...current.records, [key]: record },
                updatedAt: record.updatedAt,
                writerId,
                keys: [],
            }),
        );
        void persist();
    },
}));

function openChannel() {
    if (channel || typeof BroadcastChannel === "undefined") return;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<unknown>) => {
        const snapshot = parseAgentSkillFavoriteSnapshot(event.data);
        if (!snapshot) return;
        const current = useAgentSkillFavoriteStore.getState();
        const merged = mergeAgentSkillFavoriteSnapshots(current, snapshot);
        if (!agentSkillFavoriteSnapshotsEqual(current, merged)) useAgentSkillFavoriteStore.setState(merged);
        if (!agentSkillFavoriteSnapshotsEqual(merged, snapshot)) void persist();
    };
}

async function persist() {
    try {
        await withFavoriteWriteLock(async () => {
            const stored = parseAgentSkillFavoriteSnapshot(await storage.getItem<unknown>(STORAGE_KEY));
            const merged = mergeAgentSkillFavoriteSnapshots(stored, useAgentSkillFavoriteStore.getState());
            await storage.setItem(STORAGE_KEY, merged);
            const current = useAgentSkillFavoriteStore.getState();
            const reconciled = mergeAgentSkillFavoriteSnapshots(current, merged);
            if (!agentSkillFavoriteSnapshotsEqual(current, reconciled)) useAgentSkillFavoriteStore.setState(reconciled);
            channel?.postMessage(merged);
        });
    } catch {
        // Keep the in-memory selection usable when browser persistence is unavailable.
    }
}

function withFavoriteWriteLock<T>(task: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined" && navigator.locks?.request) return navigator.locks.request(WRITE_LOCK_NAME, task) as unknown as Promise<T>;
    const queued = persistQueue.then(task, task);
    persistQueue = queued.then(
        () => undefined,
        () => undefined,
    );
    return queued;
}

function createWriterId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
