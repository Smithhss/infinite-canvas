import { expect, test } from "bun:test";

import { parseAgentInlineTokens } from "../src/components/agent/agent-chat-inline-tokens";

const claudeSkill = { name: "storyboard", path: "claude:storyboard", displayName: "分镜" };
const claudeCopySkill = { name: "copy-review", path: "claude:copy-review", displayName: "文案检查" };
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

test("多个 Skill 标记按出现顺序解析", () => {
    expect(parseAgentInlineTokens("/storyboard 和 /copy-review 一起处理", [], [claudeSkill, claudeCopySkill], "claude")).toEqual([
        { type: "skill", skill: claudeSkill },
        { type: "text", value: " 和 " },
        { type: "skill", skill: claudeCopySkill },
        { type: "text", value: " 一起处理" },
    ]);
});

test("重复的 Skill 选择只生成一个标记", () => {
    expect(parseAgentInlineTokens("/storyboard 拆镜头", [], [claudeSkill, claudeSkill], "claude")).toEqual([
        { type: "skill", skill: claudeSkill },
        { type: "text", value: " 拆镜头" },
    ]);
});
