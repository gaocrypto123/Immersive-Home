import test from "node:test";
import assert from "node:assert/strict";
import {
  springStep,
  deckPose,
  deckRank,
  swipeDirection,
} from "../src/deck-motion.js";
test("参考图采用横图比例和紧凑卡高，平面图卡片保留原尺寸", () => {
  for (const width of [210, 250, 350]) {
    const closed = deckPose(width, false, 0, false, true);
    assert.equal(closed.height, (closed.width - 20) * 941 / 1672 + 84);
    assert.ok(closed.height < 316);
    assert.equal(deckPose(width, false, 0).height, 316);
    for (const coarse of [false, true]) {
      const cards = Array.from({length: 6}, (_, rank) => deckPose(width, true, rank, coarse, true));
      assert.equal(cards[0].height, coarse ? 124 : 104);
      for (let i = 1; i < cards.length; i++) assert.ok(cards[i].y > cards[i - 1].y + cards[i - 1].height);
    }
  }
});
test("六张参考图循环和展开时位姿有效，卡片之间不重叠", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => deckRank(i, 5, 6)), [1, 2, 3, 4, 5, 0]);
  for (const width of [210, 250, 350]) {
    for (const coarse of [false, true]) {
      for (let rank = 0; rank < 6; rank++) {
        assert.ok(Object.values(deckPose(width, false, rank, coarse)).every(Number.isFinite));
        if (rank > 0) {
          const previous = deckPose(width, true, rank - 1, coarse);
          assert.ok(previous.y + previous.height < deckPose(width, true, rank, coarse).y);
        }
      }
    }
  }
});
test("弹簧在30/60/120帧率下稳定归位，长帧不发散", () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 120, 0.9]) {
    let x = -300,
      v = 900;
    for (let i = 0; i < 500; i++) [x, v] = springStep(x, v, 90, dt);
    assert.ok(Number.isFinite(x) && Number.isFinite(v));
    assert.ok(Math.abs(x - 90) < 0.01);
    assert.ok(Math.abs(v) < 0.01);
  }
});
test("中途反向不重置位置与速度，随后收回原位", () => {
  let x = 0,
    v = 0;
  for (let i = 0; i < 12; i++) [x, v] = springStep(x, v, 300, 1 / 60);
  const before = x;
  [x, v] = springStep(x, v, 0, 1 / 60);
  assert.ok(Math.abs(x - before) < 35, "反向时不跳到目标或起点");
  for (let i = 0; i < 180; i++) [x, v] = springStep(x, v, 0, 1 / 60);
  assert.equal(x, 0);
  assert.equal(v, 0);
});
test("翻牌门槛区分横向甩动、普通拖拽和纵向移动", () => {
  assert.equal(swipeDirection(20, 0, 900, 285), 0);
  assert.equal(swipeDirection(40, 5, 900, 285), 1);
  assert.equal(swipeDirection(-100, 10, -100, 285), -1);
  assert.equal(swipeDirection(110, 180, 1100, 285), 0);
});
test("循环只更换视觉层级，展开保持三卡不重叠、窄屏尺寸有效", () => {
  assert.deepEqual(
    [0, 1, 2].map((i) => deckRank(i, 1)),
    [2, 0, 1],
  );
  for (const w of [203, 285, 350])
    for (const coarse of [false, true]) {
      const poses = [0, 1, 2].map((r) => deckPose(w, true, r, coarse));
      assert.ok(poses[0].y + poses[0].height < poses[1].y);
      assert.ok(poses[1].y + poses[1].height < poses[2].y);
      assert.ok(poses.every((p) => p.width === w && p.rotation === 0));
      assert.equal(deckPose(w, false, 0, coarse).rotation, -6);
    }
});
