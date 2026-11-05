import { create } from "zustand";
import i18n from "@/i18n";

import { activeAgentProvider } from "@/lib/agent/agent-provider";
import { agentSkillMarker } from "@/lib/agent/agent-skill-catalog";
import { fetchClaudeSkills, fetchCodexSkills, type AgentSkillDraft, type AgentSkillSummary } from "@/services/api/canvas-agent";
import { useAgentStore } from "@/stores/use-agent-store";

let loadSequence = 0;

type AgentSkillStore = {
    skills: AgentSkillSummary[];
    selectedSkills: AgentSkillSummary[];
    selectedSkill: AgentSkillSummary | null;
    selectionRevision: number;
    connectionRevision: number;
    autoPrompt: string;
    draft: AgentSkillDraft | null;
    generatingSource: "conversation" | "canvas" | null;
    loading: boolean;
    loaded: boolean;
    errors: string[];
    loadSkills: (endpoint: string, token: string, forceReload?: boolean) => Promise<void>;
    selectSkill: (skill: AgentSkillSummary | null, prompt?: string) => void;
    removeSkill: (skill: AgentSkillSummary) => void;
    setSelectedSkills: (skills: AgentSkillSummary[]) => void;
    clearSelection: (expectedRevision?: number) => void;
    setDraft: (draft: AgentSkillDraft | null) => void;
    setGeneratingSource: (source: "conversation" | "canvas" | null) => void;
    reset: () => void;
};

export const useAgentSkillStore = create<AgentSkillStore>((set, get) => ({
    skills: [],
    selectedSkills: [],
    selectedSkill: null,
    selectionRevision: 0,
    connectionRevision: 0,
    autoPrompt: "",
    draft: null,
    generatingSource: null,
    loading: false,
    loaded: false,
    errors: [],
    loadSkills: async (endpoint, token, forceReload = false) => {
        const sequence = ++loadSequence;
        set({ loading: true });
        try {
            const provider = activeAgentProvider(useAgentStore.getState().agentProvider);
            const response = provider === "claude" ? await fetchClaudeSkills(endpoint, token) : await fetchCodexSkills(endpoint, token, forceReload);
            if (sequence !== loadSequence) return;
            const skills = response.data || [];
            const current = get();
            const selectedSkills = current.selectedSkills
                .map((selected) => skills.find((item) => item.name === selected.name && item.path === selected.path && item.enabled))
                .filter((item): item is AgentSkillSummary => Boolean(item));
            const selectedSkill = selectedSkills[0] || null;
            const selectionChanged = !sameSkillSelection(selectedSkills, current.selectedSkills);
            if (selectionChanged) clearSelectedSkillPrompt(current);
            const autoPrompt = selectionChanged ? "" : current.autoPrompt;
            set({ skills, selectedSkills, selectedSkill, autoPrompt, selectionRevision: current.selectionRevision + (selectionChanged ? 1 : 0), loading: false, loaded: true, errors: (response.errors || []).map(skillErrorText) });
        } catch (error) {
            if (sequence !== loadSequence) return;
            set({ loading: false, loaded: true, errors: [error instanceof Error ? error.message : i18n.t("agent.state.skillReadFailed")] });
        }
    },
    selectSkill: (selectedSkill, prompt) => {
        const current = get();
        const agent = useAgentStore.getState();
        const provider = activeAgentProvider(agent.agentProvider);
        const marker = selectedSkill ? agentSkillMarker(selectedSkill, provider) : "";
        const selectedSkills = selectedSkill && !current.selectedSkills.some((item) => sameSkill(item, selectedSkill))
            ? [...current.selectedSkills, selectedSkill]
            : current.selectedSkills;
        const selectionChanged = selectedSkills !== current.selectedSkills;
        let nextPrompt = prompt;
        let autoPrompt = current.autoPrompt;
        if (nextPrompt === undefined && selectedSkill) {
            const defaultPrompt = selectedSkill.interface?.defaultPrompt?.trim() || marker;
            if (!agent.prompt.trim() || Boolean(current.autoPrompt && agent.prompt === current.autoPrompt)) {
                nextPrompt = !agent.prompt.trim() ? defaultPrompt : agent.prompt.includes(marker) ? agent.prompt : `${agent.prompt}${/\s$/.test(agent.prompt) ? "" : " "}${marker}`;
                autoPrompt = nextPrompt;
            } else {
                nextPrompt = agent.prompt.includes(marker) ? agent.prompt : `${agent.prompt}${/\s$/.test(agent.prompt) ? "" : " "}${marker}`;
            }
        }
        if (nextPrompt !== undefined && agent.prompt !== nextPrompt) agent.setAgentState({ prompt: nextPrompt });
        set({ selectedSkills, selectedSkill: selectedSkills[0] || null, autoPrompt, selectionRevision: current.selectionRevision + (selectionChanged ? 1 : 0) });
    },
    removeSkill: (skill) => {
        const current = get();
        const selectedSkills = current.selectedSkills.filter((item) => !sameSkill(item, skill));
        if (selectedSkills.length === current.selectedSkills.length) return;
        const agent = useAgentStore.getState();
        const marker = agentSkillMarker(skill, activeAgentProvider(agent.agentProvider));
        const prompt = agent.prompt.replaceAll(marker, "").replace(/[ \t]{2,}/g, " ").trim();
        if (prompt !== agent.prompt) agent.setAgentState({ prompt });
        set({ selectedSkills, selectedSkill: selectedSkills[0] || null, autoPrompt: "", selectionRevision: current.selectionRevision + 1 });
    },
    setSelectedSkills: (selectedSkills) => {
        const current = get();
        const unique = uniqueSkills(selectedSkills);
        set({ selectedSkills: unique, selectedSkill: unique[0] || null, autoPrompt: "", selectionRevision: current.selectionRevision + 1 });
    },
    clearSelection: (expectedRevision) => {
        const current = get();
        if (expectedRevision !== undefined && expectedRevision !== current.selectionRevision) return;
        clearSelectedSkillPrompt(current);
        set({ selectedSkills: [], selectedSkill: null, autoPrompt: "", selectionRevision: current.selectionRevision + 1 });
    },
    setDraft: (draft) => set({ draft }),
    setGeneratingSource: (generatingSource) => set({ generatingSource }),
    reset: () => {
        loadSequence += 1;
        const current = get();
        clearSelectedSkillPrompt(current);
        set({ skills: [], selectedSkills: [], selectedSkill: null, selectionRevision: current.selectionRevision + 1, connectionRevision: current.connectionRevision + 1, autoPrompt: "", draft: null, generatingSource: null, loading: false, loaded: false, errors: [] });
    },
}));

function clearSelectedSkillPrompt(selection: Pick<AgentSkillStore, "selectedSkills" | "autoPrompt">) {
    const agent = useAgentStore.getState();
    if (selection.autoPrompt && agent.prompt === selection.autoPrompt) {
        agent.setAgentState({ prompt: "" });
        return;
    }
    if (!selection.selectedSkills.length) return;
    const provider = activeAgentProvider(agent.agentProvider);
    let prompt = agent.prompt;
    selection.selectedSkills.forEach((skill) => {
        prompt = prompt.replaceAll(agentSkillMarker(skill, provider), "");
    });
    prompt = prompt.replace(/[ \t]{2,}/g, " ").trim();
    if (prompt !== agent.prompt) agent.setAgentState({ prompt });
}

function sameSkill(left: AgentSkillSummary, right: AgentSkillSummary) {
    return left.name === right.name && left.path === right.path;
}

function sameSkillSelection(left: AgentSkillSummary[], right: AgentSkillSummary[]) {
    return left.length === right.length && left.every((skill, index) => sameSkill(skill, right[index]));
}

function uniqueSkills(skills: AgentSkillSummary[]) {
    const seen = new Set<string>();
    return skills.filter((skill) => {
        const key = `${skill.name}\u0000${skill.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function skillErrorText(value: unknown) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return i18n.t("agent.state.skillParseFailed");
    const item = value as { path?: unknown; error?: unknown; message?: unknown };
    const message = typeof item.error === "string" ? item.error : typeof item.message === "string" ? item.message : i18n.t("agent.state.skillParseFailed");
    return typeof item.path === "string" ? `${item.path}：${message}` : message;
}
