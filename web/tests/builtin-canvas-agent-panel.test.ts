import { expect, test } from "bun:test";

import { builtinAgentButtonLabel, canSendBuiltinAgentMessage } from "../src/lib/canvas/builtin-canvas-agent/ui-state";

test("the built-in agent button reflects its open state", () => {
    expect(builtinAgentButtonLabel(false)).toBe("打开创作 Agent");
    expect(builtinAgentButtonLabel(true)).toBe("关闭创作 Agent");
});

test("the composer blocks blank messages and running turns", () => {
    expect(canSendBuiltinAgentMessage("  ", false)).toBe(false);
    expect(canSendBuiltinAgentMessage("生成一张图", false)).toBe(true);
    expect(canSendBuiltinAgentMessage("生成一张图", true)).toBe(false);
});
