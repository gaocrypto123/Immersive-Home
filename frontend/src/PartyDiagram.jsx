import React from "react";
import {
  DAILY_FURNITURE,
  PARTY_FURNITURE,
  PARTY_PEOPLE,
  STANDING_SPACES,
} from "./party-model.js";
const scale = 85,
  X = (x) => 40 + x * scale,
  Y = (y) => 35 + y * scale;
export default function PartyDiagram({
  mode = "party",
  zones = true,
  people = true,
  paths = true,
  playing = false,
  compact = false,
  id = "party",
}) {
  const party = mode === "party";
  return (
    <svg
      viewBox="0 0 760 555"
      className="party-diagram"
      role="img"
      aria-label={
        party
          ? "聚会布局：四人Switch、四人麻将、两位孩子和一米主通道"
          : "日常客餐厅家具布局"
      }
    >
      <defs>
        <pattern
          id={`${id}-wood`}
          width="66"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <rect width="66" height="26" fill="#eee5d4" />
          <path d="M0 0H66M0 26H66M0 0V26" stroke="#d7c9b1" strokeWidth=".7" />
        </pattern>
        <filter
          id={`${id}-shadow`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3"
            floodColor="#304a35"
            floodOpacity=".12"
          />
        </filter>
        <marker
          id={`${id}-arrow`}
          viewBox="0 0 10 10"
          refX="7"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path
            d="M0 1L8 5L0 9"
            fill="none"
            stroke="#729da0"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
      <rect
        x="40"
        y="35"
        width="680"
        height="476"
        rx="8"
        fill={`url(#${id}-wood)`}
        stroke="#8d9b8a"
        strokeWidth="7"
      />
      <path d="M80 35H310" stroke="#b5cbc3" strokeWidth="9" />
      <path d="M80 32H310M80 38H310" stroke="#eef5eb" strokeWidth="2" />
      <path d="M340 511H420" stroke="#f6f1e5" strokeWidth="10" />
      <path
        d="M340 511V445Q420 445 420 511"
        stroke="#92a68d"
        strokeWidth="1.2"
        fill="none"
      />
      {party && zones && (
        <g data-layer="activity-zones">
          <rect
            x={X(0.18)}
            y={Y(0.58)}
            width={3.18 * scale}
            height={2.8 * scale}
            rx="18"
            fill="#aac3a1"
            fillOpacity=".20"
            stroke="#809e72"
            strokeDasharray="6 5"
          />
          <rect
            x={X(4.48)}
            y={Y(0.6)}
            width={3.37 * scale}
            height={3.55 * scale}
            rx="18"
            fill="#d9b887"
            fillOpacity=".17"
            stroke="#bca071"
            strokeDasharray="6 5"
          />
          {!compact && (
            <>
              <text x={X(0.38)} y={Y(3.62)} className="diagram-label">
                游戏区 · 4 人
              </text>
              <text x={X(5.4)} y={Y(4.42)} className="diagram-label">
                麻将区 · 4 人
              </text>
            </>
          )}
        </g>
      )}
      {party && paths && (
        <g data-layer="circulation">
          <rect
            x={X(3.5)}
            y={Y(0.6)}
            width={scale}
            height={5 * scale}
            rx="18"
            fill="#9dc6c3"
            opacity=".22"
          />
          <path
            id={`${id}-route`}
            d={`M${X(4)} ${Y(5.2)}V${Y(0.85)}H${X(3.2)}H${X(4.8)}H${X(4)}V${Y(5.2)}`}
            fill="none"
            stroke="#80aaa9"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />
          {STANDING_SPACES.map((s, i) => (
            <rect
              key={i}
              x={X(s[0])}
              y={Y(s[1])}
              width={(s[2] - s[0]) * scale}
              height={(s[3] - s[1]) * scale}
              fill="#e6d8c0"
              opacity=".65"
              stroke="#bbaa87"
              strokeDasharray="3 3"
            />
          ))}
          {!compact && (
            <>
              <text
                x={X(4)}
                y={Y(4.9)}
                textAnchor="middle"
                className="diagram-path-label"
              >
                1.0 m
              </text>
              <text
                x={X(4)}
                y={Y(5.13)}
                textAnchor="middle"
                className="diagram-path-label"
              >
                主通道
              </text>
            </>
          )}
        </g>
      )}
      {party && people && (
        <g opacity=".18" data-layer="tv-sightlines">
          {PARTY_PEOPLE.filter((p) => p.group === "switch").map((p) => (
            <path
              key={p.id}
              d={`M${X(p.x)} ${Y(p.y)}L${X(0.65)} ${Y(0.4)}L${X(2.65)} ${Y(0.4)}Z`}
              fill="#8ba77d"
            />
          ))}
        </g>
      )}
      {(party ? PARTY_FURNITURE : DAILY_FURNITURE).map((a) => (
        <g
          key={a.id}
          data-furniture={a.id}
          data-position={`${a.x},${a.y}`}
          transform={`translate(${X(a.x)},${Y(a.y)})`}
          className="party-furniture"
          filter={`url(#${id}-shadow)`}
        >
          <title>{a.name}</title>
          {a.type === "tv" ? (
            <>
              <rect
                x={(-a.w * scale) / 2}
                y={(-a.d * scale) / 2}
                width={a.w * scale}
                height={a.d * scale}
                rx="4"
                fill="#506258"
              />
              {!compact && (
                <text
                  y="-17"
                  textAnchor="middle"
                  className="diagram-small-label"
                >
                  电视 / Switch
                </text>
              )}
            </>
          ) : a.type === "sofa" ? (
            <>
              <rect
                x={(-a.w * scale) / 2}
                y={(-a.d * scale) / 2}
                width={a.w * scale}
                height={a.d * scale}
                rx="10"
                fill="#96ad8d"
              />
              <rect
                x={(-a.w * scale) / 2 + 3}
                y={(a.d * scale) / 2 - 15}
                width={a.w * scale - 6}
                height="13"
                rx="5"
                fill="#7e9a75"
              />
              {[-1, 0, 1].map((n) => (
                <rect
                  key={n}
                  x={(n * a.w * scale) / 3 - (a.w * scale) / 6 + 3}
                  y={(-a.d * scale) / 2 + 4}
                  width={(a.w * scale) / 3 - 6}
                  height={a.d * scale - 21}
                  rx="5"
                  fill="#b2c2a4"
                />
              ))}
            </>
          ) : a.type === "table" ? (
            <>
              <rect
                x={(-a.w * scale) / 2}
                y={(-a.d * scale) / 2}
                width={a.w * scale}
                height={a.d * scale}
                rx="7"
                fill={party ? "#70917d" : "#c0a788"}
                stroke={party ? "#577863" : "#a88e6e"}
                strokeWidth="3"
              />
              {party && (
                <>
                  <rect
                    x="-23"
                    y="-23"
                    width="46"
                    height="46"
                    rx="3"
                    fill="#88a38c"
                  />
                  {[-20, -10, 0, 10, 20].map((n) => (
                    <React.Fragment key={n}>
                      <rect
                        x={n - 3}
                        y="-29"
                        width="6"
                        height="8"
                        rx="1"
                        fill="#f0e9d5"
                      />
                      <rect
                        x={n - 3}
                        y="21"
                        width="6"
                        height="8"
                        rx="1"
                        fill="#f0e9d5"
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          ) : a.type === "coffee" ? (
            <>
              <rect
                x={(-a.w * scale) / 2}
                y={(-a.d * scale) / 2}
                width={a.w * scale}
                height={a.d * scale}
                rx="17"
                fill="#c9b799"
              />
              <circle cx="8" cy="-2" r="8" fill="#e9ddca" />
              {party && !compact && (
                <text
                  y="39"
                  textAnchor="middle"
                  className="diagram-small-label"
                >
                  茶几暂靠边
                </text>
              )}
            </>
          ) : (
            <g transform={`rotate(${a.rotation})`}>
              <rect
                x={(-a.w * scale) / 2}
                y={(-a.d * scale) / 2}
                width={a.w * scale}
                height={a.d * scale}
                rx="8"
                fill={a.type === "armchair" ? "#b8aa8f" : "#cbb997"}
              />
              <rect
                x={(-a.w * scale) / 2 + 3}
                y={(a.d * scale) / 2 - 9}
                width={a.w * scale - 6}
                height="9"
                rx="4"
                fill="#a28c72"
              />
            </g>
          )}
        </g>
      ))}
      {party &&
        people &&
        PARTY_PEOPLE.map((p, i) => {
          const kid = p.group === "children";
          return (
            <g
              key={p.id}
              data-person-group={p.group}
              aria-label={`${kid ? "小朋友" : p.group === "switch" ? "游戏参与者" : "麻将参与者"} ${i + 1}`}
              transform={
                kid && playing ? undefined : `translate(${X(p.x)},${Y(p.y)})`
              }
            >
              {kid && playing && (
                <animateMotion
                  dur="14s"
                  begin={i === 8 ? "0s" : "-7s"}
                  repeatCount="indefinite"
                  path={`M${X(i === 8 ? 3.82 : 4.18)} ${Y(4.9)}V${Y(0.85)}H${X(3.2)}H${X(4.8)}H${X(i === 8 ? 3.82 : 4.18)}V${Y(4.9)}`}
                />
              )}
              <circle
                r={kid ? 13 : 12}
                fill={
                  kid ? "#ce9569" : p.group === "switch" ? "#4d775b" : "#a78759"
                }
                stroke="#faf7ee"
                strokeWidth="3"
              />
              <circle cy="-3" r="3.1" fill="#fff8e8" />
              <path
                d="M-5 5Q0-1 5 5"
                fill="none"
                stroke="#fff8e8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {kid && !compact && (
                <text
                  y="28"
                  textAnchor="middle"
                  className="diagram-small-label"
                >
                  {p.id === "K1" ? "小朋友 1" : "小朋友 2"}
                </text>
              )}
            </g>
          );
        })}
      {!compact && (
        <>
          <text x="40" y="544" className="diagram-small-label">
            示例户型 8.0 × 5.6 m · 家具及通道尺寸均为演示假设
          </text>
          <text
            x="718"
            y="544"
            textAnchor="end"
            className="diagram-small-label"
          >
            入口 ↑
          </text>
        </>
      )}
    </svg>
  );
}
