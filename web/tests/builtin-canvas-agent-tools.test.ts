import { expect, test } from "bun:test";

import { BUILTIN_CANVAS_AGENT_TOOLS, BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS, parseBuiltinCanvasAgentJson } from "../src/lib/canvas/builtin-canvas-agent/tools";

test("built-in agent exposes only the fixed tool whitelist", () => {
    expect(BUILTIN_CANVAS_AGENT_TOOL_DEFINITIONS.map((tool) => tool.function.name)).toEqual([...BUILTIN_CANVAS_AGENT_TOOLS]);
    expect(BUILTIN_CANVAS_AGENT_TOOLS).toContain("generate_image");
    expect(BUILTIN_CANVAS_AGENT_TOOLS as readonly string[]).not.toContain("execute_shell");
});

test("parses strict JSON actions and string arguments", () => {
    const parsed = parseBuiltinCanvasAgentJson('{"content":"ok","actions":[{"name":"delete_nodes","arguments":"{\\"ids\\":[\\"a\\"]}"}]}');
    expect(parsed.content).toBe("ok");
    expect(parsed.actions[0].name).toBe("delete_nodes");
});

test("unknown tool names and malformed JSON are rejected", () => {
    expect(() => parseBuiltinCanvasAgentJson('{"actions":[{"name":"execute_shell","arguments":{}}]}')).toThrow("unsupported-tool");
    expect(() => parseBuiltinCanvasAgentJson("{bad json")).toThrow("invalid-agent-json");
});

test("fenced JSON is accepted without accepting extra action fields", () => {
    expect(parseBuiltinCanvasAgentJson('```json\n{"actions":[{"name":"get_node","arguments":{"id":"n1"}}]}\n```').actions).toHaveLength(1);
    expect(() => parseBuiltinCanvasAgentJson('{"actions":[{"name":"get_node","arguments":{"id":"n1"},"shell":true}]}')).toThrow("unknown-field");
});

