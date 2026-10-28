import { expect, test } from "bun:test";

import { actionToCanvasAgentOps, builtinCanvasActionConsumesMediaBudget, builtinCanvasActionImageOutputs, isBuiltinCanvasMediaAction, normalizeBuiltinCanvasAction } from "../src/lib/canvas/builtin-canvas-agent/actions";

test("rejects unknown fields, missing ids and invalid generation counts", () => {
    expect(() => normalizeBuiltinCanvasAction("delete_nodes", { ids: [] })).toThrow("ids-required");
    expect(() => normalizeBuiltinCanvasAction("generate_image", { prompt: "cat", extra: true })).toThrow("unknown-field");
    expect(() => normalizeBuiltinCanvasAction("generate_image", { prompt: "cat", count: 16 })).toThrow("count-invalid");
});

test("normalizes a safe text-node action", () => {
    const action = normalizeBuiltinCanvasAction("create_text_node", {
        title: "角色设定",
        content: "白色短发",
        position: { x: 20, y: 40 },
    });
    expect(action.name).toBe("create_text_node");
    if (action.name !== "create_text_node") throw new Error("unexpected action");
    expect(action.args.title).toBe("角色设定");
    expect(actionToCanvasAgentOps(action)[0].type).toBe("add_node");
});

test("media actions route to the media executor rather than canvas ops", () => {
    const action = normalizeBuiltinCanvasAction("generate_image", { prompt: "cat", count: 1 });
    expect(actionToCanvasAgentOps(action)).toEqual([]);
    expect(isBuiltinCanvasMediaAction(action)).toBe(true);
});

test("run_node consumes the media budget before triggering generation", () => {
    const action = normalizeBuiltinCanvasAction("run_node", { nodeId: "node-1", mode: "image" });
    expect(builtinCanvasActionConsumesMediaBudget(action)).toBe(true);
    expect(builtinCanvasActionImageOutputs(action)).toBe(1);
});
