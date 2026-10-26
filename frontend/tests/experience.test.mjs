import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  checkParty,
  PARTY_FURNITURE,
  DAILY_FURNITURE,
  PARTY_PEOPLE,
  STANDING_SPACES,
  bounds,
  intersects,
  PARTY_ROOM,
} from "../src/party-model.js";
import { rankLayouts, DEFAULT_BRIEF, occupancy } from "../src/bedroom-brief.js";
import { validateUpload, briefReady } from "../src/custom-brief.js";
test("聚会同时提供4游戏、4麻将与2儿童位置", () => {
  const c = checkParty();
  assert.equal(c.switchSeats, 4);
  assert.equal(c.mahjongSeats, 4);
  assert.equal(c.children, 2);
  assert.equal(PARTY_PEOPLE.length, 10);
});
test("1米主通道不被家具或麻将起身区域占用", () => {
  const c = checkParty();
  assert.equal(c.passageWidthM, 1);
  assert(c.mainPassageClear);
  assert(c.standingSpacesClear);
  assert(c.standingInsideRoom);
  assert(c.childrenInPassage);
  assert(c.furnitureInsideRoom);
  for (const s of STANDING_SPACES)
    assert.equal(intersects(s, PARTY_ROOM.passage), false);
});
test("麻将四把椅子独立，游戏4个座位朝向同一电视区域", () => {
  assert.equal(PARTY_FURNITURE.filter((f) => f.type === "chair").length, 4);
  const tv = PARTY_FURNITURE.find((f) => f.type === "tv");
  for (const p of PARTY_PEOPLE.filter((p) => p.group === "switch")) {
    assert(p.y > tv.y);
    assert(Math.abs(p.x - tv.x) / (p.y - tv.y) < 1.1);
  }
});
test("聚会只重排原家具，日常位置可精确恢复", () => {
  assert.deepEqual(
    PARTY_FURNITURE.map((f) => f.id).sort(),
    DAILY_FURNITURE.map((f) => f.id).sort(),
  );
  assert.equal(PARTY_FURNITURE.length, 9);
  assert.notDeepEqual(
    PARTY_FURNITURE.find((f) => f.id === "coffee"),
    DAILY_FURNITURE.find((f) => f.id === "coffee"),
  );
  for (const a of DAILY_FURNITURE) {
    const r = bounds(a);
    assert(r[0] >= 0 && r[1] >= 0 && r[2] <= 8 && r[3] <= 5.6);
  }
});
test("上传类型、空文件和体积边界正确", () => {
  assert.equal(validateUpload({ type: "image/png", size: 1024 }, true), "");
  assert.equal(
    validateUpload({ type: "application/pdf", size: 1024 }, true),
    "",
  );
  assert(validateUpload({ type: "application/pdf", size: 1024 }, false));
  assert(validateUpload({ type: "image/png", size: 0 }, true));
  assert(validateUpload({ type: "image/jpeg", size: 11 * 1024 * 1024 }, false));
  assert.equal(
    validateUpload({ type: "image/jpeg", size: 20 * 1024 * 1024 }, true),
    "",
  );
});
test("缺图、缺参考、非整数人数与无效预算不能完成自定义需求", () => {
  const f = { needs: "需要学习、睡觉和存放衣服", people: 1, budget: 5000 };
  assert.equal(briefReady([], [], f), false);
  assert.equal(briefReady([{}], [], f), false);
  assert(briefReady([{}], [{}], f));
  assert.equal(briefReady([{}], [{}], { ...f, people: 1.5 }), false);
  assert.equal(briefReady([{}], [{}], { ...f, budget: Infinity }), false);
  assert.equal(briefReady([{}], [{}], { ...f, budget: 499 }), false);
});
test("需求排序复用6个参考方案，占地为轮廓并集而非重复计数", async () => {
  const d = JSON.parse(
    await readFile(
      new URL("../public/assets/bedroom.json", import.meta.url),
      "utf8",
    ),
  );
  const ranked = rankLayouts(d.layouts, DEFAULT_BRIEF);
  assert.equal(ranked.length, 6);
  assert(
    !ranked[0].items.some((x) =>
      ["partition", "walk_in_closet"].includes(x.category),
    ),
  );
  const items = d.layouts[0].items;
  assert.equal(occupancy(items), occupancy([...items, ...items]));
  assert(occupancy(items) > 0 && occupancy(items) < 100);
});
