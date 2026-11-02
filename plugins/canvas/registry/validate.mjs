import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OFFICIAL_PLUGINS } from "./official-plugins.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

function fail(message) {
    throw new Error(`官方插件制品校验失败: ${message}`);
}

function isSafeEntry(entry) {
    return typeof entry === "string" && entry.length > 0 && !/^[a-z][a-z0-9+.-]*:/i.test(entry) && !entry.startsWith("/") && !entry.includes("\\") && !entry.includes("?") && !entry.includes("#") && !entry.split("/").some((part) => !part || part === "." || part === "..");
}

const manifest = JSON.parse(await readFile(join(dist, "official-plugins.json"), "utf8"));
if (manifest.schemaVersion !== 1) fail(`schemaVersion 应为 1,实际为 ${manifest.schemaVersion}`);
if (!Array.isArray(manifest.plugins)) fail("plugins 不是数组");
if (manifest.plugins.length !== OFFICIAL_PLUGINS.length) fail(`插件数量应为 ${OFFICIAL_PLUGINS.length},实际为 ${manifest.plugins.length}`);

const expectedIds = OFFICIAL_PLUGINS.map((plugin) => plugin.id);
const manifestIds = manifest.plugins.map((plugin) => plugin?.id);
if (new Set(manifestIds).size !== manifestIds.length) fail("清单包含重复插件 ID");
for (const id of expectedIds) {
    if (!manifestIds.includes(id)) fail(`缺少插件 ${id}`);
}
for (const id of manifestIds) {
    if (!expectedIds.includes(id)) fail(`包含未登记插件 ${id}`);
}

for (const plugin of manifest.plugins) {
    if (typeof plugin.name !== "string" || !plugin.name.trim()) fail(`${plugin.id}.name 为空`);
    if (!/^\d+\.\d+\.\d+$/.test(plugin.version || "")) fail(`${plugin.id}.version 无效`);
    if (!isSafeEntry(plugin.entry)) fail(`${plugin.id}.entry 不是安全相对路径`);
    if (plugin.entry !== `${plugin.id}.js`) fail(`${plugin.id}.entry 应为 ${plugin.id}.js`);
    if (!/^[a-f0-9]{64}$/.test(plugin.sha256 || "")) fail(`${plugin.id}.sha256 无效`);
    if (!Number.isSafeInteger(plugin.size) || plugin.size < 0) fail(`${plugin.id}.size 无效`);
    if (!/^v?\d+\.\d+\.\d+$/.test(plugin.minAppVersion || "")) fail(`${plugin.id}.minAppVersion 无效`);
    if (plugin.platform !== "browser") fail(`${plugin.id}.platform 必须为 browser`);

    const contents = await readFile(join(dist, plugin.entry));
    const sha256 = createHash("sha256").update(contents).digest("hex");
    if (contents.byteLength !== plugin.size) fail(`${plugin.id}.size 不匹配: 清单 ${plugin.size},实际 ${contents.byteLength}`);
    if (sha256 !== plugin.sha256) fail(`${plugin.id}.sha256 不匹配: 清单 ${plugin.sha256},实际 ${sha256}`);
    console.log(`${plugin.id}@${plugin.version} ${plugin.entry} ${plugin.size} bytes sha256=${sha256}`);
}

console.log(`validated official-plugins.json (${manifest.plugins.length} plugins)`);
