import test from "node:test";
import assert from "node:assert/strict";
import {
  inside,
  overlaps,
  OUTLINE,
  newItem,
  shiftItem,
  resizeItem,
  worldPolygon,
  inspect,
  validateImport,
} from "../src/model.js";
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
test("入口缺口不属于房间，边界可以贴墙", () => {
  assert.equal(inside([0.1, 0.05], OUTLINE), false);
  assert.equal(inside([0.8, 0.05], OUTLINE), true);
  assert.equal(inside([0, 0.4], OUTLINE), true);
});
test("完全重合、包含和局部重叠都能识别", () => {
  const a = rect(0.1, 0.1, 0.4, 0.4);
  assert(overlaps(a, a));
  assert(overlaps(a, rect(0.2, 0.2, 0.3, 0.3)));
  assert(overlaps(a, rect(0.3, 0.3, 0.6, 0.6)));
});
test("共边与仅角点接触不算占地重叠", () => {
  assert.equal(overlaps(rect(0, 0, 0.3, 0.3), rect(0.3, 0, 0.5, 0.3)), false);
  assert.equal(overlaps(rect(0, 0, 0.3, 0.3), rect(0.3, 0.3, 0.6, 0.6)), false);
});
test("U形衣帽间内部的空位不能当作实心柜碰撞", () => {
  const u = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0.7, 1],
    [0.7, 0.3],
    [0.3, 0.3],
    [0.3, 1],
    [0, 1],
  ];
  assert.equal(overlaps(u, rect(0.4, 0.4, 0.6, 0.8)), false);
  assert.equal(overlaps(u, rect(0.1, 0.4, 0.4, 0.8)), true);
});
test("移动与缩放保持家具轮廓相对中心的关系", () => {
  const a = newItem("desk"),
    b = shiftItem(a, [0.7, 0.4]);
  assert.deepEqual(b.center, [0.7, 0.4]);
  assert(
    Math.abs(b.bounds[2] - b.bounds[0] - (a.bounds[2] - a.bounds[0])) < 1e-9,
  );
  const c = resizeItem(b, 0.2, 0.15);
  assert.deepEqual(c.center, b.center);
  assert(Math.abs(c.bounds[2] - c.bounds[0] - 0.2) < 1e-9);
});
test("90度旋转考虑房间长宽比，四次旋转回到原形", () => {
  const a = newItem("bed");
  const b = worldPolygon({ ...a, rotation: 360 });
  b.forEach((p, i) =>
    p.forEach((n, j) => assert(Math.abs(n - a.polygon[i][j]) < 1e-9)),
  );
  const r = worldPolygon({ ...a, rotation: 90 });
  assert(r.every((p) => p.every(Number.isFinite)));
});
test("越界及冲突检查使用真正的多边形", () => {
  const a = shiftItem(newItem("bedside_cabinet"), [0.1, 0.05]);
  assert(inspect([a]).some((i) => i.message.includes("越出")));
  const b = newItem("desk");
  assert(inspect([b, { ...b, id: "copy" }]).some((i) => i.ids.length === 2));
});
test("导入拒绝NaN、过大轮廓、重复ID和无效尺寸", () => {
  const a = newItem("desk"),
    make = (items) => ({
      schema: "jyxj.studio-plan.v1",
      layoutId: "L04",
      items,
    });
  assert.equal(validateImport(make([a])).items.length, 1);
  assert.throws(() => validateImport(make([a, a])));
  assert.throws(() => validateImport(make([{ ...a, center: [NaN, 1] }])));
  assert.throws(() =>
    validateImport(make([{ ...a, bounds: [0.5, 0.5, 0.1, 0.1] }])),
  );
  assert.throws(() =>
    validateImport(
      make([
        {
          ...a,
          polygon: [
            [0, 0],
            [99, 0],
            [0, 1],
          ],
        },
      ]),
    ),
  );
});
