import {imageAsset} from './image-assets.js';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Home,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Armchair,
  Image as ImageIcon,
  Box,
  Layers,
  MousePointer2,
  Move,
  RotateCw,
  Ruler,
  Undo2,
  Redo2,
  Save,
  Download,
  Upload,
  Plus,
  Minus,
  Maximize,
  Grid2X2,
  PanelLeftClose,
  PanelRightClose,
  Sun,
  Check,
  CheckCheck,
  Info,
  X,
  Trash2,
  Copy,
  Eye,
  Expand,
  CheckCircle2,
  ArrowUpRight,
  SlidersHorizontal,
  HelpCircle,
  Leaf,
  CheckSquare,
  Square,
  LoaderCircle,
  Search,
  Camera,
  BookOpen,
  FolderOpen,
} from "lucide-react";
import Plan, { MiniPlan } from "./Plan.jsx";
import Scene from "./Scene.jsx";
import { STYLES, styleItems } from "./bedroom-brief.js";
import {
  clone,
  shiftItem,
  resizeItem,
  inspect,
  validateImport,
  LIBRARY,
  newItem,
  PALETTE,
} from "./model.js";
const STORAGE = "jyxj.studio.v1";
const SHARE_MODE = import.meta.env.VITE_SHARE_MODE === "1";
const SHORT = [
  "居中双侧床头柜",
  "隔断划分睡眠区",
  "临窗横向布床",
  "拐角纵向布床",
  "独立床后衣帽间",
  "床后转角工作区",
];
function Button({
  icon: Icon,
  children,
  active = false,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button ${active ? "active " : ""}${className}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      <Icon size={17} />
    </button>
  );
}
function download(content, name, type = "application/json") {
  const url =
    typeof content === "string" && content.startsWith("data:")
      ? content
      : URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 500);
}
export default function App({
  onHome,
  onBrief,
  initialLayout = null,
  preferences = null,
}) {
  const [data, setData] = useState(null),
    [livingData, setLivingData] = useState([]),
    [loadError, setLoadError] = useState("");
  const [activeId, setActiveId] = useState(initialLayout || "L04"),
    [caseId, setCaseId] = useState("bedroom"),
    [livingId, setLivingId] = useState("P04-R01"),
    [plans, setPlans] = useState({});
  const [tab, setTab] = useState("layouts"),
    [viewMode, setViewMode] = useState("3d"),
    [camera, setCamera] = useState("iso"),
    [viewTick, setViewTick] = useState(0),
    [selected, setSelected] = useState(null);
  const [past, setPast] = useState([]),
    [future, setFuture] = useState([]),
    [saved, setSaved] = useState(true),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [search, setSearch] = useState("");
  const [floor, setFloor] = useState("light"),
    [walls, setWalls] = useState(true),
    [grid, setGrid] = useState(true),
    [snap, setSnap] = useState(true),
    [dimensions, setDimensions] = useState(true),
    [light, setLight] = useState(80),
    [zoom, setZoom] = useState(1),
    [measurement, setMeasurement] = useState(null),
    [leftOpen, setLeftOpen] = useState(() => innerWidth >= 700),
    [rightOpen, setRightOpen] = useState(() => innerWidth >= 1050),
    [showIssues, setShowIssues] = useState(false);
  const scene = useRef(null),
    file = useRef(null),
    toastTimer = useRef(null),
    restored = useRef(false);
  const notify = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  useEffect(() => {
    const resize = () => {
      if (innerWidth < 1050) setRightOpen(false);
      if (innerWidth < 700) setLeftOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    Promise.all([
      fetch("/assets/bedroom.json").then((r) => {
        if (!r.ok) throw Error("未找到卧室素材，请运行 npm run assets");
        return r.json();
      }),
      fetch("/assets/living.json").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([d, l]) => {
        setData(d);
        setLivingData(l);
        try {
          const raw = JSON.parse(localStorage.getItem(STORAGE) || "null");
          if (raw?.version === 1) {
            const safe = {};
            for (const [id, items] of Object.entries(raw.plans || {})) {
              const p = validateImport({
                schema: "jyxj.studio-plan.v1",
                layoutId: id,
                items,
              });
              safe[id] = p.items;
            }
            setPlans(safe);
            if (!initialLayout && d.layouts.some((x) => x.id === raw.activeId))
              setActiveId(raw.activeId);
            if (["light", "warm", "grey"].includes(raw.floor))
              setFloor(raw.floor);
          }
        } catch {
          notify("本地旧方案格式不兼容，已载入视频参考布局");
        }
        if (preferences && initialLayout) {
          const chosen = d.layouts.find((x) => x.id === initialLayout);
          if (chosen)
            setPlans((p) => ({
              ...p,
              [initialLayout]: styleItems(
                p[initialLayout] || chosen.items,
                preferences.style,
              ),
            }));
          setFloor(
            (STYLES.find((s) => s.id === preferences.style) || STYLES[0]).floor,
          );
        }
        restored.current = true;
      })
      .catch((e) => setLoadError(e.message));
    return () => clearTimeout(toastTimer.current);
  }, [notify]);
  const bedroom = caseId === "bedroom",
    preset = data?.layouts.find((l) => l.id === activeId),
    living = bedroom ? null : livingData.find((l) => l.id === livingId),
    items = plans[activeId] || preset?.items || [];
  const picked = bedroom
    ? items.find((a) => a.id === selected)
    : living?.items.find((a) => a.id === selected);
  const issues = useMemo(
    () => (bedroom ? inspect(items) : []),
    [items, bedroom],
  );
  useEffect(() => {
    if (!data || !restored.current) return;
    setSaved(false);
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE,
          JSON.stringify({ version: 1, plans, activeId, floor }),
        );
        setSaved(true);
      } catch {
        notify("浏览器空间不足，请导出 JSON 保存方案");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [plans, activeId, floor, data, notify]);
  useEffect(() => {
    setSelected(null);
    setPast([]);
    setFuture([]);
    setMeasurement(null);
    setShowIssues(false);
    setCamera("iso");
    setViewTick((n) => n + 1);
  }, [activeId, caseId, livingId]);
  useEffect(() => setWalls(caseId === "bedroom"), [caseId]);
  const setItems = useCallback(
    (fn) =>
      setPlans((p) => ({
        ...p,
        [activeId]:
          typeof fn === "function" ? fn(p[activeId] || preset.items) : fn,
      })),
    [activeId, preset],
  );
  const checkpoint = useCallback(() => {
    if (!bedroom) return;
    setPast((p) => [...p.slice(-39), clone(items)]);
    setFuture([]);
  }, [items, bedroom]);
  const moveItem = useCallback(
    (id, center) =>
      setItems((p) => p.map((a) => (a.id === id ? shiftItem(a, center) : a))),
    [setItems],
  );
  function editItem(patch) {
    if (!picked || !bedroom) return;
    checkpoint();
    setItems((a) => a.map((x) => (x.id === selected ? { ...x, ...patch } : x)));
  }
  function undo() {
    if (!past.length) return;
    setFuture((p) => [clone(items), ...p]);
    setItems(past.at(-1));
    setPast((p) => p.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, clone(items)]);
    setItems(future[0]);
    setFuture((p) => p.slice(1));
  }
  function remove() {
    if (!selected || !bedroom) return;
    checkpoint();
    setItems(items.filter((a) => a.id !== selected));
    setSelected(null);
  }
  function duplicate() {
    if (!picked || !bedroom) return;
    checkpoint();
    const a = shiftItem(
      {
        ...clone(picked),
        id: `${picked.category}_${crypto.randomUUID().slice(0, 8)}`,
      },
      picked.center.map((n) => Math.min(0.9, n + 0.05)),
    );
    setItems([...items, a]);
    setSelected(a.id);
    notify("已复制家具，可拖动调整位置");
  }
  function add(category) {
    const a = newItem(category);
    checkpoint();
    setItems([...items, a]);
    setSelected(a.id);
    notify(`已添加${a.label}`);
  }
  function switchLayout(id) {
    setActiveId(id);
    setModal(null);
  }
  function rotate() {
    if (picked && bedroom)
      editItem({ rotation: ((picked.rotation || 0) + 90) % 360 });
  }
  function fit() {
    setZoom(1);
    setViewTick((t) => t + 1);
  }
  function save() {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          version: 1,
          plans: { ...plans, [activeId]: items },
          activeId,
          floor,
        }),
      );
      setSaved(true);
      notify("方案已保存在此浏览器");
    } catch {
      notify("保存失败，请导出方案 JSON");
    }
  }
  function exportPlan() {
    if (!bedroom) {
      download(
        JSON.stringify(
          {
            schema: "jyxj.existing-case.v1",
            caseId: living.id,
            total_cny: living.total,
            items: living.items,
          },
          null,
          2,
        ),
        `${living.id}-家具报价.json`,
      );
      return;
    }
    download(
      JSON.stringify(
        {
          schema: "jyxj.studio-plan.v1",
          layoutId: activeId,
          title: preset.title,
          coordinateSystem: "relative_uv_not_meters",
          metricScale: null,
          items,
        },
        null,
        2,
      ),
      `家有新解-${activeId}.json`,
    );
    notify("方案已导出为 JSON");
  }
  async function importPlan(event) {
    const f = event.target.files?.[0];
    if (!f) return;
    try {
      if (f.size > 2 * 1024 * 1024) throw Error("方案文件不能超过2MB");
      const p = validateImport(JSON.parse(await f.text()));
      setCaseId("bedroom");
      setActiveId(p.layoutId);
      setPlans((v) => ({ ...v, [p.layoutId]: p.items }));
      setSelected(null);
      notify("方案已导入");
    } catch (e) {
      notify(e.message || "方案文件读取失败");
    }
    event.target.value = "";
  }
  async function capture() {
    if (viewMode === "3d" && scene.current) {
      download(
        scene.current.capture(),
        `家有新解-${bedroom ? activeId : livingId}.png`,
      );
      notify("三维视图已导出");
      return;
    }
    const el = document.querySelector(".plan-canvas");
    if (!el) {
      notify("请切换到三维后导出当前案例图片");
      return;
    }
    const svg = el.cloneNode(true);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "1600");
    svg.setAttribute("height", "1800");
    svg
      .querySelectorAll("text")
      .forEach((t) => t.setAttribute("fill", "#365047"));
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1800;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f2f1eb";
      ctx.fillRect(0, 0, 1600, 1800);
      ctx.drawImage(im, 0, 0, 1600, 1800);
      download(c.toDataURL("image/png"), `家有新解-${activeId}-平面.png`);
      URL.revokeObjectURL(url);
      notify("平面图已导出");
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      notify("图片导出失败，请重试");
    };
    im.src = url;
  }
  useEffect(() => {
    function key(e) {
      if (e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "Escape") {
        setModal(null);
        setMeasurement(null);
        setSelected(null);
      }
      if (modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key.toLowerCase() === "r") rotate();
      else if (e.key.toLowerCase() === "t")
        setViewMode((v) => (v === "3d" ? "2d" : "3d"));
      else if (e.key === "Delete") {
        e.preventDefault();
        remove();
      } else if (e.key.toLowerCase() === "f") fit();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (loadError)
    return (
      <div className="initial-screen">
        <Home size={36} />
        <h2>素材还没有准备好</h2>
        <p>{loadError}</p>
      </div>
    );
  if (!data)
    return (
      <div className="initial-screen">
        <LoaderCircle className="spin" size={30} />
        <p>打开你的空间工作台…</p>
      </div>
    );
  const visibleLibrary = LIBRARY.filter((a) => a.label.includes(search));
  return (
    <div
      className={`studio ${!leftOpen ? "hide-left" : ""} ${!rightOpen ? "hide-right" : ""}`}
    >
      <header className="app-header">
        <a
          className="brand"
          href="/"
          aria-label="返回首页"
          onClick={(e) => {
            e.preventDefault();
            if (onHome) {
              save();
              onHome();
            } else setCaseId("bedroom");
          }}
        >
          <span className="brand-mark">
            <Home size={24} strokeWidth={1.7} />
          </span>
          <strong>
            家有新解<span>SPACE STUDIO</span>
          </strong>
        </a>
        <span className="header-line" />
        <div className="project-name">
          <span>{bedroom ? "我的第一间卧室" : "喜欢的设计，适合新的家"}</span>
          <small>
            <span className={`saved-dot ${saved ? "" : "pending"}`} />
            {saved ? "已保存到本机" : "正在保存"}
          </small>
        </div>
        <div className="case-select">
          <FolderOpen size={15} />
          <select
            aria-label="选择案例"
            value={caseId}
            onChange={(e) => {
              setCaseId(e.target.value);
              setTab("layouts");
              setViewMode("3d");
            }}
          >
            <option value="bedroom">案例一 · 合租卧室</option>
            <option value="living" disabled={!livingData.length}>
              案例二 · 客餐厅迁移
            </option>
          </select>
          <ChevronDown size={13} />
        </div>
        <div className="header-actions">
          {onBrief && (
            <Button icon={SlidersHorizontal} onClick={onBrief}>
              需求设置
            </Button>
          )}
          <Button icon={LayoutGrid} onClick={() => setModal("compare")}>
            方案对比
          </Button>
          <Button icon={Save} onClick={save} disabled={!bedroom}>
            保存
          </Button>
          <Button icon={Download} className="primary" onClick={exportPlan}>
            导出方案
          </Button>
          <div className="avatar" title="本地个人工作台">
            我
          </div>
        </div>
      </header>
      <nav className="rail" aria-label="设计导航">
        <div>
          <button
            className={tab === "layouts" ? "current" : ""}
            title="布局方案"
            onClick={() => {
              setTab("layouts");
              setLeftOpen(true);
            }}
          >
            <LayoutGrid size={22} />
            <span>方案</span>
          </button>
          <button
            className={tab === "library" ? "current" : ""}
            title="家具库"
            onClick={() => {
              setTab("library");
              setLeftOpen(true);
            }}
          >
            <Armchair size={23} />
            <span>家具</span>
          </button>
          <button
            className={tab === "reference" ? "current" : ""}
            title="参考素材"
            onClick={() => {
              setTab("reference");
              setLeftOpen(true);
            }}
          >
            <ImageIcon size={22} />
            <span>参考</span>
          </button>
        </div>
        <div>
          <button title="导入方案" onClick={() => file.current.click()}>
            <Upload size={21} />
            <span>导入</span>
          </button>
          <button title="使用帮助" onClick={() => setModal("help")}>
            <HelpCircle size={22} />
            <span>帮助</span>
          </button>
        </div>
      </nav>
      <aside className="left-panel">
        <div className="panel-title">
          <h2>
            {tab === "layouts"
              ? "布局方案"
              : tab === "library"
                ? "家具与收纳"
                : "灵感与依据"}
          </h2>
          <IconButton
            icon={PanelLeftClose}
            label="收起左侧栏"
            onClick={() => setLeftOpen(false)}
          />
        </div>
        {tab === "layouts" && (
          <>
            <div className="persona">
              <div className="persona-icon">
                <Leaf size={18} />
              </div>
              <div>
                <b>
                  {bedroom
                    ? "一个人的房间，也要好好住"
                    : "把喜欢的生活带到新家"}
                </b>
                <p>
                  {bedroom
                    ? preferences
                      ? `${(STYLES.find((s) => s.id === preferences.style) || STYLES[0]).name} · 预算 ¥${preferences.budget.toLocaleString("zh-CN")}`
                      : "毕业第一站 · 合租卧室改造"
                    : "已有场景 · 家具组团与报价"}
                </p>
              </div>
            </div>
            <div className="list-heading">
              <span>{bedroom ? "为小拐角找到新解" : "已完成的客餐厅方案"}</span>
              <small>
                {bedroom ? "6 个参考方案" : `${livingData.length} 个案例`}
              </small>
            </div>
            {bedroom ? (
              <div className="layout-list">
                {data.layouts.map((l, i) => (
                  <button
                    className={`layout-card ${activeId === l.id ? "chosen" : ""}`}
                    key={l.id}
                    data-layout={l.id}
                    onClick={() => switchLayout(l.id)}
                  >
                    <div className="layout-thumb">
                      <MiniPlan
                        items={plans[l.id] || l.items}
                        selected={activeId === l.id}
                      />
                      <span className="layout-no">0{i + 1}</span>
                      {activeId === l.id && (
                        <span className="chosen-check">
                          <Check size={11} />
                        </span>
                      )}
                    </div>
                    <strong>{SHORT[i]}</strong>
                    <span>{(plans[l.id] || l.items).length} 项布置</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="existing-layouts">
                {livingData.map((l) => (
                  <button
                    key={l.id}
                    className={livingId === l.id ? "chosen" : ""}
                    onClick={() => setLivingId(l.id)}
                  >
                    <img src={imageAsset(l.image,{thumbnail:true})} alt={l.name} />
                    <b>
                      {l.id} · {l.name}
                    </b>
                    <span>17 项报价 · ¥{l.total.toLocaleString("zh-CN")}</span>
                  </button>
                ))}
              </div>
            )}
            {bedroom && (
              <div className="source-note">
                <Info size={15} />
                <p>
                  六种布局来自同一参考视频。家具位置为视觉提取，可在画布中继续调整。
                </p>
              </div>
            )}
            <div className="panel-bottom">
              <Button
                icon={Plus}
                className="wide"
                onClick={() => {
                  if (bedroom) {
                    checkpoint();
                    setItems(clone(preset.items));
                    notify("已恢复此方案的参考布局，可撤销");
                  } else setViewTick((t) => t + 1);
                }}
              >
                {bedroom ? "恢复参考布局" : "适应场景"}
              </Button>
            </div>
          </>
        )}
        {tab === "library" && (
          <>
            <div className="search-box">
              <Search size={15} />
              <input
                placeholder="搜索家具"
                aria-label="搜索家具"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="library-heading">
              卧室基础家具 <span>点击添加到房间</span>
            </div>
            {bedroom ? (
              <div className="furniture-library">
                {visibleLibrary.map((l) => (
                  <button key={l.category} onClick={() => add(l.category)}>
                    <MiniPlan
                      items={[
                        {
                          ...newItem(l.category),
                          center: [0.5, 0.5],
                          bounds: [0.25, 0.25, 0.75, 0.75],
                          polygon: [
                            [0.25, 0.25],
                            [0.75, 0.25],
                            [0.75, 0.75],
                            [0.25, 0.75],
                          ],
                        },
                      ]}
                    />
                    <b>{l.label}</b>
                    <span>
                      <Plus size={12} /> 添加
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-note">
                <Armchair size={32} />
                <p>客餐厅展示已生成家具。</p>
                <p>{SHARE_MODE ? "分享包保留场景浏览；客餐厅重算使用完整项目的原工作流。" : "如需调整布局，请打开原工作流。"}</p>
                {!SHARE_MODE&&<a
                  href={
                    livingId === "P04-R01"
                      ? "http://127.0.0.1:8879/"
                      : "http://127.0.0.1:8880/"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  打开设计流程 <ArrowUpRight size={13} />
                </a>}
              </div>
            )}{" "}
            {!visibleLibrary.length && (
              <p className="empty-note">没有找到对应家具</p>
            )}
            <p className="subtle-note">
              新增家具使用可编辑示意模型，尚未选择商品。
            </p>
          </>
        )}
        {tab === "reference" && (
          <>
            <div className="reference-card">
              <img
                src={imageAsset(bedroom ? preset.image : living?.image)}
                alt="当前方案参考画面"
              />
              <span className="reference-tag">
                {bedroom ? "视频原帧裁图" : "已完成场景渲染"}
              </span>
            </div>
            <div className="reference-info">
              <h3>{bedroom ? preset.title : living?.name}</h3>
              <p>
                {bedroom
                  ? `参考视频 ${preset.time.toFixed(3)} 秒 · 第 ${preset.frame} 帧`
                  : "复用已生成的本地模型与材质"}
              </p>
              <Button icon={Expand} onClick={() => setModal("reference")}>
                放大查看
              </Button>
              <div className="info-block">
                <Info size={16} />
                <p>
                  {bedroom
                    ? "原图是实体模型的俯拍画面。高柜顶部存在视差，位置尚未标定真实尺寸。"
                    : "原案例保留商品来源与套装报价，价格沿用演示记录。"}
                </p>
              </div>
            </div>
          </>
        )}
      </aside>
      <main className="workspace">
        <div className="workspace-toolbar">
          <div className="tool-cluster">
            {!leftOpen && (
              <IconButton
                icon={LayoutGrid}
                label="展开左侧栏"
                onClick={() => setLeftOpen(true)}
              />
            )}
            <Button
              icon={MousePointer2}
              active={!measurement}
              onClick={() => setMeasurement(null)}
            >
              选择
            </Button>
            <IconButton
              icon={RotateCw}
              label="旋转选中家具 (R)"
              disabled={!picked || !bedroom}
              onClick={rotate}
            />
            <Button
              icon={Ruler}
              active={!!measurement}
              disabled={!bedroom}
              onClick={() => {
                setViewMode("2d");
                setMeasurement((m) => (m ? null : { points: [] }));
                notify("在平面图上点击两个点，查看相对距离");
              }}
            >
              测量
            </Button>
            <span className="tool-divider" />
            <IconButton
              icon={Undo2}
              label="撤销 (Ctrl+Z)"
              onClick={undo}
              disabled={!past.length || !bedroom}
            />
            <IconButton
              icon={Redo2}
              label="重做 (Ctrl+Shift+Z)"
              onClick={redo}
              disabled={!future.length || !bedroom}
            />
          </div>
          <div className="view-switch" role="group" aria-label="视图模式">
            <button
              className={viewMode === "2d" ? "active" : ""}
              onClick={() => setViewMode("2d")}
            >
              2D 平面
            </button>
            <button
              className={viewMode === "3d" ? "active" : ""}
              onClick={() => {
                setViewMode("3d");
                setMeasurement(null);
              }}
            >
              <Box size={14} />
              3D 空间
            </button>
          </div>
          <div className="tool-cluster toolbar-end">
            <IconButton
              icon={Camera}
              label="导出当前视图 PNG"
              onClick={capture}
            />
            <IconButton icon={Maximize} label="适应画布 (F)" onClick={fit} />
            <IconButton
              icon={PanelRightClose}
              label={rightOpen ? "收起属性面板" : "展开属性面板"}
              onClick={() => setRightOpen((v) => !v)}
            />
          </div>
        </div>
        <section className="canvas-area">
          <div className="canvas-topline">
            <div>
              <span className="project-crumb">
                {bedroom ? "我的卧室" : "客餐厅迁移"}
                <ChevronRight size={12} />
                {bedroom ? `方案 ${activeId.slice(-2)}` : livingId}
              </span>
              <h1>
                {bedroom
                  ? SHORT[data.layouts.findIndex((x) => x.id === activeId)]
                  : living?.name}
              </h1>
            </div>
            <span className="canvas-badge">
              <span />
              {bedroom ? "参考布局 · 可编辑" : "本地完整场景"}
            </span>
          </div>
          <div className="viewport" data-view={viewMode}>
            {viewMode === "3d" ? (
              <Scene
                items={items}
                selected={selected}
                onSelect={setSelected}
                onMove={moveItem}
                onCommit={checkpoint}
                onReady={(api) => (scene.current = api)}
                living={living}
                floor={floor}
                walls={walls}
                grid={grid}
                snap={snap}
                light={light}
                view={camera}
                viewTick={viewTick}
              />
            ) : bedroom ? (
              <Plan
                items={items}
                selected={selected}
                onSelect={setSelected}
                onMove={moveItem}
                onCommit={checkpoint}
                zoom={zoom}
                grid={grid}
                snap={snap}
                dimensions={dimensions}
                measurement={measurement}
                onMeasure={(p) =>
                  setMeasurement((m) => ({
                    points: m.points.length === 2 ? [p] : [...m.points, p],
                  }))
                }
              />
            ) : (
              <div className="existing-plan">
                <img src={imageAsset(living?.plan)} alt="客餐厅方案平面图" />
              </div>
            )}
          </div>
          <div className="compass">
            <span className="compass-arrow">↑</span>
            <span>画面上方</span>
          </div>
          <div className="canvas-side-tools">
            <IconButton
              icon={Plus}
              label="放大"
              onClick={() =>
                viewMode === "3d"
                  ? scene.current?.zoom(0.85)
                  : setZoom((v) => Math.min(2, v + 0.15))
              }
            />
            <IconButton
              icon={Minus}
              label="缩小"
              onClick={() =>
                viewMode === "3d"
                  ? scene.current?.zoom(1.15)
                  : setZoom((v) => Math.max(0.55, v - 0.15))
              }
            />
            <span />
            <IconButton icon={Maximize} label="复位视角" onClick={fit} />
          </div>
          <div className="view-dock">
            {viewMode === "3d" ? (
              <>
                <button
                  className={camera === "iso" ? "selected" : ""}
                  onClick={() => setCamera("iso")}
                >
                  <Box size={15} />
                  鸟瞰
                </button>
                <button
                  className={camera === "top" ? "selected" : ""}
                  onClick={() => setCamera("top")}
                >
                  <LayoutGrid size={15} />
                  俯视
                </button>
                <button
                  className={camera === "living" ? "selected" : ""}
                  onClick={() => setCamera("living")}
                >
                  <Eye size={15} />
                  近景
                </button>
                <span />
                <button
                  className={walls ? "selected-lite" : ""}
                  onClick={() => setWalls((v) => !v)}
                >
                  <Layers size={15} />
                  {walls ? "显示墙体" : "隐藏墙体"}
                </button>
              </>
            ) : (
              <>
                <button
                  className={grid ? "selected-lite" : ""}
                  onClick={() => setGrid((v) => !v)}
                >
                  <Grid2X2 size={15} />
                  网格
                </button>
                <button
                  className={dimensions ? "selected-lite" : ""}
                  onClick={() => setDimensions((v) => !v)}
                >
                  <Ruler size={15} />
                  相对尺寸
                </button>
                <button
                  className={snap ? "selected-lite" : ""}
                  onClick={() => setSnap((v) => !v)}
                >
                  <CheckSquare size={15} />
                  吸附
                </button>
              </>
            )}
          </div>
          <div className="viewport-hint">
            {measurement
              ? "点击两点测量 · 长度以房宽百分比表示"
              : bedroom
                ? viewMode === "3d"
                  ? "拖动空白旋转 · 滚轮缩放 · 拖动家具调整位置"
                  : "拖动家具调整位置 · R 旋转 · Delete 移除"
                : "拖动旋转 · 滚轮缩放 · 点击家具查看商品"}
          </div>
        </section>
        <footer className="workspace-footer">
          <div>
            <span className="status-dot" />
            {bedroom ? "相对坐标 · 尺寸待确认" : "源案例 · 已有模型"}
            <span className="footer-sep">|</span>
            {bedroom
              ? `${items.length} 项家具与构件`
              : `${living?.items.length || 0} 项报价`}
          </div>
          <button onClick={() => setModal("reference")}>
            <ImageIcon size={13} />
            参考原图
            <ArrowUpRight size={12} />
          </button>
        </footer>
      </main>
      <aside className="right-panel">
        <div className="panel-title">
          <h2>{picked ? "家具属性" : "空间设置"}</h2>
          {picked ? (
            <IconButton
              icon={X}
              label="取消选择"
              onClick={() => setSelected(null)}
            />
          ) : (
            <SlidersHorizontal size={17} />
          )}
        </div>
        {picked ? (
          <>
            <div className="selected-heading">
              <span className="furniture-symbol">
                <Armchair size={25} />
              </span>
              <div>
                <b>{picked.label.replace("（按桌椅形态识别）", "")}</b>
                <span>{bedroom ? "示意家具 · 相对尺寸" : picked.price}</span>
              </div>
              <span className="selection-dot" />
            </div>
            {bedroom ? (
              <>
                <section className="property-section">
                  <h3>
                    位置 <span>% 房间范围</span>
                  </h3>
                  <div className="field-pair">
                    {["X · 左右", "Y · 上下"].map((label, i) => (
                      <label key={label}>
                        {label}
                        <div>
                          <input
                            aria-label={label}
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={+(picked.center[i] * 100).toFixed(1)}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n) || n < 0 || n > 100)
                                return;
                              checkpoint();
                              moveItem(
                                selected,
                                picked.center.map((x, j) =>
                                  j === i ? n / 100 : x,
                                ),
                              );
                            }}
                          />
                          <span>%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="field-pair">
                    {["宽度", "深度"].map((label, i) => (
                      <label key={label}>
                        {label}
                        <div>
                          <input
                            aria-label={label}
                            type="number"
                            min="3"
                            max="100"
                            step="1"
                            value={
                              +(
                                (picked.bounds[i + 2] - picked.bounds[i]) *
                                100
                              ).toFixed(1)
                            }
                            onChange={(e) => {
                              const n = Number(e.target.value) / 100;
                              if (n < 0.03 || n > 1) return;
                              checkpoint();
                              setItems(
                                items.map((a) =>
                                  a.id === selected
                                    ? resizeItem(
                                        a,
                                        i === 0 ? n : a.bounds[2] - a.bounds[0],
                                        i === 1 ? n : a.bounds[3] - a.bounds[1],
                                      )
                                    : a,
                                ),
                              );
                            }}
                          />
                          <span>%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <label className="rotation-field">
                    旋转角度
                    <div>
                      <input
                        type="number"
                        aria-label="旋转角度"
                        min="0"
                        max="359"
                        value={picked.rotation || 0}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 0 && n < 360)
                            editItem({ rotation: n });
                        }}
                      />
                      <span>°</span>
                      <IconButton
                        icon={RotateCw}
                        label="旋转90度"
                        onClick={rotate}
                      />
                    </div>
                  </label>
                </section>
                <section className="property-section">
                  <h3>家具配色</h3>
                  <div className="color-swatches">
                    {[
                      "#bf8a6f",
                      "#d8c4a7",
                      "#819caa",
                      "#91aa92",
                      "#e5dfd2",
                      "#646f68",
                    ].map((c) => (
                      <button
                        key={c}
                        style={{ background: c }}
                        aria-label={`配色${c}`}
                        className={
                          (picked.color || PALETTE[picked.category]) === c
                            ? "chosen"
                            : ""
                        }
                        onClick={() => editItem({ color: c })}
                      >
                        {(picked.color || PALETTE[picked.category]) === c && (
                          <Check size={15} />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="property-section item-description">
                  <h3>布置依据</h3>
                  <p>{picked.description}</p>
                  <p>{picked.orientation || "朝向尚未判断"}</p>
                  {picked.notes && <small>{picked.notes}</small>}
                </section>
                <div className="item-actions">
                  <Button icon={Copy} onClick={duplicate}>
                    复制
                  </Button>
                  <Button icon={Trash2} className="danger" onClick={remove}>
                    移除
                  </Button>
                </div>
              </>
            ) : (
              <section className="property-section">
                <h3>商品信息</h3>
                <p>
                  {picked.size?.map((n) => Math.round(n * 100)).join(" × ")} cm
                </p>
                <p>{picked.notes}</p>
                {picked.products?.map((p, i) => (
                  <a
                    className="product-link"
                    key={i}
                    href={p.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.name || p.sku}
                    <ArrowUpRight size={12} />
                  </a>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            <div className="room-info">
              <div className="room-icon">
                <Home size={28} strokeWidth={1.5} />
              </div>
              <h3>{bedroom ? "小拐角，也有大可能" : "一个灵感，两种新家"}</h3>
              <p>
                {bedroom
                  ? "为休息、工作与收纳留出各自的位置。"
                  : "保留家具与材质，适配新的客餐厅。"}
              </p>
              <div className="room-stats">
                <div>
                  <b>{bedroom ? "6" : livingData.length}</b>
                  <span>{bedroom ? "参考方案" : "已完成户型"}</span>
                </div>
                <div>
                  <b>{bedroom ? items.length : "17"}</b>
                  <span>{bedroom ? "当前构件" : "家具与地毯"}</span>
                </div>
              </div>
            </div>
            <section className="property-section">
              <h3>
                地面材质 <span>{bedroom ? "示意效果" : "原场景材质"}</span>
              </h3>
              <div className="material-options">
                {[
                  ["light", "原木", "light"],
                  ["warm", "暖橡木", "warm"],
                  ["grey", "浅灰", "grey"],
                ].map(([id, label, cls]) => (
                  <button
                    key={id}
                    disabled={!bedroom}
                    onClick={() => setFloor(id)}
                    className={floor === id ? "chosen" : ""}
                  >
                    <span className={`material-swatch ${cls}`}>
                      {floor === id && <Check size={12} />}
                    </span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="property-section">
              <h3>
                自然光 <Sun size={15} />
              </h3>
              <div className="light-control">
                <Sun size={14} />
                <input
                  type="range"
                  min="10"
                  max="100"
                  aria-label="自然光强度"
                  value={light}
                  onChange={(e) => setLight(Number(e.target.value))}
                />
                <span>{light}%</span>
              </div>
            </section>
            <section className="property-section">
              <h3>图层显示</h3>
              <button className="layer-row" onClick={() => setWalls((v) => !v)}>
                <Layers size={14} />
                <span>房间墙体</span>
                <span className={`toggle ${walls ? "on" : ""}`} />
              </button>
              <button className="layer-row" onClick={() => setGrid((v) => !v)}>
                <Grid2X2 size={14} />
                <span>参考网格</span>
                <span className={`toggle ${grid ? "on" : ""}`} />
              </button>
            </section>
          </>
        )}
        <section className="property-section object-list">
          <h3>
            当前家具{" "}
            <span>{bedroom ? items.length : living?.items.length} 项</span>
          </h3>
          {(bedroom ? items : living?.items || []).map((a) => (
            <button
              key={a.id}
              className={selected === a.id ? "selected" : ""}
              onClick={() => setSelected(a.id)}
            >
              <span
                className="object-color"
                style={{
                  background: a.color || PALETTE[a.category] || "#b9b6a8",
                }}
              />
              <span>{a.label.replace("（按桌椅形态识别）", "")}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </section>
        <div className="check-card">
          <div>
            <span className="check-icon">
              <CheckCheck size={18} />
            </span>
            <b>{bedroom ? "布置检查" : "参考预算"}</b>
            {bedroom ? (
              <button onClick={() => setShowIssues((v) => !v)}>
                {showIssues ? "收起" : "查看"}
              </button>
            ) : (
              <b className="budget">¥{living?.total.toLocaleString("zh-CN")}</b>
            )}
          </div>
          <p>
            {bedroom
              ? issues.length
                ? `${issues.length} 处占地关系待核对`
                : "未发现明显越界或占地重叠"
              : "17 项家具与地毯 · 沿用演示价格"}
          </p>
          {showIssues && (
            <ul>
              {issues.length ? (
                issues.map((x, i) => (
                  <li key={i}>
                    <button onClick={() => setSelected(x.ids[0])}>
                      {x.message}
                    </button>
                  </li>
                ))
              ) : (
                <li>检查仅覆盖相对轮廓，不代表通路或施工验收。</li>
              )}
            </ul>
          )}
          <small>
            {bedroom
              ? "基于估计轮廓，真实尺寸仍需确认。"
              : "未含配送、安装及装修工程。"}
          </small>
        </div>
      </aside>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={importPlan}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal === "reference" ? "reference-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "compare"
                ? "方案对比"
                : modal === "help"
                  ? "使用帮助"
                  : "参考原图"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">家有新解 · SPACE STUDIO</span>
                <h2>
                  {modal === "compare"
                    ? "六种布置，哪一种更像你？"
                    : modal === "help"
                      ? "从一个喜欢的布局开始"
                      : bedroom
                        ? preset.title
                        : living?.name}
                </h2>
              </div>
              <IconButton
                icon={X}
                label="关闭弹窗"
                onClick={() => setModal(null)}
              />
            </header>
            {modal === "compare" ? (
              <>
                <p className="modal-intro">
                  同一间小拐角卧室，给睡眠、工作和收纳不同的答案。选择一个方案继续调整。
                </p>
                <div className="compare-grid">
                  {data.layouts.map((l, i) => (
                    <button
                      key={l.id}
                      data-compare={l.id}
                      onClick={() => {
                        setCaseId("bedroom");
                        switchLayout(l.id);
                      }}
                    >
                      <MiniPlan
                        items={plans[l.id] || l.items}
                        selected={activeId === l.id}
                      />
                      <b>
                        0{i + 1} · {SHORT[i]}
                      </b>
                      <span>{l.title}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : modal === "help" ? (
              <div className="help-content">
                <p>
                  选择左侧参考方案，拖动家具或修改右侧属性，调整成你的房间。
                </p>
                <dl>
                  <dt>T</dt>
                  <dd>切换平面 / 三维</dd>
                  <dt>R</dt>
                  <dd>选中家具旋转 90°</dd>
                  <dt>Delete</dt>
                  <dd>移除选中家具</dd>
                  <dt>Ctrl + D</dt>
                  <dd>复制选中家具</dd>
                  <dt>Ctrl + Z</dt>
                  <dd>撤销；加 Shift 重做</dd>
                  <dt>Ctrl + S</dt>
                  <dd>保存到此浏览器</dd>
                  <dt>F</dt>
                  <dd>复位视角</dd>
                </dl>
                <p>
                  方案自动保存在当前浏览器。导出 JSON
                  可备份或在另一台电脑导入；相机按钮可导出 PNG。
                </p>
                <div className="info-block">
                  <Info size={18} />
                  <p>
                    卧室视频尚未标定尺寸，当前使用房间相对坐标和示意模型。酷家乐界面未能接入当前浏览器会话；本页没有读取或修改你的酷家乐设计。
                  </p>
                </div>
                <a
                  href="https://github.com/wy51ai/floorplan-3d"
                  target="_blank"
                  rel="noreferrer"
                >
                  界面布局参考：floorplan-3d <ArrowUpRight size={13} />
                </a>
              </div>
            ) : (
              <>
                <img
                  className="large-reference"
                  src={imageAsset(bedroom ? preset.image : living?.image)}
                  alt="参考原图"
                />
                <p className="modal-intro">
                  {bedroom
                    ? `原视频 ${preset.time.toFixed(3)} 秒，第 ${preset.frame} 帧。家具位置来自此画面及相邻帧人工核对；视频未提供真实尺寸。`
                    : "既有完整场景渲染，模型与材质沿用本地原案例。"}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
