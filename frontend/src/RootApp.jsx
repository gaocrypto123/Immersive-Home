import React, { lazy, Suspense, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import HomePage from "./HomePage.jsx";
import BedroomPage from "./BedroomPage.jsx";
import PartyPage from "./PartyPage.jsx";
import CustomPage from "./CustomPage.jsx";
import { SiteHeader, SiteFooter, AboutModal } from "./ExperienceShell.jsx";
import { DEFAULT_BRIEF, STYLES } from "./bedroom-brief.js";
import "./landing.css";
import "./home-design.css";
const Studio = lazy(() => import("./App.jsx"));
const MetricBedroomPage = lazy(() => import("./MetricBedroomPage.jsx"));
export default function RootApp() {
  const [locationKey, setLocationKey] = useState(
      () => location.pathname + location.search + location.hash,
    ),
    [about, setAbout] = useState(false),
    [brief, setBrief] = useState(() => {
      try {
        const value = JSON.parse(sessionStorage.getItem("jyxj.brief.v1"));
        if (
          value &&
          STYLES.some((s) => s.id === value.style) &&
          Number.isFinite(value.budget) &&
          value.budget >= 1500 &&
          value.budget <= 6000
        )
          return { ...DEFAULT_BRIEF, ...value };
      } catch {}
      return DEFAULT_BRIEF;
    });
  function navigate(url) {
    history.pushState({}, "", url);
    setLocationKey(location.pathname + location.search + location.hash);
    setAbout(false);
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const pop = () => {
      setLocationKey(location.pathname + location.search + location.hash);
      setAbout(false);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("jyxj.brief.v1", JSON.stringify(brief));
    } catch {}
  }, [brief]);
  const path = locationKey.split(/[?#]/)[0];
  useEffect(() => {
    document.title =
      path === "/"
        ? "家有新解 · 布局有巧思，生活有新解。"
        : path === "/party"
          ? "朋友来了，客厅换个玩法 · 家有新解"
          : path === "/custom" || path === "/parse"
            ? "你的房间，你来出题 · 家有新解"
            : path === "/bedroom"
              ? "刚毕业，也要住得像自己 · 家有新解"
              : "家有新解 · 空间设计工作台";
    if (path === "/" && location.hash) {
      const t = setTimeout(
        () =>
          document
            .getElementById(location.hash.slice(1))
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        30,
      );
      return () => clearTimeout(t);
    }
  }, [path, locationKey]);
  useEffect(() => {
    if (!about) return;
    const key = (e) => {
      if (e.key === "Escape") setAbout(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [about]);
  // Keep old /parse bookmarks usable inside the new three-step experience.
  if (path === "/custom" || path === "/parse") {
    return <CustomPage navigate={navigate} />;
  }
  if (path === "/studio") {
    const requested = new URLSearchParams(location.search).get("layout");
    const initial = /^L0[1-6]$/.test(requested || "") ? requested : null;
    return (
      <Suspense
        fallback={
          <div className="initial-screen">
            <LoaderCircle className="spin" />
            <p>正在打开三维设计工作台…</p>
          </div>
        }
      >
        <Studio
          onHome={() => navigate("/")}
          onBrief={() => navigate("/bedroom")}
          initialLayout={initial}
          preferences={initial ? brief : null}
        />
      </Suspense>
    );
  }
  return (
    <div className={`site-shell${path === "/" ? " home-shell" : ""}`}>
      {path !== "/" && (
        <SiteHeader navigate={navigate} onAbout={() => setAbout(true)} />
      )}
      {path === "/bedroom" &&
      new URLSearchParams(location.search).get("mode") !== "reference" ? (
        <Suspense
          fallback={
            <div className="initial-screen">
              <LoaderCircle className="spin" />
              <p>正在读取卧室估算尺寸…</p>
            </div>
          }
        >
          <MetricBedroomPage navigate={navigate} />
        </Suspense>
      ) : path === "/bedroom" ? (
        <BedroomPage
          navigate={navigate}
          brief={brief}
          onBrief={setBrief}
          onEdit={(id, b) => {
            setBrief({ ...b, layoutId: id });
            navigate(`/studio?layout=${id}`);
          }}
        />
      ) : path === "/party" ? (
        <PartyPage navigate={navigate} />
      ) : path === "/" ? (
        <HomePage navigate={navigate} />
      ) : (
        <main className="experience-main not-found">
          <h1>这个房间，还没有打开。</h1>
          <p>回到首页，选择一个生活场景开始体验。</p>
          <button className="entry-button" onClick={() => navigate("/")}>
            返回首页
          </button>
        </main>
      )}
      {path !== "/" && <SiteFooter />}
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  );
}
