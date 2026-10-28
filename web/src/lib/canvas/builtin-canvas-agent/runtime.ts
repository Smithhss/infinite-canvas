import {
    actionToCanvasAgentOps,
    builtinCanvasActionConsumesMediaBudget,
    builtinCanvasActionImageOutputs,
    isBuiltinCanvasMediaAction,
    isBuiltinCanvasReadAction,
    isBuiltinCanvasWriteAction,
    normalizeBuiltinCanvasAction,
    type BuiltinCanvasAction,
} from "./actions";
import type { BuiltinCanvasAgentToolCall } from "./tools";

export const BUILTIN_AGENT_LIMITS = {
    steps: 12,
    writeActions: 24,
    mediaTasks: 6,
    imageOutputs: 12,
} as const;

export type BuiltinCanvasBudget = {
    steps: number;
    writeActions: number;
    mediaTasks: number;
    imageOutputs: number;
};

export type BuiltinCanvasStopReason = "completed" | "step-budget" | "write-budget" | "media-budget" | "image-output-budget" | "duplicate-action" | "canceled" | "model-error";

export type BuiltinCanvasActionExecution = {
    ok: boolean;
    error?: string;
    canceled?: boolean;
    result?: unknown;
};

export type BuiltinCanvasTurn = {
    content: string;
    toolCalls: BuiltinCanvasAgentToolCall[];
};

export type BuiltinCanvasRunResult = {
    content: string;
    stoppedReason: BuiltinCanvasStopReason;
    budget: BuiltinCanvasBudget;
    actions: Array<{ name: string; ok: boolean; error?: string }>;
    error?: string;
};

export function createBuiltinCanvasBudget(): BuiltinCanvasBudget {
    return { steps: 0, writeActions: 0, mediaTasks: 0, imageOutputs: 0 };
}

export async function runBuiltinCanvasAgent(input: {
    runTurn: (turnIndex: number, toolResults: Array<{ call: BuiltinCanvasAgentToolCall; result: string }>) => Promise<BuiltinCanvasTurn>;
    executeAction: (action: BuiltinCanvasAction, signal: AbortSignal) => Promise<BuiltinCanvasActionExecution>;
    signal: AbortSignal;
    maxTurns?: number;
    maxWriteActions?: number;
    maxMediaTasks?: number;
    maxImageOutputs?: number;
}): Promise<BuiltinCanvasRunResult> {
    const budget = createBuiltinCanvasBudget();
    const actions: BuiltinCanvasRunResult["actions"] = [];
    const seen = new Set<string>();
    const toolResults: Array<{ call: BuiltinCanvasAgentToolCall; result: string }> = [];
    let content = "";
    const maxTurns = input.maxTurns ?? BUILTIN_AGENT_LIMITS.steps;
    const maxWriteActions = input.maxWriteActions ?? BUILTIN_AGENT_LIMITS.writeActions;
    const maxMediaTasks = input.maxMediaTasks ?? BUILTIN_AGENT_LIMITS.mediaTasks;
    const maxImageOutputs = input.maxImageOutputs ?? BUILTIN_AGENT_LIMITS.imageOutputs;

    for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
        if (input.signal.aborted) return result("canceled");
        budget.steps += 1;

        let turn: BuiltinCanvasTurn;
        try {
            turn = await input.runTurn(turnIndex, toolResults);
        } catch (error) {
            return input.signal.aborted ? result("canceled") : result("model-error", errorMessage(error));
        }
        if (input.signal.aborted) return result("canceled");
        content = turn.content || content;
        if (!turn.toolCalls.length) return result("completed");

        for (const call of turn.toolCalls) {
            if (input.signal.aborted) return result("canceled");
            let action: BuiltinCanvasAction;
            try {
                action = normalizeBuiltinCanvasAction(call);
            } catch (error) {
                return result("model-error", errorMessage(error));
            }

            const signature = JSON.stringify(action);
            if (seen.has(signature)) return result("duplicate-action");
            seen.add(signature);

            if (isBuiltinCanvasWriteAction(action)) {
                if (budget.writeActions + 1 > maxWriteActions) return result("write-budget");
                budget.writeActions += 1;
            }
            if (builtinCanvasActionConsumesMediaBudget(action)) {
                if (budget.mediaTasks + 1 > maxMediaTasks) return result("media-budget");
                const imageOutputs = builtinCanvasActionImageOutputs(action);
                if (budget.imageOutputs + imageOutputs > maxImageOutputs) return result("image-output-budget");
                budget.mediaTasks += 1;
                budget.imageOutputs += imageOutputs;
            }

            if (isBuiltinCanvasReadAction(action) && actionToCanvasAgentOps(action).length) {
                return result("model-error", "read-action-produced-ops");
            }

            let execution: BuiltinCanvasActionExecution;
            try {
                execution = await input.executeAction(action, input.signal);
            } catch (error) {
                execution = { ok: false, error: errorMessage(error), canceled: input.signal.aborted };
            }
            actions.push({ name: action.name, ok: execution.ok, ...(execution.error ? { error: execution.error } : {}) });
            toolResults.push({ call, result: JSON.stringify({ ok: execution.ok, ...(execution.error ? { error: execution.error } : {}), ...(execution.result !== undefined ? { result: execution.result } : {}) }) });
            if (execution.canceled || input.signal.aborted) return result("canceled");
        }
    }

    return result("step-budget");

    function result(stoppedReason: BuiltinCanvasStopReason, error?: string): BuiltinCanvasRunResult {
        return { content, stoppedReason, budget: { ...budget }, actions, ...(error ? { error } : {}) };
    }
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error || "unknown-error");
}
