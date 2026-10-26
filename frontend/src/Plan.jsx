import React, { useRef } from "react";
import { OUTLINE, PALETTE, worldPolygon, ROOM_RATIO } from "./model.js";
const S = 1000,
  H = S * ROOM_RATIO,
  points = (p) => p.map(([u, v]) => `${u * S},${v * H}`).join(" ");
export function MiniPlan({ items, selected = false }) {
  return (
    <svg viewBox="-65 -65 1130 1280" className="mini-plan" aria-hidden="true">
      <polygon
        points={points(OUTLINE)}
        fill={selected ? "#f3f3e9" : "#f1efea"}
        stroke="#8d948d"
        strokeWidth="23"
      />
      {items.map((a) => (
        <polygon
          key={a.id}
          points={points(worldPolygon(a))}
          fill={a.color || PALETTE[a.category] || "#a9a89d"}
          stroke="#ffffff"
          strokeWidth="9"
        />
      ))}
      <path d="M240 1150H820" stroke="#89aeb0" strokeWidth="20" />
    </svg>
  );
}
export default function Plan({
  items,
  selected,
  onSelect,
  onMove,
  onCommit,
  zoom,
  grid,
  snap,
  dimensions,
  measurement,
  onMeasure,
}) {
  const svg = useRef(null),
    drag = useRef(null);
  function coords(e) {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const s = p.matrixTransform(svg.current.getScreenCTM().inverse());
    return [s.x / S, s.y / H];
  }
  function down(e, a) {
    if (measurement) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(a.id);
    onCommit();
    drag.current = { id: a.id, start: coords(e), center: a.center };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!drag.current) return;
    const p = coords(e),
      d = drag.current;
    const step = snap ? 0.02 : 0.001;
    onMove(
      d.id,
      [0, 1].map((i) =>
        Math.max(
          0,
          Math.min(
            1,
            Math.round((d.center[i] + p[i] - d.start[i]) / step) * step,
          ),
        ),
      ),
    );
  }
  return (
    <svg
      ref={svg}
      className={`plan-canvas ${measurement ? "measuring" : ""}`}
      viewBox={`${500 - 690 / zoom} ${575 - 780 / zoom} ${1380 / zoom} ${1560 / zoom}`}
      role="img"
      aria-label="可编辑卧室平面图"
      onPointerDown={(e) => {
        if (measurement) onMeasure(coords(e));
        else onSelect(null);
      }}
    >
      <defs>
        <pattern
          id="floor-lines"
          width="120"
          height="60"
          patternUnits="userSpaceOnUse"
        >
          <rect width="120" height="60" fill="#eee5d6" />
          <path
            d="M0 0H120M0 60H120M0 0V60"
            stroke="#d4c6b0"
            strokeWidth="1.7"
          />
        </pattern>
        <pattern
          id="grid-dots"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="0" cy="0" r="2.2" fill="#9ca99f" />
        </pattern>
        <filter id="plan-shadow">
          <feDropShadow dx="5" dy="14" stdDeviation="13" floodOpacity=".12" />
        </filter>
      </defs>
      <polygon
        points={points(OUTLINE)}
        fill="url(#floor-lines)"
        filter="url(#plan-shadow)"
      />
      {grid && <polygon points={points(OUTLINE)} fill="url(#grid-dots)" />}
      <text x="430" y="590" textAnchor="middle" className="room-label">
        我的卧室
      </text>
      <text x="430" y="630" textAnchor="middle" className="room-sub-label">
        小拐角户型 · 相对布局
      </text>
      <path
        d="M340 172.5V0H1000V1150H0V172.5"
        fill="none"
        stroke="#5d6962"
        strokeWidth="23"
        strokeLinejoin="miter"
      />
      <path d="M0 172.5H300" stroke="#a4b9a5" strokeWidth="12" />
      <path
        d="M8 172.5V425Q300 425 300 172.5"
        fill="none"
        stroke="#809486"
        strokeWidth="4"
      />
      <text x="78" y="130" className="plan-small">
        入口
      </text>
      <path d="M240 1150H820" stroke="#7fa6aa" strokeWidth="29" />
      <path d="M240 1144H820M240 1157H820" stroke="#e4f0ec" strokeWidth="3" />
      <text x="525" y="1235" textAnchor="middle" className="plan-small">
        窗
      </text>
      {items.map((a) => {
        const [x0, y0, x1, y1] = a.bounds,
          cx = a.center[0] * S,
          cy = a.center[1] * H,
          active = a.id === selected;
        return (
          <g
            key={a.id}
            className={`plan-item ${active ? "selected" : ""}`}
            data-item={a.id}
            transform={`rotate(${a.rotation || 0},${cx},${cy})`}
            onPointerDown={(e) => down(e, a)}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            onLostPointerCapture={() => (drag.current = null)}
          >
            <polygon
              points={points(a.polygon)}
              fill={a.color || PALETTE[a.category] || "#b5b5a5"}
              fillOpacity=".88"
              stroke={active ? "#245a49" : "#ffffff"}
              strokeWidth={active ? 7 : 4}
            />
            {a.category === "bed" && (
              <>
                <rect
                  x={(x0 + 0.02) * S}
                  y={(y0 + 0.02) * H}
                  width={Math.max(0, (x1 - x0 - 0.04) * S)}
                  height={Math.max(0, (y1 - y0 - 0.04) * H)}
                  rx="10"
                  fill="#f7f1e7"
                />
                {a.orientation?.includes("右") ? (
                  <>
                    <path
                      d={`M${(x1 - 0.16) * S} ${(y0 + 0.03) * H}V${(y1 - 0.03) * H}`}
                      stroke="#c5ad9d"
                      strokeWidth="5"
                    />
                    <rect
                      x={(x1 - 0.14) * S}
                      y={(y0 + 0.04) * H}
                      width="105"
                      height={Math.max(15, ((y1 - y0 - 0.1) * H) / 2)}
                      rx="12"
                      fill="#e4d7c4"
                    />
                  </>
                ) : (
                  <>
                    <path
                      d={`M${(x0 + 0.03) * S} ${(y0 + 0.13) * H}H${(x1 - 0.03) * S}`}
                      stroke="#c5ad9d"
                      strokeWidth="5"
                    />
                    {[0.05, (x1 - x0) / 2 + 0.02].map((p, i) => (
                      <rect
                        key={i}
                        x={(x0 + p) * S}
                        y={(y0 + 0.025) * H}
                        width={Math.max(15, ((x1 - x0) * S) / 2 - 55)}
                        height="95"
                        rx="12"
                        fill="#e4d7c4"
                      />
                    ))}
                  </>
                )}
              </>
            )}
            <text
              transform={`rotate(${-(a.rotation || 0)},${cx},${cy})`}
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              className="item-name"
            >
              {a.label.replace("（按桌椅形态识别）", "")}
            </text>
            {active && (
              <>
                <circle
                  cx={(x1 + 0.035) * S}
                  cy={(y1 + 0.035) * H}
                  r="13"
                  fill="#2d6552"
                  stroke="white"
                  strokeWidth="4"
                />
                {dimensions && (
                  <>
                    <text
                      x={cx}
                      y={y0 * H - 22}
                      textAnchor="middle"
                      className="dimension-text"
                    >
                      {((x1 - x0) * 100).toFixed(0)}% 房宽
                    </text>
                    <text x={x1 * S + 18} y={cy} className="dimension-text">
                      {((y1 - y0) * 100).toFixed(0)}% 房深
                    </text>
                  </>
                )}
              </>
            )}
          </g>
        );
      })}
      {measurement?.points?.map((p, i) => (
        <circle key={i} cx={p[0] * S} cy={p[1] * H} r="10" fill="#b47755" />
      ))}
      {measurement?.points?.length === 2 && (
        <>
          <line
            x1={measurement.points[0][0] * S}
            y1={measurement.points[0][1] * H}
            x2={measurement.points[1][0] * S}
            y2={measurement.points[1][1] * H}
            stroke="#b47755"
            strokeWidth="5"
            strokeDasharray="12 8"
          />
          <text
            x={((measurement.points[0][0] + measurement.points[1][0]) * S) / 2}
            y={
              ((measurement.points[0][1] + measurement.points[1][1]) * H) / 2 -
              20
            }
            className="dimension-text"
          >
            {(
              Math.hypot(
                measurement.points[1][0] - measurement.points[0][0],
                (measurement.points[1][1] - measurement.points[0][1]) *
                  ROOM_RATIO,
              ) * 100
            ).toFixed(1)}
            % 房宽
          </text>
        </>
      )}
    </svg>
  );
}
