import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Info,
  SlidersHorizontal,
  CheckCircle2,
  Armchair,
  Wallet,
  Leaf,
  Expand,
  LoaderCircle,
} from "lucide-react";
import { BackLink, Note } from "./ExperienceShell.jsx";
import { MiniPlan } from "./Plan.jsx";
import { BEDROOM_PRICES, demoCost } from "./party-model.js";
import {
  DEFAULT_BRIEF,
  STYLES,
  rankLayouts,
  occupancy,
  styleItems,
  EXAMPLE_SPECS,
} from "./bedroom-brief.js";
const NAMES = [
  "居中双侧床头柜",
  "隔断划分睡眠区",
  "临窗横向布床",
  "拐角纵向布床",
  "独立床后衣帽间",
  "床后转角工作区",
];
export default function BedroomPage({ navigate, brief, onBrief, onEdit }) {
  const [data, setData] = useState(null),
    [selected, setSelected] = useState(
      /^L0[1-6]$/.test(brief?.layoutId || "") ? brief.layoutId : "L04",
    ),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const b = brief || DEFAULT_BRIEF;
  useEffect(() => {
    let live = true;
    fetch("/assets/bedroom.json")
      .then((r) => {
        if (!r.ok) throw Error("卧室案例素材未就绪");
        return r.json();
      })
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => (live = false);
  }, []);
  const ranked = useMemo(
    () => (data ? rankLayouts(data.layouts, b) : []),
    [data, b],
  );
  const footprints = useMemo(
    () =>
      data
        ? Object.fromEntries(
            data.layouts.map((l) => [l.id, occupancy(l.items)]),
          )
        : {},
    [data],
  );
  const active = data?.layouts.find((l) => l.id === selected),
    cost = active ? demoCost(active.items) : 0,
    cover = useMemo(() => (active ? occupancy(active.items) : 0), [active]);
  function update(patch) {
    onBrief({ ...b, ...patch });
    setNotice("需求已更新，可比较不同布局的取舍。");
  }
  if (error)
    return (
      <main className="experience-main">
        <BackLink navigate={navigate} />
        <h1>{error}</h1>
      </main>
    );
  if (!data)
    return (
      <main className="experience-main experience-loading">
        <LoaderCircle className="spin" />
        正在准备六种卧室参考布局…
      </main>
    );
  const strongRental = active.items.some((a) =>
    ["partition", "walk_in_closet"].includes(a.category),
  );
  return (
    <main className="experience-main bedroom-page">
      <BackLink navigate={navigate} />
      <div className="experience-heading">
        <div>
          <span className="page-kicker">预设案例 01 · 毕业生合租卧室</span>
          <h1>
            刚毕业，<span>也要住得像自己。</span>
          </h1>
          <p>说说你的喜好，让睡眠、学习办公和衣物收纳各有位置。</p>
        </div>
        <span className="data-label">视频参考布局 · 演示选品</span>
      </div>
      <div className="bedroom-workbench">
        <aside className="brief-panel">
          <div className="section-title">
            <SlidersHorizontal size={18} />
            <h2>我的卧室需求</h2>
          </div>
          <div className="brief-section">
            <h3>喜欢什么样的感觉？</h3>
            <div className="brief-style-options">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  className={b.style === s.id ? "selected" : ""}
                  onClick={() => update({ style: s.id })}
                  aria-pressed={b.style === s.id}
                >
                  <span className="style-colors">
                    {s.colors.map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                  <span>{s.name}</span>
                  {b.style === s.id && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>
          <div className="brief-section">
            <h3>
              <span>家具预算</span>
              <strong>¥{b.budget.toLocaleString("zh-CN")}</strong>
            </h3>
            <input
              type="range"
              aria-label="卧室家具预算"
              min="1500"
              max="6000"
              step="100"
              value={b.budget}
              onChange={(e) => update({ budget: Number(e.target.value) })}
            />
            <div className="range-labels">
              <span>¥1,500</span>
              <span>¥6,000</span>
            </div>
            <p className="form-help">参考价格为演示估价，不含施工和配送。</p>
          </div>
          <div className="brief-section">
            <h3>房间里，需要装下什么？</h3>
            <label className="entry-check">
              <input type="checkbox" checked disabled readOnly />
              <span>好好睡觉</span>
              <small>必需</small>
            </label>
            <label className="entry-check">
              <input
                type="checkbox"
                checked={b.study}
                onChange={(e) => update({ study: e.target.checked })}
              />
              <span>学习与居家办公</span>
            </label>
            <label className="entry-check">
              <input
                type="checkbox"
                checked={b.storage}
                onChange={(e) => update({ storage: e.target.checked })}
              />
              <span>衣物与日常收纳</span>
            </label>
          </div>
          <div className="brief-section">
            <h3>租来的房间，也要轻松恢复</h3>
            <label className="entry-check">
              <input
                type="checkbox"
                checked={b.rental}
                onChange={(e) => update({ rental: e.target.checked })}
              />
              <span>不打孔、不改墙，优先可移动家具</span>
            </label>
            <p className="form-help">
              到顶隔断和衣帽间方案需要另行确认固定方式。
            </p>
          </div>
          <button
            className="entry-button secondary"
            onClick={() => {
              setSelected(ranked[0].id);
              setNotice(
                "已按预算、工作区与租房限制优先选择参考方案；其余方案仍可比较。",
              );
            }}
          >
            <Leaf size={16} />
            按我的需求挑一挑
            <ArrowRight size={15} />
          </button>
        </aside>
        <section className="bedroom-results">
          <div className="bedroom-results-heading">
            <h2>同一个房间，六种生活安排</h2>
            <span>已准备的参考方案</span>
          </div>
          <div className="bedroom-preview">
            <div className={`bedroom-preview-plan ${b.style}`}>
              <MiniPlan items={styleItems(active.items, b.style)} />
              <span className="preview-scale-note">相对位置 · 尺寸待确认</span>
            </div>
            <div className="bedroom-preview-details">
              <span className="page-kicker">方案 {selected.slice(-2)}</span>
              <h3>{NAMES[Number(selected.slice(-2)) - 1]}</h3>
              <p>{active.title}</p>
              <div className="bedroom-metrics">
                <div>
                  <Wallet size={16} />
                  <b>¥{cost.toLocaleString("zh-CN")}</b>
                  <span>演示家具估价</span>
                </div>
                <div>
                  <Armchair size={16} />
                  <b>{cover}%</b>
                  <span>估计家具占地</span>
                </div>
              </div>
              <div className={`budget-fit ${cost > b.budget ? "over" : ""}`}>
                <CheckCircle2 size={14} />
                {cost <= b.budget
                  ? "演示估价在预算内"
                  : `演示估价超出预算 ¥${cost - b.budget}`}
              </div>
              <p className="rental-fit">
                {strongRental
                  ? "隔断或衣帽间的可拆装性需要确认。"
                  : "以床、柜、桌椅等可移动家具为主。"}
              </p>
              {b.study && !active.items.some((a) => a.category === "desk") && (
                <p className="requirement-missing">
                  当前方案缺少独立书桌，可进入编辑补充。
                </p>
              )}
              <button
                className="entry-button"
                onClick={() => onEdit(selected, b)}
              >
                进入 3D 布置，继续调整
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="brief-layout-grid">
            {data.layouts.map((l, i) => (
              <button
                key={l.id}
                data-bedroom-layout={l.id}
                className={selected === l.id ? "selected" : ""}
                onClick={() => setSelected(l.id)}
              >
                <MiniPlan items={styleItems(l.items, b.style)} />
                <b>
                  {String(i + 1).padStart(2, "0")} · {NAMES[i]}
                </b>
                <span>
                  ¥{demoCost(l.items).toLocaleString("zh-CN")} · 家具占地约{" "}
                  {footprints[l.id]}%
                </span>
                <small
                  className={
                    demoCost(l.items) <= b.budget
                      ? "layout-budget-ok"
                      : "layout-budget-over"
                  }
                >
                  {demoCost(l.items) <= b.budget
                    ? "演示估价在预算内"
                    : "超出当前预算"}
                </small>
                {selected === l.id && (
                  <i>
                    <Check size={11} />
                  </i>
                )}
              </button>
            ))}
          </div>
        </section>
      </div>
      {notice && (
        <p className="experience-feedback" role="status">
          <CheckCircle2 size={16} />
          {notice}
        </p>
      )}
      <section className="bedroom-shopping">
        <div className="section-title">
          <Armchair size={18} />
          <h2>这一方案，可以从这些家具开始</h2>
          <span className="data-label">示例规格与演示参考价</span>
        </div>
        <div className="shopping-table-wrap">
          <table>
            <thead>
              <tr>
                <th>家具示例</th>
                <th>示例规格</th>
                <th>演示参考价</th>
                <th>参考摆放位置</th>
              </tr>
            </thead>
            <tbody>
              {active.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.label.replace("（按桌椅形态识别）", "")}</td>
                  <td>{EXAMPLE_SPECS[a.category] || "待选择"}</td>
                  <td>
                    ¥
                    {a.category === "desk" && a.polygon.length > 4
                      ? 599
                      : BEDROOM_PRICES[a.category]}
                  </td>
                  <td>{a.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Note>
        <Info size={15} />
        方案来自已提取的视频布局，风格选择调整示意配色，需求用于参考排序；当前不调用
        AI
        生成。家具规格与价格为演示示例，未确认库存，也未将视频中的相对位置匹配到真实房间尺寸。
      </Note>
    </main>
  );
}
