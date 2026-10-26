// Small, interruptible spring integrator. No CDN or animation runtime required.
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const mix = (a, b, t) => a + (b - a) * t;
export function springStep(
  value,
  velocity,
  target,
  elapsed,
  stiffness = 390,
  damping = 32,
) {
  const time = clamp(elapsed, 0, 1 / 30),
    steps = Math.max(1, Math.ceil(time / (1 / 120))),
    dt = time / steps;
  for (let i = 0; i < steps; i++) {
    velocity += ((target - value) * stiffness - velocity * damping) * dt;
    value += velocity * dt;
  }
  if (Math.abs(target - value) < 0.001 && Math.abs(velocity) < 0.01)
    return [target, 0];
  return [value, velocity];
}
export function deckRank(index, top, count = 3) {
  return (index - top + count) % count;
}
export function deckPose(width, expanded, rank, coarse = false, reference = false) {
  const closedWidth = Math.max(150, width - 42);
  const openHeight = reference ? (coarse ? 124 : 104) : (coarse ? 148 : 138);
  return expanded
    ? {
        x: 0,
        y: rank * (openHeight + 12),
        width,
        height: openHeight,
        rotation: 0,
        scale: 1,
        opacity: 1,
        open: 1,
        lift: 0,
      }
    : {
        x: 21 + [0, 5, -3, 3, -5, 1][rank % 6],
        y: 12 + rank * 15,
        width: closedWidth,
        height: reference ? (closedWidth - 20) * 941 / 1672 + 84 : 316,
        rotation: [-6, 5, 10, -4, 7, -2][rank % 6],
        scale: 1 - rank * 0.035,
        opacity: 1,
        open: 0,
        lift: 0,
      };
}
export function swipeDirection(dx, dy, vx, width) {
  if (Math.abs(dy) > Math.max(100, Math.abs(dx) * 0.85)) return 0;
  if (Math.abs(dx) > width * 0.3 || (Math.abs(dx) > 28 && Math.abs(vx) > 650))
    return Math.sign(dx);
  return 0;
}
