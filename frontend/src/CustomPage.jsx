import {imageAsset} from './image-assets.js';
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, X } from "lucide-react";
import FinalLayout from "./FinalLayout.jsx";
import { validateReferenceSelection } from "./reference-input.js";
import { REFERENCE_EXAMPLES } from "./reference-examples.js";
import SourceDeck from "./SourceDeck.jsx";
import "./parsing-workbench.css";
import "./custom-flow.css";
import "./reference-workbench.css";

const ParsingWorkbench = lazy(() => import("./ParsingWorkbench.jsx"));
const ReferencePipeline = lazy(() => import("./ReferencePipeline.jsx"));
const REFERENCE_SOURCES = REFERENCE_EXAMPLES.map((example, index) => ({
  id: example.id,
  name: `参考图 ${String(index + 1).padStart(2, "0")}`,
  caption: example.style,
  image: example.sourceImage,
}));

export default function CustomPage({ navigate }) {
  const [parsedRoom, setParsedRoom] = useState(null);
  const [referenceResult,setReferenceResult]=useState(null);
  const [activeReference, setActiveReference] = useState(null);
  const [referenceRun, setReferenceRun] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);
  const referenceZone = useRef(null);
  const urls = useRef(new Set());
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  function selectReference(reference) {
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
    if(reference?.url.startsWith('blob:'))urls.current.add(reference.url);
    setActiveReference(reference);
    setReferenceResult(null);
    setReferenceRun(value => value + 1);
  }

  function addReferences(files) {
    setError("");
    if (!files.length) return;
    const problem=validateReferenceSelection(files);
    if(problem){setError(problem);return;}
    selectReference({name:files[0].name,url:URL.createObjectURL(files[0])});
    setNotice('已替换当前参考图，三栏解析同步重新开始。');
  }
  function removeReference() {
    selectReference(null);
    setError("");
    setNotice("参考图已移除。");
  }
  function useExample(example) {
    setError("");
    if (matchMedia("(max-width: 700px)").matches) {
      referenceZone.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
    selectReference({
      name: `参考图 ${example.id.slice(1)} · ${example.style}`,
      url: example.sourceImage,
      exampleId: example.id,
    });
    setNotice(`当前参考图：${example.style}。三栏解析同步自动播放。`);
  }
  function home(event) {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate("/");
    }
  }
  return (
    <div className="custom-flow-shell">
      <header className="custom-flow-header">
        <a href="/" onClick={home}><ArrowLeft size={15} /> 家有新解</a>
        <span>自定义场景</span>
      </header>
      <main className="custom-flow-main">
        <ol className="custom-flow-steps" aria-label="自定义场景三个步骤">
          <li data-custom-step="plan">
            <section aria-labelledby="custom-plan-title">
              <header className="custom-step-heading">
                <span className="custom-step-number">01</span>
                <div><h2 id="custom-plan-title">平面图解析</h2><p>先定尺寸，再描轮廓、识别门窗，生成三维空房。</p></div>
                <span className={`custom-step-state ${parsedRoom ? "is-ready" : ""}`}>
                  {parsedRoom ? <><Check size={13} /> 空房就绪</> : "示例解析"}
                </span>
              </header>
              <Suspense fallback={<p className="custom-flow-loading" role="status">正在打开平面图解析…</p>}>
                <ParsingWorkbench navigate={navigate} embedded onRoomChange={setParsedRoom} />
              </Suspense>
            </section>
          </li>
          <li data-custom-step="reference">
            <section aria-labelledby="custom-reference-title">
              <header className="custom-step-heading">
                <span className="custom-step-number">02</span>
                <div><h2 id="custom-reference-title">参考图解析</h2><p>放入喜欢的空间参考图，为家具与风格提供灵感。</p></div>
                <span className="custom-step-state">{activeReference ? "三路解析" : "等待参考图"}</span>
              </header>
              <div className="reference-workbench parsing-workbench">
                <SourceDeck zone={referenceZone} sources={REFERENCE_SOURCES} variant="reference"
                  activeId={activeReference?.exampleId}
                  onDrop={id => useExample(REFERENCE_EXAMPLES.find(example => example.id === id))} />
                <div ref={referenceZone} className="custom-reference-output" role="region" aria-label="参考图解析区">
              <div className={`custom-reference-area ${dragging ? "is-dragging" : ""}`}
                onDragOver={event => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => { event.preventDefault(); setDragging(false); addReferences([...event.dataTransfer.files]); }}>
                <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="上传一张风格参考图"
                  onChange={event => { addReferences([...event.target.files]); event.target.value = ""; }} />
                {!activeReference ? (
                  <button className="custom-reference-empty" onClick={() => input.current.click()}>
                    <ImagePlus size={28} strokeWidth={1.25} />
                    <strong>把灵感放在这里</strong><span>展开左侧卡片，拖入或点击放入。</span><small>也可以点击上传自己的参考图</small>
                    <small>一次一张 · JPG / PNG / WebP · 10MB以内</small>
                  </button>
                ) : (
                  <div className="custom-reference-grid">
                      <figure className="custom-reference-item" key={activeReference.url}>
                        <img src={imageAsset(activeReference.url,{thumbnail:true})} alt={`当前参考图：${activeReference.name}`} />
                        <button className="custom-reference-remove" aria-label="移除当前参考图" onClick={removeReference}><X size={14} /></button>
                        <figcaption title={activeReference.name}>{activeReference.name}</figcaption>
                        <button type="button" className="custom-reference-change" onClick={()=>input.current.click()}>更换参考图</button>
                      </figure>
                  </div>
                )}
              </div>
              {error && <p className="custom-flow-error" role="alert">{error}</p>}
              <p className="custom-flow-notice" role="status">{notice}</p>
              {activeReference && <Suspense fallback={<p className="custom-flow-loading" role="status">正在打开三栏解析…</p>}>
                <ReferencePipeline key={`${activeReference.url}:${referenceRun}`} reference={activeReference} onResultChange={setReferenceResult} />
              </Suspense>}
                </div>
              </div>
            </section>
          </li>
          <li data-custom-step="layout">
            <section aria-labelledby="custom-layout-title">
              <header className="custom-step-heading">
                <span className="custom-step-number">03</span>
                <div><h2 id="custom-layout-title">最终布局生成</h2><p>结合房间条件与参考图，生成适合你的家具布局。</p></div>
                <span className="custom-step-state">{parsedRoom&&referenceResult?'资料已就绪':'等待解析完成'}</span>
              </header>
              <FinalLayout parsedRoom={parsedRoom} referenceResult={referenceResult} activeReference={activeReference}/>
            </section>
          </li>
        </ol>
        <p className="custom-flow-privacy">参考图仅在当前浏览器预览与取色。示例解析使用已保存成果；刷新后需重新选择参考图。</p>
      </main>
    </div>
  );
}
