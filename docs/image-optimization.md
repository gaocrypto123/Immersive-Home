# Squoosh 图片优化

使用官方 `@squoosh/lib@0.5.3` 的 WebAssembly WebP 编码器，在本地处理网站图片，编码器不进入网页运行时。

原尺寸栅格图 199 张，按图片 URL 统计约 104449906 字节；轻量大图及无需调整的原图合计 28403089 字节，减少 72.81%。90 张生成了更小的版本，其余保持原样。另生成 62 张最长边不超过 800px 的卡片缩略图；六张参考图卡片合计从 13695006 字节降为 326594 字节。

- 平面图、参考图取色源与蒙版采用无损编码或保留原图；无损输出已逐像素核对。尺寸、图形坐标与透明度不变。
- 展示照片使用 WebP 质量 88，误差较大的图片提高至 94；透明通道保持不变。
- 卡片使用质量 86 的缩略图；放大预览仍使用原尺寸轻量大图。
- 原图和来源 SHA-256 均保留。最终 Graph SVG 和手机 GLB 不被重写。

`data/web-images/compression-report.json` 保存每张图的源文件哈希、编码参数、输出哈希、原尺寸、像素校验与缩略图记录。生成结果在同目录的 `files/`。

复现：在工作区根目录安装工具 `npm install --prefix .runtime/squoosh @squoosh/lib@0.5.3`，然后在 `jia-you-xin-jie` 目录依次运行：

```powershell
node --no-experimental-fetch --no-experimental-global-navigator scripts/compress-web-images.cjs
node --no-experimental-fetch --no-experimental-global-navigator scripts/create-image-thumbnails.cjs
node frontend/scripts/sync-assets.mjs
```

这些兼容参数只用于离线编码工具；网站继续使用现有依赖。正式构建只复制已生成的轻量资源。

`frontend/src/image-assets.js` 统一选择图片。需要回退时，将 `USE_OPTIMIZED_IMAGES` 设为 `false` 并重新构建，页面会恢复原图路径。源码副本在工作区 `魔搭部署/20261025-Squoosh图片优化/before`；上一有效线上版本为 `a27fca73257ce322e685eb667164931807a206ed`，本次版本为 `eff05cec99217eef2d3c8a992af935847648b20d`。

原图保留供回退，因此上述数字衡量页面使用图片的传输体积，不是包含备份的整个项目目录大小。
