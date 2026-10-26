import React, { useId } from "react";
import { House, Sparkles } from "lucide-react";
import RoomVignette from "./RoomVignette.jsx";
import "./home-flow.css";

// The input and output share a footprint so the transformation is easy to read.
function FloorPlan({ furnished = false, compact = false }) {
  return (
    <svg
      viewBox={compact ? "27 9 168 112" : "0 0 220 142"}
      fill="none"
      aria-hidden="true"
    >
      <path d="M31 25H104V13H191V117H31V25Z" fill="#f4f2e8" />
      <path
        d="M31 25H104V13H191V117H133M102 117H31V25"
        stroke="#6f826b"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M31 49V82M191 38V75" stroke="#a8bdb5" strokeWidth="5" />
      <path
        d="M133 117V88M133 88A29 29 0 0 0 104 117"
        stroke="#a0aa93"
        strokeWidth="1"
      />
      <path
        d="M31 133H191M31 130V136M191 130V136M17 25V117M14 25H20M14 117H20"
        stroke="#c4c9b8"
        strokeWidth=".8"
      />
      {furnished ? (
        <g>
          <rect
            x="120"
            y="23"
            width="60"
            height="76"
            rx="3"
            fill="#e3c7aa"
            stroke="#aa967a"
          />
          <rect x="123" y="26" width="54" height="20" rx="2" fill="#fffaf0" />
          <path
            d="M149 28V43M122 52H178M124 55H176"
            stroke="#c6ac8e"
            strokeWidth=".8"
          />
          <rect x="66" y="59" width="42" height="44" rx="4" fill="#e4e8d7" />
          <path
            d="M71 62V100M76 62V100M81 62V100M86 62V100M91 62V100M96 62V100M101 62V100"
            stroke="#d4dbc4"
            strokeWidth=".7"
          />
          <rect
            x="39"
            y="32"
            width="23"
            height="50"
            rx="2"
            fill="#b8c5a7"
            stroke="#8fa17b"
          />
          <path d="M42 56H59" stroke="#8fa17b" />
          <rect
            x="39"
            y="91"
            width="49"
            height="17"
            rx="2"
            fill="#d8c9ad"
            stroke="#b6a88b"
          />
          <rect
            x="53"
            y="86"
            width="18"
            height="10"
            rx="2"
            fill="#fbf9f0"
            stroke="#b6a88b"
          />
          <circle cx="181" cy="108" r="6" fill="#a4b493" />
          <path d="M179 111L184 104" stroke="#7b926b" />
        </g>
      ) : (
        <g stroke="#c9cebd" strokeWidth=".8">
          <path d="M112 54V83M98 69H126" />
          <circle cx="112" cy="69" r="19" strokeDasharray="2 4" />
        </g>
      )}
    </svg>
  );
}

function ReferenceScene() {
  return (
    <svg viewBox="0 0 220 142" fill="none" aria-hidden="true">
      <path d="M20 105L110 133L201 102L111 75Z" fill="#e8dfce" />
      <path d="M20 105V30L111 9V75Z" fill="#e8eade" />
      <path d="M111 9L201 36V102L111 75Z" fill="#f2ede2" />
      <path
        d="M21 31L110 10L200 37M110 11V74M22 104L110 130L199 102"
        stroke="#d2d6c3"
        strokeWidth=".9"
      />
      <path d="M38 38L75 29V68L38 78Z" fill="#fffdf5" stroke="#d6dccb" />
      <path d="M56 34V73M39 55L73 46" stroke="#c1d0c4" strokeWidth="2" />
      <path d="M52 106L101 122L155 104L108 90Z" fill="#cbd2bb" />
      <path d="M130 68L171 80V101L130 89Z" fill="#acb99c" />
      <path d="M125 85L166 98L183 91L141 78Z" fill="#c7d0b6" />
      <path d="M125 85V99L167 113V98Z" fill="#a1af8e" />
      <path d="M167 98L183 91V106L167 113Z" fill="#8f9f7e" />
      <path
        d="M123 81L132 84V100L123 97ZM175 87L184 90V107L175 104Z"
        fill="#b8c5a6"
      />
      <path d="M142 74L153 77V87L142 84Z" fill="#f2e9d5" />
      <path d="M91 92L114 99L96 106L73 99Z" fill="#cbaa86" />
      <path d="M73 99V103L96 111V106M96 106L114 99V103L96 111" fill="#b99774" />
      <ellipse cx="93" cy="96" rx="5" ry="2" fill="#eee9da" />
      <path d="M179 73L188 76L186 88L180 86Z" fill="#c4ab8c" />
      <path
        d="M183 76V53M183 66Q165 64 173 53Q185 53 183 66M184 60Q185 44 193 48Q198 57 184 60"
        stroke="#7e9675"
        strokeWidth="2"
        fill="#a2b398"
      />
      <path d="M123 27L155 37V54L123 44Z" fill="#dfd5bd" stroke="#c5baa3" />
      <path d="M127 41L136 34L142 43L150 40" stroke="#b39e7e" />
    </svg>
  );
}

export default function HomeFlow() {
  const id = useId().replace(/:/g, "");
  const inputPaths = [
    "M240 72C345 72 357 175 490 175",
    "M240 91C348 91 369 175 490 175",
    "M240 259C345 259 357 175 490 175",
    "M240 278C348 278 369 175 490 175",
  ];
  return (
    <figure
      className="home-flow"
      aria-label="流程示意：平面户型图和场景参考图汇入家有新解，输出 2D 平面布局与 3D 空间示意"
    >
      <div className="home-flow-ambient" aria-hidden="true" />
      <svg
        className="home-flow-wires desktop-wires"
        viewBox="0 0 1000 350"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`${id}-wire`}
            x1="240"
            y1="0"
            x2="760"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9bab8e" stopOpacity=".2" />
            <stop offset=".5" stopColor="#6f8c64" stopOpacity=".55" />
            <stop offset="1" stopColor="#9bab8e" stopOpacity=".3" />
          </linearGradient>
        </defs>
        {inputPaths.map((d, i) => (
          <g key={d}>
            <path d={d} stroke={`url(#${id}-wire)`} strokeWidth="1" />
            <path
              className="flow-packet"
              d={d}
              pathLength="100"
              style={{
                animationDelay: `${(i % 2) * -2.8 - (i > 1 ? 1.4 : 0)}s`,
              }}
            />
          </g>
        ))}
        <path d="M530 175H800" stroke={`url(#${id}-wire)`} strokeWidth="1.5" />
        <path
          className="flow-packet flow-packet-out"
          d="M530 175H800"
          pathLength="100"
        />
        <path
          d="M737 171L742 175L737 179"
          stroke="#8ca17f"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        className="home-flow-wires mobile-wires"
        viewBox="0 0 360 430"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M86 128C86 179 180 151 180 209M274 128C274 179 180 151 180 209M180 239V300"
          stroke="#a9b89a"
          strokeOpacity=".6"
        />
        <path
          className="flow-packet"
          d="M86 128C86 179 180 151 180 209"
          pathLength="100"
        />
        <path
          className="flow-packet"
          d="M274 128C274 179 180 151 180 209"
          pathLength="100"
          style={{ animationDelay: "-1.5s" }}
        />
        <path
          className="flow-packet flow-packet-out"
          d="M180 239V300"
          pathLength="100"
        />
        <path
          d="M176 279L180 284L184 279"
          stroke="#8ca17f"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flow-source flow-source-plan">
        <div className="flow-paper">
          <FloorPlan />
        </div>
        <div className="flow-label">
          <strong>平面户型图</strong>
          <span>空间的尺寸与边界</span>
        </div>
      </div>
      <div className="flow-source flow-source-reference">
        <div className="flow-paper">
          <ReferenceScene />
        </div>
        <div className="flow-label">
          <strong>场景参考图</strong>
          <span>你喜欢的风格与氛围</span>
        </div>
      </div>
      <div className="flow-center">
        <div className="flow-core">
          <House size={38} strokeWidth={1.15} />
          <Sparkles className="flow-core-spark" size={16} strokeWidth={1.3} />
        </div>
        <span>家有新解</span>
      </div>
      <div className="flow-result">
        <div className="flow-paper flow-result-paper">
          <div className="flow-result-topline">
            <i />
            <span>为你的生活，找到新解</span>
          </div>
          <div className="flow-result-views">
            <div className="flow-result-view">
              <span className="flow-view-name">2D</span>
              <div className="flow-view-art">
                <FloorPlan furnished compact />
              </div>
            </div>
            <div className="flow-result-view">
              <span className="flow-view-name">3D</span>
              <div className="flow-view-art flow-view-3d">
                <RoomVignette type="flow-result" compact />
              </div>
            </div>
          </div>
        </div>
        <div className="flow-label">
          <strong>
            布局结果<small>示意</small>
          </strong>
          <span>让灵感落在你的空间里</span>
        </div>
      </div>
      <figcaption className="flow-caption">
        读懂你的空间，也懂你向往的生活。
      </figcaption>
    </figure>
  );
}
