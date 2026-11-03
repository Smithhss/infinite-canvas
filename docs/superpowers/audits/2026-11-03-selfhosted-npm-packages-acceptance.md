# 自有 npm 包迁移验收

**验收日期：** 2026-11-03

**环境：** Infinite Canvas `v0.23.0`，独立本地预发 `http://127.0.0.1:4176/`，Ego Browser TaskSpace `infinite-canvas npm acceptance 20261103`（57）。

**结论：** `canvas-agent` 与 `canvas-proxy` 的包名、版本、仓库元数据、CLI 契约、测试和 GitHub Actions 发布流水线已迁移到 `@smithhsiiiii/*`。现有网页连接入口和 Codex 插件在兼容窗口内继续使用已发布的 `@basketikun/*`，避免新包尚未上线时出现 404。本轮没有发布 npm，也没有部署生产。

## 包变更

| 包 | 旧版本 | 新版本 | 结果 |
| --- | --- | --- | --- |
| `@smithhsiiiii/canvas-agent` | `@basketikun/canvas-agent@0.6.0` | `0.7.0` | 通过 |
| `@smithhsiiiii/canvas-proxy` | `@basketikun/canvas-proxy@0.1.0` | `0.2.0` | 通过 |

两个新包名在迁移时均未占用。CLI 名称、参数、端口、HTTP 转发和 SSE 行为保持不变；旧包在兼容窗口内继续保留。

## 浏览器结果

| 检查项 | 结果 | 实测 |
| --- | --- | --- |
| Agent 连接面板 | 通过 | 直接运行命令仍为 `npx -y @basketikun/canvas-agent@latest` |
| 本地代理页签 | 通过 | 显示 `npx @basketikun/canvas-proxy@latest` 和默认地址 `http://127.0.0.1:23210` |
| 新代理源码启动 | 通过 | `@smithhsiiiii/canvas-proxy v0.2.0` 在 `127.0.0.1:23210` 正常监听 |
| 本地代理测试连接 | 通过 | 页面提示“本地代理连接正常（@smithhsiiiii/canvas-proxy v0.2.0）” |
| 付费请求 | 未触发 | 本轮只检查本地连接，没有调用模型或供应商 |

## 自动化验证

| 命令 | 结果 |
| --- | --- |
| `canvas-agent: npm ci && npm test && npm run build && npm pack --dry-run` | 127 pass，0 fail；构建和打包通过，49 files / 81.9 kB |
| `canvas-proxy: npm ci && npm test && npm pack --dry-run` | 4 pass，0 fail；打包通过，3 files / 4.3 kB |
| `canvas-proxy: node index.js --help` | 通过 |
| npm-style executable symlink 启动 | 通过，修复软链接下 CLI 不启动的问题 |
| `web: bun test` | 106 pass，0 fail，350 assertions |
| `web: bun run typecheck` | 通过 |
| Web standalone 与 FYT-managed 生产构建 | 通过 |
| `docs: bun run types:check && bun run build` | 通过 |
| `git diff --check` | 通过 |

## 发布边界

- 发布工作流只在 `main` 的包目录变更或手动触发时运行，`dev` 合并不会发布 npm。
- 工作流先安装、测试、构建并检查打包内容，再查询 npm 版本。
- 只有 npm 明确返回 `E404` 时才允许发布；其他查询错误会失败关闭，不会误把未知状态当成“版本不存在”。
- 发布使用 `NPM_TOKEN` 和 npm provenance；仓库需先配置 Secret。
- 新包真实发布和线上 `npx` 安装仍需在合并 `main` 后验收。

## 剩余风险

- 本机没有 npm 登录态，本轮未实际发布 `@smithhsiiiii/*`。
- 现有网页和插件入口仍指向旧包，待新包发布并完成在线 `npx` 验收后再切换。
- 本轮没有部署生产，也没有把 `dev` 合并到 `main`。
