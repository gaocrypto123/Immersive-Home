import React, { useState } from "react";
import {
  Gamepad2,
  Users,
  Footprints,
  Check,
  ArrowLeftRight,
  Play,
  Pause,
  RotateCcw,
  Info,
  CheckCircle2,
  Armchair,
  ChevronDown,
} from "lucide-react";
import { BackLink, Note } from "./ExperienceShell.jsx";
import PartyDiagram from "./PartyDiagram.jsx";
import { checkParty } from "./party-model.js";
const constraints = checkParty();
export default function PartyPage({ navigate }) {
  const [mode, setMode] = useState("daily"),
    [zones, setZones] = useState(true),
    [people, setPeople] = useState(true),
    [paths, setPaths] = useState(true),
    [playing, setPlaying] = useState(false),
    [compare, setCompare] = useState(false),
    [notice, setNotice] = useState("");
  function change(next) {
    setMode(next);
    setPlaying(false);
    setCompare(false);
    setNotice(
      next === "party"
        ? "聚会模式已就位：4 人游戏、4 人麻将，两个孩子可以在主通道旁观。"
        : "已恢复日常：沙发、茶几、餐桌与座椅回到原位。",
    );
  }
  return (
    <main className="experience-main party-page">
      <BackLink navigate={navigate} />
      <div className="experience-heading">
        <div>
          <span className="page-kicker">预设案例 02 · 朋友聚会</span>
          <h1>
            朋友来了，<span>客厅换个玩法。</span>
          </h1>
          <p>家具挪一挪，游戏、麻将和小朋友的好奇心一起装得下。</p>
        </div>
        <span className="data-label">示例户型 · 演示方案</span>
      </div>
      <div className="party-workbench">
        <section className="party-plan-panel">
          <div className="party-plan-toolbar">
            <div
              className="mode-segment"
              role="group"
              aria-label="聚会布局模式"
            >
              <button
                className={mode === "daily" ? "selected" : ""}
                onClick={() => change("daily")}
              >
                日常模式
              </button>
              <button
                className={mode === "party" ? "selected" : ""}
                onClick={() => change("party")}
              >
                <Users size={15} />
                聚会模式
              </button>
            </div>
            <button
              className={`plain-button ${compare ? "selected" : ""}`}
              onClick={() => setCompare((v) => !v)}
            >
              <ArrowLeftRight size={15} />
              前后对比
            </button>
          </div>
          {compare ? (
            <div className="party-compare">
              <div>
                <h3>日常 · 休息与用餐</h3>
                <PartyDiagram mode="daily" compact id="compare-daily" />
              </div>
              <div>
                <h3>聚会 · 8 位大人 + 2 位孩子</h3>
                <PartyDiagram
                  mode="party"
                  zones={zones}
                  people={people}
                  paths={paths}
                  compact
                  id="compare-party"
                />
              </div>
            </div>
          ) : (
            <PartyDiagram
              mode={mode}
              zones={zones}
              people={people}
              paths={paths}
              playing={playing}
              id="main-party"
            />
          )}
          <div className="party-plan-bottom">
            <div className="diagram-legend">
              <span>
                <i className="switch-key" />
                Switch 座位
              </span>
              <span>
                <i className="mahjong-key" />
                麻将座位
              </span>
              <span>
                <i className="kids-key" />
                小朋友
              </span>
              <span>
                <i className="path-key" />
                通行 / 起身空间
              </span>
            </div>
            <button
              className="plain-button"
              disabled={mode !== "party" || !people || compare}
              onClick={() => {
                setPlaying((v) => !v);
                setPaths(true);
              }}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
              {playing ? "暂停走动示意" : "播放走动示意"}
            </button>
          </div>
          <div className="party-layer-controls" aria-label="聚会图层">
            {[
              ["活动分区", zones, setZones],
              ["人员位置", people, setPeople],
              ["通行动线", paths, setPaths],
            ].map(([name, on, set]) => (
              <button
                key={name}
                className={on ? "on" : ""}
                onClick={() => set((v) => !v)}
              >
                <span>{on && <Check size={11} />}</span>
                {name}
              </button>
            ))}
          </div>
        </section>
        <aside className="party-details">
          <h2>这次聚会，一个都不少</h2>
          <p className="party-details-intro">
            两个活动区同时使用，主通道留给来回走动的小观众。
          </p>
          <div
            className={`party-requirements ${mode === "party" ? "ready" : ""}`}
          >
            {[
              [Gamepad2, "4 人玩 Switch", "三人沙发 + 单人椅，座位朝向电视"],
              [Users, "4 人打麻将", "方餐桌复用，四周保留起身位置"],
              [
                Footprints,
                "2 位小朋友自由旁观",
                "在活动区之间往返，主通道约 1.0 m",
              ],
            ].map(([Icon, title, text]) => (
              <div key={title}>
                <span className="requirement-icon">
                  <Icon size={19} />
                </span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
                {mode === "party" && <CheckCircle2 size={16} />}
              </div>
            ))}
          </div>
          <div className="party-rearrange">
            <h3>挪一挪，腾出新玩法</h3>
            <ol>
              <li>
                <span>01</span>
                <p>三人沙发向电视靠拢，单人椅加入游戏区。</p>
              </li>
              <li>
                <span>02</span>
                <p>茶几暂时靠边，方餐桌和四把椅子组成麻将区。</p>
              </li>
              <li>
                <span>03</span>
                <p>中间留出通路，小朋友可以两边旁观。</p>
              </li>
            </ol>
          </div>
          <div className="reuse-note">
            <Armchair size={17} />
            <p>
              <b>9 件现有家具继续用</b>
              <span>
                可选补充：麻将桌垫，演示参考价 ¥89。聚会结束后，一键恢复。
              </span>
            </p>
          </div>
          <button
            className={`entry-button ${mode === "party" ? "secondary" : ""}`}
            onClick={() => change(mode === "party" ? "daily" : "party")}
          >
            {mode === "party" ? <RotateCcw size={16} /> : <Users size={16} />}
            {mode === "party" ? "恢复日常布局" : "切换到聚会模式"}
          </button>
        </aside>
      </div>
      {notice && (
        <p className="experience-feedback" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      <Note>
        <Info size={15} />
        独立示例户型 8.0 × 5.6 m。家具尺寸、1.0 m
        通道及起身空间是演示假设，二维检查通过不等于实际安全或人体工学验收；桌垫价格是演示估价。
      </Note>
    </main>
  );
}
