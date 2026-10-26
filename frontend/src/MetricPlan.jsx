import React, { useRef } from "react";
import { shortName } from "./metric-room.js";
const mm = (n) => n * 1000;
const points = (p) => p.map((v) => v.map(mm).join(",")).join(" ");
const Rect = ({ rect, ...props }) => (
  <rect
    x={mm(rect[0])}
    y={mm(rect[1])}
    width={mm(rect[2] - rect[0])}
    height={mm(rect[3] - rect[1])}
    {...props}
  />
);

export default function MetricPlan({
  room,
  items,
  selected,
  onSelect,
  onMove,
  doorOpen = true,
}) {
  const svg = useRef(null),
    drag = useRef(null);
  function coords(e) {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.current.getScreenCTM().inverse());
    return [q.x / 1000, q.y / 1000];
  }
  const W = mm(room.width),
    D = mm(room.depth);
  const windowInfo = room.windows
    .map(
      (w) =>
        `窗宽 ${Math.round(mm(w.rect[2] - w.rect[0]))} · 窗台高 ${Math.round(mm(w.sill))} · 窗高 ${Math.round(mm(w.height))} mm`,
    )
    .join("；");
  return (
    <svg
      ref={svg}
      className="metric-plan"
      viewBox={`-620 -520 ${W + 1180} ${D + 1170}`}
      role="img"
      aria-label="L02 估算尺寸卧室平面图"
      data-width-m={room.width}
      data-depth-m={room.depth}
      onPointerDown={() => onSelect(null)}
    >
      <defs>
        <pattern
          id="metric-floor"
          width="350"
          height="110"
          patternUnits="userSpaceOnUse"
        >
          <rect width="350" height="110" fill="#eee4d2" />
          <path
            d="M0 0H350M0 110H350M0 0V110"
            stroke="#d5c7af"
            strokeWidth="3"
          />
        </pattern>
      </defs>
      <polygon
        data-room-outline
        points={points(room.outline)}
        fill="url(#metric-floor)"
      />
      {room.walls.map((w) => (
        <Rect key={w.id} rect={w.rect} fill="#637564" data-wall={w.id} />
      ))}
      {room.windows.map((w) => (
        <g
          key={w.id}
          data-window={w.id}
          data-rect={w.rect.join(",")}
          data-sill-m={w.sill}
          data-height-m={w.height}
        >
          <Rect
            rect={w.rect}
            fill="#b5d4d1"
            stroke="#628f8b"
            strokeWidth="10"
          />
          <path
            d={`M${mm(w.rect[0])} ${mm((w.rect[1] + w.rect[3]) / 2)}H${mm(w.rect[2])}`}
            stroke="#eff6f1"
            strokeWidth="12"
          />
        </g>
      ))}
      {room.doors.map((d) => {
        const v = doorOpen ? d.open : d.closed,
          ex = d.hinge[0] + v[0] * d.width,
          ey = d.hinge[1] + v[1] * d.width,
          cx = d.hinge[0] + d.closed[0] * d.width,
          cy = d.hinge[1] + d.closed[1] * d.width,
          ox = d.hinge[0] + d.open[0] * d.width,
          oy = d.hinge[1] + d.open[1] * d.width;
        return (
          <g
            key={d.id}
            data-door={d.id}
            data-hinge={d.hinge.join(",")}
            data-width-m={d.width}
          >
            <Rect rect={d.rect} fill="#f7f6ee" />
            <path
              d={`M${mm(cx)} ${mm(cy)}A${mm(d.width)} ${mm(d.width)} 0 0 1 ${mm(ox)} ${mm(oy)}`}
              stroke="#a79876"
              strokeWidth="9"
              strokeDasharray="25 15"
              fill="none"
            />
            <path
              d={`M${mm(d.hinge[0])} ${mm(d.hinge[1])}L${mm(ex)} ${mm(ey)}`}
              stroke="#846e50"
              strokeWidth="32"
            />
            <text
              x={mm(d.hinge[0] + d.width / 2)}
              y={mm(d.rect[1]) - 90}
              textAnchor="middle"
              fontSize="85"
              fill="#607251"
            >
              门 {Math.round(mm(d.width))}
            </text>
          </g>
        );
      })}
      <g
        fill="#69785d"
        fontSize="88"
        textAnchor="middle"
        stroke="#95a089"
        strokeWidth="5"
      >
        <path
          d={`M0 -400H${W}M0 -450V-180M${W} -450V-180M-400 0V${D}M-450 0H-180M-450 ${D}H-180`}
          fill="none"
        />
        <text x={W / 2} y="-455" stroke="none">
          {W} mm · 估算
        </text>
        <text transform={`translate(-455 ${D / 2}) rotate(-90)`} stroke="none">
          {D} mm · 估算
        </text>
        <text x={W / 2} y={D + 430} stroke="none">
          {windowInfo}
        </text>
      </g>
      <text x="1750" y="2300" textAnchor="middle" fontSize="125" fill="#829073">
        约 {room.area.toFixed(1)} ㎡
      </text>
      {items.map((f) => (
        <g
          key={f.id}
          data-metric-item={f.id}
          data-center={`${f.cx},${f.cy}`}
          transform={`translate(${mm(f.cx)} ${mm(f.cy)}) rotate(${f.rot})`}
          className="metric-plan-item"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onSelect(f.id);
            drag.current = { id: f.id, start: coords(e), center: [f.cx, f.cy] };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = coords(e);
            onMove(d.id, [
              d.center[0] + p[0] - d.start[0],
              d.center[1] + p[1] - d.start[1],
            ]);
          }}
          onPointerUp={() => (drag.current = null)}
          onLostPointerCapture={() => (drag.current = null)}
        >
          <rect
            x={-mm(f.w) / 2}
            y={-mm(f.d) / 2}
            width={mm(f.w)}
            height={mm(f.d)}
            rx="24"
            fill={f.color}
            stroke={selected === f.id ? "#255b46" : "#a99f85"}
            strokeWidth={selected === f.id ? 22 : 9}
          />
          {f.type === "bed" && (
            <>
              <rect
                x={-mm(f.w) / 2 + 50}
                y={-mm(f.d) / 2 + 50}
                width={mm(f.w) - 100}
                height="380"
                rx="45"
                fill="#faf5e8"
              />
              <path
                d={`M${-mm(f.w) / 2 + 40} ${-mm(f.d) / 2 + 540}H${mm(f.w) / 2 - 40}`}
                stroke="#e4d3b8"
                strokeWidth="12"
              />
            </>
          )}
          <text
            textAnchor="middle"
            y="27"
            fontSize={f.type === "chair" ? 75 : 95}
            fill="#405542"
            pointerEvents="none"
          >
            {shortName(f)}
          </text>
        </g>
      ))}
    </svg>
  );
}
