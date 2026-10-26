import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import SourceDeck from "./SourceDeck.jsx";
import MetricScene from "./MetricScene.jsx";
import { adaptMetricRoom } from "./metric-room.js";
import {
  PARSE_SOURCES,
  PARSE_STEPS,
  initialParseState,
  parseReducer,
  parsingRoomData,
  modelChecks,
} from "./parsing-demo.js";
import { REVEAL_DURATION, revealFrame, smooth } from "./parsing-animation.js";
import {
  useSourceImage,
  AnimatedPlan,
  CalibrationView,
} from "./ParsingVisuals.jsx";
import { displayMM } from "./room-calibration.js";
import "./parsing-workbench.css";
import "./room-reveal.css";
const EMPTY_ITEMS = [],
  noop = () => {};
function RouteLink({ to, navigate, children, ...props }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          !e.altKey &&
          e.button === 0
        ) {
          e.preventDefault();
          navigate(to);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
export default function ParsingWorkbench({ navigate, embedded = false, onRoomChange }) {
  const [base, setBase] = useState(null),
    [loadError, setLoadError] = useState("");
  const [state, dispatch] = useReducer(parseReducer, initialParseState),
    zone = useRef(null),
    visual = useRef(null),
    progressBar = useRef(null),
    clock = useRef(0),
    construction = useRef(0);
  const [doorOpen, setDoorOpen] = useState(true),
    [front, setFront] = useState(true),
    [camera, setCamera] = useState("iso"),
    [modelCheck, setModelCheck] = useState(null);
  const source = PARSE_SOURCES.find((s) => s.id === state.sourceId),
    image = useSourceImage(source);
  useEffect(() => {
    let live = true;
    fetch("/assets/room-L02.json")
      .then((r) => {
        if (!r.ok) throw Error("房间资料读取失败");
        return r.json();
      })
      .then((d) => {
        adaptMetricRoom(d);
        if (live) setBase(d);
      })
      .catch((e) => {
        if (live) setLoadError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const data = useMemo(
    () => (base && source ? parsingRoomData(base, source) : null),
    [base, source],
  );
  const room = useMemo(() => (data ? adaptMetricRoom(data) : null), [data]);
  const sourceAreas = useMemo(
    () => base ? Object.fromEntries(PARSE_SOURCES.map(s => [
      s.id, parsingRoomData(base, s).DIMENSIONS.net_floor_area_m2,
    ])) : {},
    [base],
  );
  const calibration = data?.parse_demo.calibration;
  const checks = modelCheck && room ? modelChecks(modelCheck, room) : [];
  const ready = image.id === source?.id && !image.error;
  useEffect(() => {
    onRoomChange?.(state.completed && ready && room ? { source, room } : null);
  }, [state.completed, ready, room, source, onRoomChange]);
  const paint = useCallback((elapsed) => {
    const f = revealFrame(elapsed);
    clock.current = f.elapsed;
    construction.current = f.growth;
    if (visual.current) {
      const el = visual.current;
      el.style.setProperty("--outline", f.outline);
      el.style.setProperty("--door", f.door);
      el.style.setProperty("--window", f.window);
      el.style.setProperty("--dimensions", f.dimensions);
      el.style.setProperty("--calibration", f.calibration);
      const calibrationOpacity =
        f.step === 0 ? 1 : f.step === 1 ? 1 - smooth(f.local / 0.25) : 0;
      el.style.setProperty("--calibration-opacity", calibrationOpacity);
      el.style.setProperty("--image-opacity", f.imageOpacity);
      el.style.setProperty(
        "--wall-plan",
        f.step < 2 ? 0 : f.step === 2 ? smooth(f.local) : 1,
      );
      el.style.setProperty(
        "--plan-opacity",
        (1 - calibrationOpacity) * (1 - smooth(f.growth / 0.27)),
      );
      el.style.setProperty(
        "--scene-opacity",
        f.step < 3 ? 0 : smooth(f.growth / 0.2),
      );
      el.dataset.revealOutline = f.outline.toFixed(3);
      el.dataset.calibrationProgress = f.calibration.toFixed(3);
      el.dataset.revealGrowth = f.growth.toFixed(3);
      el.dataset.elapsed = String(Math.round(f.elapsed));
    }
    if (progressBar.current)
      progressBar.current.style.width = `${f.overall * 100}%`;
    return f;
  }, []);
  useEffect(() => {
    if (!source || !ready) return;
    paint(state.elapsed);
    if (!state.playing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(REVEAL_DURATION);
      dispatch({ type: "tick", elapsed: REVEAL_DURATION });
      return;
    }
    let frame,
      last = performance.now(),
      lastUI = last,
      lastStep = state.step;
    const run = (now) => {
      const dt = document.hidden ? 0 : Math.min(100, Math.max(0, now - last));
      last = now;
      const f = paint(clock.current + dt);
      if (now - lastUI > 140 || f.step !== lastStep || f.complete) {
        lastUI = now;
        lastStep = f.step;
        dispatch({ type: "tick", elapsed: f.elapsed });
      }
      if (!f.complete) frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [state.sourceId, state.playing, state.run, ready, paint]);
  const modelReady = useCallback((summary) => setModelCheck(summary), []);
  function select(id) {
    if (!base) return;
    clock.current = 0;
    construction.current = 0;
    setModelCheck(null);
    setCamera("iso");
    setDoorOpen(true);
    dispatch({ type: "drop", id });
    if (matchMedia("(max-width: 700px)").matches)
      requestAnimationFrame(() =>
        zone.current?.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        }),
      );
  }
  function action(a) {
    if (a.type === "pause") a.elapsed = clock.current;
    dispatch(a);
  }
  const step = PARSE_STEPS[state.step];
  return (
    <div className={`parsing-workbench${embedded ? " parsing-embedded" : ""}`}>
      {!embedded && <header className="parsing-header">
        <RouteLink to="/" navigate={navigate} className="parsing-back">
          <ArrowLeft size={15} /> 家有新解
        </RouteLink>
        <span>空间解析实验室</span>
        <RouteLink to="/custom" navigate={navigate}>
          自定义场景 <ArrowRight size={14} />
        </RouteLink>
      </header>}
      <div className="parsing-main">
        {!embedded && <div className="parsing-intro">
          <div>
            <span className="parsing-eyebrow">
              <ScanLine size={14} /> 从一张图，到一个空间
            </span>
            <h1>让平面，慢慢立起来。</h1>
            <p>先定尺寸，再描轮廓、解析门窗，让空房间缓缓立起来。</p>
          </div>
          <span className="parsing-demo-badge">
            平面图示例回放 <span>默认房高 2.8m · 尺寸估算</span>
          </span>
        </div>}
        {loadError ? (
          <p role="alert" className="parsing-error">
            {loadError}。请重新运行素材同步后刷新。
          </p>
        ) : !base ? (
          <p role="status">正在读取空房资料…</p>
        ) : (
          <div className="parsing-layout">
            <SourceDeck zone={zone} onDrop={select} activeId={state.sourceId} areaById={sourceAreas} />
            <section
              className={`parsing-output ${source ? "has-source" : ""}`}
              ref={zone}
              aria-label="解析区"
              data-step={source ? state.step : "empty"}
              data-completed={state.completed}
            >
              {!source ? (
                <div className="parsing-empty">
                  <div className="parsing-empty-icon">
                    <ScanLine size={34} strokeWidth={1} />
                    <span>+</span>
                  </div>
                  <h2>把房间放在这里</h2>
                  <p>
                    展开左侧卡片，拖入或点击放入。
                    <br />
                    从一条轮廓线开始，看见房间的生成。
                  </p>
                  <div className="parsing-empty-path">
                    <span>尺寸定标</span>
                    <ArrowRight size={14} />
                    <span>轮廓与门窗</span>
                    <ArrowRight size={14} />
                    <span>3D 空房</span>
                  </div>
                  <small>默认房高 2.8m · 三种卧室户型</small>
                </div>
              ) : (
                <>
                  <div className="parsing-output-top">
                    <span>
                      <span className="parsing-dot" />
                      {source.name}
                    </span>
                    <button
                      onClick={() => {
                        construction.current = 0;
                        clock.current = 0;
                        dispatch({ type: "reset" });
                        setModelCheck(null);
                      }}
                    >
                      移出资料 <ArrowLeft size={13} />
                    </button>
                  </div>
                  <ol className="parsing-stepper" aria-label="解析步骤">
                    {PARSE_STEPS.map((s, i) => (
                      <li key={s.name}>
                        <button
                          disabled={i > state.reached}
                          onClick={() => action({ type: "seek", step: i })}
                          aria-current={i === state.step ? "step" : undefined}
                        >
                          <span>
                            {i < state.step || state.completed ? (
                              <Check size={12} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          <small>{s.name}</small>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <div
                    className="parsing-stage-heading"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <div>
                      <span className="parsing-kind">
                        {state.step === 3
                          ? "本机生成"
                          : state.step === 0
                            ? "示例标注 · 实时定标"
                            : "示例回放"}
                      </span>
                      <h2>
                        {state.completed ? "空房间，已准备好。" : step.name}
                      </h2>
                    </div>
                    <span>{String(state.step + 1).padStart(2, "0")} / 04</span>
                  </div>
                  <p className="parsing-stage-detail">
                    {state.completed
                      ? "房间、门窗与尺寸已经对应。拖动旋转，从不同角度看看。"
                      : state.step === 0 && calibration.estimated
                        ? "未发现尺寸标注，以门洞宽 900mm 假设估算比例尺，并用于后续房间尺寸。"
                        : step.detail}
                  </p>
                  {image.id === source.id && image.error ? (
                    <p role="alert" className="parsing-error">
                      {image.error}
                      <button onClick={() => location.reload()}>
                        重新读取
                      </button>
                    </p>
                  ) : !ready ? (
                    <p role="status" className="parsing-processing">
                      正在读取示例图片…
                    </p>
                  ) : (
                    <>
                      <div
                        className="parsing-stage-art parsing-sequence"
                        ref={visual}
                        key={source.id}
                      >
                        <div
                          className="reveal-calibration-layer"
                          aria-hidden={state.step !== 0}
                        >
                          <CalibrationView
                            source={source}
                            calibration={calibration}
                          />
                        </div>
                        <div className="reveal-plan-layer">
                          <AnimatedPlan source={source} data={data} />
                        </div>
                        <div
                          className="reveal-scene-layer"
                          style={{
                            pointerEvents: state.completed ? "auto" : "none",
                          }}
                          aria-hidden={state.step !== 3}
                        >
                          <MetricScene
                            room={room}
                            items={EMPTY_ITEMS}
                            selected={null}
                            onSelect={noop}
                            onMove={noop}
                            doorOpen={doorOpen}
                            transparentFront={front}
                            cameraMode={camera}
                            onReady={modelReady}
                            constructionProgress={construction}
                          />
                        </div>
                        <span className="reveal-canvas-note">
                          {source.assumedFrontWall
                            ? "前墙位置为原图假设 · 默认房高2.8m"
                            : state.step === 3
                              ? "默认房高 2.8m"
                              : state.step === 0
                                ? "示例标注定位 · 比例尺单位 mm/px"
                                : calibration.estimated
                                  ? "以门洞900mm估算 · 单位 mm"
                                  : "示例尺寸 · 单位 mm"}
                        </span>
                      </div>
                      <div
                        className="reveal-summary"
                        style={{
                          visibility: state.step >= 1 ? "visible" : "hidden",
                        }}
                      >
                        <span>
                          <i className="parsing-dot" />
                          {calibration.estimated ? "约 " : ""}
                          {displayMM(
                            data.DIMENSIONS.clear_bbox_width_mm,
                            calibration.estimated,
                          )}{" "}
                          ×{" "}
                          {displayMM(
                            data.DIMENSIONS.clear_bbox_depth_mm,
                            calibration.estimated,
                          )}{" "}
                          mm
                        </span>
                        <span>约 {room.area.toFixed(1)} ㎡</span>
                        <span>房高 2.8m · 默认</span>
                      </div>
                      {state.completed && (
                        <div className="parsing-art-controls">
                          <label>
                            <input
                              type="checkbox"
                              checked={doorOpen}
                              onChange={(e) => setDoorOpen(e.target.checked)}
                            />
                            开门
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={front}
                              onChange={(e) => setFront(e.target.checked)}
                            />
                            前墙透明
                          </label>
                          <button
                            aria-pressed={camera === "iso"}
                            onClick={() => setCamera("iso")}
                          >
                            <Box size={13} />
                            鸟瞰
                          </button>
                          <button
                            aria-pressed={camera === "top"}
                            onClick={() => setCamera("top")}
                          >
                            <Maximize2 size={13} />
                            俯视
                          </button>
                          {!embedded && <RouteLink to="/custom" navigate={navigate}>
                            自定义场景 <ArrowRight size={13} />
                          </RouteLink>}
                        </div>
                      )}
                      <div className="reveal-status" aria-live="polite">
                        {state.completed ? (
                          <>
                            <Check size={13} />
                            {checks.length && checks.every((c) => c.ok)
                              ? "轮廓与门窗已对应 · 空房生成完成"
                              : "空房间已生成"}
                          </>
                        ) : (
                          <>
                            <span
                              className={`reveal-breath ${state.playing ? "is-playing" : ""}`}
                            />
                            {state.playing
                              ? "正在生成，随时可以暂停回看"
                              : "已暂停，继续后从这里接着生成"}
                          </>
                        )}
                      </div>
                    </>
                  )}
                  <div className="parsing-playback">
                    <button
                      disabled={state.step === 0}
                      onClick={() => action({ type: "previous" })}
                    >
                      <ArrowLeft size={14} />
                      上一步
                    </button>
                    {state.completed ? (
                      <button onClick={() => action({ type: "replay" })}>
                        <RotateCcw size={14} />
                        重新播放
                      </button>
                    ) : (
                      <button
                        disabled={!ready}
                        onClick={() =>
                          action({ type: state.playing ? "pause" : "play" })
                        }
                      >
                        {state.playing ? (
                          <Pause size={14} />
                        ) : (
                          <Play size={14} />
                        )}{" "}
                        {state.playing ? "暂停" : "继续"}
                      </button>
                    )}
                    <button
                      disabled={!ready || state.step === PARSE_STEPS.length - 1}
                      onClick={() => action({ type: "next" })}
                    >
                      下一步 <ArrowRight size={14} />
                    </button>
                  </div>
                  <div
                    className="parsing-progress"
                    role="progressbar"
                    aria-label="解析进度"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={Math.round(
                      (state.elapsed / REVEAL_DURATION) * 100,
                    )}
                  >
                    <span ref={progressBar} />
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        <p className="parsing-disclosure">
          标注位置、轮廓和门窗使用已校对示例回放，比例尺与三维几何在本机计算。无标注时以门洞宽900mm估算；房高默认2.8m，竖向尺寸沿用案例假设。
        </p>
      </div>
    </div>
  );
}
