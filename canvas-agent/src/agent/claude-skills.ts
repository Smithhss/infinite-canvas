import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_SKILL_BYTES = 256 * 1024;

/** 只读取项目 `.claude/skills` 中可直接寻址的 Skill 名称，不跟随符号链接。 */
export async function listProjectClaudeSkillNames(workspacePath: string) {
    const skillsPath = path.join(workspacePath, ".claude", "skills");
    const root = await lstatOptional(skillsPath);
    if (!root || root.isSymbolicLink() || !root.isDirectory()) return [];

    const names = new Set<string>();
    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || !NAME_PATTERN.test(entry.name)) continue;
        const skillFile = path.join(skillsPath, entry.name, "SKILL.md");
        const file = await lstatOptional(skillFile);
        if (!file || file.isSymbolicLink() || !file.isFile() || file.size > MAX_SKILL_BYTES) continue;
        const parsed = matter(await fs.readFile(skillFile, "utf8"));
        const declaredName = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
        if (NAME_PATTERN.test(declaredName)) names.add(declaredName);
        names.add(entry.name);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
}

async function lstatOptional(filePath: string) {
    try {
        return await fs.lstat(filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
}
