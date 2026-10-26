import React from "react";
import {
  Home,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";
export function SiteHeader({ navigate, onAbout }) {
  return (
    <header className="site-header">
      <a
        className="site-brand"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        <span>
          <Home size={24} strokeWidth={1.7} />
        </span>
        <strong>
          家有新解<small>让生活，住进空间。</small>
        </strong>
      </a>
      <nav aria-label="首页导航">
        <a
          href="/#scenarios"
          onClick={(e) => {
            e.preventDefault();
            navigate("/#scenarios");
          }}
        >
          生活场景
        </a>
        <a
          href="/#how-it-works"
          onClick={(e) => {
            e.preventDefault();
            navigate("/#how-it-works");
          }}
        >
          如何开始
        </a>
        <button onClick={onAbout}>关于 Demo</button>
      </nav>
      <a
        className="entry-button small"
        href="/#scenarios"
        onClick={(e) => {
          e.preventDefault();
          navigate("/#scenarios");
        }}
      >
        开始体验
        <ArrowUpRight size={15} />
      </a>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        家有新解<span>给空间一个新解，给生活多一种可能。</span>
      </span>
      <small>黑客松 Demo · 方案与价格含演示数据</small>
    </footer>
  );
}
export function BackLink({ navigate, label = "返回场景选择" }) {
  return (
    <a
      className="experience-back"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate("/");
      }}
    >
      <ArrowLeft size={15} />
      {label}
    </a>
  );
}
export function Note({ children }) {
  return <p className="experience-note">{children}</p>;
}
export function AboutModal({ onClose }) {
  return (
    <div className="entry-modal-backdrop" onClick={onClose}>
      <section
        className="entry-modal"
        role="dialog"
        aria-modal="true"
        aria-label="关于演示"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="entry-close"
          onClick={onClose}
          aria-label="关闭演示说明"
        >
          <X size={20} />
        </button>
        <span className="entry-eyebrow">
          <Sparkles size={14} />
          关于这个 Demo
        </span>
        <h2>从真实生活出发，探索空间的新解。</h2>
        <p>
          家有新解是一款 AI
          家具选品与空间布局助手，目标是把房间条件、审美偏好和活动需求，变成可比较的布置方案。
        </p>
        <ul>
          <li>
            <b>合租卧室：</b>
            用已提取的六种视频布局演示需求匹配与编辑；家具规格和选品价格为示例。
          </li>
          <li>
            <b>朋友聚会：</b>用独立示例户型展示 4 人游戏、4 人麻将和 2
            位孩子的同时活动；尺寸与通路为演示假设。
          </li>
          <li>
            <b>自定义房间：</b>在本机选择图片并整理需求；当前未连接任意户型的 AI
            解析和生成服务，不预先展示结果。
          </li>
        </ul>
        <p className="entry-smallprint">
          原有 P04/P03
          客餐厅模型仍可从三维工作台的案例菜单进入。文件不会因本地上传操作被发送到外部服务。
        </p>
        <button className="entry-button" onClick={onClose}>
          了解，开始探索
          <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
