import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,Cuboid,GitBranch,Palette,RotateCcw} from 'lucide-react';
import {FINAL_LAYOUT,MERGE_DURATION,canGenerateLayout,mergeFlight} from './final-layout-state.js';
import './final-layout.css';
const FinalLayoutViewer=lazy(()=>import('./FinalLayoutViewer.jsx'));
const INPUTS=[{label:'家具布局 Graph',Icon:GitBranch},{label:'家具单品 3D 模型',Icon:Cuboid},{label:'材质',Icon:Palette}];

function EmptyRoomIcon({room,filled}) {
  const outline=room?.outline||[[0,0],[3.6,0],[3.6,3.8],[0,3.8]];
  const projected=outline.map(([x,y])=>[(x-y)*18,(x+y)*9]);
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  const dx=-(Math.min(...xs)+Math.max(...xs))/2,dy=-(Math.min(...ys)+Math.max(...ys))/2;
  const points=projected.map(([x,y])=>[x+dx,y+dy]);
  return <g className="final-room-icon" aria-label="解析得到的空房间容器">
    {points.map((point,i)=>{const next=points[(i+1)%points.length];return <polygon key={i} points={[point,next,[next[0],next[1]-42],[point[0],point[1]-42]].map(p=>p.join(',')).join(' ')} fill="#f6f6ec" fillOpacity=".7" stroke="#9cab90" strokeWidth="1.5"/>;})}
    <polygon points={points.map(p=>p.join(',')).join(' ')} fill={filled?'#d9e5cd':'#e9eddf'} stroke="#68845c" strokeWidth="2"/>
    <path d="M-26-8h23v20h-23z M8-21h24v13H8z M11 4h16v13H11z" fill="#7c986e" opacity={filled?1:0}/>
    <text y="83" textAnchor="middle" fill="#3e6149" fontSize="14">{filled?'布局汇入完成':'空房间'}</text>
  </g>;
}
export default function FinalLayout({parsedRoom,referenceResult,activeReference}) {
  const ready=canGenerateLayout(parsedRoom,referenceResult,activeReference);
  const identity=`${parsedRoom?.source.id||''}:${referenceResult?.runKey||''}`;
  const [run,setRun]=useState(null),[elapsed,setElapsed]=useState(0);
  const [phase,setPhase]=useState('idle');
  const panel=useRef(null);
  const current=ready&&run===identity;
  useEffect(()=>{setRun(null);setPhase('idle');setElapsed(0);},[identity,ready]);
  useEffect(()=>{
    if(!current||phase!=='merging')return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setElapsed(MERGE_DURATION);setPhase('viewer');return;}
    let frame,last=performance.now(),clock=0;
    const tick=now=>{clock+=document.hidden?0:Math.min(100,now-last);last=now;setElapsed(Math.min(clock,MERGE_DURATION));if(clock<MERGE_DURATION)frame=requestAnimationFrame(tick);else setPhase('viewer');};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[current,phase]);
  function start(){if(!ready)return;setRun(identity);setElapsed(0);setPhase('merging');panel.current?.scrollIntoView({behavior:'smooth',block:'center'});}
  const merging=current&&phase==='merging',viewing=current&&phase==='viewer';
  const arrived=INPUTS.filter((_,i)=>mergeFlight(elapsed,i).arrived).length;
  return <div ref={panel} className="final-layout" data-final-phase={merging?'merging':viewing?'viewer':'idle'}>
    <div className="final-layout-inputs" aria-label="布局生成所需资料">
      <span className={parsedRoom?'is-ready':''}>{parsedRoom?<Check size={14}/>:<span className="final-input-dot"/>}{parsedRoom?`${parsedRoom.source.name} · 空房就绪`:'等待平面图解析完成'}</span>
      <span className={referenceResult?'is-ready':''}>{referenceResult?<Check size={14}/>:<span className="final-input-dot"/>}{referenceResult?'参考图 · 三路解析完成':'等待参考图三路解析完成'}</span>
    </div>
    {!viewing&&<div className="final-merge-stage">
      <svg viewBox="0 0 720 365" role="img" aria-label={merging?'Graph、家具模型和材质正在汇入空房间':'空房间等待家具布局、模型和材质'}>
        <g opacity=".6" stroke="#d3dcc9" fill="none" strokeDasharray="3 6"><path d="M130 105Q130 205 360 225"/><path d="M360 76V225"/><path d="M590 105Q590 205 360 225"/></g>
        <g transform="translate(360 225)"><EmptyRoomIcon room={parsedRoom?.room} filled={merging&&arrived===3}/></g>
        {INPUTS.map(({label,Icon},i)=>{const f=mergeFlight(merging?elapsed:0,i);return <g key={label} data-merge-icon={i} transform={`translate(${f.x} ${f.y}) scale(${f.scale})`} opacity={f.opacity}>
          <rect x="-27" y="-27" width="54" height="54" rx="14" fill="#fdfcf7" stroke="#ccd7bf"/>
          <Icon x="-12" y="-12" width="24" height="24" color="#58794e" strokeWidth="1.4"/>
          <text y="48" textAnchor="middle" fontSize="13" fill="#5f7453">{label}</text>
        </g>;})}
      </svg>
      <p className="final-merge-caption" role="status">{merging?(arrived===3?'让家具与空间相遇…':'正在汇入布局、模型与材质…'):ready?'房间与灵感已就绪':'先完成上方两项解析，再让灵感落地。'}</p>
    </div>}
    {viewing&&<div className="final-layout-result"><div className="final-result-heading"><h3>原木清新 · 手机清晰版</h3><span>已保存布局演示</span></div><Suspense fallback={<p role="status">正在打开 3D 视窗…</p>}><FinalLayoutViewer model={FINAL_LAYOUT}/></Suspense></div>}
    <div className="final-layout-footer"><button type="button" className="final-generate-button" disabled={!ready||merging} onClick={start} aria-describedby="final-layout-note">{viewing?<RotateCcw size={14}/>:null}{merging?'正在生成…':viewing?'重新演示':'生成最终布局'}{!viewing&&<ArrowRight size={15}/>}</button><p id="final-layout-note">展示 L01 已保存的完整布局模型；动画演示资料融合，尚未在线计算房间适配。</p></div>
  </div>;
}
