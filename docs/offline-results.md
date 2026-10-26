# 本地计算，网站展示

SAM 3分割在网站之外的本地工具完成。网站与云端CPU镜像不包含Python计算服务、模型权重、推理按钮、状态探测或本机API代理。

当前参考图流程通过GET读取`data/reference-pipeline/v1`同步出的已保存成果；原图与结果以案例ID和SHA-256对应。分割PNG、Graph SVG、单品图与GLB继续保留，已存在的SAM 3来源说明属于结果溯源。用户自选图片仅在浏览器预览与取色。

计算完成后，审核需要发布的结果，用现有`scripts/prepare-reference-pipeline.cjs`、`scripts/import-reference-models.cjs`等工具整理到`data/`，再执行`npm run build`。导入脚本接受显式来源目录；完整本地计算目录、虚拟环境、权重、令牌及个人运行记录不发布。

开发者本机的计算源码、安装脚本、命令行入口与原界面备份独立保存在工作区的`本地计算工具/SAM3/`，不属于本Git仓库。该工具保留实例PNG和JSON导出以及只监听127.0.0.1的可选交互API；当前网站不连接此API。

验证：`npm test`检查现有数据与几何，`npm run test:reference-ui`检查六套已保存成果、蒙版、Graph、24项L01模型选择、本地图片预览及零推理请求；运行浏览器检查前先启动网站，可用`JYXJ_STUDIO_URL`指定地址。
