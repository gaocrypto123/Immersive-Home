import {
  REVEAL_STEPS,
  REVEAL_DURATION,
  revealFrame,
  phaseStart,
} from "./parsing-animation.js";
import { PARSE_SOURCES } from "./parsing-sources.js";
import { calibratedRoomData } from "./room-calibration.js";
export const PARSE_STEPS = REVEAL_STEPS;
export { PARSE_SOURCES } from "./parsing-sources.js";
export const initialParseState = {
  sourceId: null,
  step: 0,
  reached: -1,
  playing: false,
  completed: false,
  elapsed: 0,
  run: 0,
};
export function parseReducer(state, action) {
  if (action.type === "drop")
    return PARSE_SOURCES.some((s) => s.id === action.id)
      ? {
          ...initialParseState,
          sourceId: action.id,
          reached: 0,
          playing: true,
          run: state.run + 1,
        }
      : state;
  if (action.type === "reset")
    return { ...initialParseState, run: state.run + 1 };
  if (!state.sourceId) return state;
  if (action.type === "replay")
    return {
      ...state,
      step: 0,
      elapsed: 0,
      reached: 0,
      completed: false,
      playing: true,
      run: state.run + 1,
    };
  if (action.type === "tick" || action.type === "pause") {
    const f = revealFrame(action.elapsed);
    return {
      ...state,
      step: f.step,
      elapsed: f.elapsed,
      reached: Math.max(state.reached, f.step),
      completed: f.complete,
      playing: action.type === "pause" || f.complete ? false : state.playing,
    };
  }
  if (action.type === "play")
    return state.completed
      ? parseReducer(state, { type: "replay" })
      : { ...state, playing: true };
  let target =
    action.type === "previous"
      ? Math.max(0, state.step - 1)
      : action.type === "next"
        ? Math.min(PARSE_STEPS.length - 1, state.step + 1)
        : action.type === "seek"
          ? action.step
          : null;
  if (
    !Number.isInteger(target) ||
    target < 0 ||
    target >= PARSE_STEPS.length ||
    (action.type === "seek" && target > state.reached)
  )
    return state;
  if (action.type === "next" && state.step === PARSE_STEPS.length - 1)
    return {
      ...state,
      elapsed: REVEAL_DURATION,
      playing: false,
      completed: true,
      run: state.run + 1,
    };
  if (action.type === "seek") {
    const elapsed =
      target === PARSE_STEPS.length - 1
        ? REVEAL_DURATION
        : phaseStart(target + 1) - 0.001;
    return {
      ...state,
      step: target,
      elapsed,
      reached: Math.max(state.reached, target),
      playing: false,
      completed: target === PARSE_STEPS.length - 1,
      run: state.run + 1,
    };
  }
  return {
    ...state,
    step: target,
    elapsed: phaseStart(target),
    reached: Math.max(state.reached, target),
    playing: true,
    completed: false,
    run: state.run + 1,
  };
}
export function parsingRoomData(base, source) {
  return calibratedRoomData(base, source);
}
export function registeredPoint(source, data, p) {
  const [x0, y0, x1, y1] = source.roomBox;
  return [
    x0 + (p[0] / data.DIMENSIONS.clear_bbox_width_mm) * (x1 - x0),
    y0 + (p[1] / data.DIMENSIONS.clear_bbox_depth_mm) * (y1 - y0),
  ];
}
export function dropOverlap(card, zone) {
  const w = Math.max(
      0,
      Math.min(card.right, zone.right) - Math.max(card.left, zone.left),
    ),
    h = Math.max(
      0,
      Math.min(card.bottom, zone.bottom) - Math.max(card.top, zone.top),
    );
  return (w * h) / (card.width * card.height) >= 0.2;
}
export function modelChecks(summary, room) {
  const eq = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 0.001;
  return [
    {
      label: "地板长宽",
      ok:
        eq(summary?.floorWidth, room.width) &&
        eq(summary?.floorDepth, room.depth),
    },
    { label: "墙体高度", ok: eq(summary?.wallHeight, room.height) },
    {
      label: "门宽、高与铰点",
      ok:
        summary?.doors?.length === room.doors.length &&
        room.doors.every((d, i) => {
          const s = summary.doors[i];
          return (
            eq(s.width, d.width) &&
            eq(s.height, d.height) &&
            s.hinge?.every((n, k) => eq(n, d.hinge[k]))
          );
        }),
    },
    {
      label: "窗宽与上下沿",
      ok:
        summary?.windows?.length === room.windows.length &&
        room.windows.every((w, i) => {
          const s = summary.windows[i];
          return (
            eq(
              s.width,
              Math.max(w.rect[2] - w.rect[0], w.rect[3] - w.rect[1]),
            ) &&
            eq(s.sill, w.sill) &&
            eq(s.head, w.sill + w.height)
          );
        }),
    },
  ];
}
