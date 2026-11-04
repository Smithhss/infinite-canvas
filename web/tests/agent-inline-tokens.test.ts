import { expect, test } from "bun:test";

import { parseAgentInlineTokens } from "../src/components/agent/agent-chat-inline-tokens";

const claudeSkill = { name: "storyboard", path: "claude:storyboard", displayName: "分镜" };
const codexSkill = { name: "storyboard", path: "/workspace/.agents/skills/storyboard", displayName: "分镜" };

test("Claude Skill markers parse without the Codex prefix", () => {
    expect(parseAgentInlineTokens("/storyboard 拆成六个镜头", [], claudeSkill, "claude")).toEqual([
        { type: "skill", skill: claudeSkill },
        { type: "text", value: " 拆成六个镜头" },
    ]);
});

test("Codex Skill markers keep their existing prefix", () => {
    expect(parseAgentInlineTokens("$storyboard 拆成六个镜头", [], codexSkill, "codex")).toEqual([
        { type: "skill", skill: codexSkill },
        { type: "text", value: " 拆成六个镜头" },
    ]);
});
