import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { REFERENCE_SEEDS } from './lib/reference-analysis-seeds.mjs';
import { createInstanceProxy, createReferenceProxyScene, PROXY_HEIGHTS } from '../frontend/src/reference-proxy.js';
import { writeProxyGlb } from './lib/write-proxy-glb.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'data/reference-analysis/v1');
try { await stat(output); throw Error('v1 already exists; preserve the previous analysis and use a new version path.'); }
catch(error) { if(error.code!=='ENOENT')throw error; }
import sharp from 'sharp';
const cropDir=path.join(root,'data/reference-inspiration');
const cropManifest=JSON.parse(await readFile(path.join(cropDir,'crop-manifest.json'),'utf8'));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex').toUpperCase();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const palette=['#b0a17a','#7e9d72','#a37957','#728fac','#b6a570','#9d7f98','#67988e','#af875d','#7c829e','#a28e69','#7f9e9c','#a97b83','#73945f'];
const typeNames=['四级空间图','3D关系图','家具清单','蒙版与属性','3D代理模型','房间属性','饰面材质'];
const typeFiles=['plan-graph.json','scene-graph.json','furniture-inventory.json','masks-attributes.json','models.json','room-properties.json','finish-materials.json'];
const zones={sleep:'睡眠区',storage:'收纳区',work:'办公区',decor:'独立陈设',envelope:'窗饰区'};
await mkdir(output,{recursive:true});
const index={schema:'jyxj.reference-analysis-index.v1',version:'v1',method:'agent_visual_annotation_with_programmatic_structuring',automated_image_parser:false,types:typeNames.map((title,i)=>({key:i+1,title,file:typeFiles[i]})),cases:[],files:[]};
const round=n=>Math.round(n*10000)/10000;
for(const seed of REFERENCE_SEEDS) {
  const source=cropManifest.references.find(r=>r.id===seed.id);
  if(!source)throw Error('Missing source '+seed.id);
  const pixels=await readFile(path.join(cropDir,source.file));
  if(hash(pixels)!==source.output_sha256)throw Error('Source hash mismatch '+seed.id);
  const {data:imageData,info}=await sharp(pixels).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width=info.width,height=info.height;
  const caseId=`REF-${seed.id}`,roomId=`${caseId}-R01`,folder=path.join(output,seed.id);
  await mkdir(path.join(folder,'masks'),{recursive:true});await mkdir(path.join(folder,'models'),{recursive:true});
  const instanceId=key=>`${roomId}-${key}`;
  const items=seed.items.map((s,i)=>{
    for(const polygon of s.polygons)for(const [x,y]of polygon)if(x<0||x>width||y<0||y>height)throw Error(`${seed.id}/${s.key}: polygon out of bounds`);
    const [x0,z0,x1,z1]=s.floor;
    if(!(x0>=0&&z0>=0&&x1<=1&&z1<=1&&x1>x0&&z1>z0))throw Error('Invalid normalized footprint '+s.key);
    return {
      instance_id:instanceId(s.key),case_id:caseId,room_id:roomId,key:s.key,
      label:s.label,category:s.category,quantity:1,zone_id:`${roomId}-zone-${s.zone}`,
      evidence:{source:'actual_core_crop',classification:'agent_visual_observation',confidence:s.visibility==='partial'?'low':'medium',visibility:s.visibility||'visible',notes:s.notes||'类别及外观为目视判读；遮挡面未知。'},
      measured_dimensions_m:{width:null,depth:null,height:null},
      appearance:{display_color:s.color,materials_appearance:s.materials||['依可见外观记录，具体材料未鉴定'],material_identity_verified:false},
      proxy:{status:'uncalibrated_geometry_hypothesis',units:'normalized_room_width',footprint_uv:s.floor,parts_uv:s.parts||null,part_heights_units:s.key==='wardrobe'&&seed.id==='L05'?[.66,.66,.22]:null,height_units:s.height||PROXY_HEIGHTS[s.category],base_y_units:s.base||0,head_direction:s.head||null,physical_scale_known:false,confidence:'low'},
      supported_by:s.support?instanceId(s.support):null,
      mask:{label_value:i+1,color:palette[i%palette.length],file:`masks/${s.key}.png`,attributes_file:'masks-attributes.json',polygon_source:'manual_coarse_outline',polygons_px:s.polygons,precision:'coarse_not_pixel_accurate',occlusion_order:i,unknown_hidden_surface:true},
      model_file:`models/${s.key}.glb`,
    };
  });
  // Supports are explicit: object bases use their parent proxy tops, not floor zero.
  for(const item of items)if(item.supported_by){const parent=items.find(p=>p.instance_id===item.supported_by);if(!parent)throw Error('Dangling support');item.proxy.base_y_units=round(parent.proxy.base_y_units+parent.proxy.height_units);}
  // Rasterize coarse polygons separately, then resolve visible ownership by draw order.
  // Index PNG contains one integer ID per pixel (0=unannotated), never blended colors.
  const labels=Buffer.alloc(width*height);
  for(const item of items) {
    const shapes=item.mask.polygons_px.map(p=>`<polygon points="${p.map(v=>v.join(',')).join(' ')}" fill="white"/>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/>${shapes}</svg>`;
    const raw=await sharp(Buffer.from(svg)).greyscale().raw().toBuffer();
    for(let i=0;i<labels.length;i++)if(raw[i]>=128)labels[i]=item.mask.label_value;
  }
  await sharp(labels,{raw:{width,height,channels:1}}).png().toFile(path.join(folder,'instance-ids.png'));
  for(const item of items) {
    const binary=Buffer.alloc(labels.length);let area=0,minX=width,minY=height,maxX=-1,maxY=-1;
    for(let i=0;i<labels.length;i++)if(labels[i]===item.mask.label_value){binary[i]=255;area++;const x=i%width,y=Math.floor(i/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    if(!area)throw Error(`${seed.id}/${item.key}: fully occluded coarse mask`);
    await sharp(binary,{raw:{width,height,channels:1}}).png().toFile(path.join(folder,item.mask.file));
    item.mask.visible_area_px=area;item.mask.bbox_xywh_px=[minX,minY,maxX-minX+1,maxY-minY+1];
  }
  const sourceInfo={reference_id:seed.id,file:`/assets/inspiration/${seed.id}.png`,sha256:source.output_sha256,width_px:width,height_px:height,image_kind:'image_gen_concept_image',crop_rectangle_in_main_board_xywh:source.crop_rectangle_xywh};
  const meta={schema:'jyxj.reference-seven-types.v1',case_id:caseId,room_id:roomId,title:seed.title,source:sourceInfo,method:'agent_visual_annotation_with_programmatic_structuring',review_status:'draft_for_human_review',observations:seed.observations,boundaries:['标注来自当前裁剪图；生成提示词不作为已观察事实。','蒙版为人工粗轮廓，经遮挡顺序近似组合，不是自动精细分割。','3D模型是归一化代理几何，未进行纹理或隐藏面重建。','没有实测比例尺；房间与家具的米制尺寸、面积未知。']};
  const zoneKeys=[...new Set(seed.items.map(s=>s.zone))];
  const planGraph={...meta,type:1,name:typeNames[0],hierarchy_definition:['case','room','functional_zone','instance'],definition_note:'本项目为本次解析采用的四级定义，非对截图未说明标准的推定。',nodes:[{id:caseId,level:0,type:'case',label:seed.id},{id:roomId,level:1,type:'room',label:'卧室'},...zoneKeys.map(z=>({id:`${roomId}-zone-${z}`,level:2,type:'functional_zone',label:zones[z],evidence:'inferred_function'})),...items.map(i=>({id:i.instance_id,level:3,type:'instance',label:i.label}))],edges:[{from:caseId,to:roomId,relation:'contains'},...zoneKeys.map(z=>({from:roomId,to:`${roomId}-zone-${z}`,relation:'contains'})),...items.map(i=>({from:i.zone_id,to:i.instance_id,relation:'contains'}))]};
  const sceneGraph={...meta,type:2,name:typeNames[1],coordinate_system:{x:'画面布局向右',y:'垂直向上',z:'布局向画面前方',units:'normalized_room_width',calibrated:false,room_extent_units:[1,.70,1],note:'平面UV及高度为独立草模假设，不由图像像素比例直接换算。'},nodes:[{id:roomId,type:'room',position:[.5,.35,.5]},...items.map(i=>({id:i.instance_id,type:i.category,position:[round((i.proxy.footprint_uv[0]+i.proxy.footprint_uv[2])/2),round(i.proxy.base_y_units+i.proxy.height_units/2),round((i.proxy.footprint_uv[1]+i.proxy.footprint_uv[3])/2)],footprint_uv:i.proxy.footprint_uv,model_file:i.model_file,mask_file:i.mask.file,geometry_status:i.proxy.status}))],edges:items.flatMap(i=>[{from:roomId,to:i.instance_id,relation:'contains',evidence:'visual_annotation'},...(i.supported_by?[{from:i.supported_by,to:i.instance_id,relation:'supports',evidence:'visual_inference'}]:[]),...(i.proxy.footprint_uv[2]>.96?[{from:i.instance_id,to:roomId,relation:'near_right_boundary',evidence:'proxy_hypothesis'}]:[])])};
  const inventory={...meta,type:3,name:typeNames[2],scope:'主要家具、独立灯具、地毯、窗饰及显著陈设；床品作为床的属性，小型杯碟书本不逐件计数。',instance_count:items.length,category_counts:Object.fromEntries([...new Set(items.map(i=>i.category))].map(c=>[c,items.filter(i=>i.category===c).length])),items};
  const masks={...meta,type:4,name:typeNames[3],coordinate_system:{origin:'image top-left',x:'right',y:'down',units:'pixel',size:[width,height]},precision:'manual_coarse_not_ground_truth',instance_index_png:'instance-ids.png',background_value:0,index_semantics:'8-bit grayscale integer ID; 0=unannotated; labels map to the same case/room/instance IDs',occlusion_note:'多个粗多边形重叠时，后标注实例覆盖前实例；二值蒙版由最终索引图生成。',instances:items.map(i=>({instance_id:i.instance_id,case_id:caseId,room_id:roomId,label:i.label,category:i.category,appearance:i.appearance,evidence:i.evidence,...i.mask}))};
  const modelEntries=[];
  for(const item of items) {
    const group=createInstanceProxy(item);group.position.set(0,0,0);
    const modelStats=await writeProxyGlb(group,path.join(folder,item.model_file),{case_id:caseId,room_id:roomId,instance_id:item.instance_id});
    modelEntries.push({instance_id:item.instance_id,case_id:caseId,room_id:roomId,label:item.label,file:item.model_file,representation:'procedural_proxy_not_reconstruction',physical_scale_known:false,proxy:item.proxy,...modelStats});
  }
  const scene=createReferenceProxyScene(items,roomId);
  const sceneStats=await writeProxyGlb(scene,path.join(folder,'room-proxy.glb'),{case_id:caseId,room_id:roomId,representation:'normalized_proxy_scene'});
  scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  const models={...meta,type:5,name:typeNames[4],combined_scene_file:'room-proxy.glb',representation:'procedural_proxy_not_reconstruction',scale_note:'归一化房间宽度为1。GLB用于拓扑/组团示意；数值不得解释为实测米制尺寸。',scene_stats:sceneStats,instances:modelEntries};
  const properties={...meta,type:6,name:typeNames[5],room_use:{value:'bedroom',evidence:'inferred_from_visible_bed',confidence:'high'},room_count_visible:1,dimensions_m:{width:null,depth:null,height:null},area_m2:null,metric_status:'unknown_without_calibration',proxy_envelope_uv:[[0,0],[1,0],[1,1],[0,1]],proxy_envelope_status:'rectangular_working_hypothesis_entry_recess_unresolved',openings:[{id:`${roomId}-door-01`,kind:'door',...seed.door,dimensions_m:null},...(seed.window?[{id:`${roomId}-window-01`,kind:'window',...seed.window,dimensions_m:null}]:[])],unobserved_openings:seed.window?[]:['window_presence_or_location_not_confirmed_in_this_crop'],ceiling_visible:!!seed.finishes.ceiling,unknowns:['实际长宽高与面积','真实指南针方向','柜内结构和被遮挡表面','材料品种、品牌与型号'],proxy_scale:{units:'normalized_room_width',extent:[1,.70,1],physical_scale_known:false},dimensions_note:'不复用旧L02估算房间的3600×3800mm，避免将另一个来源的假设误作本图量测。'};
  function finish(surface,entry) {
    if(!entry)return{surface,case_id:caseId,room_id:roomId,visibility:'not_visible_or_not_identifiable',appearance:null,material_candidates:[],material_identity_verified:false,color_sample:null};
    const[label,candidates,[x,y]]=entry,p=(y*width+x)*4,rgb=[imageData[p],imageData[p+1],imageData[p+2]],hex='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
    return{surface,case_id:caseId,room_id:roomId,visibility:'visible',appearance:label,material_candidates:candidates,material_identity_verified:false,confidence:'low',color_sample:{xy_px:[x,y],rgb,hex,status:'single_visible_pixel_under_rendered_lighting_not_material_albedo'}};
  }
  const finishes={...meta,type:7,name:typeNames[6],surfaces:['wall','floor','ceiling','accent'].map(surface=>finish(surface,seed.finishes[surface])),note:'具体木种、石种、皮革真伪和涂料品种不能由图像确认；颜色样本含光照与阴影。'};
  const bundle={...meta,plan_graph:planGraph,scene_graph:sceneGraph,furniture_inventory:inventory,masks_attributes:masks,models,room_properties:properties,finish_materials:finishes};
  for(const [i,document]of [planGraph,sceneGraph,inventory,masks,models,properties,finishes].entries())await writeFile(path.join(folder,typeFiles[i]),JSON.stringify(document,null,2));
  await writeFile(path.join(folder,'analysis.json'),JSON.stringify(bundle,null,2));
  const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${items.flatMap(i=>i.mask.polygons_px.map(p=>`<polygon points="${p.map(v=>v.join(',')).join(' ')}" fill="${i.mask.color}" fill-opacity=".38" stroke="${i.mask.color}" stroke-width="2"><title>${esc(i.label+' / '+i.instance_id)}</title></polygon>`)).join('')}</svg>`;
  await writeFile(path.join(folder,'mask-overlay.svg'),overlay);
  const csv='\ufeffinstance_id,case_id,room_id,label,category,quantity,measured_width_m,measured_depth_m,measured_height_m,model_file,mask_file\r\n'+items.map(i=>[i.instance_id,caseId,roomId,i.label,i.category,1,'','','',i.model_file,i.mask.file].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  await writeFile(path.join(folder,'furniture-inventory.csv'),csv);
  index.cases.push({id:seed.id,case_id:caseId,room_id:roomId,title:seed.title,style:seed.style,image:sourceInfo.file,source_sha256:sourceInfo.sha256,instance_count:items.length,bundle:`${seed.id}/analysis.json`,types:typeFiles.map((file,i)=>({key:i+1,title:typeNames[i],file:`${seed.id}/${file}`}))});
  console.log(`${seed.id}: ${items.length} instances, seven linked data types, masks and GLB proxies`);
}
async function list(dir,base='') {const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const rel=path.posix.join(base,entry.name);if(entry.isDirectory())files.push(...await list(path.join(dir,entry.name),rel));else files.push(rel);}return files;}
index.files=await list(output);
index.files.push('index.json');
await writeFile(path.join(output,'index.json'),JSON.stringify(index,null,2));
await writeFile(path.join(output,'README.md'),'# 六参考图七类解析 v1\n\n'+index.cases.map(c=>`- ${c.id} ${c.title}：${c.instance_count} 个主要实例，7 类关联 JSON，逐实例粗蒙版与 GLB 代理模型。`).join('\n')+'\n\n人工目视判读 + 程序结构化。四级图定义为案例→房间→功能区→家具实例。蒙版是人工粗轮廓，不是分割真值；模型是无标定归一化草模，不是照片重建。所有米制尺寸及面积保留 null。生成提示词仅用于来源背景，不作为可见事实。\n\n通过 /custom 选用对应参考图后查看七类结果；analysis.json 包含该案例的完整七类数据。每类保留 case_id、room_id 和家具 instance_id。原始裁剪图 SHA-256 见 index.json；source_info 指向明确白名单图片。\n');
console.log(`Saved ${index.cases.length} cases to ${output}`);
