import { expect, test } from "bun:test";

import { enqueuePendingTool, removePendingTool } from "../src/lib/agent/agent-pending-tools";
import type { AgentPendingToolCall } from "../src/stores/use-agent-store";

const first = { requestId: "tool-1", name: "canvas_apply_ops", input: { ops: [] } } as AgentPendingToolCall;
const second = { requestId: "tool-2", name: "canvas_get_selection" } as AgentPendingToolCall;

test("multiple pending tools keep arrival order", () => {
    expect(enqueuePendingTool(enqueuePendingTool([], first), second)).toEqual([first, second]);
});

test("duplicate request ids replace the existing item without duplicating it", () => {
    const updated = { ...first, input: { ops: [{ type: "select_nodes", ids: ["node-1"] }] } } as AgentPendingToolCall;
    expect(enqueuePendingTool([first, second], updated)).toEqual([updated, second]);
});

test("resolving one pending tool preserves the others", () => {
    expect(removePendingTool([first, second], first.requestId)).toEqual([second]);
    expect(removePendingTool([first, second], second.requestId)).toEqual([first]);
    expect(removePendingTool([first, second], "missing")).toEqual([first, second]);
});
