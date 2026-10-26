import {imageAsset} from './image-assets.js';
import React, { useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Grip, Layers } from "lucide-react";
import { PARSE_SOURCES, dropOverlap } from "./parsing-demo.js";
import {
  clamp,
  mix,
  springStep,
  deckRank,
  deckPose,
  swipeDirection,
} from "./deck-motion.js";
import "./source-deck.css";

const KEYS = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "scale",
  "opacity",
  "open",
  "lift",
];
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));

export default function SourceDeck({ zone, onDrop, activeId, areaById = {}, sources = PARSE_SOURCES, variant = "plan" }) {
  const reference = variant === "reference";
  const titleId = reference ? "reference-source-title" : "parsing-source-title";
  const deckId = reference ? "reference-source-deck" : "parsing-source-deck";
  const [expanded, setExpanded] = useState(false),
    [top, setTop] = useState(0),
    [busy, setBusy] = useState(false),
    [announcement, setAnnouncement] = useState("");
  const deck = useRef(null),
    cards = useRef([]),
    controller = useRef(null),
    latest = useRef({ onDrop });
  latest.current = { onDrop };
  useLayoutEffect(() => {
    const node = deck.current,
      reduce = matchMedia("(prefers-reduced-motion: reduce)"),
      coarse = matchMedia("(pointer: coarse)");
    let width = node.clientWidth,
      openGoal = expanded,
      topIndex = top,
      models = sources.map((_, i) => ({
        p: pose(expanded, deckRank(i, top, sources.length)),
        v: zero(),
        delay: 0,
      })),
      height = expanded ? expandedHeight() : collapsedHeight(),
      heightV = 0;
    let frame = 0,
      last = 0,
      drag = null,
      flight = null,
      disposed = false,
      over = false,
      suppressUntil = 0;
    function rank(i) {
      return deckRank(i, topIndex, sources.length);
    }
    function pose(open, rank) {
      return deckPose(width, open, rank, coarse.matches, reference);
    }
    function collapsedHeight() {
      return reference ? pose(false, 0).height + 92 : 370;
    }
    function expandedHeight() {
      const last = pose(true, sources.length - 1);
      return last.y + last.height;
    }
    function clearOver() {
      over = false;
      zone.current?.classList.remove("is-drag-over");
    }
    function draw(i) {
      const el = cards.current[i],
        p = models[i].p;
      if (!el) return;
      el.style.transform = `translate3d(${p.x}px,${p.y}px,0) rotate(${p.rotation}deg) scale(${p.scale})`;
      el.style.width = `${p.width}px`;
      el.style.height = `${p.height}px`;
      el.style.setProperty("--card-width", `${p.width}px`);
      el.style.setProperty("--card-height", `${p.height}px`);
      el.style.opacity = p.opacity;
      el.style.setProperty("--card-open", clamp(p.open, 0, 1));
      // Only the top card's copy stays visible while the cards overlap.
      el.style.setProperty("--card-copy-opacity", rank(i) === 0 ? 1 : clamp((p.open - 0.55) / 0.45, 0, 1));
      el.style.setProperty("--card-lift", clamp(p.lift, 0, 1));
      el.style.zIndex =
        drag?.i === i || flight?.i === i ? "50" : String(10 - rank(i));
      el.style.visibility = "visible";
    }
    function wake() {
      if (!frame && !disposed) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    function changeTop() {
      topIndex = (topIndex + 1) % models.length;
      setTop(topIndex);
      node.dataset.topCard = sources[topIndex].id;
    }
    function finishFlight() {
      const f = flight;
      flight = null;
      setBusy(false);
      node.dataset.gesture = "idle";
      if (f.type === "swipe") changeTop();
      const m = models[f.i];
      m.p = {
        ...pose(openGoal, rank(f.i)),
        opacity: 0,
      };
      m.v = zero();
      cards.current[f.i].dataset.motionPhase = "returning";
      if (f.type === "drop") {
        setAnnouncement(`${sources[f.i].name}已放入解析区`);
        latest.current.onDrop(sources[f.i].id);
      } else setAnnouncement(`已翻到${sources[topIndex].name}`);
    }
    function tick(now) {
      frame = 0;
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let moving = !!drag || !!flight;
      [height, heightV] = reduce.matches
        ? [openGoal ? expandedHeight() : collapsedHeight(), 0]
        : springStep(
            height,
            heightV,
            openGoal ? expandedHeight() : collapsedHeight(),
            dt,
            360,
            34,
          );
      node.style.height = `${height}px`;
      moving ||= Math.abs(heightV) > 0.01;
      models.forEach((m, i) => {
        const held = drag?.i === i && drag.moved,
          flying = flight?.i === i;
        const target = flying
          ? flight.target
          : pose(openGoal, rank(i));
        if (!held && now >= m.delay) {
          for (const k of KEYS) {
            [m.p[k], m.v[k]] = reduce.matches
              ? [target[k], 0]
              : springStep(
                  m.p[k],
                  m.v[k],
                  target[k],
                  dt,
                  k === "rotation" ? 290 : 390,
                  k === "rotation" ? 27 : 32,
                );
            moving ||=
              Math.abs(m.p[k] - target[k]) > 0.001 || Math.abs(m.v[k]) > 0.01;
          }
        } else if (now < m.delay) moving = true;
        draw(i);
      });
      if (flight) {
        const m = models[flight.i],
          distance = Math.hypot(
            m.p.x - flight.target.x,
            m.p.y - flight.target.y,
          );
        if (
          reduce.matches ||
          (distance < 3 && now - flight.start > 200) ||
          now - flight.start > 850
        ) {
          finishFlight();
          moving = true;
        }
      }
      node.dataset.animating = String(moving);
      if (!moving) node.dataset.gesture = "idle";
      if (moving) frame = requestAnimationFrame(tick);
    }
    function toggle() {
      if (flight || drag) return;
      openGoal = !openGoal;
      setExpanded(openGoal);
      node.dataset.gesture = "layout";
      models.forEach((m, i) => {
        m.delay =
          performance.now() +
          (reduce.matches ? 0 : (openGoal ? rank(i) : sources.length - 1 - rank(i)) * 28);
      });
      wake();
    }
    function fly(i, type, direction = 1) {
      const p = models[i].p,
        b = node.getBoundingClientRect(),
        z = zone.current?.getBoundingClientRect();
      if (type === "drop" && !z) return;
      const target =
        type === "drop"
          ? {
              ...p,
              x: z.left + z.width / 2 - p.width / 2 - b.left,
              y: z.top + Math.min(z.height * 0.35, 220) - p.height / 2 - b.top,
              rotation: 0,
              scale: 0.72,
              opacity: 0,
              lift: 1,
            }
          : {
              ...p,
              x: p.x + direction * (width + 100),
              y: p.y - 15,
              rotation: p.rotation + direction * 22,
              opacity: 0,
              scale: 0.9,
            };
      flight = { i, type, target, start: performance.now() };
      setBusy(true);
      node.dataset.gesture = type === "drop" ? "absorbing" : "cycling";
      cards.current[i].dataset.motionPhase = "flying";
      wake();
    }
    function pick(i) {
      if (flight || drag) return;
      fly(i, "drop");
    }
    function down(e, i) {
      if (
        flight ||
        drag ||
        e.button !== 0 ||
        e.target.closest("button") ||
        (!openGoal && rank(i) !== 0)
      )
        return;
      const m = models[i];
      drag = {
        i,
        pointer: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        base: { ...m.p },
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: e.timeStamp,
        vx: 0,
        vy: 0,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.pointer) return;
      const d = drag,
        dx = e.clientX - d.startX,
        dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      if (!d.moved) {
        d.moved = true;
        cards.current[d.i].dataset.motionPhase = "held";
        node.dataset.gesture = "dragging";
      }
      const elapsed = Math.max(8, e.timeStamp - d.lastTime) / 1000;
      d.vx = mix(d.vx, (e.clientX - d.lastX) / elapsed, 0.5);
      d.vy = mix(d.vy, (e.clientY - d.lastY) / elapsed, 0.5);
      d.lastTime = e.timeStamp;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      const p = models[d.i].p;
      p.x = d.base.x + dx;
      p.y = d.base.y + dy;
      p.rotation = d.base.rotation + clamp(dx * 0.045, -14, 14);
      p.scale = 1.045;
      p.lift = 1;
      models[d.i].v = zero();
      draw(d.i);
      const b = cards.current[d.i].getBoundingClientRect(),
        z = zone.current?.getBoundingClientRect();
      const hit =
        !!z &&
        e.clientX >= z.left &&
        e.clientX <= z.right &&
        e.clientY >= z.top &&
        e.clientY <= z.bottom &&
        dropOverlap(b, z);
      if (hit !== over) {
        over = hit;
        zone.current?.classList.toggle("is-drag-over", hit);
      }
      wake();
    }
    function end(e, cancel = false) {
      if (!drag || e.pointerId !== drag.pointer) return;
      const d = drag;
      drag = null;
      cards.current[d.i].dataset.motionPhase = "returning";
      node.dataset.gesture = "idle";
      const z = zone.current?.getBoundingClientRect(),
        hit =
          !cancel &&
          d.moved &&
          z &&
          d.lastX >= z.left &&
          d.lastX <= z.right &&
          d.lastY >= z.top &&
          d.lastY <= z.bottom &&
          dropOverlap(cards.current[d.i].getBoundingClientRect(), z);
      clearOver();
      if (d.moved) {
        suppressUntil = performance.now() + 400;
        const dx = d.lastX - d.startX,
          dy = d.lastY - d.startY,
          vx = e.timeStamp - d.lastTime > 90 ? 0 : d.vx;
        if (hit) fly(d.i, "drop");
        else {
          const direction =
            !cancel && !openGoal ? swipeDirection(dx, dy, vx, width) : 0;
          if (direction) fly(d.i, "swipe", direction);
          else {
            models[d.i].v.x = clamp(d.vx * 0.2, -600, 600);
            models[d.i].v.y = clamp(d.vy * 0.2, -600, 600);
            wake();
          }
        }
      }
      try {
        cards.current[d.i].releasePointerCapture(d.pointer);
      } catch {}
    }
    function click(e) {
      if (performance.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!openGoal && !e.target.closest("button")) toggle();
    }
    function escape(e) {
      if (e.key === "Escape" && drag)
        end({ pointerId: drag.pointer, timeStamp: performance.now() }, true);
    }
    const observer = new ResizeObserver(() => {
      width = node.clientWidth;
      wake();
    });
    observer.observe(node);
    const reducedChange = () => wake();
    reduce.addEventListener("change", reducedChange);
    coarse.addEventListener("change", reducedChange);
    window.addEventListener("keydown", escape);
    controller.current = { toggle, pick, down, move, end, click };
    setBusy(false);
    node.style.height = `${height}px`;
    node.dataset.topCard = sources[topIndex].id;
    node.dataset.gesture = "idle";
    models.forEach((_, i) => draw(i));
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduce.removeEventListener("change", reducedChange);
      coarse.removeEventListener("change", reducedChange);
      window.removeEventListener("keydown", escape);
      clearOver();
      controller.current = null;
    };
  }, [zone, sources, reference]);
  return (
    <section className="parsing-sources" aria-labelledby={titleId}>
      <div className="parsing-section-label">
        <span>
          <Layers size={15} /> 输入资料
        </span>
        <small>{reference ? "六张空间参考图" : "三张房产平面图"}</small>
      </div>
      <h2 id={titleId}>{reference ? "从一份灵感开始。" : "从一张图开始。"}</h2>
      <p className="parsing-muted">
        {reference ? "六种风格。选一张，拖入右侧，读懂你喜欢的空间。" : "三张图，三种空间。选一张，看看房间如何被读懂。"}
      </p>
      <button
        className="parsing-deck-toggle"
        aria-expanded={expanded}
        aria-controls={deckId}
        disabled={busy}
        onClick={() => controller.current?.toggle()}
      >
        <span>{expanded ? "收起卡片" : "展开资料卡片"}</span>
        <ChevronDown size={15} />
      </button>
      <div
        id={deckId}
        ref={deck}
        className={`parsing-deck parsing-spring-deck ${expanded ? "is-expanded" : ""}`}
      >
        {sources.map((s, i) => (
          <article
            key={s.id}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className={`parsing-source-card ${activeId === s.id ? "is-selected" : ""}`}
            data-source-card={s.id}
            aria-label={`${s.name}资料卡片`}
            tabIndex={!expanded && i === top ? 0 : -1}
            onPointerDown={(e) => controller.current?.down(e, i)}
            onPointerMove={(e) => controller.current?.move(e)}
            onPointerUp={(e) => controller.current?.end(e)}
            onPointerCancel={(e) => controller.current?.end(e, true)}
            onLostPointerCapture={(e) => controller.current?.end(e, true)}
            onClick={(e) => controller.current?.click(e)}
            onKeyDown={(e) => {
              if (
                e.target === e.currentTarget &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                controller.current?.toggle();
              }
            }}
          >
            <div className="parsing-sheet-picture">
              <img
                src={imageAsset(s.image,{thumbnail:true})}
                alt={`${s.name}，${s.caption}`}
                draggable="false"
              />
            </div>
            <Grip className="parsing-sheet-grip" size={15} />
            <div className="parsing-sheet-copy" aria-hidden={!expanded && i !== top}>
              <strong className="parsing-sheet-title">{s.name}</strong>
              <span className="parsing-sheet-caption">
                {s.caption}
                {Number.isFinite(areaById[s.id]) && (
                  <span className="parsing-sheet-area">净面积约 {areaById[s.id].toFixed(2)} ㎡</span>
                )}
              </span>
            </div>
            <button
              className="parsing-sheet-send"
              disabled={!expanded || busy}
              onClick={() => controller.current?.pick(i)}
              aria-label={`放入解析区：${s.name}`}
            >
              放入解析区 <ArrowRight size={13} />
            </button>
          </article>
        ))}
      </div>
      <p className="parsing-drag-hint">
        <Grip size={13} />
        {expanded
          ? "拖入解析区，松手即可开始"
          : "点击展开 · 拖动顶层卡片，左右翻阅"}
      </p>
      <div className="parsing-source-note">
        <span className="parsing-dot" />{" "}
        {reference ? "使用提供的六张原图，选择后可查看大图并进行解析。" : "轮廓与尺寸使用已校对示例，三维空房在本机生成。"}
      </div>
      <span className="parsing-sr-only" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
