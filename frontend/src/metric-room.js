import { inside } from "./model.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
const meter = (value) => value / 1000;
export const METRIC_STORAGE = "jyxj.metric-bedroom.L02.v1";
export function adaptMetricRoom(data) {
  if (
    data?.schema !== "jyxj.floorplan-3d-room-description.v1" ||
    data.units !== "mm" ||
    data.ROOMS?.length !== 1
  )
    throw Error("卧室尺寸数据格式不正确");
  const dim = data.DIMENSIONS;
  const rect = (r) => {
    if (
      !Array.isArray(r) ||
      r.length < 4 ||
      r.slice(0, 4).some((n) => !Number.isFinite(n)) ||
      r[2] <= r[0] ||
      r[3] <= r[1]
    )
      throw Error("墙体或门窗尺寸无效");
    return r.slice(0, 4).map(meter);
  };
  if (
    !dim ||
    [
      dim.clear_bbox_width_mm,
      dim.clear_bbox_depth_mm,
      dim.ceiling_height_mm,
    ].some((n) => !Number.isFinite(n) || n <= 0)
  )
    throw Error("缺少卧室尺寸");
  const outline = data.ROOMS[0].poly.map((p) => {
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      p.some((n) => !Number.isFinite(n))
    )
      throw Error("房间轮廓无效");
    return p.map(meter);
  });
  const room = {
    id: data.ROOMS[0].id,
    name: "L02 · 动静分区",
    width: meter(dim.clear_bbox_width_mm),
    depth: meter(dim.clear_bbox_depth_mm),
    height: meter(dim.ceiling_height_mm),
    outline,
    area: polygonArea(outline),
    source: copy(data),
    walls: data.WALLS.map((r, i) => ({ id: `wall-${i}`, rect: rect(r) })),
    windows: data.WINS.map((r, i) => {
      const details = data.WINDOW_DETAILS.find((d) => d.wins_index === i);
      if (
        !details ||
        !(details.sill_height_mm >= 0) ||
        !(details.opening_height_mm > 0)
      )
        throw Error("缺少窗台与窗高假设");
      return {
        id: details.id,
        rect: rect(r),
        sill: meter(details.sill_height_mm),
        height: meter(details.opening_height_mm),
      };
    }),
    doors: data.DOORS.map((d) => ({
      id: d.id,
      rect: rect(d.rect),
      hinge: d.h.map(meter),
      closed: [...d.c],
      open: [...d.o],
      width: meter(d.len),
      height: meter(d.height_mm),
      thickness: meter(d.leaf_thickness_mm),
    })),
    furniture: data.furniture.map((f) => ({
      ...copy(f),
      cx: meter(f.cx),
      cy: meter(f.cy),
      w: meter(f.w),
      d: meter(f.d),
      height: meter(data.FURNITURE_DETAILS.expected_heights_mm[f.id]),
    })),
  };
  if (!validMetricItems(room.furniture, room))
    throw Error("家具尺寸或初始位置无效");
  return room;
}
export function polygonArea(poly) {
  return (
    Math.abs(
      poly.reduce((sum, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2
  );
}
export function metricFootprint(item) {
  const a = (item.rot * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-item.w / 2, -item.d / 2],
    [item.w / 2, -item.d / 2],
    [item.w / 2, item.d / 2],
    [-item.w / 2, item.d / 2],
  ].map(([x, y]) => [item.cx + x * c - y * s, item.cy + x * s + y * c]);
}
export function validMetricItems(items, room) {
  if (!Array.isArray(items) || items.length !== room.source.furniture.length)
    return false;
  const ids = new Set();
  return items.every((f) => {
    const original = room.source.furniture.find((x) => x.id === f.id);
    if (!original || ids.has(f.id) || original.type !== f.type) return false;
    ids.add(f.id);
    return (
      [f.cx, f.cy, f.w, f.d, f.rot, f.height].every(Number.isFinite) &&
      f.w > 0 &&
      f.d > 0 &&
      f.height > 0 &&
      f.height <= room.height &&
      f.w <= 10 &&
      f.d <= 10 &&
      Math.abs(f.rot) <= 3600 &&
      /^#[0-9a-f]{6}$/i.test(f.color) &&
      metricFootprint(f).every((p) => inside(p, room.outline))
    );
  });
}
export function moveMetricItem(items, room, id, center) {
  if (center.some((n) => !Number.isFinite(n))) return items;
  const next = items.map((f) =>
    f.id === id
      ? {
          ...f,
          cx: Math.round(center[0] * 100) / 100,
          cy: Math.round(center[1] * 100) / 100,
        }
      : f,
  );
  return validMetricItems(next, room) ? next : items;
}
export function metricIssues(items, room, doorOpen = true) {
  const bounds = (poly) => [
    Math.min(...poly.map((p) => p[0])),
    Math.min(...poly.map((p) => p[1])),
    Math.max(...poly.map((p) => p[0])),
    Math.max(...poly.map((p) => p[1])),
  ];
  const overlaps = (a, b) =>
    Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.005 &&
    Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.005;
  const issues = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (
        overlaps(
          bounds(metricFootprint(items[i])),
          bounds(metricFootprint(items[j])),
        )
      )
        issues.push(
          `${shortName(items[i])}与${shortName(items[j])}占地可能重叠`,
        );
  if (doorOpen)
    for (const door of room.doors)
      for (const f of items) {
        // Sample the actual door sector, rather than its enclosing square.
        const closed = Math.atan2(door.closed[1], door.closed[0]),
          opened = Math.atan2(door.open[1], door.open[0]);
        const poly = metricFootprint(f);
        let hit = false;
        for (let a = 0; a <= 24 && !hit; a++)
          for (let r = 1; r <= 16; r++) {
            const angle = closed + ((opened - closed) * a) / 24,
              radius = (door.width * r) / 16;
            if (
              inside(
                [
                  door.hinge[0] + Math.cos(angle) * radius,
                  door.hinge[1] + Math.sin(angle) * radius,
                ],
                poly,
              )
            ) {
              hit = true;
              break;
            }
          }
        if (hit) issues.push(`${shortName(f)}可能挡住开门范围`);
      }
  return issues;
}
export function shortName(item) {
  return (
    {
      L02_bed: "床",
      L02_wardrobe: "衣柜",
      L02_desk: "窗边书桌",
      L02_low_cabinet: "矮柜",
      L02_chair: "书椅",
    }[item.id] || item.name
  );
}
export function exportMetricRoom(room, items) {
  const data = copy(room.source);
  data.furniture = items.map((f) => ({
    ...data.furniture.find((x) => x.id === f.id),
    cx: Math.round(f.cx * 1000),
    cy: Math.round(f.cy * 1000),
    w: Math.round(f.w * 1000),
    d: Math.round(f.d * 1000),
    rot: f.rot,
    color: f.color,
  }));
  data.layout_edited = true;
  data.status = "visual_estimate_not_measured";
  return data;
}
