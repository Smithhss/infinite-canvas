import type { AgentSkillScope, AgentSkillSummary } from "@/services/api/canvas-agent";
import type { AgentProvider } from "@/lib/agent/agent-provider";

export type AgentSkillScopeFilter = "all" | AgentSkillScope;
export type AgentSkillCollection = "all" | "favorites" | "mine";
export type AgentSkillFavoriteRecord = {
    active: boolean;
    updatedAt: number;
    writerId: string;
};
export type AgentSkillFavoriteSnapshot = {
    records: Record<string, AgentSkillFavoriteRecord>;
    updatedAt: number;
    writerId: string;
    keys: string[];
};

const agentSkillScopes: AgentSkillScope[] = ["repo", "user", "system", "admin"];

export function agentSkillKey(skill: Pick<AgentSkillSummary, "scope" | "path">) {
    return `${skill.scope}\u0000${skill.path}`;
}

export function agentSkillMarker(skill: Pick<AgentSkillSummary, "name">, provider: AgentProvider) {
    return `${provider === "claude" ? "/" : "$"}${skill.name}`;
}

export function normalizeAgentSkillFavoriteKeys(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value.filter((item): item is string => {
                return isAgentSkillFavoriteKey(item);
            }),
        ),
    );
}

export function parseAgentSkillFavoriteSnapshot(value: unknown): AgentSkillFavoriteSnapshot | null {
    if (Array.isArray(value)) return agentSkillFavoriteSnapshot(recordsFromKeys(normalizeAgentSkillFavoriteKeys(value), 0, ""));
    if (!value || typeof value !== "object") return null;
    const candidate = value as { updatedAt?: unknown; writerId?: unknown; keys?: unknown; records?: unknown };
    if (candidate.records && typeof candidate.records === "object" && !Array.isArray(candidate.records)) return agentSkillFavoriteSnapshot(normalizeFavoriteRecords(candidate.records));
    if (!Array.isArray(candidate.keys)) return null;
    const updatedAt = typeof candidate.updatedAt === "number" && Number.isFinite(candidate.updatedAt) ? candidate.updatedAt : 0;
    const snapshotWriterId = typeof candidate.writerId === "string" ? candidate.writerId : "";
    return agentSkillFavoriteSnapshot(recordsFromKeys(normalizeAgentSkillFavoriteKeys(candidate.keys), updatedAt, snapshotWriterId));
}

export function compareAgentSkillFavoriteRecords(left: AgentSkillFavoriteRecord, right: AgentSkillFavoriteRecord) {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
    if (left.writerId === right.writerId) return 0;
    return left.writerId > right.writerId ? 1 : -1;
}

export function mergeAgentSkillFavoriteSnapshots(...snapshots: Array<AgentSkillFavoriteSnapshot | null>) {
    const records: Record<string, AgentSkillFavoriteRecord> = {};
    for (const snapshot of snapshots) {
        if (!snapshot) continue;
        for (const [key, record] of Object.entries(snapshot.records)) {
            const current = records[key];
            if (!current || compareAgentSkillFavoriteRecords(record, current) > 0) records[key] = record;
        }
    }
    return agentSkillFavoriteSnapshot(records);
}

export function agentSkillFavoriteSnapshotsEqual(left: AgentSkillFavoriteSnapshot, right: AgentSkillFavoriteSnapshot) {
    const leftKeys = Object.keys(left.records);
    const rightKeys = Object.keys(right.records);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) => {
        const leftRecord = left.records[key];
        const rightRecord = right.records[key];
        return Boolean(rightRecord) && leftRecord.active === rightRecord.active && compareAgentSkillFavoriteRecords(leftRecord, rightRecord) === 0;
    });
}

export function didAgentWorkspaceChange(previous: string, next: string) {
    return Boolean(next && previous !== next);
}

export function filterAgentSkills({
    skills,
    query,
    scope,
    collection,
    enabledOnly,
    favoriteKeys,
}: {
    skills: AgentSkillSummary[];
    query: string;
    scope: AgentSkillScopeFilter;
    collection: AgentSkillCollection;
    enabledOnly: boolean;
    favoriteKeys: string[];
}) {
    const keyword = query.trim().toLowerCase();
    const favorites = new Set(favoriteKeys);
    return skills.filter((skill) => {
        if (scope !== "all" && skill.scope !== scope) return false;
        if (enabledOnly && !skill.enabled) return false;
        if (collection === "favorites" && !favorites.has(agentSkillKey(skill))) return false;
        if (collection === "mine" && !skill.managed) return false;
        if (!keyword) return true;
        return [skill.name, skill.description, skill.shortDescription, skill.interface?.displayName, skill.interface?.shortDescription].some((value) => value?.toLowerCase().includes(keyword));
    });
}

export function agentSkillDisplayName(skill: AgentSkillSummary) {
    return skill.interface?.displayName?.trim() || skill.name;
}

export function agentSkillDescription(skill: AgentSkillSummary) {
    return skill.interface?.shortDescription?.trim() || skill.shortDescription?.trim() || skill.description.trim();
}

function agentSkillFavoriteSnapshot(records: Record<string, AgentSkillFavoriteRecord>): AgentSkillFavoriteSnapshot {
    const entries = Object.entries(records);
    let latest: AgentSkillFavoriteRecord | undefined;
    for (const [, record] of entries) {
        if (!latest || compareAgentSkillFavoriteRecords(record, latest) > 0) latest = record;
    }
    return {
        records,
        updatedAt: latest?.updatedAt || 0,
        writerId: latest?.writerId || "",
        keys: entries
            .filter(([, record]) => record.active)
            .map(([key]) => key)
            .sort(),
    };
}

function recordsFromKeys(keys: string[], updatedAt: number, writerId: string) {
    return Object.fromEntries(keys.map((key) => [key, { active: true, updatedAt, writerId }]));
}

function normalizeFavoriteRecords(value: object) {
    const records: Record<string, AgentSkillFavoriteRecord> = {};
    for (const [key, valueRecord] of Object.entries(value)) {
        if (!isAgentSkillFavoriteKey(key) || !valueRecord || typeof valueRecord !== "object" || Array.isArray(valueRecord)) continue;
        const record = valueRecord as { active?: unknown; updatedAt?: unknown; writerId?: unknown };
        if (typeof record.active !== "boolean" || typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) continue;
        records[key] = {
            active: record.active,
            updatedAt: record.updatedAt,
            writerId: typeof record.writerId === "string" ? record.writerId : "",
        };
    }
    return records;
}

function isAgentSkillFavoriteKey(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const separator = value.indexOf("\u0000");
    if (separator < 1) return false;
    const scope = value.slice(0, separator) as AgentSkillScope;
    return agentSkillScopes.includes(scope) && Boolean(value.slice(separator + 1));
}
