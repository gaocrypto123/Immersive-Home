import { inside, OUTLINE, worldPolygon } from "./model.js";
import { demoCost } from "./party-model.js";
export const STYLES = [
  {
    id: "natural",
    name: "原木自然",
    colors: ["#c29575", "#91aa92", "#819caa"],
    floor: "light",
  },
  {
    id: "cream",
    name: "奶油极简",
    colors: ["#d6c1a4", "#bcbda6", "#b5ae97"],
    floor: "warm",
  },
  {
    id: "modern",
    name: "清爽现代",
    colors: ["#9cabb0", "#8a9f9c", "#778a91"],
    floor: "grey",
  },
];
export const DEFAULT_BRIEF = {
  style: "natural",
  budget: 3500,
  study: true,
  storage: true,
  rental: true,
};
export function styleItems(items, style) {
  const s = STYLES.find((x) => x.id === style) || STYLES[0];
  return items.map((a) => ({
    ...a,
    color:
      s.colors[
        a.category === "bed"
          ? 0
          : ["wardrobe", "walk_in_closet"].includes(a.category)
            ? 2
            : 1
      ],
  }));
}
export function rankLayouts(layouts, brief) {
  return [...layouts].sort((a, b) => score(b, brief) - score(a, brief));
}
function score(l, b) {
  let s = demoCost(l.items) <= b.budget ? 20 : 0;
  if (b.study && l.items.some((x) => x.category === "desk")) s += 10;
  if (
    b.storage &&
    l.items.some((x) => ["wardrobe", "walk_in_closet"].includes(x.category))
  )
    s += 5;
  if (
    b.rental &&
    !l.items.some((x) => ["partition", "walk_in_closet"].includes(x.category))
  )
    s += 8;
  return s;
}
export function occupancy(items) {
  const polygons = items.map(worldPolygon);
  let total = 0,
    used = 0;
  for (let x = 0; x < 65; x++)
    for (let y = 0; y < 75; y++) {
      const p = [(x + 0.5) / 65, (y + 0.5) / 75];
      if (!inside(p, OUTLINE)) continue;
      total++;
      if (polygons.some((poly) => inside(p, poly))) used++;
    }
  return Math.round((used / total) * 100);
}
export const EXAMPLE_SPECS = {
  bed: "150 × 200 × 85 cm",
  bedside_cabinet: "45 × 35 × 50 cm",
  storage_cabinet: "80 × 40 × 75 cm",
  wardrobe: "80 × 45 × 180 cm",
  walk_in_closet: "组合柜，待确认",
  desk: "100 × 50 × 75 cm",
  chair: "45 × 45 × 80 cm",
  partition: "可拆装形式待确认",
};
