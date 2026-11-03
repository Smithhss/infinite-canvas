import { create } from "zustand";

export type CanvasSaveStatus = "idle" | "saving" | "saved" | "error";

type CanvasSaveStatusStore = {
    status: CanvasSaveStatus;
    lastSavedAt: string | null;
    error: string | null;
    markSaving: () => void;
    markSaved: () => void;
    markError: (error: string) => void;
    reset: () => void;
};

export const useCanvasSaveStatusStore = create<CanvasSaveStatusStore>((set) => ({
    status: "idle",
    lastSavedAt: null,
    error: null,
    markSaving: () => set({ status: "saving", error: null }),
    markSaved: () => set({ status: "saved", lastSavedAt: new Date().toISOString(), error: null }),
    markError: (error) => set({ status: "error", error }),
    reset: () => set({ status: "idle", error: null }),
}));
