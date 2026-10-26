// A dimensioned demonstration, independent of the measured/quoted P03 and P04 cases.
export const PARTY_ROOM = {
  width: 8,
  depth: 5.6,
  source: "demo_assumption",
  passage: [3.5, 0.6, 4.5, 5.6],
};
const item = (id, type, name, x, y, w, d, rotation = 0) => ({
  id,
  type,
  name,
  x,
  y,
  w,
  d,
  rotation,
});
const tableChairs = (y) => [
  item("chair-n", "chair", "餐椅 1", 6.2, y - 0.95, 0.5, 0.5, 180),
  item("chair-e", "chair", "餐椅 2", 7.15, y, 0.5, 0.5, 270),
  item("chair-s", "chair", "餐椅 3", 6.2, y + 0.95, 0.5, 0.5, 0),
  item("chair-w", "chair", "餐椅 4", 5.25, y, 0.5, 0.5, 90),
];
export const DAILY_FURNITURE = [
  item("tv", "tv", "电视", 1.65, 0.28, 2.2, 0.18),
  item("sofa", "sofa", "三人沙发", 2.2, 3.25, 2.3, 0.85),
  item("armchair", "armchair", "单人椅", 3.85, 2.55, 0.75, 0.8),
  item("coffee", "coffee", "茶几", 2.15, 1.95, 1.1, 0.55),
  item("table", "table", "方餐桌", 6.2, 2.7, 0.9, 0.9),
  ...tableChairs(2.7),
];
export const PARTY_FURNITURE = [
  item("tv", "tv", "电视", 1.65, 0.28, 2.2, 0.18),
  item("sofa", "sofa", "三人沙发", 1.65, 2.65, 2.3, 0.85),
  item("armchair", "armchair", "单人椅", 2.98, 1.75, 0.75, 0.8),
  item("coffee", "coffee", "茶几", 1.5, 4.75, 1.1, 0.55),
  item("table", "table", "方餐桌", 6.2, 2.35, 0.9, 0.9),
  ...tableChairs(2.35),
];
export const PARTY_PEOPLE = [
  { id: "S1", group: "switch", x: 0.93, y: 2.61 },
  { id: "S2", group: "switch", x: 1.65, y: 2.61 },
  { id: "S3", group: "switch", x: 2.37, y: 2.61 },
  { id: "S4", group: "switch", x: 2.98, y: 1.75 },
  { id: "M1", group: "mahjong", x: 6.2, y: 1.4 },
  { id: "M2", group: "mahjong", x: 7.15, y: 2.35 },
  { id: "M3", group: "mahjong", x: 6.2, y: 3.3 },
  { id: "M4", group: "mahjong", x: 5.25, y: 2.35 },
  { id: "K1", group: "children", x: 3.88, y: 2.05 },
  { id: "K2", group: "children", x: 4.12, y: 3.7 },
];
export const STANDING_SPACES = [
  [5.95, 0.65, 6.45, 1.15],
  [7.4, 2.1, 7.9, 2.6],
  [5.95, 3.55, 6.45, 4.05],
  [4.5, 2.1, 5, 2.6],
];
export function bounds(a) {
  return [a.x - a.w / 2, a.y - a.d / 2, a.x + a.w / 2, a.y + a.d / 2];
}
export function intersects(a, b) {
  return (
    Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-7 &&
    Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-7
  );
}
export function checkParty() {
  const f = PARTY_FURNITURE,
    p = PARTY_PEOPLE,
    passage = PARTY_ROOM.passage;
  return {
    switchSeats: p.filter((x) => x.group === "switch").length,
    mahjongSeats: p.filter((x) => x.group === "mahjong").length,
    children: p.filter((x) => x.group === "children").length,
    passageWidthM: passage[2] - passage[0],
    mainPassageClear: f.every((a) => !intersects(bounds(a), passage)),
    standingSpacesClear: STANDING_SPACES.every((s) =>
      f.every((a) => !intersects(bounds(a), s)),
    ),
    standingInsideRoom: STANDING_SPACES.every(
      (s) =>
        s[0] >= 0 &&
        s[1] >= 0 &&
        s[2] <= PARTY_ROOM.width &&
        s[3] <= PARTY_ROOM.depth,
    ),
    childrenInPassage: p
      .filter((x) => x.group === "children")
      .every((x) => x.x - 0.16 >= passage[0] && x.x + 0.16 <= passage[2]),
    furnitureInsideRoom: f.every((a) => {
      const b = bounds(a);
      return (
        b[0] >= 0 &&
        b[1] >= 0 &&
        b[2] <= PARTY_ROOM.width &&
        b[3] <= PARTY_ROOM.depth
      );
    }),
  };
}
export const BEDROOM_PRICES = {
  bed: 899,
  bedside_cabinet: 129,
  storage_cabinet: 249,
  wardrobe: 799,
  walk_in_closet: 1399,
  desk: 399,
  chair: 159,
  partition: 199,
};
export function demoCost(items) {
  return items.reduce(
    (n, a) =>
      n +
      (a.category === "desk" && a.polygon.length > 4
        ? 599
        : BEDROOM_PRICES[a.category] || 0),
    0,
  );
}
