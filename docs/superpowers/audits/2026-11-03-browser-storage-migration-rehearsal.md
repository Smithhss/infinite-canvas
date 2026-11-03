# 浏览器存储命名空间迁移演练

## 结论

已在真实 Chromium 环境中完成 `infinite-canvas` IndexedDB 的只读扫描、独立临时库复制和逐仓校验。所有对象仓的 schema、记录键、记录数量和内容体积一致，临时库已清理；正式库没有改名、删除或切换读取入口。

## 演练数据

| 项目 | 结果 |
| --- | ---: |
| 源数据库版本 | 8 |
| 对象仓 | 8 |
| 画布项目 | 2 |
| 画布节点 | 6 |
| 连线 | 0 |
| 资产 | 0 |
| 生成记录 | 0 |
| 图片文件记录 | 81 |
| 图片预览记录 | 81 |
| 媒体文件记录 | 1 |
| 提示词缓存记录 | 7 |
| IndexedDB 内容体积 | 4,264,777 bytes |
| 应用本地偏好键 | 6 |
| 本地键内容体积 | 2,349 bytes |

## 校验

- `app_state`、`image_files`、`image_generation_logs`、`image_previews`、`local-forage-detect-blob-support`、`media_files`、`prompt_cache`、`video_generation_logs` 全部复制成功。
- 每个对象仓的记录数、主键集合、对象仓库 schema 和内容体积一致。
- Blob 按大小和 MIME 类型校验；ArrayBuffer 和 TypedArray 按字节长度校验；JSON 记录按键和序列化内容校验。
- 演练目标库使用独立时间戳名称，校验后删除。
- 再次枚举 IndexedDB 时只剩正式库 `infinite-canvas`。

## 边界

- 本轮没有实现迁移标记、双读、首次启动切换或旧库清理。
- 本轮没有修改应用正式存储名称、localForage 配置、`localStorage` key 或故事板偏好 key。
- 正式迁移前仍需补充空间不足、数据库被其他标签页阻塞、未知 schema、损坏记录和回滚入口的失败关闭测试。
