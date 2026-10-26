import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import {
  PARSE_SOURCES,
  PARSE_STEPS,
  initialParseState,
  parseReducer,
  parsingRoomData,
  dropOverlap,
  registeredPoint,
  modelChecks,
} from "../src/parsing-demo.js";
import {
  REVEAL_DURATION,
  revealFrame,
  phaseStart,
  captureArchitecture,
  applyArchitectureGrowth,
} from "../src/parsing-animation.js";
import { calibrateSource } from "../src/room-calibration.js";
import { adaptMetricRoom } from "../src/metric-room.js";
import { buildMetricArchitecture, disposeMetric } from "../src/metric-three.js";
const base = JSON.parse(
  await readFile(
    new URL(
      "../../data/room-descriptions/L02-动静分区-房间估算.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const legacySources = JSON.parse(await readFile(new URL("./fixtures/legacy-parsing-sources.json", import.meta.url), "utf8"));
test("四阶段自动完成，无确认关口或JSON展示阶段", () => {
  assert.equal(PARSE_STEPS.length, 4);
  assert.ok(PARSE_STEPS.every((s) => !/JSON|确认/.test(s.name)));
  let s = parseReducer(initialParseState, { type: "drop", id: "plan-01" });
  assert.equal(parseReducer(s, { type: "seek", step: 3 }), s);
  for (let step = 0; step < 4; step++) {
    s = parseReducer(s, { type: "tick", elapsed: phaseStart(step) + 50 });
    assert.equal(s.step, step);
    assert.equal(s.playing, true);
  }
  s = parseReducer(s, { type: "tick", elapsed: REVEAL_DURATION });
  assert.equal(s.completed, true);
  assert.equal(s.playing, false);
  assert.equal(s.step, 3);
});
test("暂停精确保留毫秒位置，继续、回看、重放和切换输入不混用进度", () => {
  let s = parseReducer(initialParseState, { type: "drop", id: "plan-03" });
  s = parseReducer(s, { type: "tick", elapsed: 4567 });
  s = parseReducer(s, { type: "pause", elapsed: 4599.5 });
  assert.equal(s.elapsed, 4599.5);
  assert.equal(s.playing, false);
  s = parseReducer(s, { type: "play" });
  assert.equal(s.elapsed, 4599.5);
  s = parseReducer(s, { type: "seek", step: 0 });
  assert.equal(s.elapsed, phaseStart(1) - 0.001);
  assert.equal(s.playing, false);
  s = parseReducer(s, { type: "replay" });
  assert.equal(s.reached, 0);
  assert.equal(s.completed, false);
  s = parseReducer(s, { type: "drop", id: "plan-02" });
  assert.equal(s.sourceId, "plan-02");
  assert.equal(s.elapsed, 0);
  assert.equal(parseReducer(s, { type: "reset" }).sourceId, null);
});
test("尺寸定标→轮廓→门窗→升墙，跨阶段连续且没有越界", () => {
  assert.deepEqual(
    PARSE_STEPS.map((s) => s.name),
    ["尺寸解析", "描摹轮廓", "解析门窗", "生成空房"],
  );
  assert.equal(revealFrame(1000).door, 0);
  assert.equal(revealFrame(1000).outline, 0);
  assert.ok(revealFrame(1000).calibration > 0);
  const outline = revealFrame(phaseStart(1) + 1000);
  assert.ok(outline.outline > 0 && outline.outline < 1);
  assert.equal(outline.door, 0);
  const door = revealFrame(phaseStart(2) + 800);
  assert.ok(door.door > 0);
  assert.equal(door.window, 0);
  const dims = revealFrame(phaseStart(2) + 2700);
  assert.equal(dims.door, 1);
  assert.equal(dims.window, 1);
  assert.ok(dims.dimensions > 0);
  assert.equal(dims.growth, 0);
  for (let i = 1; i < 4; i++) {
    const before = revealFrame(phaseStart(i) - 0.001),
      after = revealFrame(phaseStart(i));
    assert.ok(Math.abs(before.outline - after.outline) < 0.001);
    assert.ok(Math.abs(before.door - after.door) < 0.001);
    assert.ok(Math.abs(before.window - after.window) < 0.001);
  }
  assert.equal(revealFrame(-1).overall, 0);
  assert.equal(revealFrame(Infinity).overall, 1);
  assert.equal(revealFrame(REVEAL_DURATION).growth, 1);
});
test("尺寸标注用毫米除以尺线像素，计算两个方向的mm/px", () => {
  const a = calibrateSource(PARSE_SOURCES[0]);
  assert.equal(a.mode, "dimension-labels");
  assert.equal(a.annotations.length, 10);
  assert.equal(a.mmPerPixelX, 3600 / 805);
  assert.equal(a.mmPerPixelY, 3800 / 842);
  assert.equal(a.estimated, false);
  assert.equal(a.anisotropic, true);
  const b = calibrateSource(legacySources[1]);
  assert.ok(Math.abs(b.mmPerPixelX - 3.6) < 1e-12);
  assert.ok(Math.abs(b.mmPerPixelY - 3.6) < 0.001);
});
test("无标注使用门洞900mm估算，门、轮廓、窗及真实三维都采用新比例", () => {
  const before = JSON.stringify(base),
    c = calibrateSource(legacySources[2]),
    data = parsingRoomData(base, legacySources[2]),
    room = adaptMetricRoom(data),
    arch = buildMetricArchitecture(room, true, true);
  assert.equal(c.mode, "door-assumption");
  assert.equal(c.doorPixels, 155);
  assert.equal(c.mmPerPixelX, 900 / 155);
  assert.equal(c.mmPerPixelX, c.mmPerPixelY);
  assert.ok(Math.abs(room.width - (770 * (900 / 155)) / 1000) < 1e-9);
  assert.ok(Math.abs(room.depth - (802 * (900 / 155)) / 1000) < 1e-9);
  assert.equal(room.doors[0].width, 0.9);
  assert.equal(data.DIMENSIONS.ceiling_height_mm, 2800);
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(data.furniture, []);
  assert.ok(Math.abs(arch.summary.floorWidth - room.width) < 0.001);
  assert.equal(arch.summary.doors[0].width, 0.9);
  assert.ok(modelChecks(arch.summary, room).every((c) => c.ok));
  disposeMetric(arch.group);
});
test("定标变化传入实际几何，不只是改界面数字；无效尺线不产生无限比例", () => {
  const source = structuredClone(PARSE_SOURCES[0]);
  source.tokens[0][0] = "4500";
  const data = parsingRoomData(base, source);
  assert.equal(data.DIMENSIONS.clear_bbox_width_mm, 4500);
  assert.equal(data.ROOMS[0].poly[1][0], 4500);
  const missing = structuredClone(PARSE_SOURCES[0]);
  missing.dimensionAnchors = [];
  assert.throws(() => calibrateSource(missing), /尺线/);
  const noDoor = structuredClone(legacySources[2]);
  noDoor.doorReference.closed = [...noDoor.doorReference.hinge];
  assert.throws(() => calibrateSource(noDoor), /门洞/);
});
test("默认2.8m且不修改原始JSON，空房门窗几何保持一致", () => {
  const before = JSON.stringify(base),
    altered = structuredClone(base);
  altered.DIMENSIONS.ceiling_height_mm = 3000;
  const data = parsingRoomData(altered, PARSE_SOURCES[0]),
    room = adaptMetricRoom(data),
    arch = buildMetricArchitecture(room, true, true);
  assert.equal(data.DIMENSIONS.ceiling_height_mm, 2800);
  assert.equal(altered.DIMENSIONS.ceiling_height_mm, 3000);
  assert.equal(JSON.stringify(base), before);
  assert.deepEqual(data.furniture, []);
  assert.equal(data.FURNITURE_DETAILS, undefined);
  assert.equal(
    data.parse_demo.heights_status,
    "default_assumptions_not_measured",
  );
  assert.equal(data.parse_demo.real_time_ocr, false);
  assert.ok(modelChecks(arch.summary, room).every((c) => c.ok));
  disposeMetric(arch.group);
});
test("真实三维墙体从地面升起，暂停可停在中间，重播不累积缩放", () => {
  const room = adaptMetricRoom(parsingRoomData(base, PARSE_SOURCES[0])),
    arch = buildMetricArchitecture(room, true, true),
    capture = captureArchitecture(arch);
  const wall = arch.group.children.find((o) => o.userData.wallId),
    size = (o) =>
      new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
  applyArchitectureGrowth(capture, 0);
  assert.equal(wall.visible, false);
  assert.equal(arch.floor.visible, true);
  applyArchitectureGrowth(capture, 0.5);
  assert.ok(Math.abs(size(wall).y - 1.4) < 0.001);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(wall).min.y) < 0.001);
  const halfway = size(wall).y;
  applyArchitectureGrowth(capture, 0.5);
  assert.equal(size(wall).y, halfway);
  assert.ok(Math.abs(size(arch.floor).y - 0.1) < 0.001);
  applyArchitectureGrowth(capture, 1);
  assert.ok(Math.abs(size(wall).y - 2.8) < 0.001);
  const pane = arch.windowPanes[0].pane,
    bounds = new THREE.Box3().setFromObject(pane);
  assert.ok(Math.abs(bounds.min.y - 0.85) < 0.001);
  assert.ok(Math.abs(bounds.max.y - 2.35) < 0.001);
  applyArchitectureGrowth(capture, 0.2);
  applyArchitectureGrowth(capture, 1);
  assert.ok(Math.abs(size(wall).y - 2.8) < 0.001);
  assert.equal(arch.doorPivots[0].leaf.geometry.parameters.height, 2.1);
  disposeMetric(arch.group);
});
test("拖放和人工配准仍使用原尺寸；概念图不带OCR标签", () => {
  const card = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
  };
  assert.equal(
    dropOverlap(card, { left: 80, top: 0, right: 150, bottom: 150 }),
    true,
  );
  assert.equal(
    dropOverlap(card, { left: 81, top: 0, right: 150, bottom: 150 }),
    false,
  );
  for (const s of legacySources) {
    assert.deepEqual(registeredPoint(s, base, [0, 0]), s.roomBox.slice(0, 2));
    assert.deepEqual(
      registeredPoint(s, base, [3600, 3800]),
      s.roomBox.slice(2),
    );
  }
  assert.equal(legacySources[2].tokens.length, 0);
  assert.equal(legacySources[2].hasDimensions, false);
});


test("三张新平面图分别定标，门窗方向与实际三维尺寸一致", () => {
  const expected = [
    {w:3.6,d:3.8,area:13.205,door:.75,window:2.1,sill:.85,n:6},
    {w:3,d:4,area:12,door:.8,window:1.8,sill:.85,n:4},
    {w:2.7,d:4.5,area:12.15,door:.8,window:2,sill:.8,n:4},
  ];
  const before=JSON.stringify(base);
  for (const [index, source] of PARSE_SOURCES.entries()) {
    const data=parsingRoomData(base,source), room=adaptMetricRoom(data),
      arch=buildMetricArchitecture(room,true,true), e=expected[index];
    assert.equal(calibrateSource(source).mode,"dimension-labels");
    assert.equal(room.width,e.w); assert.equal(room.depth,e.d);
    assert.equal(data.DIMENSIONS.net_floor_area_m2,e.area);
    assert.equal(data.ROOMS[0].poly.length,e.n);
    assert.equal(arch.summary.doors[0].width,e.door);
    assert.ok(Math.abs(arch.summary.windows[0].width-e.window)<0.001);
    assert.ok(Math.abs(arch.summary.windows[0].sill-e.sill)<0.001);
    assert.ok(modelChecks(arch.summary,room).every(c=>c.ok));
    assert.equal(data.source.image_sha256,source.sha256);
    if(index===1) {
      assert.deepEqual(data.DOORS[0].h,[0,220]);
      assert.deepEqual(data.DOORS[0].c,[0,1]);
      assert.deepEqual(data.DOORS[0].o,[1,0]);
    }
    if(index===2) {
      assert.deepEqual(data.DOORS[0].h,[2600,0]);
      assert.deepEqual(data.DOORS[0].c,[-1,0]);
      assert.deepEqual(data.WINS[0],[2700,400,2850,2400]);
      assert.match(data.parse_demo.notes.join(" "),/前墙.*假设/);
    }
    disposeMetric(arch.group);
  }
  assert.equal(JSON.stringify(base),before);
});

