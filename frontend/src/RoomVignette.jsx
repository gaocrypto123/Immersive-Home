import React from "react";

// A shared isometric projection keeps furniture and circulation in the same space.
const point = (x, y, z = 0) => [220 + (x - y) * 29, 87 + (x + y) * 14 - z * 27];
const points = (vertices) =>
  vertices.map((v) => point(...v).join(",")).join(" ");
function Surface({ x, y, w, d, z = 0, fill, ...props }) {
  return (
    <polygon
      points={points([
        [x, y, z],
        [x + w, y, z],
        [x + w, y + d, z],
        [x, y + d, z],
      ])}
      fill={fill}
      {...props}
    />
  );
}
function Block({
  x,
  y,
  w,
  d,
  h,
  z = 0,
  top = "#eee2cf",
  front = "#c9b697",
  side = "#bba384",
}) {
  return (
    <g
      stroke="#62694f"
      strokeWidth=".65"
      strokeOpacity=".22"
      strokeLinejoin="round"
    >
      <polygon
        points={points([
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x, y + d, z + h],
        ])}
        fill={front}
      />
      <polygon
        points={points([
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, z + h],
          [x + w, y, z + h],
        ])}
        fill={side}
      />
      <Surface x={x} y={y} w={w} d={d} z={z + h} fill={top} />
    </g>
  );
}
function Plant({ x, y }) {
  const [px, py] = point(x, y, 0.5);
  return (
    <g>
      <Block
        x={x - 0.18}
        y={y - 0.18}
        w={0.36}
        d={0.36}
        h={0.5}
        top="#dfc8ad"
        front="#caa88d"
        side="#b58f74"
      />
      <path d={`M${px} ${py}v-29`} stroke="#657b58" strokeWidth="2" />
      <ellipse
        cx={px - 6}
        cy={py - 21}
        rx="6"
        ry="11"
        fill="#829a6b"
        transform={`rotate(-35 ${px - 6} ${py - 21})`}
      />
      <ellipse
        cx={px + 7}
        cy={py - 30}
        rx="6"
        ry="12"
        fill="#58785a"
        transform={`rotate(38 ${px + 7} ${py - 30})`}
      />
      <ellipse
        cx={px - 3}
        cy={py - 39}
        rx="5"
        ry="10"
        fill="#a3b58b"
        transform={`rotate(-18 ${px - 3} ${py - 39})`}
      />
    </g>
  );
}
function Person({ x, y, color = "#68856d", child = false }) {
  const [px, py] = point(x, y, 0.2);
  return (
    <g>
      <ellipse cx={px} cy={py + 4} rx={child ? 5 : 6} ry="3" fill="#5d6a5420" />
      <path
        d={`M${px} ${py}v-${child ? 8 : 10}`}
        stroke={color}
        strokeWidth={child ? 8 : 10}
        strokeLinecap="round"
      />
      <circle
        cx={px}
        cy={py - (child ? 14 : 18)}
        r={child ? 4 : 5}
        fill="#dfbda0"
      />
    </g>
  );
}
function Chair({ x, y }) {
  return (
    <g>
      <Block
        x={x}
        y={y}
        w={0.55}
        d={0.52}
        h={0.48}
        top="#bba584"
        front="#ac9474"
        side="#8f7e64"
      />
      <Block
        x={x}
        y={y}
        w={0.55}
        d={0.1}
        h={0.38}
        z={0.48}
        top="#d5c2a4"
        front="#bca888"
        side="#a68b69"
      />
    </g>
  );
}
export default function RoomVignette({ type, compact = false }) {
  const party = type === "party";
  const id = `vignette-${type}`;
  return (
    <div className={`entry-room room-vignette ${type}-vignette`}>
      <svg
        viewBox={compact ? "70 23 328 222" : "0 0 440 295"}
        role="img"
        aria-label={
          party
            ? "聚会立体示意：左侧四人游戏，右侧四人麻将，两位孩子从中间通道走动"
            : "卧室立体示意：右侧睡眠、左侧衣柜与书桌，中央留出活动空间"
        }
      >
        <defs>
          <pattern
            id={`${id}-pencil`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M-2 6L6-2M2 10L10 2"
              fill="none"
              stroke="#536347"
              strokeWidth=".7"
              strokeOpacity=".23"
              strokeLinecap="round"
            />
          </pattern>
          <filter
            id={`${id}-shadow`}
            x="-35%"
            y="-30%"
            width="170%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f9f6ec" />
            <stop offset="1" stopColor="#e2ddcc" />
          </linearGradient>
          <clipPath id={`${id}-floor`}>
            <Surface x={0} y={0} w={6} d={5} fill="white" />
          </clipPath>
        </defs>
        <ellipse
          cx="231"
          cy="250"
          rx="146"
          ry="22"
          fill="#59664c"
          opacity=".13"
          filter={`url(#${id}-shadow)`}
        />
        <Block
          x={0}
          y={0}
          w={6}
          d={5}
          h={0.16}
          z={-0.16}
          top="#e6d7bd"
          front="#cabba0"
          side="#bba98d"
        />
        <g clipPath={`url(#${id}-floor)`}>
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M${point(i * 0.6, 0)}L${point(i * 0.6, 5)}`}
              stroke="#d5c5a9"
              strokeWidth=".6"
            />
          ))}
          {[1, 2.5, 4].map((y) => (
            <path
              key={y}
              d={`M${point(0, y)}L${point(6, y)}`}
              stroke="#d5c5a9"
              strokeWidth=".5"
            />
          ))}
          <Surface
            x={1.5}
            y={0.1}
            w={2.5}
            d={4.9}
            fill="#fff8e7"
            opacity=".30"
          />
        </g>
        <polygon
          points={points([
            [0, 0, 0],
            [0, 5, 0],
            [0, 5, 2.1],
            [0, 0, 2.1],
          ])}
          fill="#e6e4d5"
        />
        <polygon
          points={points([
            [0, 0, 0],
            [6, 0, 0],
            [6, 0, 2.1],
            [0, 0, 2.1],
          ])}
          fill={`url(#${id}-wall)`}
        />
        <polyline
          points={points([
            [0, 5, 2.1],
            [0, 0, 2.1],
            [6, 0, 2.1],
          ])}
          fill="none"
          stroke="#fcfaf2"
          strokeWidth="3"
        />
        <polygon
          points={points([
            [0.6, 0, 0.9],
            [2.3, 0, 0.9],
            [2.3, 0, 1.9],
            [0.6, 0, 1.9],
          ])}
          fill="#b9c9bc"
          stroke="#fffdf5"
          strokeWidth="4"
        />
        <path
          d={`M${point(1.45, 0, 0.9)}L${point(1.45, 0, 1.9)}`}
          stroke="#fdfaf0"
          strokeWidth="2"
        />
        {party ? (
          <>
            <Surface
              x={0.35}
              y={0.9}
              w={2.1}
              d={3.65}
              fill="#aab7a1"
              opacity=".65"
            />
            <Surface
              x={3.8}
              y={1.4}
              w={1.9}
              d={2.7}
              fill="#d6bd98"
              opacity=".4"
            />
            <Block x={0.4} y={0.25} w={1.9} d={0.45} h={0.4} top="#c7ad8b" />
            <Block
              x={0.7}
              y={0.34}
              w={1.35}
              d={0.12}
              h={0.85}
              z={0.4}
              top="#3d5146"
              front="#384e45"
              side="#263e34"
            />
            <polygon
              points={points([
                [0.79, 0.47, 0.55],
                [1.26, 0.47, 0.55],
                [1.26, 0.47, 1.15],
                [0.79, 0.47, 1.15],
              ])}
              fill="#a6c1aa"
            />
            <polygon
              points={points([
                [1.32, 0.47, 0.55],
                [1.96, 0.47, 0.55],
                [1.96, 0.47, 1.15],
                [1.32, 0.47, 1.15],
              ])}
              fill="#9cab83"
            />
            <Block
              x={0.45}
              y={3.65}
              w={2.05}
              d={0.85}
              h={0.45}
              top="#78927e"
              front="#5f7c67"
              side="#516e5b"
            />
            <Block
              x={0.45}
              y={4.3}
              w={2.05}
              d={0.17}
              h={0.5}
              z={0.35}
              top="#8ea28b"
              front="#69846d"
              side="#57735e"
            />
            {[0.58, 1.25, 1.92].map((x) => (
              <Person key={x} x={x + 0.15} y={3.96} color="#637b65" />
            ))}
            <Chair x={2.08} y={2.2} />
            <Person x={2.35} y={2.5} color="#ab856a" />
            <Chair x={4.1} y={1.04} />
            <Person x={4.37} y={1.3} color="#a28a70" />
            <Chair x={5.1} y={2.1} />
            <Person x={5.36} y={2.36} color="#829488" />
            <Chair x={3.15} y={2.1} />
            <Person x={3.42} y={2.36} color="#8c8191" />
            <Block
              x={3.9}
              y={1.9}
              w={1.1}
              d={1.1}
              h={0.7}
              top="#4b7866"
              front="#ad9677"
              side="#927b60"
            />
            <Surface x={4} y={2} w={0.9} d={0.9} z={0.71} fill="#6b937b" />
            {[0, 1, 2].map((i) => (
              <Surface
                key={i}
                x={4.12 + i * 0.2}
                y={2.13}
                w={0.13}
                d={0.07}
                z={0.73}
                fill="#f5efe1"
              />
            ))}
            <Chair x={4.1} y={3.2} />
            <Person x={4.37} y={3.46} color="#b58e77" />
            <path
              d={`M${point(2.9, 4.7)}L${point(2.9, 1.2)}`}
              fill="none"
              stroke="#719e98"
              strokeWidth="3"
              strokeDasharray="4 4"
              opacity=".7"
            />
            <Person x={2.85} y={3.4} child color="#c39362" />
            <Person x={2.85} y={1.4} child color="#8d9baf" />
            <Plant x={5.5} y={0.5} />
          </>
        ) : (
          <>
            <Surface x={1} y={1.4} w={4.55} d={3.2} fill="#f4ead6" />
            <Surface
              x={1.1}
              y={1.5}
              w={4.35}
              d={3}
              fill="none"
              stroke="#e7dbc3"
              strokeWidth=".8"
            />
            <Block
              x={0.15}
              y={0.5}
              w={0.75}
              d={1.55}
              h={1.75}
              top="#a4b09b"
              front="#7e917e"
              side="#6e806e"
            />
            <polygon
              points={points([
                [0.19, 2.05, 0.08],
                [0.86, 2.05, 0.08],
                [0.86, 2.05, 1.7],
                [0.19, 2.05, 1.7],
              ])}
              fill={`url(#${id}-pencil)`}
              opacity=".65"
            />
            <path
              d={`M${point(0.53, 2.06, 0.12)}L${point(0.53, 2.06, 1.7)}`}
              stroke="#b3bda5"
              strokeWidth="1"
            />
            <Block
              x={3.15}
              y={0.4}
              w={2.15}
              d={0.18}
              h={1.1}
              top="#c4a888"
              front="#b39676"
              side="#9e8264"
            />
            <Block
              x={3.15}
              y={0.6}
              w={2.15}
              d={3.15}
              h={0.42}
              top="#c4ab8b"
              front="#b79b79"
              side="#a18665"
            />
            <Block
              x={3.22}
              y={0.66}
              w={2.01}
              d={3.01}
              h={0.22}
              z={0.42}
              top="#fbf5e8"
              front="#e9deca"
              side="#dfd2bd"
            />
            <Block
              x={3.23}
              y={1.6}
              w={1.99}
              d={2.06}
              h={0.07}
              z={0.64}
              top="#b78365"
              front="#a87458"
              side="#986549"
            />
            <Surface
              x={3.25}
              y={1.65}
              w={1.95}
              d={0.4}
              z={0.72}
              fill="#c69778"
            />
            <Surface
              x={3.25}
              y={2.08}
              w={1.95}
              d={1.55}
              z={0.72}
              fill={`url(#${id}-pencil)`}
              opacity=".7"
            />
            <path
              d={`M${point(3.28, 2.12, 0.73)}Q${point(4.18, 2.16, 0.73)} ${point(5.15, 2.1, 0.73)}`}
              fill="none"
              stroke="#f4dfc6"
              strokeWidth="1.1"
              strokeOpacity=".58"
              strokeLinecap="round"
            />
            <Block
              x={3.4}
              y={0.83}
              w={0.68}
              d={0.57}
              h={0.14}
              z={0.64}
              top="#fffcf2"
              front="#f1e9d9"
              side="#e9dfca"
            />
            <Block
              x={4.27}
              y={0.83}
              w={0.68}
              d={0.57}
              h={0.14}
              z={0.64}
              top="#fffcf2"
              front="#f1e9d9"
              side="#e9dfca"
            />
            <Block x={5.4} y={0.7} w={0.45} d={0.65} h={0.55} top="#d5c09b" />
            <Block
              x={0.3}
              y={3.65}
              w={1.8}
              d={0.75}
              h={0.75}
              top="#d1b58e"
              front="#bca079"
              side="#ac8e68"
            />
            <Surface
              x={0.68}
              y={3.74}
              w={0.73}
              d={0.42}
              z={0.77}
              fill="#f7f1e2"
            />
            <Block
              x={0.75}
              y={3.7}
              w={0.64}
              d={0.08}
              h={0.42}
              z={0.78}
              top="#465c51"
              front="#40574c"
              side="#31473c"
            />
            <Chair x={1.1} y={2.72} />
            <Plant x={2.7} y={0.7} />
            <Plant x={0.45} y={4.7} />
          </>
        )}
      </svg>
      <span className="room-caption">
        <i />
        {party
          ? "4 人游戏 · 4 人麻将 · 2 位小朋友"
          : "休息、学习、收纳，各有位置"}
        <span className="vignette-note">布局示意</span>
      </span>
    </div>
  );
}
