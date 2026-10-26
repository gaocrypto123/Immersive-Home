import React from "react";
import RoomVignette from "./RoomVignette.jsx";
export default function HomeIllustration({ type }) {
  if (type !== "custom") return <RoomVignette type={type} />;
  if (type === "custom")
    return (
      <div className="entry-room">
        <svg
          viewBox="45 10 350 225"
          role="img"
          aria-label="上传自己的户型和风格图片，尚未生成布局"
        >
          <defs>
            <pattern
              id="home-upload-pencil"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M-2 5L5-2M2 9L9 2"
                fill="none"
                stroke="#657352"
                strokeWidth=".7"
                strokeOpacity=".24"
                strokeLinecap="round"
              />
            </pattern>
            <filter id="paper-shadow">
              <feDropShadow
                dx="0"
                dy="5"
                stdDeviation="8"
                floodColor="#758578"
                floodOpacity=".12"
              />
            </filter>
          </defs>
          <g
            transform="translate(82,29) rotate(-5 130 90)"
            filter="url(#paper-shadow)"
          >
            <rect
              width="236"
              height="177"
              rx="9"
              fill="#fffdf8"
              stroke="#8d947b"
              strokeWidth=".8"
              strokeOpacity=".34"
            />
            <path
              d="M16 14Q110 12 219 15M221 17Q220 82 222 159M218 162Q119 165 17 162"
              fill="none"
              stroke="#899377"
              strokeWidth=".65"
              strokeOpacity=".18"
              strokeLinecap="round"
            />
            <path
              d="M24 42H84V20H207V148H24Z"
              fill="#eff1e8"
              stroke="#99a895"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <path
              d="M26 44L86 43L85 22L205 21M205 23L206 145L26 147"
              fill="none"
              stroke="#6f805f"
              strokeWidth=".8"
              strokeOpacity=".3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M42 148H112" stroke="#9db9b6" strokeWidth="5" />
            <path
              d="M143 64V104M123 84H163"
              stroke="#a6b79d"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          <g transform="translate(280,120) rotate(7)">
            <rect
              width="89"
              height="91"
              rx="7"
              fill="#e2e7db"
              stroke="#fffdf7"
              strokeWidth="5"
            />
            <rect x="11" y="12" width="66" height="32" rx="3" fill="#b1bda0" />
            <rect
              x="11"
              y="12"
              width="66"
              height="32"
              rx="3"
              fill="url(#home-upload-pencil)"
              opacity=".7"
            />
            <rect x="11" y="51" width="19" height="25" rx="3" fill="#d0bc9f" />
            <rect
              x="11"
              y="51"
              width="19"
              height="25"
              rx="3"
              fill="url(#home-upload-pencil)"
              opacity=".5"
            />
            <rect x="36" y="51" width="41" height="25" rx="3" fill="#f4eddf" />
          </g>
          <g transform="translate(63,172)">
            <rect width="56" height="43" rx="10" fill="#65896d" />
            <path
              d="M28 30V12M21 19L28 12L35 19"
              stroke="#fffdf3"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
        <span className="room-caption">
          <i />
          你的平面图 + 喜欢的风格
        </span>
      </div>
    );
  return null;
}
