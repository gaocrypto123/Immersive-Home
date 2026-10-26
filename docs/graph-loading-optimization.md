# Graph 加载优化（2026-10-25）

Graph 原始 SVG 每张约 2.3–2.7 MB，主要体积为内嵌底图。底图已在前两步加载，Graph 不应再携带一次。现在 GraphArtwork 使用相同的无损 WebP 底图 URL，再叠加原 SVG 去掉 `<image>` 后的矢量层（每张 11–15 KB）。不缩放或重画原始节点、文字、关系及坐标。原始 graph.svg、case 中的原始 SHA-256 完整保留；分层资源读取失败可回落到原 SVG。

卡片和放大窗口共用分层渲染。当前阶段图不再懒加载。Graph 与后续单品图后台预热，不阻塞第一步；Graph 的渐显缩短至约 600ms，并保留原步骤的阅读停留时间、暂停和回看。

生成脚本：`scripts/prepare-graph-layers.cjs`。更新最终 Graph 后先运行已有 `refresh-reference-graphs.cjs`，再运行此脚本，以生成新的 overlay 和前端映射。所有六张图的矢量内容逐字比对测试、70 项现有测试及分享构建通过。原件仍为标注依据。

回退：工作区 `魔搭部署/20261025-Graph加载优化/before` 保存改动前 ReferencePipeline.jsx、reference-pipeline.css 及 index.json；恢复对应文件后重新构建即可。新增图层文件可保留，不会被旧组件引用。线上上一有效提交为 `537c39fac6542d03c6182613c735d1ddc2604817`。

线上提交：`18f6a4dc6119c872f0e26813ea50e3b7ae584817`。10 项公网哈希与六张图层检查通过，单次网络测量 356–799ms；网页 Graph 显示、放大查看通过。完整模型仍为 15907636 字节。
