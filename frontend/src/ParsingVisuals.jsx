import {imageAsset} from './image-assets.js';
import React, { useEffect, useState } from "react";
import { displayMM } from "./room-calibration.js";
export function CalibrationView({ source, calibration }) {
  const c = calibration,
    box = c.estimated
      ? [575, 0, 950, 941]
      : [0, 0, source.width, source.height];
  const ref = c.door,
    doorPath = ref
      ? `M${ref.hinge[0]} ${ref.hinge[1]}L${ref.closed[0]} ${ref.closed[1]}`
      : "";
  return (
    <div className="calibration-view" data-calibration-mode={c.mode}>
      <div className="calibration-picture">
        <svg
          viewBox={box.join(" ")}
          role="img"
          aria-label={
            c.estimated
              ? "无尺寸图，按门洞900mm估算比例"
              : "高亮尺寸标注位置与比例尺基准"
          }
        >
          <image
            href={imageAsset(source.image,{exact:true})}
            width={source.width}
            height={source.height}
          />
          {c.annotations.map((t, i) => (
            <g
              key={i}
              className="calibration-token"
              data-dimension-token={t.text}
              style={{ "--token-start": 0.08 + i * 0.035 }}
            >
              <rect
                x={t.rect[0] - 7}
                y={t.rect[1] - 6}
                width={t.rect[2] - t.rect[0] + 14}
                height={t.rect[3] - t.rect[1] + 12}
                rx="6"
              />
            </g>
          ))}
          <g className="calibration-anchor">
            {c.samples.map((a, i) => (
              <path key={i} d={`M${a.from.join(" ")}L${a.to.join(" ")}`} />
            ))}
            {ref && (
              <>
                <rect
                  x={Math.min(ref.hinge[0], ref.closed[0]) - 10}
                  y={ref.hinge[1] - 16}
                  width={c.doorPixels + 20}
                  height="32"
                />
                <path d={doorPath} />
                <circle cx={ref.hinge[0]} cy={ref.hinge[1]} r="8" />
                <circle cx={ref.closed[0]} cy={ref.closed[1]} r="8" />
              </>
            )}
          </g>
        </svg>
      </div>
      <aside className="calibration-info">
        <span className="calibration-kicker">
          {c.estimated
            ? "未发现尺寸标注"
            : `定位 ${c.annotations.length} 处示例标注`}
        </span>
        <h3>{c.estimated ? "按门洞宽度估算" : "从标注建立比例尺"}</h3>
        {c.estimated ? (
          <div className="calibration-equation">
            <span>假设门洞宽 900 mm</span>
            <small>900 mm ÷ {c.doorPixels.toFixed(0)} px</small>
            <strong data-mm-per-pixel="door">
              {c.mmPerPixelX.toFixed(4)} <em>mm/px</em>
            </strong>
          </div>
        ) : (
          c.samples.map((s) => (
            <div className="calibration-equation" key={s.axis}>
              <span>
                {s.axis === "x" ? "横向" : "纵向"}基准 · {s.mm} mm
              </span>
              <small>
                {s.mm} mm ÷ {Number(s.pixels.toFixed(1))} px
              </small>
              <strong data-mm-per-pixel={s.axis}>
                {s.mmPerPixel.toFixed(4)} <em>mm/px</em>
              </strong>
            </div>
          ))
        )}
        <p>
          {c.estimated
            ? "900mm 是估算假设；门洞位置为人工示例标注。后续几何按这个比例重算。"
            : c.anisotropic
              ? "横纵比例略有差异，分别定标。标注位置为示例回放，比例尺在本机计算。"
              : "标注位置为示例回放，比例尺在本机计算并用于后续几何。"}
        </p>
      </aside>
    </div>
  );
}
export function useSourceImage(source) {
  const [state, setState] = useState({ id: null, error: "" });
  useEffect(() => {
    if (!source) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live) setState({ id: source.id, error: "" });
    };
    img.onerror = () => {
      if (live)
        setState({
          id: source.id,
          error: "示例图片读取失败，请重新同步素材。",
        });
    };
    img.src = imageAsset(source.image,{exact:true});
    return () => {
      live = false;
    };
  }, [source]);
  return state;
}
function Dimension({ path, x, y, children, rotate = 0, order = 0 }) {
  return (
    <g
      className={`reveal-dimension dimension-${order}`}
      data-dimension={children}
    >
      <path d={path} fill="none" />
      <text
        transform={`translate(${x} ${y}) rotate(${rotate})`}
        textAnchor="middle"
      >
        {children}
      </text>
    </g>
  );
}
export function AnimatedPlan({ source, data }) {
  const W = data.DIMENSIONS.clear_bbox_width_mm,
    D = data.DIMENSIONS.clear_bbox_depth_mm,
    poly = data.ROOMS[0].poly;
  const path =
    poly.map((p, i) => `${i ? "L" : "M"}${p.join(" ")}`).join(" ") + "Z";
  const calibration = data.parse_demo.calibration,
    estimated = calibration.estimated,
    win = data.WINDOW_DETAILS[0],
    notchW = data.DIMENSIONS.upper_left_notch_width_mm,
    notchD = data.DIMENSIONS.upper_left_notch_depth_mm;
  const [x0, y0, x1, y1] = calibration.box,
    sx = W / (x1 - x0),
    sy = D / (y1 - y0),
    door = data.DOORS[0],
    h = door.h,
    L = door.len;
  const closed = [h[0] + door.c[0] * L, h[1] + door.c[1] * L],
    open = [h[0] + door.o[0] * L, h[1] + door.o[1] * L];
  const sweep = door.o[0] * door.c[1] - door.o[1] * door.c[0] > 0 ? 1 : 0,
    verticalDoor = Math.abs(door.c[1]) > 0.5,
    verticalWindow = win.start_mm[0] === win.end_mm[0];
  const doorLow = Math.min(h[1], closed[1]),
    doorHigh = Math.max(h[1], closed[1]),
    doorLeft = Math.min(h[0], closed[0]),
    doorRight = Math.max(h[0], closed[0]),
    doorBelow = Math.max(h[1], open[1], closed[1]) + 80;
  return (
    <svg
      className="reveal-plan"
      viewBox={`-620 -520 ${W + 1180} ${D + 1170}`}
      role="img"
      aria-label="连续描摹房间轮廓、门窗和估算尺寸"
    >
      <defs>
        <clipPath id={`reveal-input-clip-${source.id}`}>
          <path d={path} />
        </clipPath>
        <pattern
          id="reveal-floor"
          width="350"
          height="110"
          patternUnits="userSpaceOnUse"
        >
          <rect width="350" height="110" fill="#eee7d7" />
          <path
            d="M0 0H350M0 110H350M0 0V110"
            stroke="#dcd2bd"
            strokeWidth="3"
          />
        </pattern>
      </defs>
      <image
        clipPath={`url(#reveal-input-clip-${source.id})`}
        className="reveal-input-image"
        href={imageAsset(source.image,{exact:true})}
        x={-x0 * sx}
        y={-y0 * sy}
        width={source.width * sx}
        height={source.height * sy}
        preserveAspectRatio="none"
      />
      <path d={path} className="reveal-floor" fill="url(#reveal-floor)" />
      <g className="reveal-wall-plan">
        {data.WALLS.map((r, i) => (
          <rect
            key={i}
            x={r[0]}
            y={r[1]}
            width={r[2] - r[0]}
            height={r[3] - r[1]}
          />
        ))}
      </g>
      <path
        className="reveal-outline"
        d={path}
        pathLength="1"
        fill="none"
        strokeDasharray="1"
        strokeLinejoin="round"
      />
      <g className="reveal-door" data-opening="door">
        <rect
          x={door.rect[0]}
          y={door.rect[1]}
          width={door.rect[2] - door.rect[0]}
          height={door.rect[3] - door.rect[1]}
          fill="#e4d4b5"
        />
        <path
          d={`M${h.join(" ")}L${open.join(" ")}M${open.join(" ")}A${L} ${L} 0 0 ${sweep} ${closed.join(" ")}`}
          fill="none"
          pathLength="1"
          strokeDasharray="1"
        />
        <circle cx={h[0]} cy={h[1]} r="26" />
      </g>
      <g className="reveal-window" data-opening="window">
        {data.WINS.map((r, i) => (
          <g key={i}>
            <rect x={r[0]} y={r[1]} width={r[2] - r[0]} height={r[3] - r[1]} />
            <path
              d={`M${r[0]} ${(r[1] + r[3]) / 2}H${r[2]}M${(r[0] + r[2]) / 2} ${r[1]}V${r[3]}`}
            />
          </g>
        ))}
      </g>
      <Dimension
        order={0}
        path={`M0 -250H${W}M0 -300V-200M${W} -300V-200`}
        x={W / 2}
        y={-330}
      >{`${displayMM(W, estimated)} mm`}</Dimension>
      <Dimension
        order={1}
        path={
          verticalWindow
            ? `M-300 0V${D}M-350 0H-250M-350 ${D}H-250`
            : `M${W + 280} 0V${D}M${W + 230} 0H${W + 330}M${W + 230} ${D}H${W + 330}`
        }
        x={verticalWindow ? -460 : W + 440}
        y={D / 2}
        rotate={verticalWindow ? -90 : 90}
      >{`${displayMM(D, estimated)} mm`}</Dimension>
      <Dimension
        order={2}
        path={
          verticalDoor
            ? `M${h[0] - 250} ${doorLow}V${doorHigh}M${h[0] - 300} ${doorLow}H${h[0] - 200}M${h[0] - 300} ${doorHigh}H${h[0] - 200}`
            : `M${doorLeft} ${doorBelow}H${doorRight}M${doorLeft} ${doorBelow - 40}V${doorBelow + 40}M${doorRight} ${doorBelow - 40}V${doorBelow + 40}`
        }
        x={verticalDoor ? h[0] - 420 : (doorLeft + doorRight) / 2}
        y={verticalDoor ? (doorLow + doorHigh) / 2 : doorBelow + 180}
        rotate={verticalDoor ? -90 : 0}
      >
        门 {Math.round(L)}
      </Dimension>
      <Dimension
        order={3}
        path={
          verticalWindow
            ? `M${W + 220} ${win.start_mm[1]}V${win.end_mm[1]}M${W + 170} ${win.start_mm[1]}H${W + 270}M${W + 170} ${win.end_mm[1]}H${W + 270}`
            : `M${win.start_mm[0]} ${D + 270}H${win.end_mm[0]}M${win.start_mm[0]} ${D + 220}V${D + 320}M${win.end_mm[0]} ${D + 220}V${D + 320}`
        }
        x={verticalWindow ? W + 400 : (win.start_mm[0] + win.end_mm[0]) / 2}
        y={verticalWindow ? (win.start_mm[1] + win.end_mm[1]) / 2 : D + 490}
        rotate={verticalWindow ? 90 : 0}
      >
        窗 {displayMM(win.opening_width_mm, estimated)}
      </Dimension>
      <g className="reveal-last-label">
        {notchW > 0 && notchD > 0 && (
          <text x={notchW / 2} y="190" textAnchor="middle">
            缺口 {displayMM(notchW, estimated)} × {displayMM(notchD)}
          </text>
        )}
        <text
          x={W / 2}
          y={D / 2}
          textAnchor="middle"
          className="reveal-room-name"
        >
          卧室
        </text>
        <text x={W / 2} y={D / 2 + 200} textAnchor="middle">
          约 {data.DIMENSIONS.net_floor_area_m2.toFixed(1)} ㎡
        </text>
      </g>
    </svg>
  );
}
