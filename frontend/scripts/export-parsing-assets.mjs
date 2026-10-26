import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { build } from "esbuild";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PARSE_SOURCES, parsingRoomData, modelChecks } from "../src/parsing-demo.js";
import { adaptMetricRoom } from "../src/metric-room.js";
import { buildMetricArchitecture, disposeMetric } from "../src/metric-three.js";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.dirname(frontend);
const destination = path.resolve(project, "../01-平面图解析");
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const snapshot = path.resolve(project, "artifacts", process.argv[2] || `parsing-exports-${stamp}`);
assert.equal(path.dirname(snapshot), path.resolve(project, "artifacts"));
await mkdir(snapshot, { recursive: true });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const manifestPath = path.join(snapshot, "export-manifest.json");
const manifest = await exists(manifestPath)
  ? JSON.parse(await readFile(manifestPath, "utf8"))
  : { destination, files: [], validation: [] };
assert.equal(manifest.destination, destination);
async function save(folder, name, value) {
  const target = path.join(destination, folder, name);
  assert.equal(path.dirname(path.dirname(target)), destination);
  await mkdir(path.dirname(target), { recursive: true });
  const key = `${folder}/${name}`;
  let entry = manifest.files.find(f => f.path === key);
  if (!entry) {
    entry = { path: key, before: null };
    if (await exists(target)) {
      const bytes = await readFile(target); entry.before = sha(bytes);
      const copy = path.join(snapshot, "before", folder, name);
      await mkdir(path.dirname(copy), { recursive: true });
      await copyFile(target, copy);
    }
    manifest.files.push(entry);
  }
  await writeFile(target, value);
  entry.after = sha(await readFile(target));
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

// The only FileReader operation needed for a texture-free GLB is Blob -> bytes.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => {
      this.result = result; this.onloadend?.({ target: this });
    }).catch(error => this.onerror?.(error));
  }
};
const visuals = await build({
  stdin: {
    contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {CalibrationView,AnimatedPlan} from './ParsingVisuals.jsx';
      export const calibration=(source,c)=>renderToStaticMarkup(React.createElement(CalibrationView,{source,calibration:c}));
      export const plan=(source,data)=>renderToStaticMarkup(React.createElement(AnimatedPlan,{source,data}));`,
    resolveDir: path.join(frontend, "src"), loader: "js",
  },
  bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: `import {createRequire} from 'node:module';const require=createRequire(import.meta.url);` },
  define: { "process.env.NODE_ENV": '"production"' },
});
const runtimePath = path.join(snapshot, "render-visuals.mjs");
await writeFile(runtimePath, visuals.outputFiles[0].contents);
const render = await import(pathToFileURL(runtimePath));
const previewBundle = await build({
  entryPoints: [path.join(frontend, "scripts/parsing-export-preview.js")],
  bundle: true, platform: "browser", format: "iife", write: false,
  minify: true, legalComments: "inline", target: "es2022",
});
const previewJS = previewBundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const base = JSON.parse(await readFile(path.join(project, "data/room-descriptions/L02-动静分区-房间估算.json"), "utf8"));
const baseHash = sha(Buffer.from(JSON.stringify(base)));
const svgContent = html => html.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)[1];
const xml = s => String(s).replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const planStyle = `
  text{font-family:system-ui,'Microsoft YaHei',sans-serif}
  .reveal-input-image{opacity:.12}.reveal-outline{stroke:#52754e;stroke-width:22;stroke-dashoffset:0}
  .reveal-wall-plan{fill:#7d8c73}.reveal-door path{stroke:#ac8855;stroke-width:16;stroke-dashoffset:0}
  .reveal-door circle{fill:#9e7a46}.reveal-window rect{fill:#c7dfdc;stroke:#719e99;stroke-width:14}
  .reveal-window path{fill:none;stroke:#719e99;stroke-width:10}
  .reveal-dimension{stroke:#91a47c;stroke-width:6;fill:#688355}
  .reveal-dimension text{font-size:135px;paint-order:stroke;stroke:#f1f2ea;stroke-width:22;stroke-linejoin:round}
  .reveal-last-label{fill:#8d9c7d;font-size:120px}.reveal-room-name{font-size:155px;fill:#718666}
`;
function standalonePlan(source, data, input, complete) {
  const W = data.DIMENSIONS.clear_bbox_width_mm, D = data.DIMENSIONS.clear_bbox_depth_mm;
  let inner = svgContent(render.plan({ ...source, image: input }, data));
  if (complete) inner = inner.replace(/<image\b[^>]*(?:\/>|>[\s\S]*?<\/image>)/, "");
  const stateStyle = complete
    ? ".reveal-input-image{display:none}"
    : ".reveal-floor{opacity:.14}.reveal-wall-plan,.reveal-door,.reveal-window,.reveal-dimension,.reveal-last-label{display:none}";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${Math.round(1000 * (D + 1170) / (W + 1180))}" viewBox="-620 -520 ${W + 1180} ${D + 1170}">
    <title>${xml(source.name)} · ${complete ? "门窗与尺寸" : "房间轮廓"}</title>
    <desc>从网站同一SVG组件导出的阶段完成快照。平面坐标单位mm，图示为估算；${xml(source.roomTemplate?.notes.join(" ") || "转角卧室示例")}</desc>
    <style>${planStyle}${stateStyle}</style><rect x="-620" y="-520" width="${W + 1180}" height="${D + 1170}" fill="#f1f2ea"/>${inner}</svg>`;
}
function standaloneCalibration(source, calibration, input) {
  const c = calibration, footer = 225;
  const lines = c.samples.map((s, i) => `<text x="35" y="${source.height + 55 + i * 55}">${s.axis === "x" ? "横向" : "纵向"}：${s.mm} mm ÷ ${s.pixels} px = ${s.mmPerPixel.toFixed(4)} mm/px</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height + footer}" viewBox="0 0 ${source.width} ${source.height + footer}">
    <title>${xml(source.name)} · 尺寸标注与比例尺</title>
    <desc>标注位置采用人工校对示例数据，比例尺由标注毫米数除以尺线像素跨度计算；不是实时OCR结果。</desc>
    <style>.calibration-token rect{fill:#dfb45955;stroke:#b78d3e;stroke-width:4}.calibration-anchor path{fill:none;stroke:#4f8c69;stroke-width:7;stroke-dasharray:12 7}text{font:27px system-ui,'Microsoft YaHei',sans-serif;fill:#3e6149}</style>
    <rect width="100%" height="100%" fill="#fff"/>
    ${svgContent(render.calibration({ ...source, image: input }, c))}${lines}
    <text x="35" y="${source.height + 180}" style="font-size:22px">示例标注导出 · 尺寸估算，非现场实测</text></svg>`;
}
function previewHTML(source, room, glb, stages, meshes) {
  const meta = { width: room.width, depth: room.depth, stages, meshes };
  const note = source.roomTemplate?.notes.join(" ") || "左上角缺口为950×500mm。";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xml(source.name)} · 解析成果</title>
    <style>*{box-sizing:border-box}body{margin:0;background:#f7f5ee;color:#283e33;font:14px system-ui,'Microsoft YaHei',sans-serif}main{max-width:1100px;margin:48px auto;padding:0 24px}h1{font-size:30px;font-weight:550;margin:8px 0 12px}p{line-height:1.8;color:#667762}.eyebrow{color:#48684e}nav,.tools{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}button,a{font:inherit}button{border:1px solid #cbd3c1;background:#fffdf8;border-radius:8px;padding:10px 16px;color:#3e6149;cursor:pointer}button[aria-pressed=true]{background:#3e6149;color:white;border-color:#3e6149}button:focus-visible,a:focus-visible{outline:3px solid #bc8264;outline-offset:4px}button:disabled{opacity:.5;cursor:wait}.stage{border-radius:12px;background:#f1f2ea;overflow:hidden}#room-view{height:560px;width:100%}canvas{display:block;width:100%;height:100%;touch-action:none}#stage-picture{display:block;width:100%;height:660px;object-fit:contain;background:#f1f2ea}#stage-picture[hidden],[hidden]{display:none!important}a{color:#3e6149}.tools{align-items:center;margin:18px 0}.tools a{margin-left:auto}#status{font-size:12px;margin:8px 0}.note{font-size:12px;margin-top:24px;border-top:1px solid #dbe0d1;padding-top:16px}@media(max-width:600px){main{margin:26px auto;padding:0 18px}h1{font-size:25px}nav{gap:7px}button{padding:9px 12px}#room-view{height:440px}#stage-picture{height:550px}.tools a{margin-left:0}}</style></head>
    <body><main><span class="eyebrow">家有新解 · 本地离线成果</span><h1>${xml(source.name)} · 从平面到空房</h1>
    <p>净框 ${room.width * 1000} × ${room.depth * 1000} mm · 净面积 ${room.area.toFixed(3)} ㎡ · 默认房高 2800 mm</p>
    <nav aria-label="解析成果切换">${["尺寸解析", "房间轮廓", "门窗尺寸", "三维空房"].map((s, i) => `<button data-stage="${i + 1}" aria-pressed="${i === 3}">${String(i + 1).padStart(2, "0")} ${s}</button>`).join("")}</nav>
    <section class="stage"><img id="stage-picture" hidden alt=""><div id="room-view"></div></section>
    <div id="view-tools" class="tools"><button id="camera" disabled>切换俯视</button><button id="door" disabled>关闭房门</button><button id="walls" disabled>显示完整墙体</button><a href="04-三维空房.glb" download>保存 GLB 模型 ↗</a></div>
    <p id="status" role="status">正在读取内嵌模型…</p>
    <p class="note">${xml(note)}<br>尺寸与开口位置采用当前网页已校对的示例数据，非实时OCR、非现场测量。SVG为阶段完成快照；GLB为可编辑三维模型，单位m、Y轴向上、无家具。预览中的前墙透明仅用于观察，GLB保留完整实体墙。全部资源位于本机，不请求在线服务。</p>
    </main><script id="room-meta" type="application/json">${JSON.stringify(meta)}</script><script id="room-bytes" type="application/octet-stream">${glb.toString("base64")}</script><script>${previewJS}</script></body></html>`;
}

const stages = ["01-尺寸解析.svg", "02-房间轮廓.svg", "03-门窗尺寸.svg"];
manifest.validation = [];
for (const source of PARSE_SOURCES) {
  const original = await readFile(path.join(destination, source.fileName));
  assert.equal(sha(original), source.sha256, "输入原图已变更，应先重新核对元数据");
  const folder = source.processFolder, input = `data:image/png;base64,${original.toString("base64")}`;
  const data = parsingRoomData(base, source), room = adaptMetricRoom(data);
  const arch = buildMetricArchitecture(room, false, true);
  assert.ok(modelChecks(arch.summary, room).every(c => c.ok));
  arch.group.name = `${source.name} · 三维空房`;
  arch.group.userData = { sourceSHA256: source.sha256, unit: "m", assumedHeight: 2.8, estimated: true, furniture: false };
  arch.floor.name = "floor"; arch.floor.userData.exportFloor = true;
  for (const { door, pivot } of arch.doorPivots) {
    pivot.name = door.id;
    pivot.userData = { ...pivot.userData, exportDoorPivot: true, openY: -Math.atan2(door.open[1], door.open[0]), closedY: -Math.atan2(door.closed[1], door.closed[0]) };
  }
  let meshes = 0;
  arch.group.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    const bounds = new THREE.Box3().setFromObject(o);
    if (o.userData.wallId && (bounds.max.x <= 0.001 || bounds.min.z >= room.depth - 0.001)) o.userData.frontWall = true;
  });
  const glb = Buffer.from(await new GLTFExporter().parseAsync(arch.group, { binary: true, onlyVisible: true }));
  assert.equal(glb.readUInt32LE(0), 0x46546c67);
  assert.equal(glb.readUInt32LE(8), glb.length);
  const loaded = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");
  let loadedMeshes = 0, floors = [], walls = [], windows = [], doors = [];
  loaded.scene.updateMatrixWorld(true);
  loaded.scene.traverse(o => {
    if (o.isMesh) loadedMeshes++;
    if (o.userData.exportFloor) floors.push(o);
    if (o.userData.wallId) walls.push(o);
    if (o.userData.windowId) windows.push(o);
    if (o.userData.doorId) doors.push(o);
  });
  assert.equal(loadedMeshes, meshes); assert.equal(floors.length, 1);
  assert.equal(walls.length, room.walls.length); assert.equal(windows.length, 1); assert.equal(doors.length, 1);
  const floorSize = new THREE.Box3().setFromObject(floors[0]).getSize(new THREE.Vector3());
  const windowSize = new THREE.Box3().setFromObject(windows[0]).getSize(new THREE.Vector3());
  const doorSize = new THREE.Vector3(); doors[0].geometry.computeBoundingBox(); doors[0].geometry.boundingBox.getSize(doorSize);
  const near = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} != ${b}`);
  near(floorSize.x, room.width); near(floorSize.z, room.depth);
  walls.forEach(o => near(new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y, 2.8));
  near(Math.max(windowSize.x, windowSize.z), data.WINDOW_DETAILS[0].opening_width_mm / 1000);
  near(doorSize.x, room.doors[0].width); near(doorSize.y, 2.1);
  await save(folder, stages[0], standaloneCalibration(source, data.parse_demo.calibration, input));
  await save(folder, stages[1], standalonePlan(source, data, input, false));
  await save(folder, stages[2], standalonePlan(source, data, input, true));
  await save(folder, "04-三维空房.glb", glb);
  await save(folder, "打开解析成果.html", previewHTML(source, room, glb, stages, meshes));
  const oldNote = await readFile(path.join(destination, folder, "素材说明.md"), "utf8");
  const dimensions = oldNote.split("## 尺度与实现边界")[1]?.split("\n## ")[0].trim() || "当前示例为估算，默认房高2800mm。";
  await save(folder, "素材说明.md", `# ${source.fileName} · 解析成果\n\n本次将网页原来实时绘制的SVG与三维空房导出为实际文件。原图保持不变，未重新生成图片或识别户型。\n\n| 文件 | 用途 |\n| --- | --- |\n| 00-输入平面图.png | 原始输入图完整副本 |\n| 01-尺寸解析.svg | 尺寸高亮、尺线与横纵mm/px；内嵌原图 |\n| 02-房间轮廓.svg | 描摹完成的闭合轮廓，背景为淡化原图 |\n| 03-门窗尺寸.svg | 门窗、开门弧线、尺寸与面积 |\n| 04-三维空房.glb | 可导入Blender等软件的实体三维空房，单位m、Y轴向上、无家具 |\n| 打开解析成果.html | 双击在浏览器离线查看SVG和可旋转空房；无需启动网站 |\n\nSVG为对应步骤完成时的静态快照，不包含网页逐帧动画；HTML支持切换三个SVG、旋转/缩放三维、鸟瞰/俯视、门扇开关与前墙透明。GLB保留完整实体墙；透明仅是HTML预览显示选项。模型内嵌在HTML中，SVG内嵌所需原图，没有外部字体、图片、模型或CDN请求。\n\n此前“没有独立中间文件”描述的是导出前网页的实时状态；现在这些文件已经由同一套组件和几何导出。它们是阶段成果，不是额外生成的中间PNG。\n\n输入：${source.width}×${source.height}px；SHA-256：\`${source.sha256}\`。\n\n## 尺度与实现边界\n\n${dimensions}\n\n## 复现与回退\n\n项目脚本：\`frontend/scripts/export-parsing-assets.mjs\`。在项目根目录执行 \`node frontend/scripts/export-parsing-assets.mjs\`；使用现有React/Three.js/esbuild，不新增依赖。\n\n导出前的素材说明和文件哈希保存在 \`jia-you-xin-jie/artifacts/${path.basename(snapshot)}\`。本次只增加导出脚本、SVG、GLB和离线预览，更新本目录说明；现有网站源码及交互不修改。\n`);
  manifest.validation.push({ source: source.name, width: room.width, depth: room.depth, area: room.area, height: 2.8, doorWidth: room.doors[0].width, windowWidth: data.WINDOW_DETAILS[0].opening_width_mm / 1000, glbBytes: glb.length, meshes, roundTripMeshes: loadedMeshes, geometryRoundTrip: "passed", sourceSHA256: source.sha256 });
  disposeMetric(arch.group); disposeMetric(loaded.scene);
}
assert.equal(sha(Buffer.from(JSON.stringify(base))), baseHash);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
await writeFile(path.join(snapshot, "README.md"), `# 平面图成果导出\n\n三个对应目录各新增三份SVG、一份GLB和一个离线HTML，更新素材说明。原图、网站运行源码与依赖保持原样。\n\n原说明备份：before/。导出清单、文件SHA-256、GLB重新读取后的实际几何验证：export-manifest.json。\n\n回退不需要修改网站；需要恢复说明时可从before/按原相对目录复制。保留全部原图和导出成果，未执行删除。\n`);
console.log(JSON.stringify({ snapshot, exports: manifest.validation }, null, 2));
