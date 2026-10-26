import React, { lazy, Suspense, useEffect, useState } from 'react';
import { REFERENCE_EXAMPLES } from './reference-examples.js';
import './reference-analysis.css';
const ProxyView=lazy(()=>import('./ReferenceProxyView.jsx'));
const TYPES=['四级空间图','3D关系图','家具清单','蒙版与属性','3D草模','房间属性','饰面材质'];
const FILES=['plan-graph.json','scene-graph.json','furniture-inventory.json','masks-attributes.json','models.json','room-properties.json','finish-materials.json'];
const ROOT='/assets/reference-analysis/v1';
const leafName=id=>id?.split('-').slice(3).join('-') || id;
function Graph({ data, selected, onSelect }) {
  const graph=data.scene_graph,positions=new Map(graph.nodes.map(n=>[n.id,n.position]));
  const project=p=>[220+(p[0]-p[2])*150,235+(p[0]+p[2]-1)*65-p[1]*200];
  return <svg viewBox="0 0 440 340" className="reference-spatial-graph" role="img" aria-label="归一化3D关系图，节点可选取">
    <path d="M220 170 370 235 220 300 70 235Z" fill="#f0eee0" stroke="#bcc8b0" />
    {graph.edges.filter(e=>e.relation==='supports').map((edge,i)=>{const a=project(positions.get(edge.from)),b=project(positions.get(edge.to));return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#829775" strokeWidth="2" />;})}
    {graph.nodes.filter(n=>n.type!=='room').map(n=>{const [x,y]=project(n.position),item=data.furniture_inventory.items.find(i=>i.instance_id===n.id);return <g key={n.id} role="button" tabIndex="0" aria-label={`选中 ${item.label}`} onClick={()=>onSelect(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id);}}}><circle cx={x} cy={y} r={selected===n.id?9:6} fill={item.mask.color} stroke={selected===n.id?'#263e2e':'white'} strokeWidth="2"/><text x={x+10} y={y-7} fontSize="10" fill="#475a40">{item.label}</text><title>{n.id}</title></g>;})}
    <text x="18" y="328" fontSize="11" fill="#78846e">节点位置为未标定草模假设 · 线连接“支承”关系</text>
  </svg>;
}
function PlanTree({data,selected,onSelect}){
  const graph=data.plan_graph;
  return <div className="reference-plan-tree"><div className="reference-tree-root">{data.case_id} · {data.title}<span>案例</span></div><div className="reference-tree-room">{data.room_id} · 卧室<span>房间</span></div><div className="reference-tree-zones">{graph.nodes.filter(n=>n.level===2).map(zone=><section key={zone.id}><h5>{zone.label}<small>功能区 · 推断</small></h5><div>{graph.edges.filter(e=>e.from===zone.id).map(e=>{const item=data.furniture_inventory.items.find(i=>i.instance_id===e.to);return <button key={e.to} onClick={()=>onSelect(e.to)} aria-pressed={selected===e.to}>{item.label}</button>;})}</div></section>)}</div><p>本次四级定义：案例 → 房间 → 功能区 → 家具实例。</p></div>;
}
function MaskView({data,selected,onSelect}){
  const [opacity,setOpacity]=useState(.40),[onlySelected,setOnlySelected]=useState(false);
  return <div><div className="reference-mask-tools"><label>覆盖透明度 <input type="range" min="0" max=".8" step=".05" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><label><input type="checkbox" checked={onlySelected} onChange={e=>setOnlySelected(e.target.checked)}/>仅看选中实例</label></div><div className="reference-mask-image"><img src={data.source.file} alt={`${data.title} 原始裁剪图`}/><svg viewBox={`0 0 ${data.source.width_px} ${data.source.height_px}`} aria-label="人工粗轮廓蒙版">{data.masks_attributes.instances.filter(i=>!onlySelected||i.instance_id===selected).flatMap(i=>i.polygons_px.map((p,n)=><polygon key={i.instance_id+n} points={p.map(v=>v.join(',')).join(' ')} fill={i.color} fillOpacity={opacity} stroke={selected===i.instance_id?'#183426':i.color} strokeWidth={selected===i.instance_id?4:1.5} onClick={()=>onSelect(i.instance_id)}><title>{i.label}</title></polygon>))}</svg></div><p className="reference-muted">轮廓为人工粗标注，遮挡边缘尚未精修。下载的逐实例二值蒙版按遮挡顺序分配像素。</p></div>;
}
function Properties({data}){const p=data.room_properties;return <div className="reference-properties"><dl><div><dt>空间用途</dt><dd>卧室（由可见床推断）</dd></div><div><dt>实际长 × 宽 × 高</dt><dd>未知 · 未标定</dd></div><div><dt>面积</dt><dd>未知（area_m2 = null）</dd></div><div><dt>门</dt><dd>{p.openings.filter(o=>o.kind==='door').length} 处可见 · 尺寸未知</dd></div><div><dt>窗</dt><dd>{p.openings.some(o=>o.kind==='window')?'下侧可见 · 尺寸未知':'此裁剪图未确认'}</dd></div><div><dt>顶面</dt><dd>{p.ceiling_visible?'局部可见':'未入镜或无法确认'}</dd></div></dl><h5>逐图观察</h5><ul>{data.observations.map(text=><li key={text}>{text}</li>)}</ul><h5>仍未知</h5><p>{p.unknowns.join('、')}。</p></div>;}
function Finishes({data}){const names={wall:'墙面',floor:'地面',ceiling:'顶面',accent:'局部饰面'};return <div className="reference-finishes">{data.finish_materials.surfaces.map(f=><section key={f.surface}><div className="reference-finish-swatch" style={{background:f.color_sample?.hex||'repeating-linear-gradient(45deg,#ecece2,#ecece2 8px,#f7f7ee 8px,#f7f7ee 16px)'}}/><div><h5>{names[f.surface]}</h5><p>{f.appearance||'未入镜或无法确认'}</p><small>{f.material_candidates.length?`候选：${f.material_candidates.join(' / ')}；具体材质未鉴定`:'保留未知'}</small>{f.color_sample&&<small>图中取样 {f.color_sample.hex} · 含光照和阴影</small>}</div></section>)}</div>;}

export default function ReferenceAnalysis({exampleIds}){
  const selectionKey=exampleIds.join(',');
  const [active,setActive]=useState(exampleIds.at(-1)||null),[tab,setTab]=useState(0),[data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null);
  useEffect(()=>{setActive(exampleIds.at(-1)||null);},[selectionKey]);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setError('');setSelected(null);
    if(active)fetch(`${ROOT}/${active}/analysis.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('解析初稿读取失败');return r.json();}).then(value=>{setData(value);setSelected(value.furniture_inventory.items.find(i=>i.category==='bed')?.instance_id||value.furniture_inventory.items[0]?.instance_id);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    return()=>controller.abort();
  },[active]);
  if(!exampleIds.length)return null;
  const item=data?.furniture_inventory.items.find(i=>i.instance_id===selected),base=`${ROOT}/${active}`;
  return <section className="reference-analysis" aria-labelledby="reference-analysis-title" data-reference-analysis={active}>
    <header className="reference-analysis-heading"><div><h3 id="reference-analysis-title">参考图的七类解析</h3><p>人工目视初稿 · 粗蒙版 · 未标定3D草模</p></div>{data&&<a href={`${base}/analysis.json`} download>下载本图完整 JSON</a>}</header>
    <div className="reference-case-switch" aria-label="切换已选示例的解析">{exampleIds.map(id=><button key={id} aria-pressed={id===active} onClick={()=>setActive(id)}>{id} {REFERENCE_EXAMPLES.find(e=>e.id===id)?.title}</button>)}</div>
    {error?<p role="alert">{error}</p>:!data?<p role="status">正在读取七类解析初稿…</p>:<>
      <div className="reference-result-summary"><strong>{data.title}</strong><span>{data.furniture_inventory.instance_count} 个主要实例</span><span>7 类数据以 ID 关联</span><span>绝对尺寸与面积未知</span></div>
      <div className="reference-analysis-tabs" role="tablist" aria-label="七类解析数据">{TYPES.map((name,i)=><button key={name} role="tab" id={`reference-tab-${i}`} aria-controls="reference-data-panel" aria-selected={tab===i} onClick={()=>setTab(i)}>{String(i+1).padStart(2,'0')} {name}</button>)}</div>
      <div className="reference-analysis-content" role="tabpanel" id="reference-data-panel" aria-labelledby={`reference-tab-${tab}`}>
        <div className="reference-analysis-visual">
          {tab===0&&<PlanTree data={data} selected={selected} onSelect={setSelected}/>}
          {tab===1&&<><Graph data={data} selected={selected} onSelect={setSelected}/><ul className="reference-relation-list">{data.scene_graph.edges.filter(e=>e.relation!=='contains'&&(e.from===selected||e.to===selected)).map((e,i)=><li key={i}>{data.furniture_inventory.items.find(item=>item.instance_id===e.from)?.label||leafName(e.from)} → {e.relation==='supports'?'支承':'靠近右侧边界（假设）'} → {data.furniture_inventory.items.find(item=>item.instance_id===e.to)?.label||'房间'}</li>)}</ul></>}
          {tab===2&&<div className="reference-table-wrap"><table><thead><tr><th>家具 / 陈设</th><th>数量</th><th>尺寸</th><th>可见性</th></tr></thead><tbody>{data.furniture_inventory.items.map(i=><tr key={i.instance_id} data-selected={i.instance_id===selected}><td><button onClick={()=>setSelected(i.instance_id)}>{i.label}</button><small>{i.instance_id}</small></td><td>{i.quantity}</td><td>未标定</td><td>{i.evidence.visibility==='partial'?'局部':'可见'}</td></tr>)}</tbody></table></div>}
          {tab===3&&<MaskView data={data} selected={selected} onSelect={setSelected}/>}
          {tab===4&&<><Suspense fallback={<p>正在打开3D草模…</p>}><ProxyView url={`${base}/room-proxy.glb`} selected={selected} onSelect={setSelected}/></Suspense><p className="reference-muted">仅用于检查位置与组团关系。比例、形状、高度和遮挡面是草模假设，未做照片重建。</p><a href={`${base}/room-proxy.glb`} download>下载整间 GLB 草模</a></>}
          {tab===5&&<Properties data={data}/>}
          {tab===6&&<Finishes data={data}/>}
        </div>
        <aside className="reference-instance-details"><h4>关联实例</h4><label>查看家具<select aria-label="查看关联家具实例" value={selected||''} onChange={e=>setSelected(e.target.value)}>{data.furniture_inventory.items.map(i=><option key={i.instance_id} value={i.instance_id}>{i.label}</option>)}</select></label>{item&&<><h5>{item.label}</h5><code>{item.instance_id}</code><p>{item.evidence.notes}</p><dl><div><dt>数量</dt><dd>{item.quantity}</dd></div><div><dt>实际尺寸</dt><dd>未知</dd></div><div><dt>类别判读</dt><dd>{item.evidence.confidence==='low'?'较低把握':'中等把握'}</dd></div><div><dt>蒙版精度</dt><dd>人工粗轮廓</dd></div><div><dt>3D模型</dt><dd>无标定代理</dd></div></dl><a href={`${base}/${item.mask.file}`} download>下载本实例二值蒙版 PNG</a><a href={`${base}/${item.model_file}`} download>下载本实例 GLB 草模</a></>}<a className="reference-type-download" href={`${base}/${FILES[tab]}`} download>下载「{TYPES[tab]}」JSON</a></aside>
      </div>
    </>}
  </section>;
}
