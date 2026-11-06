import { expect, test } from "bun:test";

import { summarizeAgentRuntime } from "../src/lib/agent/agent-runtime-status";
import type { AgentPendingApproval, AgentPendingToolCall, AgentPendingUserInput } from "../src/stores/use-agent-store";

const idle = { sending: false, waiting: false, pendingTools: [] as AgentPendingToolCall[], pendingApprovals: [] as AgentPendingApproval[], pendingUserInputs: [] as AgentPendingUserInput[] };
const pendingTool = { requestId: "tool-1", name: "canvas_apply_ops", input: {} } as AgentPendingToolCall;
const secondPendingTool = { requestId: "tool-2", name: "canvas_create_text_node", input: {} } as AgentPendingToolCall;
const approval = { requestId: "approval-1" } as AgentPendingApproval;
const userInput = { requestId: "input-1", questions: [{ id: "style", header: "风格", question: "选择风格" }] } as AgentPendingUserInput;

test("idle runtime has no pending work", () => {
    expect(summarizeAgentRuntime(idle)).toEqual({ phase: "idle", pendingApprovalCount: 0, pendingUserInputCount: 0, pendingToolCount: 0, queueCount: 0 });
});

test("sending or waiting is a running phase", () => {
    expect(summarizeAgentRuntime({ ...idle, sending: true }).phase).toBe("running");
    expect(summarizeAgentRuntime({ ...idle, waiting: true }).phase).toBe("running");
});

test("pending tools count separately from approvals", () => {
    expect(summarizeAgentRuntime({ ...idle, pendingTools: [pendingTool] })).toEqual({ phase: "tool", pendingApprovalCount: 0, pendingUserInputCount: 0, pendingToolCount: 1, queueCount: 1 });
    expect(summarizeAgentRuntime({ ...idle, pendingTools: [pendingTool, secondPendingTool] })).toEqual({ phase: "tool", pendingApprovalCount: 0, pendingUserInputCount: 0, pendingToolCount: 2, queueCount: 2 });
    expect(summarizeAgentRuntime({ ...idle, pendingTools: [pendingTool, secondPendingTool], pendingApprovals: [approval, { ...approval, requestId: "approval-2" }] })).toEqual({
        phase: "approval",
        pendingApprovalCount: 2,
        pendingUserInputCount: 0,
        pendingToolCount: 2,
        queueCount: 4,
    });
});

test("approvals take priority over a pending tool status", () => {
    expect(summarizeAgentRuntime({ ...idle, pendingTools: [pendingTool], pendingApprovals: [approval] }).phase).toBe("approval");
});

test("user input is a separate blocking question phase", () => {
    expect(summarizeAgentRuntime({ ...idle, pendingUserInputs: [userInput] })).toEqual({
        phase: "user-input",
        pendingApprovalCount: 0,
        pendingUserInputCount: 1,
        pendingToolCount: 0,
        queueCount: 1,
    });
});

test("user input takes priority while another approval is pending", () => {
    expect(summarizeAgentRuntime({ ...idle, pendingApprovals: [approval], pendingUserInputs: [userInput] }).phase).toBe("user-input");
});
