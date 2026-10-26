import {imageAsset} from './image-assets.js';
import React, {lazy,Suspense,useEffect, useId, useRef, useState} from 'react';
import {Check, CircleDashed, Cuboid, Expand, GitBranch, LoaderCircle, Palette as PaletteIcon, Pause, Play, RotateCcw, X} from 'lucide-react';
import {initialReferenceTracks, runReferenceTracks} from './reference-pipeline.js';
import {analyzeReferenceStyle} from './reference-style.js';
import {REFERENCE_PLAYBACK_DURATION, TRACK_DURATIONS, stageStart, referenceTrackFrame, paletteColorProgress,trackAnimationProgress,layoutBoxProgress} from './reference-playback.js';
import {maskLayerOpacity, furnitureMaskNumber, maskLabelPosition} from './reference-mask-animation.js';
import {referenceCompleted} from './final-layout-state.js';
import GraphArtwork,{graphWarmUrls} from './GraphArtwork.jsx';
import './reference-pipeline.css';
const FurnitureModelPreview=lazy(()=>import('./FurnitureModelPreview.jsx'));
const STATUS = {idle: '等待', loading: '载入中', ready: '已就绪', pending: '待接入', error: '读取失败'};
function PlanDrawing({data, progress = 1}) {
  const layout = data.layout;
  return <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="reference-track-drawing" role="img" aria-label="当前平面图的家具位置标注">
    <image href={imageAsset(data.plan.image,{exact:true})} width={layout.width} height={layout.height} opacity=".8"/>
    {layout.nodes.map((node,index) => {const reveal=layoutBoxProgress(progress,index,layout.nodes.length);return <g key={node.id} opacity={reveal>0?1:0}>
      {node.bbox && <rect x={node.bbox.x} y={node.bbox.y} width={node.bbox.width} height={node.bbox.height} fill={node.color} fillOpacity={.08*reveal} stroke={node.color} strokeWidth="7" pathLength="1" strokeDasharray="1" strokeDashoffset={1-reveal}/>}
      <text x={node.bbox?.x || node.x} y={(node.bbox?.y || node.y) - 12} opacity={Math.min(1,reveal*3)} fontSize="30" fill="#233b2d" stroke="#fffef9" strokeWidth="5" paintOrder="stroke">{node.name}</text>
    </g>;})}
  </svg>;
}
function Preview({src, alt, onOpen, reveal = 'wipe',graph=false}) {
  return <button type="button" className={`reference-track-preview is-${reveal}`} onClick={() => onOpen({src, alt,type:graph?'graph':undefined})} aria-label={`放大：${alt}`}>{graph?<GraphArtwork key={src} src={src} alt={alt}/>:<img src={imageAsset(src,{thumbnail:true})} alt={alt}/>}<span><Expand size={12}/>放大</span></button>;
}
const MASK_COLORS=['#72ba8a','#c9a667','#84adc9','#c691bc','#aac27b','#c5947d'];
function FurnitureMasks({data, items, progress = 1}) {
  const prefix=useId().replace(/:/g,'');
  return <div className="reference-instance-scene" style={{'--mask-aspect':data.source.width/data.source.height}}><svg className="reference-instance-mask" viewBox={`0 0 ${data.source.width} ${data.source.height}`} role="img" aria-label={`${data.style}的家具实例蒙版与编号`}>
    <defs>{items.map(item=><mask key={item.id} id={`${prefix}-${item.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={data.source.width} height={data.source.height}><image href={imageAsset(item.mask,{exact:true})} width={data.source.width} height={data.source.height}/></mask>)}</defs>
    <image className="reference-mask-source" href={imageAsset(data.source.url,{exact:true})} width={data.source.width} height={data.source.height}/>
    <g className="reference-furniture-masks" opacity={maskLayerOpacity(progress)}>{items.map(item=><rect key={item.id} data-mask-id={item.id} width={data.source.width} height={data.source.height} fill={MASK_COLORS[data.furniture.findIndex(entry=>entry.id===item.id)%MASK_COLORS.length]} fillOpacity=".55" mask={`url(#${prefix}-${item.id})`}/>)}</g>
  </svg><div className="reference-mask-labels" style={{opacity:maskLayerOpacity(progress)}}>{items.map(item=>{const number=furnitureMaskNumber(item,data.furniture.findIndex(entry=>entry.id===item.id)),position=maskLabelPosition(item.bbox,data.source.width,data.source.height);return <span key={item.id} data-mask-number={number} title={`${number} ${item.label}`} style={{left:`${position.left}%`,top:`${position.top}%`}}>{number}</span>;})}</div></div>;
}
function Palette({style,progress}) {
  return <div className="reference-palette">
    <div className="reference-palette-strip" aria-label="当前图片的配色比例">{style.palette.map((color,i)=><span key={color.hex} data-palette-color={i} style={{background:color.hex,flex:color.share,opacity:paletteColorProgress(progress,i,style.palette.length)}}/>)}</div>
    <ul>{style.palette.map((color,i)=>{const reveal=paletteColorProgress(progress,i,style.palette.length);return <li key={color.hex} aria-hidden={reveal===0} style={{opacity:reveal,transform:`translateY(${3*(1-reveal)}px)`}}><i style={{background:color.hex}}/><span>{color.hex}<small>画面占比 {color.percent}%</small></span></li>;})}</ul>
    <p className="reference-track-note">从当前原图像素聚类取样；比例指画面像素，含光照与阴影。</p>
  </div>;
}
function Materials({style,progress}) {
  return <><ul className="reference-material-list">{style.materials.map((material,i)=><li key={material.name} style={{opacity:Math.min(1,Math.max(0,progress*3-i*.35))}}><i className={`reference-material-sample is-${material.texture}`} aria-hidden="true"/><div><strong>{material.name}</strong><span>{material.location}</span><small>{material.note}</small></div></li>)}</ul><p className="reference-track-note">示例图的人工外观标注，纹理块为示意；材质候选未经实物鉴定。</p></>;
}
function warmImage(url,signal) {
  return new Promise(resolve=>{
    if(!url||signal.aborted){resolve();return;}
    const image=new Image();
    const done=()=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',abort);resolve();};
    const abort=()=>{done();image.src='';};
    signal.addEventListener('abort',abort,{once:true});image.onload=done;image.onerror=done;image.src=imageAsset(url);
  });
}
const TRACK_INFO={layout:{title:'平面布局解析',subtitle:'空间示意与家具关系',Icon:GitBranch},furniture:{title:'家具单品解析',subtitle:'实例、单品与模型',Icon:Cuboid},style:{title:'色彩风格解析',subtitle:'配色取样与材质外观',Icon:PaletteIcon}};
export default function ReferencePipeline({reference,onResultChange}) {
  const [tracks,setTracks]=useState(initialReferenceTracks),[data,setData]=useState(null),[style,setStyle]=useState(null),[selected,setSelected]=useState(''),[zoom,setZoom]=useState(null),[replay,setReplay]=useState(0),[maskView,setMaskView]=useState('all');
  const [elapsed,setElapsed]=useState(0),[playing,setPlaying]=useState(true);
  const clock=useRef(0);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setStyle(null);setSelected('');setMaskView('all');setZoom(null);setTracks(initialReferenceTracks());clock.current=0;setElapsed(0);setPlaying(true);
    runReferenceTracks({reference,signal:controller.signal,onTrack:(key,value)=>setTracks(current=>({...current,[key]:value})),onData:value=>{setData(value);setSelected(value.furniture[0]?.id||'');},onStyle:setStyle,loadStyle:analyzeReferenceStyle,
      loadCase:async(id,signal)=>{const response=await fetch(`/assets/reference-pipeline/v1/${id}/case.json`,{signal});if(!response.ok)throw Error('当前参考图的成果暂不可用，请重试。');const value=await response.json();
        // Later results warm in parallel without blocking the first step. Graph
        // reuses the exact plan URL; only its small vector overlay is additional.
        for(const url of [...graphWarmUrls(value.graphArtifact?.image),value.furniture?.[0]?.product])void warmImage(url,signal);
        await Promise.all([value.plan?.image,...(value.furniture||[]).map(item=>item.mask)].map(url=>warmImage(url,signal)));return value;}});
    return()=>controller.abort();
  },[reference.url,reference.exampleId,replay]);
  const initialized=Object.values(tracks).every(steps=>!['idle','loading'].includes(steps[0].status));
  useEffect(()=>{
    const completed=referenceCompleted({reference,data,style,tracks,elapsed});
    onResultChange?.(completed?{id:data.id,sourceUrl:reference.url,runKey:`${reference.url}:${replay}`,data,style}:null);
  },[reference,data,style,tracks,elapsed,replay,onResultChange]);
  useEffect(()=>()=>onResultChange?.(null),[onResultChange]);
  useEffect(()=>{
    if(!initialized||!playing)return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){clock.current=REFERENCE_PLAYBACK_DURATION;setElapsed(clock.current);setPlaying(false);return;}
    let frame,last=performance.now(),lastUI=last;
    const advance=now=>{const dt=document.hidden?0:Math.min(100,Math.max(0,now-last));last=now;clock.current=Math.min(REFERENCE_PLAYBACK_DURATION,clock.current+dt);if(now-lastUI>40||clock.current===REFERENCE_PLAYBACK_DURATION){setElapsed(clock.current);lastUI=now;}if(clock.current<REFERENCE_PLAYBACK_DURATION)frame=requestAnimationFrame(advance);else setPlaying(false);};
    frame=requestAnimationFrame(advance);return()=>cancelAnimationFrame(frame);
  },[initialized,playing,replay]);
  useEffect(()=>{if(!zoom)return;const close=event=>{if(event.key==='Escape')setZoom(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[zoom]);
  const item=data?.furniture.find(entry=>entry.id===selected)||data?.furniture[0];
  const frames=Object.fromEntries(Object.keys(tracks).map(key=>[key,referenceTrackFrame(key,elapsed,tracks[key])]));
  function seek(time){setPlaying(false);clock.current=time;setElapsed(time);}
  function toggle(){if(elapsed>=REFERENCE_PLAYBACK_DURATION){clock.current=0;setElapsed(0);}setPlaying(value=>!value);}
  function content(key,index,progress){
    if(key==='style')return style&&(index===0?<Palette style={style} progress={progress}/>:<Materials style={style} progress={progress}/>);
    if(!data)return null;
    if(key==='layout')return index===0?<><Preview src={data.plan.image} alt={`${data.style} · 生成平面图 v${data.plan.revision}`} onOpen={setZoom}/><p className="reference-track-note">{data.plan.note}</p></>:index===1?<><PlanDrawing data={data} progress={progress}/><p className="reference-track-note">最终标注中的家具位置 · 像素坐标，非实测尺寸。</p></>:data.graphArtifact&&<><Preview src={data.graphArtifact.image} alt={`${data.style} · 最终空间关系 Graph`} onOpen={setZoom} reveal="fade" graph/><p className="reference-track-note">{data.graphArtifact.note}</p></>;
    if(index===0){const items=maskView==='selected'&&item?[item]:data.furniture;const alt=`${data.style} · 家具实例分割`;return <><div className="reference-mask-switch"><button type="button" aria-pressed={maskView==='all'} onClick={()=>setMaskView('all')}>全部家具</button><button type="button" aria-pressed={maskView==='selected'} onClick={()=>setMaskView('selected')}>当前家具</button></div><button type="button" className="reference-track-preview reference-segmentation-preview" aria-label={`放大：${alt}`} onClick={()=>setZoom({type:'segmentation',data,items,alt})}><FurnitureMasks data={data} items={items} progress={progress}/><span><Expand size={12}/>放大</span></button><p className="reference-track-note">{data.segmentation.note}</p></>;}
    if(index===1)return <><p className="reference-track-count">{data.furniture.length} 件家具主体<span>分割物件共 {data.segmentation.totalObjects} 项，含软装与部件</span></p><ul className="reference-furniture-list">{data.furniture.map((entry,i)=><li key={entry.id} style={{opacity:Math.min(1,Math.max(0,progress*(data.furniture.length+1)-i*.65))}}><button type="button" aria-pressed={item?.id===entry.id} onClick={()=>setSelected(entry.id)}><img src={imageAsset(entry.cutout,{thumbnail:true})} alt="" loading="lazy"/><span><b className="reference-furniture-number">{furnitureMaskNumber(entry,i)}</b>{entry.label}</span><span>{item?.id===entry.id?'已选':'查看'}</span></button></li>)}</ul></>;
    if(index===2)return item&&<><label className="reference-product-select">查看单品图<select aria-label="查看生成的家具单品图" value={item.id} onChange={event=>setSelected(event.target.value)}>{data.furniture.map((entry,i)=><option key={entry.id} value={entry.id}>{furnitureMaskNumber(entry,i)} {entry.label}</option>)}</select></label>{item.product?<Preview src={item.product} alt={`${item.label} · AI 白底单品图`} onOpen={setZoom}/>:<p>此单品暂没有已保存的生成图片。</p>}<p className="reference-track-note">已有 AI 单品图；遮挡部分与细节包含推定。</p></>;
    const models=data.modelCatalog||[],model=models.find(entry=>entry.id===selected)||models[0];
    return model&&<><label className="reference-product-select">查看单品模型<select aria-label="选择家具3D模型" value={model.id} onChange={event=>setSelected(event.target.value)}><optgroup label="家具主体">{models.filter(entry=>entry.isFurniture).map(entry=><option key={entry.id} value={entry.id}>{entry.numberLabel} {entry.label}</option>)}</optgroup><optgroup label="软装、灯具与部件">{models.filter(entry=>!entry.isFurniture).map(entry=><option key={entry.id} value={entry.id}>{entry.numberLabel} {entry.label}</option>)}</optgroup></select></label><Suspense fallback={<p className="reference-track-note">正在打开三维预览…</p>}><FurnitureModelPreview key={model.id} model={model}/></Suspense><p className="reference-track-note">{models.filter(entry=>entry.isFurniture).length} 件家具主体 · {models.filter(entry=>!entry.isFurniture).length} 件软装与部件</p></>;
  }
  return <section className="reference-parallel" aria-label="当前参考图的三路解析" data-pipeline-source={reference.exampleId||reference.name} data-playback={playing?'playing':'paused'}>
    <div className="reference-parallel-bar"><span>三路同步 · {reference.exampleId?'已保存成果回放 + 原图取色':'原图取色 · 其他服务待接入'}</span><div className="reference-playback-controls"><button type="button" disabled={!initialized} onClick={toggle}>{playing?<Pause size={13}/>:<Play size={13}/>} {playing?'暂停':'播放'}</button><button type="button" onClick={()=>setReplay(value=>value+1)}><RotateCcw size={12}/>重新播放</button></div></div>
    <label className="reference-playback-timeline"><span>{initialized?(elapsed>=REFERENCE_PLAYBACK_DURATION?'播放完成':playing?'自动播放':'已暂停'):'正在读取当前图片…'}</span><input type="range" min="0" max={REFERENCE_PLAYBACK_DURATION} step="100" value={Math.round(elapsed)} disabled={!initialized} onChange={event=>seek(Number(event.target.value))} aria-label="参考图解析播放进度"/><span>{(elapsed/1000).toFixed(1)} / {(REFERENCE_PLAYBACK_DURATION/1000).toFixed(1)}s</span></label>
    <div className="reference-parallel-columns">
      {Object.entries(TRACK_INFO).map(([key,{title,subtitle,Icon}])=>{const frame=frames[key],progress=trackAnimationProgress(key,frame.index,frame.progress),step=tracks[key][frame.index],blocked=tracks[key].findIndex(entry=>entry.status!=='ready');return <section key={key} className="reference-track" aria-labelledby={`reference-${key}-track-title`} data-track={key} data-current-step={frame.index}>
        <header className="reference-track-heading"><Icon size={17}/><div><h3 id={`reference-${key}-track-title`}>{title}</h3><p>{subtitle}</p></div><span>{tracks[key].length} 步</span></header>
        <ol className="reference-track-nav" aria-label={`${title}步骤`}>{tracks[key].map((entry,index)=><li key={entry.name}><button type="button" aria-label={`回看${title}：${entry.name}`} aria-current={frame.index===index?'step':undefined} disabled={!initialized||(blocked>=0&&index>blocked)} onClick={()=>seek(stageStart(key,index)+TRACK_DURATIONS[key][index]-(index===tracks[key].length-1?0:1))}><span>{index<frame.completed?<Check size={11}/>:String(index+1).padStart(2,'0')}</span>{entry.name}</button></li>)}</ol>
        <div className={`reference-track-step is-${step.status}`} key={frame.index} style={{'--stage-progress':progress}} data-stage-status={step.status}>
          <header><h4>{step.name}</h4><span className="reference-track-status">{step.status==='ready'?(progress<1?'演示中':'已就绪'):STATUS[step.status]}</span></header>
          <div className="reference-track-progress" aria-hidden="true"><span style={{transform:`scaleX(${frame.progress})`}}/></div>
          <div className="reference-track-body">{step.status==='ready'?content(key,frame.index,progress):<p className="reference-track-placeholder">{step.status==='loading'?<LoaderCircle className="reference-track-spinner" size={20}/>:<CircleDashed size={20}/>} {step.note}</p>}</div>
        </div>
        <p className="reference-track-completion" aria-label={`${title}完成进度`}>{frame.completed} / {tracks[key].length} 步已展示</p>
      </section>;})}
    </div>
    {zoom&&<div className="reference-image-modal" role="dialog" aria-modal="true" aria-label={zoom.alt} onClick={()=>setZoom(null)}><button autoFocus type="button" aria-label="关闭图片预览" onClick={()=>setZoom(null)}><X size={20}/></button><figure onClick={event=>event.stopPropagation()}>{zoom.type==='segmentation'?<FurnitureMasks data={zoom.data} items={zoom.items}/>:zoom.type==='graph'?<GraphArtwork key={zoom.src} src={zoom.src} alt={zoom.alt}/>:<img src={imageAsset(zoom.src)} alt={zoom.alt}/>}<figcaption>{zoom.alt}</figcaption></figure></div>}
  </section>;
}
