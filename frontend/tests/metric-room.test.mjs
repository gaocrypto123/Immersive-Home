import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import {
  adaptMetricRoom,
  exportMetricRoom,
  metricFootprint,
  metricIssues,
  moveMetricItem,
  validMetricItems,
} from "../src/metric-room.js";
import {
  buildMetricArchitecture,
  buildMetricFurniture,
  disposeMetric,
  setMetricDoor,
} from "../src/metric-three.js";
const geometryData = JSON.parse(
  await readFile(
    new URL(
      "../../data/room-descriptions/L02-动静分区-房间估算.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
// Preserve furnished editing coverage independently of the active empty-room preset.
const fixture = JSON.parse(
  await readFile(
    new URL("./fixtures/L02-furniture.json", import.meta.url),
    "utf8",
  ),
);
const data = { ...geometryData, ...fixture };
test("空房 JSON 不包含家具，二维三维保留同一门窗几何", () => {
  assert.deepEqual(geometryData.furniture, []);
  assert.equal(Object.hasOwn(geometryData, "FURNITURE_DETAILS"), false);
  const room = adaptMetricRoom(geometryData);
  assert.deepEqual(room.furniture, []);
  assert(validMetricItems([], room));
  const arch = buildMetricArchitecture(room);
  assert.equal(arch.summary.doors[0].width, 0.75);
  assert.deepEqual(exportMetricRoom(room, []).furniture, []);
  disposeMetric(arch.group);
});
const close = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
test("毫米描述只转换一次：净尺寸、缺口和面积正确", () => {
  const r = adaptMetricRoom(data);
  close(r.width, 3.6);
  close(r.depth, 3.8);
  close(r.area, 13.205);
  close(r.height, 2.8);
  assert.deepEqual(r.outline[0], [0.95, 0]);
  assert.equal(data.units, "mm");
});
test("生成的 Three.js 地板与窗洞实际尺寸符合 JSON", () => {
  const room = adaptMetricRoom(data),
    a = buildMetricArchitecture(room);
  close(a.summary.floorWidth, 3.6);
  close(a.summary.floorDepth, 3.8);
  const w = a.summary.windows[0];
  close(w.width, 2.1);
  close(w.sill, 0.85);
  close(w.head, 2.35);
  assert.deepEqual(w.center, [1.7, 3.875]);
  const d = a.summary.doors[0];
  assert.deepEqual(d.hinge, [0.05, 0.5]);
  close(d.width, 0.75);
  close(d.height, 2.1);
  close(d.openRotationY, -Math.PI / 2);
  disposeMetric(a.group);
});
test("门扇在同一铰点向室内开启，关闭时恢复水平洞口", () => {
  const room = adaptMetricRoom(data),
    a = buildMetricArchitecture(room),
    d = a.doorPivots[0];
  const pos = new THREE.Vector3();
  d.pivot.updateMatrixWorld(true);
  d.leaf.getWorldPosition(pos);
  close(pos.x, 0.05);
  close(pos.z, 0.875);
  setMetricDoor(d.pivot, d.door, false);
  d.pivot.updateMatrixWorld(true);
  d.leaf.getWorldPosition(pos);
  close(pos.x, 0.425);
  close(pos.z, 0.5);
  disposeMetric(a.group);
});
test("二维顺时针90度与三维负Y转角一致：床头朝右", () => {
  const r = adaptMetricRoom(data),
    bed = r.furniture[0],
    g = buildMetricFurniture(bed);
  g.updateMatrixWorld(true);
  const head = new THREE.Vector3(0, 0, -bed.d / 2).applyMatrix4(g.matrixWorld);
  assert(head.x > bed.cx);
  close(head.z, bed.cy);
  close(g.rotation.y, -Math.PI / 2);
  const poly = metricFootprint(bed);
  close(
    Math.max(...poly.map((p) => p[0])) - Math.min(...poly.map((p) => p[0])),
    2.3,
  );
  close(
    Math.max(...poly.map((p) => p[1])) - Math.min(...poly.map((p) => p[1])),
    1.45,
  );
  disposeMetric(g);
});
test("初始家具在房内、不相交且不阻挡开门；移动不能进入缺口", () => {
  const room = adaptMetricRoom(data),
    items = room.furniture;
  assert(validMetricItems(items, room));
  assert.deepEqual(metricIssues(items, room), []);
  assert.equal(moveMetricItem(items, room, items[4].id, [0.2, 0.2]), items);
  const moved = moveMetricItem(items, room, items[4].id, [1.6, 2.8]);
  assert.notEqual(moved, items);
  assert.equal(moved[4].cx, 1.6);
});
test("编辑后导出仍为毫米且保留房间、门窗和估算声明", () => {
  const room = adaptMetricRoom(data),
    items = moveMetricItem(room.furniture, room, "L02_chair", [1.6, 2.8]),
    out = exportMetricRoom(room, items);
  assert.equal(out.furniture.find((f) => f.id === "L02_chair").cx, 1600);
  assert.equal(out.units, "mm");
  assert.deepEqual(out.ROOMS, data.ROOMS);
  assert.deepEqual(out.WINS, data.WINS);
  assert.deepEqual(out.DOORS, data.DOORS);
  assert.equal(out.status, "visual_estimate_not_measured");
  assert.equal(data.furniture.find((f) => f.id === "L02_chair").cx, 1800);
});
test("局部保存格式校验不会接受相对坐标或不同家具类型", () => {
  const room = adaptMetricRoom(data),
    bad = JSON.parse(JSON.stringify(room.furniture));
  bad[0].type = "plant";
  assert.equal(validMetricItems(bad, room), false);
  assert.throws(() => adaptMetricRoom({ ...data, units: "uv" }));
});
