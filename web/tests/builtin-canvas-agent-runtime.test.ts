import { expect, test } from "bun:test";

import { runBuiltinCanvasAgent } from "../src/lib/canvas/builtin-canvas-agent/runtime";

test("stops before a seventh media task", async () => {
    let calls = 0;
    const result = await runBuiltinCanvasAgent({
        signal: new AbortController().signal,
        runTurn: async (turnIndex) => ({
            content: "",
            toolCalls: turnIndex < 7 ? [{ id: `call-${turnIndex}`, name: "generate_image", arguments: { prompt: `cat ${turnIndex}` } }] : [],
        }),
        executeAction: async () => {
            calls += 1;
            return { ok: true };
        },
    });
    expect(calls).toBe(6);
    expect(result.budget.mediaTasks).toBe(6);
    expect(result.stoppedReason).toBe("media-budget");
});

test("does not repeat the same action in one run", async () => {
    const calls: string[] = [];
    const result = await runBuiltinCanvasAgent({
        signal: new AbortController().signal,
        runTurn: async () => ({
            content: "",
            toolCalls: [
                { id: "one", name: "delete_nodes", arguments: { ids: ["same"] } },
                { id: "two", name: "delete_nodes", arguments: { ids: ["same"] } },
            ],
        }),
        executeAction: async (action) => {
            calls.push(action.name);
            return { ok: false, error: "not-found" };
        },
    });
    expect(calls).toHaveLength(1);
    expect(result.stoppedReason).toBe("duplicate-action");
});

test("cancels before executing a subsequent action", async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const result = await runBuiltinCanvasAgent({
        signal: controller.signal,
        runTurn: async () => ({
            content: "",
            toolCalls: [
                { id: "one", name: "create_text_node", arguments: { title: "A", content: "B", position: { x: 0, y: 0 } } },
                { id: "two", name: "delete_nodes", arguments: { ids: ["same"] } },
            ],
        }),
        executeAction: async (action) => {
            calls.push(action.name);
            controller.abort();
            return { ok: true };
        },
    });
    expect(calls).toEqual(["create_text_node"]);
    expect(result.stoppedReason).toBe("canceled");
});

test("stops before a seventh run_node generation", async () => {
    let calls = 0;
    const result = await runBuiltinCanvasAgent({
        signal: new AbortController().signal,
        runTurn: async (turnIndex) => ({
            content: "",
            toolCalls: turnIndex < 7 ? [{ id: `run-${turnIndex}`, name: "run_node", arguments: { nodeId: `node-${turnIndex}`, mode: "image" } }] : [],
        }),
        executeAction: async () => {
            calls += 1;
            return { ok: true };
        },
    });
    expect(calls).toBe(6);
    expect(result.stoppedReason).toBe("media-budget");
});

test("reports canceled when the model request is aborted", async () => {
    const controller = new AbortController();
    const result = await runBuiltinCanvasAgent({
        signal: controller.signal,
        runTurn: async () => {
            controller.abort();
            throw new DOMException("Aborted", "AbortError");
        },
        executeAction: async () => ({ ok: true }),
    });
    expect(result.stoppedReason).toBe("canceled");
});
