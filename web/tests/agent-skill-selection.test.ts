import { afterAll, beforeEach, expect, test } from "bun:test";

import { installTestLocalStorage } from "./test-local-storage";
import type { AgentSkillSummary } from "../src/services/api/canvas-agent";

const cleanupStorage = installTestLocalStorage();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const { useAgentSkillStore } = await import("../src/stores/use-agent-skill-store");
const { useAgentStore } = await import("../src/stores/use-agent-store");

const skillA: AgentSkillSummary = {
    name: "skill-a",
    description: "First Skill",
    path: "/workspace/.agents/skills/skill-a",
    scope: "repo",
    enabled: true,
    managed: true,
};
const skillB: AgentSkillSummary = {
    name: "skill-b",
    description: "Second Skill",
    path: "/workspace/.agents/skills/skill-b",
    scope: "repo",
    enabled: true,
    managed: true,
};

beforeEach(() => {
    useAgentStore.setState({ agentProvider: "codex", prompt: "" });
    useAgentSkillStore.setState({
        skills: [skillA, skillB],
        selectedSkills: [],
        selectedSkill: null,
        selectionRevision: 0,
        autoPrompt: "",
        loading: false,
        loaded: true,
        errors: [],
    });
});

afterAll(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    cleanupStorage();
});

test("selecting multiple Skills appends markers without replacing the prompt", () => {
    useAgentStore.getState().setAgentState({ prompt: "保留这段正文" });

    useAgentSkillStore.getState().selectSkill(skillA);
    useAgentSkillStore.getState().selectSkill(skillB);

    expect(useAgentSkillStore.getState().selectedSkills).toEqual([skillA, skillB]);
    expect(useAgentSkillStore.getState().selectedSkill).toEqual(skillA);
    expect(useAgentStore.getState().prompt).toBe("保留这段正文 $skill-a $skill-b");
});

test("Claude selects multiple Skills with slash markers", () => {
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            location: { search: "?ff_agentProviderSwitch=1" },
            __RUNTIME_CONFIG__: { FEATURE_FLAGS: {} },
        },
    });
    try {
        useAgentStore.getState().setAgentState({ agentProvider: "claude", prompt: "保留这段正文" });

        useAgentSkillStore.getState().selectSkill(skillA);
        useAgentSkillStore.getState().selectSkill(skillB);

        expect(useAgentSkillStore.getState().selectedSkills).toEqual([skillA, skillB]);
        expect(useAgentStore.getState().prompt).toBe("保留这段正文 /skill-a /skill-b");
    } finally {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    }
});

test("duplicate selection does not duplicate the Skill or marker", () => {
    useAgentSkillStore.getState().selectSkill(skillA);
    const revision = useAgentSkillStore.getState().selectionRevision;

    useAgentSkillStore.getState().selectSkill(skillA);

    expect(useAgentSkillStore.getState().selectedSkills).toEqual([skillA]);
    expect(useAgentSkillStore.getState().selectionRevision).toBe(revision);
    expect(useAgentStore.getState().prompt).toBe("$skill-a");
});

test("removing one Skill keeps the others and removes only its marker", () => {
    useAgentSkillStore.getState().selectSkill(skillA);
    useAgentSkillStore.getState().selectSkill(skillB);

    useAgentSkillStore.getState().removeSkill(skillA);

    expect(useAgentSkillStore.getState().selectedSkills).toEqual([skillB]);
    expect(useAgentSkillStore.getState().selectedSkill).toEqual(skillB);
    expect(useAgentStore.getState().prompt).toBe("$skill-b");
});

test("setSelectedSkills deduplicates by name and path", () => {
    useAgentSkillStore.getState().setSelectedSkills([skillA, skillA, skillB]);

    expect(useAgentSkillStore.getState().selectedSkills).toEqual([skillA, skillB]);
    expect(useAgentSkillStore.getState().selectedSkill).toEqual(skillA);
});

test("reset clears every selected Skill while preserving ordinary prompt text", () => {
    useAgentStore.getState().setAgentState({ prompt: "保留正文" });
    useAgentSkillStore.getState().selectSkill(skillA);
    useAgentSkillStore.getState().selectSkill(skillB);

    useAgentSkillStore.getState().reset();

    expect(useAgentSkillStore.getState().selectedSkills).toEqual([]);
    expect(useAgentSkillStore.getState().selectedSkill).toBeNull();
    expect(useAgentStore.getState().prompt).toBe("保留正文");
});
