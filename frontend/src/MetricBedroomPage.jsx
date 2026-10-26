import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Box,
  Download,
  Info,
  LayoutGrid,
  LoaderCircle,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { BackLink, Note } from "./ExperienceShell.jsx";
import MetricPlan from "./MetricPlan.jsx";
import MetricScene from "./MetricScene.jsx";
import {
  adaptMetricRoom,
  exportMetricRoom,
  METRIC_STORAGE,
  metricIssues,
  moveMetricItem,
  shortName,
  validMetricItems,
} from "./metric-room.js";
import "./metric-bedroom.css";

export default function MetricBedroomPage({ navigate }) {
  const [room, setRoom] = useState(null),
    [items, setItems] = useState([]),
    [selected, setSelected] = useState(null),
    [view, setView] = useState("2d");
  const [doorOpen, setDoorOpen] = useState(true),
    [transparentFront, setTransparentFront] = useState(true),
    [cameraMode, setCameraMode] = useState("iso");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [canSave, setCanSave] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/assets/room-L02.json")
      .then((r) => {
        if (!r.ok) throw Error("估算尺寸案例尚未准备，请重新同步素材。");
        return r.json();
      })
      .then((data) => {
        if (!live) return;
        const model = adaptMetricRoom(data);
        let next = model.furniture,
          save = true;
        try {
          const text = localStorage.getItem(METRIC_STORAGE);
          if (text) {
            const stored = JSON.parse(text);
            if (
              stored.units === "m" &&
              stored.sourceImageHash === data.source.image_sha256 &&
              validMetricItems(stored.items, model)
            )
              next = stored.items;
            else {
              save = false;
              setNotice(
                "本地记录与当前尺寸版本不一致，已显示原始估算，旧记录未覆盖。",
              );
            }
          }
        } catch {
          save = false;
          setNotice("无法读取本地记录，已显示原始估算；旧记录未覆盖。");
        }
        setRoom(model);
        setItems(next);
        setCanSave(save);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!room || !canSave) return;
    try {
      localStorage.setItem(
        METRIC_STORAGE,
        JSON.stringify({
          schema: "jyxj.metric-bedroom-layout.v1",
          units: "m",
          sourceImageHash: room.source.source.image_sha256,
          items,
        }),
      );
    } catch {
      setNotice("浏览器未允许本地保存；可使用“导出尺寸方案”保存当前布置。");
    }
  }, [room, items, canSave]);
  const move = useCallback(
    (id, center) => {
      if (room) setItems((prev) => moveMetricItem(prev, room, id, center));
    },
    [room],
  );
  const issues = useMemo(
    () => (room ? metricIssues(items, room, doorOpen) : []),
    [room, items, doorOpen],
  );
  const current = items.find((f) => f.id === selected);
  function rotate() {
    const next = items.map((f) =>
      f.id === selected ? { ...f, rot: (f.rot + 90) % 360 } : f,
    );
    if (validMetricItems(next, room)) {
      setItems(next);
      setNotice("家具已旋转 90°，二维与三维共用同一位置。");
    } else setNotice("旋转后会超出房间轮廓，请先将家具移到空处。");
  }
  function reset() {
    setItems(room.furniture.map((f) => ({ ...f })));
    setSelected(null);
    setCanSave(true);
    setNotice("已恢复 JSON 中的初始家具位置。");
  }
  function download() {
    const content = JSON.stringify(exportMetricRoom(room, items), null, 2),
      url = URL.createObjectURL(
        new Blob([content], { type: "application/json" }),
      );
    const a = document.createElement("a");
    a.href = url;
    a.download = "L02-卧室估算尺寸方案.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (error)
    return (
      <main className="experience-main">
        <BackLink navigate={navigate} />
        <p role="alert">{error}</p>
      </main>
    );
  if (!room)
    return (
      <main className="experience-main experience-loading">
        <LoaderCircle className="spin" />
        正在读取卧室估算尺寸…
      </main>
    );
  const dim = room.source.DIMENSIONS,
    door = room.doors[0],
    win = room.windows[0],
    mm = (n) => Math.round(n * 1000);
  return (
    <main
      className="experience-main metric-bedroom-page"
      data-room-preset="L02-metric"
    >
      <BackLink navigate={navigate} />
      <div className="experience-heading">
        <div>
          <span className="page-kicker">预设案例 01 · L02 动静分区</span>
          <h1>
            刚毕业，<span>也要住得像自己。</span>
          </h1>
          <p>
            {items.length
              ? "以估算房间为起点，在平面和三维视图中试试自己的布置。"
              : "查看空房间的平面与三维视图，核对房间和门窗尺寸。"}
          </p>
        </div>
        <span className="data-label">尺寸为图片估算 · 非实测</span>
      </div>
      <div className="metric-case-actions">
        <a
          href="/bedroom?mode=reference"
          onClick={(e) => {
            e.preventDefault();
            navigate("/bedroom?mode=reference");
          }}
        >
          查看六种视频参考布局 <ArrowRight size={14} />
        </a>
        <div>
          <a
            href="/parse"
            onClick={(e) => {
              e.preventDefault();
              navigate("/parse");
            }}
          >
            平面图如何变成 3D <ArrowRight size={14} />
          </a>
          <button onClick={reset}>
            <RotateCcw size={14} />
            恢复初始布局
          </button>
          <button onClick={download}>
            <Download size={14} />
            导出尺寸方案
          </button>
        </div>
      </div>
      <div className="metric-workbench">
        <section className="metric-viewport-panel">
          <div className="metric-toolbar">
            <div className="metric-view-tabs">
              <button
                aria-pressed={view === "2d"}
                onClick={() => setView("2d")}
              >
                <LayoutGrid size={15} />
                2D 平面图
              </button>
              <button
                aria-pressed={view === "3d"}
                onClick={() => setView("3d")}
              >
                <Box size={15} />
                3D 房间
              </button>
            </div>
            <span>
              {room.width.toFixed(1)} × {room.depth.toFixed(1)} m · 约{" "}
              {room.area.toFixed(1)} ㎡
            </span>
          </div>
          <div className="metric-viewport">
            {view === "2d" ? (
              <MetricPlan
                room={room}
                items={items}
                selected={selected}
                onSelect={setSelected}
                onMove={move}
                doorOpen={doorOpen}
              />
            ) : (
              <MetricScene
                room={room}
                items={items}
                selected={selected}
                onSelect={setSelected}
                onMove={move}
                doorOpen={doorOpen}
                transparentFront={transparentFront}
                cameraMode={cameraMode}
              />
            )}
          </div>
          <div className="metric-view-options">
            <label>
              <input
                type="checkbox"
                checked={doorOpen}
                onChange={(e) => setDoorOpen(e.target.checked)}
              />
              开门示意
            </label>
            {view === "3d" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={transparentFront}
                    onChange={(e) => setTransparentFront(e.target.checked)}
                  />
                  前墙透明
                </label>
                <button
                  aria-pressed={cameraMode === "iso"}
                  onClick={() => setCameraMode("iso")}
                >
                  鸟瞰
                </button>
                <button
                  aria-pressed={cameraMode === "top"}
                  onClick={() => setCameraMode("top")}
                >
                  俯视
                </button>
              </>
            )}
            <span>
              {items.length === 0
                ? view === "2d"
                  ? "空房间 · 保留墙体与门窗"
                  : "拖动空白旋转视角 · 滚轮缩放"
                : view === "2d"
                  ? "拖动家具调整位置"
                  : "拖动家具移动 · 拖动空白旋转视角 · 滚轮缩放"}
            </span>
          </div>
        </section>
        <aside className="metric-properties">
          <h2>房间与开口</h2>
          <dl className="metric-dimensions">
            <div>
              <dt>净尺寸外接框</dt>
              <dd>
                {mm(room.width)} × {mm(room.depth)} mm
              </dd>
            </div>
            <div>
              <dt>左上缺口</dt>
              <dd>
                {dim.upper_left_notch_width_mm} ×{" "}
                {dim.upper_left_notch_depth_mm} mm
              </dd>
            </div>
            <div>
              <dt>净使用面积</dt>
              <dd>{room.area.toFixed(2)} ㎡</dd>
            </div>
            <div>
              <dt>墙厚 / 墙高（假设）</dt>
              <dd>
                {dim.wall_thickness_mm} / {mm(room.height)} mm
              </dd>
            </div>
            <div>
              <dt>左上门 · 宽 × 高</dt>
              <dd>
                {mm(door.width)} × {mm(door.height)} mm
              </dd>
            </div>
            <div>
              <dt>下侧窗 · 宽 × 高</dt>
              <dd>
                {mm(win.rect[2] - win.rect[0])} × {mm(win.height)} mm
              </dd>
            </div>
            <div>
              <dt>窗台高 / 距左墙</dt>
              <dd>
                {mm(win.sill)} / {mm(win.rect[0])} mm
              </dd>
            </div>
          </dl>
          <h2>{items.length ? "家具位置" : "空房间"}</h2>
          <div className="metric-furniture-list">
            {items.map((f) => (
              <button
                key={f.id}
                data-furniture-select={f.id}
                aria-pressed={selected === f.id}
                onClick={() => setSelected(f.id)}
              >
                <span>{shortName(f)}</span>
                <small>
                  {Math.round(f.w * 1000)} × {Math.round(f.d * 1000)} mm
                </small>
              </button>
            ))}
          </div>
          {current ? (
            <div className="metric-selection">
              <h3>{shortName(current)} · 中心位置</h3>
              <div>
                {["cx", "cy"].map((key, i) => (
                  <label key={key}>
                    {i === 0 ? "横向 X" : "纵向 Y"}
                    <span>
                      <input
                        aria-label={`家具中心${i === 0 ? "X" : "Y"}毫米`}
                        type="number"
                        step="10"
                        min="0"
                        max={Math.round(
                          (i === 0 ? room.width : room.depth) * 1000,
                        )}
                        value={Math.round(current[key] * 1000)}
                        onChange={(e) => {
                          const center = [current.cx, current.cy];
                          center[i] = Number(e.target.value) / 1000;
                          move(current.id, center);
                        }}
                      />
                      mm
                    </span>
                  </label>
                ))}
              </div>
              <button onClick={rotate}>
                <RotateCw size={13} />
                旋转 90° <small>当前 {current.rot}°</small>
              </button>
            </div>
          ) : (
            <p className="metric-selection-hint">
              {items.length
                ? "选择家具查看毫米坐标；二维与三维同步。"
                : "当前 JSON 不含家具，仅保留房间、墙体和门窗。"}
            </p>
          )}
        </aside>
      </div>
      {issues.length > 0 && (
        <p className="metric-collision-note" role="status">
          {issues.join("；")}。此提示只检查简化占地与开门范围。
        </p>
      )}
      {notice && (
        <p className="experience-feedback" role="status">
          {notice}
        </p>
      )}
      <Note>
        <Info size={15} />
        所有尺寸均来自概念图估算；门窗高度、窗台、墙厚和墙高是建模假设，不作为施工或家具定制依据。前墙透明仅用于观察，墙体仍按完整高度生成。调整自动保存在当前浏览器，独立于原六方案工作台。
      </Note>
    </main>
  );
}
