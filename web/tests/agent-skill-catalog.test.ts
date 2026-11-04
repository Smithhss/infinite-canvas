import { expect, test } from "bun:test";

import {
    agentSkillDescription,
    agentSkillDisplayName,
    agentSkillKey,
    compareAgentSkillFavoriteRecords,
    didAgentWorkspaceChange,
    filterAgentSkills,
    mergeAgentSkillFavoriteSnapshots,
    normalizeAgentSkillFavoriteKeys,
    parseAgentSkillFavoriteSnapshot,
} from "../src/lib/agent/agent-skill-catalog";
import type { AgentSkillSummary } from "../src/services/api/canvas-agent";

const skills: AgentSkillSummary[] = [
    {
        name: "product-grid",
        description: "Plan and generate a product grid",
        path: "/workspace/.agents/skills/product-grid",
        scope: "repo",
        enabled: true,
        managed: true,
        interface: { displayName: "Product grid", shortDescription: "Build a consistent product image grid" },
    },
    {
        name: "product-grid",
        description: "A personal copy that remains distinct",
        path: "/Users/smith/.agents/skills/product-grid",
        scope: "user",
        enabled: false,
        managed: false,
    },
    {
        name: "storyboard",
        description: "Build a shot sequence",
        path: "/system/skills/storyboard",
        scope: "system",
        enabled: true,
        managed: false,
    },
];

test("agent Skill identity includes scope and path instead of relying on name", () => {
    expect(agentSkillKey(skills[0])).toBe("repo\u0000/workspace/.agents/skills/product-grid");
    expect(agentSkillKey(skills[0])).not.toBe(agentSkillKey(skills[1]));
});

test("favorite keys reject malformed values and remove duplicates", () => {
    expect(normalizeAgentSkillFavoriteKeys(["repo\u0000/a", "repo\u0000/a", "unknown\u0000/a", "repo\u0000", 42])).toEqual(["repo\u0000/a"]);
});

test("favorite snapshots migrate legacy keys into per-Skill revisions", () => {
    expect(parseAgentSkillFavoriteSnapshot(["user\u0000/a", "user\u0000/a"])?.records).toEqual({ "user\u0000/a": { active: true, updatedAt: 0, writerId: "" } });
    expect(parseAgentSkillFavoriteSnapshot({ updatedAt: 2, writerId: "tab-a", keys: ["repo\u0000/a"] })?.records).toEqual({ "repo\u0000/a": { active: true, updatedAt: 2, writerId: "tab-a" } });
    expect(parseAgentSkillFavoriteSnapshot({ updatedAt: "now" })).toBeNull();
    expect(compareAgentSkillFavoriteRecords({ active: true, updatedAt: 2, writerId: "a" }, { active: true, updatedAt: 1, writerId: "z" })).toBeGreaterThan(0);
    expect(compareAgentSkillFavoriteRecords({ active: true, updatedAt: 2, writerId: "b" }, { active: true, updatedAt: 2, writerId: "a" })).toBeGreaterThan(0);
});

test("favorite snapshots merge concurrent writes per Skill and keep tombstones", () => {
    const first = parseAgentSkillFavoriteSnapshot({ records: { "repo\u0000/a": { active: true, updatedAt: 10, writerId: "tab-a" } } })!;
    const second = parseAgentSkillFavoriteSnapshot({ records: { "user\u0000/b": { active: true, updatedAt: 10, writerId: "tab-b" } } })!;
    const merged = mergeAgentSkillFavoriteSnapshots(first, second);
    expect(merged.keys).toEqual(["repo\u0000/a", "user\u0000/b"]);

    const removed = parseAgentSkillFavoriteSnapshot({ records: { "repo\u0000/a": { active: false, updatedAt: 11, writerId: "tab-a" } } })!;
    expect(mergeAgentSkillFavoriteSnapshots(merged, removed).keys).toEqual(["user\u0000/b"]);
});

test("Skill reload compares the next known workspace path", () => {
    expect(didAgentWorkspaceChange("", "/workspace/one")).toBe(true);
    expect(didAgentWorkspaceChange("/workspace/one", "/workspace/one")).toBe(false);
    expect(didAgentWorkspaceChange("/workspace/one", "/workspace/two")).toBe(true);
});

test("Skill filtering combines collection, scope, enabled state and search", () => {
    const favoriteKeys = [agentSkillKey(skills[0])];
    expect(filterAgentSkills({ skills, query: "", scope: "all", collection: "favorites", enabledOnly: false, favoriteKeys })).toEqual([skills[0]]);
    expect(filterAgentSkills({ skills, query: "", scope: "all", collection: "mine", enabledOnly: false, favoriteKeys })).toEqual([skills[0]]);
    expect(filterAgentSkills({ skills, query: "product", scope: "user", collection: "all", enabledOnly: false, favoriteKeys })).toEqual([skills[1]]);
    expect(filterAgentSkills({ skills, query: "", scope: "all", collection: "all", enabledOnly: true, favoriteKeys })).toEqual([skills[0], skills[2]]);
});

test("Skill display metadata uses localized interface fields when present", () => {
    expect(agentSkillDisplayName(skills[0])).toBe("Product grid");
    expect(agentSkillDescription(skills[0])).toBe("Build a consistent product image grid");
    expect(agentSkillDisplayName(skills[2])).toBe("storyboard");
});
