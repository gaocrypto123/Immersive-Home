export const ROOM_RATIO = 1.15;
export const OUTLINE = [
  [0.34, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0.15],
  [0.34, 0.15],
];
export const PALETTE = {
  bed: "#bf8a6f",
  bedside_cabinet: "#b99a72",
  storage_cabinet: "#b99a72",
  wardrobe: "#819caa",
  walk_in_closet: "#819caa",
  desk: "#91aa92",
  chair: "#b2a0b7",
  partition: "#a8aaa5",
  plant: "#6f8e70",
};
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function shiftItem(item, center) {
  const du = center[0] - item.center[0],
    dv = center[1] - item.center[1];
  return {
    ...item,
    center,
    polygon: item.polygon.map(([u, v]) => [u + du, v + dv]),
    bounds: item.bounds.map((n, i) => n + (i % 2 ? dv : du)),
  };
}
export function resizeItem(item, w, d) {
  const [x0, y0, x1, y1] = item.bounds,
    sx = w / (x1 - x0),
    sy = d / (y1 - y0),
    [cx, cy] = item.center;
  return {
    ...item,
    bounds: [cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2],
    polygon: item.polygon.map(([u, v]) => [
      cx + (u - cx) * sx,
      cy + (v - cy) * sy,
    ]),
  };
}
export function worldPolygon(item) {
  const a = ((item.rotation || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    [cx, cy] = item.center;
  return item.polygon.map(([u, v]) => {
    const x = u - cx,
      y = (v - cy) * ROOM_RATIO;
    return [cx + x * c - y * s, cy + (x * s + y * c) / ROOM_RATIO];
  });
}
export function inside(p, poly, edge = true) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-7 &&
      p[0] >= Math.min(a[0], b[0]) - 1e-7 &&
      p[0] <= Math.max(a[0], b[0]) + 1e-7 &&
      p[1] >= Math.min(a[1], b[1]) - 1e-7 &&
      p[1] <= Math.max(a[1], b[1]) + 1e-7
    )
      return edge;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
export function overlaps(a, b) {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        r = b[j],
        s = b[(j + 1) % b.length];
      if (
        cross(p, q, r) * cross(p, q, s) < -1e-12 &&
        cross(r, s, p) * cross(r, s, q) < -1e-12
      )
        return true;
    }
  if (a.some((p) => inside(p, b, false)) || b.some((p) => inside(p, a, false)))
    return true;
  for (let i = 0; i < a.length; i++) {
    const p = a[i],
      q = a[(i + 1) % a.length],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!len) continue;
    for (const side of [-1, 1]) {
      const m = [
        (p[0] + q[0]) / 2 + ((q[1] - p[1]) / len) * 1e-5 * side,
        (p[1] + q[1]) / 2 - ((q[0] - p[0]) / len) * 1e-5 * side,
      ];
      if (inside(m, a, false) && inside(m, b, false)) return true;
    }
  }
  return false;
}
export function inspect(items) {
  const issues = [];
  const shapes = items.map(worldPolygon);
  for (let i = 0; i < items.length; i++) {
    const p = shapes[i];
    if (
      p.some((v) => !inside(v, OUTLINE)) ||
      p.some(
        (v, j) =>
          !inside(
            [
              (v[0] + p[(j + 1) % p.length][0]) / 2,
              (v[1] + p[(j + 1) % p.length][1]) / 2,
            ],
            OUTLINE,
          ),
      )
    )
      issues.push({
        ids: [items[i].id],
        message: `${items[i].label}可能越出房间`,
      });
    for (let j = i + 1; j < items.length; j++)
      if (overlaps(p, shapes[j]))
        issues.push({
          ids: [items[i].id, items[j].id],
          message: `${items[i].label}与${items[j].label}占地重叠`,
        });
  }
  return issues;
}
export function validateImport(value) {
  if (
    value?.schema !== "jyxj.studio-plan.v1" ||
    !/^L0[1-6]$/.test(value.layoutId) ||
    !Array.isArray(value.items) ||
    value.items.length > 80
  )
    throw Error("请选择家有新解工作台导出的卧室方案 JSON");
  const ids = new Set();
  for (const a of value.items) {
    if (
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      !Object.hasOwn(PALETTE, a.category) ||
      typeof a.label !== "string" ||
      a.label.length > 80
    )
      throw Error("家具数据无效");
    ids.add(a.id);
    for (const x of [a.center, a.bounds])
      if (
        !Array.isArray(x) ||
        x.length !== (x === a.center ? 2 : 4) ||
        x.some((n) => !Number.isFinite(n) || n < -0.5 || n > 1.5)
      )
        throw Error("坐标超出支持范围");
    if (a.bounds[2] <= a.bounds[0] || a.bounds[3] <= a.bounds[1])
      throw Error("家具宽度或深度无效");
    if (
      !Array.isArray(a.polygon) ||
      a.polygon.length < 3 ||
      a.polygon.length > 30 ||
      a.polygon.some(
        (p) =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((n) => !Number.isFinite(n) || n < -0.5 || n > 1.5),
      )
    )
      throw Error("家具轮廓无效");
    if (!Number.isFinite(a.rotation) || Math.abs(a.rotation) > 3600)
      throw Error("家具角度无效");
    if (a.color && !/^#[0-9a-f]{6}$/i.test(a.color))
      throw Error("家具颜色无效");
  }
  return clone(value);
}
export const LIBRARY = [
  { category: "bed", label: "双人床", size: [0.46, 0.6] },
  { category: "wardrobe", label: "衣柜", size: [0.19, 0.44] },
  { category: "desk", label: "书桌", size: [0.33, 0.17] },
  { category: "chair", label: "书椅", size: [0.14, 0.13] },
  { category: "bedside_cabinet", label: "床头柜", size: [0.15, 0.13] },
  { category: "storage_cabinet", label: "收纳柜", size: [0.24, 0.17] },
  { category: "partition", label: "隔断", size: [0.03, 0.35] },
  { category: "plant", label: "绿植", size: [0.12, 0.12] },
];
export function newItem(type) {
  const l = LIBRARY.find((x) => x.category === type),
    [w, d] = l.size;
  return {
    id: `${type}_${crypto.randomUUID().slice(0, 8)}`,
    label: l.label,
    category: type,
    center: [0.5, 0.65],
    bounds: [0.5 - w / 2, 0.65 - d / 2, 0.5 + w / 2, 0.65 + d / 2],
    polygon: [
      [0.5 - w / 2, 0.65 - d / 2],
      [0.5 + w / 2, 0.65 - d / 2],
      [0.5 + w / 2, 0.65 + d / 2],
      [0.5 - w / 2, 0.65 + d / 2],
    ],
    rotation: 0,
    orientation: type === "bed" ? "床头朝画面上方" : null,
    description: "手动添加",
    confidence: "user",
    notes: "手动添加的示意家具，未指定商品或真实尺寸",
  };
}
