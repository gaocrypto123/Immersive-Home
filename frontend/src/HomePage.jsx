import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import HomeIllustration from "./HomeIllustration.jsx";
import HomeFlow from "./HomeFlow.jsx";

const SCENARIOS = [
  {
    id: "custom",
    title: ["上传户型与灵感，", "探索适合你的布局"],
    description: "给你的家，一个新解",
    button: "开始布置我的家",
    path: "/custom",
  },
];

export default function HomePage({ navigate }) {
  return (
    <main className="home-main">
      <section className="home-hero">
        <div className="home-eyebrow">
          <span className="little-spark">
            <Sparkles size={13} />
          </span>
          AI 家具选品与空间布局助手
        </div>
        <h1>
          家有<span>新解</span>
          <i aria-hidden="true" />
        </h1>
        <p className="hero-tagline">让心仪设计，适配你的家</p>
        <p className="hero-support">布局有巧思，生活有新解。</p>
      </section>
      <HomeFlow />
      <section
        id="scenarios"
        className="scenarios-section"
        aria-label="开始布置你的家"
      >
        <div className="scenario-grid">
          {SCENARIOS.map((s) => (
            <article
              className={`scenario-card scenario-${s.id}`}
              key={s.id}
              data-scenario={s.id}
            >
              <div className="scenario-art" aria-hidden="true">
                <HomeIllustration type={s.id} />
              </div>
              <div className="scenario-content">
                <h2>
                  {s.title.map((phrase) => (
                    <span className="scenario-title-phrase" key={phrase}>
                      {phrase}
                    </span>
                  ))}
                </h2>
                <p className="scenario-description">{s.description}</p>
                <a
                  className="entry-button"
                  href={s.path}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(s.path);
                  }}
                >
                  {s.button}
                  <ArrowRight size={15} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
