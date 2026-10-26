export const clamp01 = (n) =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
export const smooth = (n) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};
export const REVEAL_STEPS = [
  {
    name: "尺寸解析",
    duration: 5200,
    detail: "先寻找尺寸标注并高亮，再将标注长度与像素跨度换算为 mm/px。",
  },
  {
    name: "描摹轮廓",
    duration: 3200,
    detail: "沿着房间边界逐步描线，并应用第一步得到的比例尺。",
  },
  {
    name: "解析门窗",
    duration: 2800,
    detail: "依次标出房门、窗户和开口尺寸，沿用第一步的尺度。",
  },
  {
    name: "生成空房",
    duration: 4400,
    detail: "从平面缓缓转向鸟瞰，让墙体升至默认房高 2.8m。",
  },
];
export const REVEAL_DURATION = REVEAL_STEPS.reduce((s, p) => s + p.duration, 0);
export const phaseStart = (step) =>
  REVEAL_STEPS.slice(0, Math.max(0, step)).reduce((s, p) => s + p.duration, 0);
export function revealFrame(elapsed) {
  const time = Math.max(0, Math.min(REVEAL_DURATION, Number(elapsed) || 0));
  let step = 0;
  while (step < REVEAL_STEPS.length - 1 && time >= phaseStart(step + 1)) step++;
  const local = clamp01(
    (time - phaseStart(step)) / REVEAL_STEPS[step].duration,
  );
  return {
    step,
    local,
    complete: time === REVEAL_DURATION,
    elapsed: time,
    overall: time / REVEAL_DURATION,
    calibration: step === 0 ? local : 1,
    outline: step < 1 ? 0 : step === 1 ? smooth(local) : 1,
    door: step < 2 ? 0 : step > 2 ? 1 : smooth(local / 0.46),
    window: step < 2 ? 0 : step > 2 ? 1 : smooth((local - 0.42) / 0.5),
    dimensions: step < 2 ? 0 : step > 2 ? 1 : local,
    growth: step < 3 ? 0 : local,
    imageOpacity: step === 1 ? 0.5 * (1 - smooth(local)) : 0,
  };
}
// Record the original transforms once. Scale every vertical element from the floor;
// the floor itself and the canonical room description are never changed.
export function captureArchitecture(arch) {
  return {
    arch,
    nodes: arch.group.children
      .filter((o) => o !== arch.floor)
      .map((object) => ({
        object,
        y: object.position.y,
        scaleY: object.scale.y,
        visible: object.visible,
      })),
  };
}
export function applyArchitectureGrowth(capture, progress) {
  const growth = smooth(progress),
    safe = Math.max(0.0001, growth);
  for (const n of capture.nodes) {
    n.object.position.y = n.y * safe;
    n.object.scale.y = n.scaleY * safe;
    n.object.visible = n.visible && growth > 0;
  }
  capture.arch.group.updateMatrixWorld(true);
  return growth;
}
