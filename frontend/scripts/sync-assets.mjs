import { readFile, writeFile, mkdir, copyFile, stat, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { REFERENCE_EXAMPLES } from "../src/reference-examples.js";
const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(here, ".."),
  project = path.resolve(root, "..");
const out = path.join(root, "public/assets");
await mkdir(out, { recursive: true });
// Only the portable description is exposed; never expose source image folders or artifacts.
await copyFile(
  path.join(project, "data/room-descriptions/L02-动静分区-房间估算.json"),
  path.join(out, "room-L02.json"),
);
async function copy(src, dest) {
  const target = path.join(out, dest);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    const [a, b] = await Promise.all([stat(src), stat(target)]);
    if (a.size === b.size && b.mtimeMs >= a.mtimeMs) return;
  } catch {}
  await copyFile(src, target);
}
const source = path.join(project, "data/bedroom-corner-six");
const pipelineSource = path.join(project, "data/reference-pipeline/v1");
const pipelineIndex = JSON.parse(await readFile(path.join(pipelineSource, "index.json"), "utf8"));
await copy(path.join(project,'data/final-layout/L01/full-layout.glb'),'final-layout/L01/full-layout.glb');
await copy(path.join(project,'data/final-layout/L01/mobile-layout.glb'),'final-layout/L01/mobile-layout.glb');
await copy(path.join(project,'data/final-layout/L01/balanced-layout-16.glb'),'final-layout/L01/balanced-layout-16.glb');
// Keep the original in data/ for rollback; do not ship its generated 106 MB copy.
await rm(path.join(out,'final-layout/L01/full-layout.glb'),{force:true});
const imageVariants=JSON.parse(await readFile(path.join(root,'src/image-assets.generated.json'),'utf8'));
for(const variant of Object.values(imageVariants)){
 for(const url of [variant.url,variant.thumbnail].filter(value=>value?.startsWith('/assets/optimized/'))){
  const relative=url.replace(/^\/assets\//,'');
  if(!/^optimized\/[a-f0-9]{20}-(exact|q\d+|thumb)\.(webp|png)$/.test(relative))throw Error('优化图片路径无效。');
  await copy(path.join(project,'data/web-images/files',path.basename(relative)),relative);
 }
}
for (const relative of pipelineIndex.files) {
  if (relative.includes("..") || path.isAbsolute(relative) || !/\.(json|png|jpg|svg|glb)$/.test(relative)) throw Error("参考图解析资源路径不在白名单中。");
  await copy(path.join(pipelineSource, relative), `reference-pipeline/v1/${relative}`);
}
// Only the six room crops are served, not full proposal boards or local logs.
for (const example of REFERENCE_EXAMPLES) {
  await copy(
    path.join(project, "data/reference-sources", example.sourceFile),
    `reference-sources/${example.id}.png`,
  );
  await copy(
    path.join(project, "data/reference-inspiration", example.file),
    `inspiration/${example.id}.png`,
  );
}
// Structured reference drafts have an explicit generated-file manifest. Never
// publish annotation scripts, unrelated data directories or absolute provenance paths.
const analysisSource = path.join(project, "data/reference-analysis/v1");
const analysisIndex = JSON.parse(await readFile(path.join(analysisSource, "index.json"), "utf8"));
for (const relative of analysisIndex.files) {
  if (relative.includes("..") || path.isAbsolute(relative) || !/\.(json|svg|png|glb|csv)$/.test(relative))
    throw Error("参考图解析清单中有非白名单路径。");
  await copy(path.join(analysisSource, relative), `reference-analysis/v1/${relative}`);
}
// Expose only these approved demonstration inputs, never whole source folders.
for (const [name, target] of [
  ["房产中介风格平面图-01.png", "plan-01.png"],
  ["房产中介风格平面图-02.png", "plan-02.png"],
  ["房产中介风格平面图-03.png", "plan-03.png"],
])
  await copy(
    path.join(project, "data/room-descriptions/inputs", name),
    `parsing/${target}`,
  );
let original;
try {
  original = JSON.parse(
    await readFile(path.join(source, "layouts.json"), "utf8"),
  );
} catch {
  throw Error("缺少六种卧室布局资料：请保留项目 data/bedroom-corner-six。");
}
const bedroom = {
  source: {
    type: "video_observation",
    sha256: original.source.sha256,
    scale: "relative",
    metricScale: null,
  },
  outline: original.layouts[0].room_registration.shared_outline_uv,
  layouts: [],
};
for (const [i, l] of original.layouts.entries()) {
  const photo = `reference/layout-${String(i + 1).padStart(2, "0")}.png`;
  await copy(path.join(source, l.screenshot_room), photo);
  bedroom.layouts.push({
    id: l.id,
    title: l.title,
    time: l.timestamp_seconds,
    frame: l.frame_index,
    image: "/assets/" + photo,
    items: l.items.map((a) => ({
      id: a.id,
      label: a.label,
      category: a.category,
      bounds: a.estimated_floor_bbox_uv,
      polygon: a.estimated_floor_polygon_uv,
      center: a.estimated_center_uv,
      orientation: a.orientation,
      description: a.position_description,
      notes: a.notes,
      confidence: a.floor_position_confidence,
      rotation: 0,
    })),
  });
}
await writeFile(
  path.join(out, "bedroom.json"),
  JSON.stringify(bedroom, null, 2),
);
const living = [];
for (const id of ["P04-R01", "P03-R01"]) {
  const folder = path.join(project, "demo", id, "scene");
  try {
    const [settings, quotes, layout] = await Promise.all(
      ["viewer-settings.json", "quotes.json", "layout.json"].map(async (n) =>
        JSON.parse(await readFile(path.join(folder, n), "utf8")),
      ),
    );
    await copy(path.join(folder, "Room.glb"), `${id}/Room.glb`);
    await copy(path.join(folder, "render/overview.png"), `${id}/overview.png`);
    const svg = path.join(project, "demo", id, "steps/instances.svg");
    await copy(svg, `${id}/plan.svg`);
    living.push({
      id,
      name: id === "P04-R01" ? "横向客餐厅" : "纵向客餐厅",
      image: `/assets/${id}/overview.png`,
      plan: `/assets/${id}/plan.svg`,
      model: `/assets/${id}/Room.glb`,
      settings,
      total: quotes.total_cny,
      items: quotes.instances.map((x) => ({
        id: x.id,
        label: x.label,
        size: x.size_m,
        price: x.price_label,
        allocation: x.budget_allocation_cny,
        notes: x.note,
        products: x.products,
      })),
      objects: layout.objects,
    });
  } catch (e) {
    console.warn(`${id}素材不可用: ${e.message}`);
  }
}
await writeFile(path.join(out, "living.json"), JSON.stringify(living, null, 2));
await copyFile(
  path.join(root, "favicon.svg"),
  path.join(root, "public/favicon.svg"),
);
console.log(
  `素材已准备：6种卧室方案 / ${living.length}个客餐厅案例。只复制展示白名单，不包含密钥或任务日志。`,
);
