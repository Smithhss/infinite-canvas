import assert from "node:assert/strict";
import test from "node:test";

import { AGENT_MEMORY_CONTEXT_INSTRUCTION, AGENT_MEMORY_CONTEXT_MARKER, withoutAgentMemoryContext } from "./memory-context.js";

test("local memory context is stripped without changing ordinary prompts", () => {
    const prompt = `继续优化分镜${AGENT_MEMORY_CONTEXT_MARKER}1. 标题：视觉偏好\n优先使用自然光${AGENT_MEMORY_CONTEXT_INSTRUCTION}`;
    assert.equal(withoutAgentMemoryContext(prompt), "继续优化分镜");
    assert.equal(withoutAgentMemoryContext("普通用户正文"), "普通用户正文");
    assert.equal(withoutAgentMemoryContext(`${AGENT_MEMORY_CONTEXT_MARKER}记忆内容`), `${AGENT_MEMORY_CONTEXT_MARKER}记忆内容`);
});
