# 自有文档域名就绪检查

## 结论

仓库已经具备独立文档应用、源码构建、GitHub Pages 和 Docs Docker 镜像发布路径，但还没有绑定自有域名。本轮只核对配置入口，没有修改 DNS、TLS、Nginx 或生产环境。

## 当前入口

| 能力 | 当前实现 |
| --- | --- |
| 应用内文档链接 | `VITE_DOC_URL`，未设置时回退到 GitHub 文档目录 |
| 文档根路由 | `/` 重写到 `/en` |
| 文档兼容路由 | `/docs/:path*` 重写到 `/en/docs/:path*` |
| GitHub Pages | 构建 Web 应用并部署 `web/dist` |
| Docs 镜像 | `ghcr.io/smithhss/infinite-canvas-docs` 多架构镜像 |

## 切换前需要用户提供

1. 最终域名。
2. DNS 托管平台及修改权限。
3. 选择 GitHub Pages、Docs 容器或现有反向代理作为目标。
4. 是否保留旧地址和 301/302 重定向。
5. 证书签发与续期方式。
6. 回滚目标和 DNS 回滚记录。

## 未执行

- 未修改 `VITE_DOC_URL` 默认值。
- 未修改 GitHub Pages 或 Docker 发布目标。
- 未修改 DNS、TLS 或反向代理。
