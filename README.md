<p align="center">
  <img src="web/public/logo.svg" width="96" alt="无限画布 Logo">
</p>

<h1 align="center">无限画布</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-f97316?style=flat-square" alt="MIT License"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-7-646cff?style=flat-square&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="https://reactrouter.com/"><img src="https://img.shields.io/badge/React_Router-7-ca4245?style=flat-square&logo=reactrouter&logoColor=white" alt="React Router"></a>
</p>

<p align="center">
  <a href="docs/content/docs/overview/quick-start.mdx">快速开始</a> ·
  <a href="docs/content/docs/overview/features.mdx">功能介绍</a> ·
  <a href="docs/content/docs/canvas/canvas-node-manual.mdx">画布节点操作手册</a> ·
  <a href="docs/content/docs/canvas/canvas-shortcuts.mdx">画布快捷键</a> ·
  <a href="docs/content/docs/progress/todo.mdx">待办事项</a> ·
  <a href="canvas-agent/README.md">本地 Canvas Agent</a>
</p>

无限画布是一个浏览器本地优先的 AI 视觉创作工作台，提供画布编排、图片与视频生成、参考图编辑、工作流、故事板、提示词库、素材管理和本地 Agent 连接能力。

本仓库是基于原项目 MIT 许可继续维护的独立开发分支。原始版权声明保留在 [LICENSE](LICENSE)；上游赞助、社区推广和外部运营入口不再作为本项目的一部分。

## 当前方向

- 保持浏览器本地优先，画布、素材、生成历史和 API Key 默认不离开用户设备。
- 继续完善工作流与故事板双视角，强化高密度素材浏览、定位、筛选和批量处理。
- 统一深色、浅色主题下的画布视觉语言，减少工具控件对创作内容的干扰。
- 逐步替换上游品牌、发布和分发依赖；Agent 与代理已切换到 `@smithhsiiiii/*`，旧 `@basketikun/*` 包在兼容窗口内继续可用。

## 核心能力

- 多画布项目、节点拖拽与缩放、连线、小地图、撤销重做、导入导出。
- OpenAI 兼容接口直连，支持文本、图片、视频、音频和自定义调用脚本。
- 工作流与故事板双视角，同一节点数据可在两种视图间定位和批量处理。
- 本地 Agent 与 Codex 插件，通过 MCP 操作当前画布。
- 动态节点插件、提示词库、我的素材和 WebDAV 同步。
- 节点锁定、本地画布复制和跨标签页保存冲突提示。

## 本地开发

```bash
git clone git@github.com:Smithhss/infinite-canvas.git
cd infinite-canvas/web
bun install
bun run dev
```

默认访问 `http://localhost:3000`。

## Docker

根目录的 Compose 配置直接从当前源码构建，不依赖上游镜像：

```bash
git clone git@github.com:Smithhss/infinite-canvas.git
cd infinite-canvas
docker compose up -d --build
```

## 数据与安全

- 画布项目、“我的素材”和生成记录主要保存在浏览器 IndexedDB。
- AI API Key 保存在浏览器本地，并由前端直接请求用户配置的 OpenAI 兼容接口。
- 不要在生产日志、截图、Issue 或提交中暴露 API Key、连接 Token 和私有素材。
- 真实付费模型验收必须使用明确费用上限或零收费 mock；本地视觉验收默认不触发模型调用。

## 文档

- [文档索引](docs/index.md)
- [功能说明](docs/content/docs/overview/features.mdx)
- [待办事项](docs/content/docs/progress/todo.mdx)
- [待测试项](docs/content/docs/progress/pending-test.mdx)

## 许可

项目使用 [MIT License](LICENSE)。可以用于个人、内部、SaaS、私有部署和闭源商业产品，但必须保留原始版权与许可声明。
