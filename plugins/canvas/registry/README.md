# 官方插件注册表(集中构建 + 远程发布)

本目录**只放构建脚本**,不放构建产物。官方插件由 CI 构建后发布到孤儿分支 `plugins-dist`,画布经 jsDelivr 从该分支远程拉取并一键安装。第三方插件不进本流程,由用户自行填 JS URL 安装。

```
registry/
  package.json          # 构建与校验脚本
  official-plugins.mjs  # 官方插件登记表(build 与 validate 共用)
  build.mjs             # 构建全部官方插件并生成带哈希的清单
  validate.mjs          # 校验清单、文件、大小和 SHA-256
  dist/                 # 构建产物(gitignore,不提交;CI 发布到 plugins-dist 分支)
```

**产物不进 git**:`dist/` 与 `node_modules/` 均被 `.gitignore` 覆盖。`main` 分支只有源码与脚本。

## 清单格式

`official-plugins.json` 当前使用 `schemaVersion: 1`。前端会先完整校验清单,任一条目非法都不会暴露部分列表:

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "id": "sticky-note",
      "name": "便利贴节点",
      "version": "1.1.0",
      "description": "可自选颜色、双击编辑、拖动即可移动的便利贴",
      "icon": "📌",
      "entry": "sticky-note.js",
      "sha256": "<64 位十六进制 SHA-256>",
      "size": 4141,
      "minAppVersion": "0.23.0",
      "platform": "browser"
    }
  ]
}
```

- `entry` 必须是相对本清单的安全路径,不能是绝对路径、URL、查询串或包含 `..`。
- 官方插件必须提供 `sha256` 和 `size`;前端下载后先校验,通过前不会执行插件代码。
- `minAppVersion` 由构建时的根目录 `VERSION` 自动写入,低于该版本的宿主会拒绝整个清单。
- 当前只接受 `platform: "browser"`。
- 重复插件 ID、重复 entry、未知 `schemaVersion`、非法版本或哈希都会失败关闭。

## 发布流程(CI 自动)

`.github/workflows/publish-plugins.yml` 在**打版本 tag(`v*`)**或手动触发(`workflow_dispatch`)时运行:

1. `npm ci && npm run build` → 在 `dist/` 产出各 `<id>.js` 与 `official-plugins.json`;
2. `npm run validate` → 检查 5 个登记插件、entry 文件、大小和 SHA-256;
3. 把 `dist/` 强推到孤儿分支 **`plugins-dist`**(仅含产物,force-push 覆盖)。

前端默认从下面地址读取(可用 `VITE_PLUGIN_REGISTRY_URL` 覆盖):

```
https://cdn.jsdelivr.net/gh/Smithhss/infinite-canvas@plugins-dist/official-plugins.json
```

清单里每条的 `entry` 由前端解析成与清单同目录的绝对 URL。jsDelivr 对分支有缓存(约数小时),需要立即生效可对该分支目录做 purge。

## 新增 / 更新官方插件

- 在 `official-plugins.mjs` 登记插件元数据,插件版本仍从各自 `package.json` 读取。
- 修改官方插件后提交到 `main`;下次打版本 tag(或手动 `workflow_dispatch`)时自动重新构建和发布。
- 本地发布前必须同时运行 `npm run build && npm run validate`。

## 本地自测

```bash
cd plugins/canvas/registry
npm ci
npm run build
npm run validate
# 用任意静态服务器伺服 dist/,把 VITE_PLUGIN_REGISTRY_URL 指向其 official-plugins.json
```
