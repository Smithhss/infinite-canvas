// 官方插件集中构建:一次进程构建所有官方插件 + 生成清单,产物进 dist/(已 gitignore)。
// 官方插件目录本身不各自安装依赖:统一从本目录 node_modules 解析 SDK(nodePaths)。
// CI(publish-plugins.yml)把 dist/ 强推到 plugins-dist 分支,前端经 jsDelivr 远程拉取。
// 本地自测:`npm install && npm run build`,再把 VITE_PLUGIN_REGISTRY_URL 指向本地 dist。
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { OFFICIAL_PLUGINS } from "./official-plugins.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "dist");
const nodeModules = join(root, "node_modules");

// 读取插件 package.json 的 version 作为清单版本的唯一来源
async function readPluginVersion(dir) {
    const pkg = JSON.parse(await readFile(join(root, "..", dir, "package.json"), "utf8"));
    if (!pkg.version) throw new Error(`插件 ${dir} 的 package.json 缺少 version`);
    return pkg.version;
}

// 清单要求的最低应用版本跟随根目录 VERSION,避免官方产物先于宿主兼容性发布。
const appVersion = (await readFile(join(root, "../../../VERSION"), "utf8")).trim().replace(/^v/, "");
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error(`VERSION 不是有效的语义版本: ${appVersion}`);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const bundles = new Map();
for (const plugin of OFFICIAL_PLUGINS) {
    const outfile = join(outDir, `${plugin.id}.js`);
    await build({
        entryPoints: [join(root, "..", plugin.dir, "src", "index.tsx")],
        outfile,
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2020",
        // automatic JSX → SDK 的 jsx-runtime(内部用宿主 React),react external
        jsx: "automatic",
        jsxImportSource: "@infinite-canvas/plugin-sdk",
        loader: { ".ts": "ts", ".tsx": "tsx", ".css": "text" },
        external: ["react", "react-dom"],
        minify: true,
        nodePaths: [nodeModules],
    });
    const contents = await readFile(outfile);
    bundles.set(plugin.id, {
        sha256: createHash("sha256").update(contents).digest("hex"),
        size: contents.byteLength,
    });
    console.log(`built ${plugin.id}.js`);
}

const manifest = {
    // 清单结构版本;entry 为相对本清单的 bundle 文件名,由前端解析成绝对 URL
    schemaVersion: 1,
    plugins: await Promise.all(
        OFFICIAL_PLUGINS.map(async (plugin) => ({
            id: plugin.id,
            name: plugin.name,
            version: await readPluginVersion(plugin.dir),
            description: plugin.description,
            icon: plugin.icon,
            entry: `${plugin.id}.js`,
            sha256: bundles.get(plugin.id).sha256,
            size: bundles.get(plugin.id).size,
            minAppVersion: appVersion,
            platform: "browser",
        })),
    ),
};
await writeFile(join(outDir, "official-plugins.json"), JSON.stringify(manifest, null, 4) + "\n");
console.log(`wrote official-plugins.json (${OFFICIAL_PLUGINS.length} plugins) → dist/`);
