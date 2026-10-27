import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { createBlankWorkflow, normalizeWorkflowTemplate, type WorkflowTemplate } from "@/lib/creative-workflow";
import { normalizeWorkflowRuns, type WorkflowRun } from "@/lib/creative-workflow-history";
import { localForageStorage } from "@/lib/localforage-storage";

type WorkflowStore = {
    hydrated: boolean;
    workflows: WorkflowTemplate[];
    runs: WorkflowRun[];
    createWorkflow: (input?: Partial<WorkflowTemplate>) => string;
    updateWorkflow: (id: string, patch: Partial<WorkflowTemplate>) => void;
    removeWorkflow: (id: string) => void;
    replaceWorkflows: (workflows: WorkflowTemplate[]) => void;
    appendRun: (run: WorkflowRun) => void;
    clearRuns: () => void;
};

const workflowStorage: PersistStorage<WorkflowStore> = {
    getItem: async (name) => {
        const value = await localForageStorage.getItem(name);
        return value ? JSON.parse(value) as StorageValue<WorkflowStore> : null;
    },
    setItem: (name, value) => localForageStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useWorkflowStore = create<WorkflowStore>()(
    persist(
        (set) => ({
            hydrated: false,
            workflows: [],
            runs: [],
            createWorkflow: (input = {}) => {
                const now = new Date().toISOString();
                const workflow = normalizeWorkflowTemplate({ ...createBlankWorkflow(), ...input, createdAt: now, updatedAt: now });
                set((state) => ({ workflows: [workflow, ...state.workflows] }));
                return workflow.id;
            },
            updateWorkflow: (id, patch) => set((state) => ({
                workflows: state.workflows.map((workflow) => workflow.id === id
                    ? normalizeWorkflowTemplate({ ...workflow, ...patch, id, updatedAt: new Date().toISOString() })
                    : workflow),
            })),
            removeWorkflow: (id) => set((state) => ({ workflows: state.workflows.filter((workflow) => workflow.id !== id) })),
            replaceWorkflows: (workflows) => set({ workflows: workflows.map(normalizeWorkflowTemplate) }),
            appendRun: (run) => set((state) => ({ runs: normalizeWorkflowRuns([run, ...state.runs]) })),
            clearRuns: () => set({ runs: [] }),
        }),
        {
            name: "infinite-canvas:workflow_store",
            storage: workflowStorage,
            partialize: (state) => ({ workflows: state.workflows, runs: state.runs }) as StorageValue<WorkflowStore>["state"],
            merge: (persisted, current) => {
                const source = persisted as Partial<WorkflowStore>;
                return {
                    ...current,
                    workflows: Array.isArray(source.workflows) ? source.workflows.map(normalizeWorkflowTemplate) : [],
                    runs: normalizeWorkflowRuns(source.runs),
                };
            },
            onRehydrateStorage: () => () => useWorkflowStore.setState({ hydrated: true }),
        },
    ),
);
