import { useShallow } from "zustand/react/shallow";

import { summarizeAgentCanvas } from "@/lib/agent/agent-suggestions";
import { useAgentStore } from "@/stores/use-agent-store";

export function useAgentCanvasSummary() {
    return useAgentStore(useShallow((state) => summarizeAgentCanvas(state.canvasContext?.snapshot)));
}
