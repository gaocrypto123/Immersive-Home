// Import the user's final SVGs verbatim. Never recompute their graph topology.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const decode=text=>text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');

function parseFinalGraph(bytes,planBytes) {
  const svg=bytes.toString('utf8');
  if(/<\s*(script|foreignObject|iframe)\b|\son\w+\s*=|(?:href|url)\s*[=(]\s*["']?https?:/i.test(svg))throw Error('Graph SVG must be a local static image');
  const root=attrs(svg.match(/<svg\b([^>]*)>/)?.[1]||'');
  const imageTag=svg.match(/<image\b([^>]*)\/?\s*>/);
  const image=attrs(imageTag?.[1]||'');
  const href=image.href||image['xlink:href']||'';
  if(!href.startsWith('data:image/png;base64,'))throw Error('Graph background must be its embedded plan PNG');
  const background=Buffer.from(href.split(',')[1],'base64');
  if(hash(background)!==hash(planBytes))throw Error('Final Graph and current plan PNG do not match');
  const width=Number(image.width),height=Number(image.height);
  if(width!==planBytes.readUInt32BE(16)||height!==planBytes.readUInt32BE(20))throw Error('Graph coordinate dimensions do not match plan');
  const nodes=[];
  for(const match of svg.matchAll(/<g\b([^>]*\bclass="annotation-box"[^>]*)>([\s\S]*?)<\/g>/g)){
    const group=attrs(match[1]),box=attrs(match[2].match(/<rect\b([^>]*\bclass="bbox"[^>]*)\/?\s*>/)?.[1]||'');
    const bbox=Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(box[key])]));
    if(!group['data-id']||Object.values(bbox).some(v=>!Number.isFinite(v))||bbox.width<=0||bbox.height<=0)throw Error('Invalid annotation box');
    nodes.push({id:group['data-id'],name:decode((group['aria-label']||'').replace(/^\S+\s+/,'')),category:/^[DW]/.test(group['data-id'])?'opening':'furniture',color:'#426f5e',bbox,x:bbox.x+bbox.width/2,y:bbox.y+bbox.height/2});
  }
  const graphNodes=[...svg.matchAll(/<g\b([^>]*\bclass="graph-node [^"]*"[^>]*)>/g)].map(m=>{const a=attrs(m[1]);return {id:a['data-id'],label:decode(a['aria-label']||'')};});
  const graphEdges=[...svg.matchAll(/<g\b([^>]*\bclass="graph-edge"[^>]*)>/g)].map(m=>{const a=attrs(m[1]);return {id:a['data-edge'],source:a['data-source'],target:a['data-target']};});
  const graphIds=new Set(graphNodes.map(n=>n.id));
  if(!nodes.length||!graphIds.has('A01')||graphEdges.some(edge=>!graphIds.has(edge.source)||!graphIds.has(edge.target)))throw Error('Final Graph has missing boxes or invalid relationships');
  return {layout:{width,height,nodes,edges:[],method:'最终 Graph SVG 中的人工矩形框标注',unit:'px'},graphNodes,graphEdges,viewBox:root.viewBox};
}
function refreshReferenceGraphs({project=path.resolve(__dirname,'..'),source=path.join(project,'..','02-参考图解析')}={}) {
  const output=path.join(project,'data/reference-pipeline/v1'),folder=path.join(source,'01-平面布局解析/03-Graph标注');
  const index=JSON.parse(fs.readFileSync(path.join(output,'index.json'),'utf8'));
  // Validate all six before changing any published case.
  const prepared=index.cases.map((entry,i)=>{
    const candidates=fs.readdirSync(folder).filter(name=>name.startsWith(`${i+1}-${entry.style}-Graph标注`)&&name.endsWith('.svg'));
    candidates.sort((a,b)=>Number(b.match(/-v(\d+)\.svg$/)?.[1]||1)-Number(a.match(/-v(\d+)\.svg$/)?.[1]||1));
    if(!candidates.length)throw Error('Missing final Graph: '+entry.id);
    const filename=candidates[0],bytes=fs.readFileSync(path.join(folder,filename)),data=JSON.parse(fs.readFileSync(path.join(output,entry.id,'case.json'),'utf8'));
    const parsed=parseFinalGraph(bytes,fs.readFileSync(path.join(output,entry.id,'plan.png')));
    data.layout=parsed.layout;
    const instances=JSON.parse(fs.readFileSync(path.join(source,'SAM3-全物件分割-20261025',entry.id,'instances.json'),'utf8'));
    if(instances.source.sha256!==data.source.sha256)throw Error('Furniture label source does not match photo');
    const primaryNumbers=new Map(instances.objects.filter(item=>!item.is_part).map((item,index)=>[item.id,index+1]));
    for(const item of data.furniture){item.primaryNumber=primaryNumbers.get(item.id);if(!item.primaryNumber)throw Error('Missing source primary number: '+item.id);}
    data.graphArtifact={image:`/assets/reference-pipeline/v1/${entry.id}/graph.svg`,sourceFile:filename,sha256:hash(bytes),viewBox:parsed.viewBox,nodes:parsed.graphNodes,edges:parsed.graphEdges,note:'最终人工 Graph 标注；细直线表示空间关系，不代表行走路线。'};
    data.segmentation.note='家具 mask 逐步显现；标号沿用已有主体标注，与家具列表一致。';
    return {id:entry.id,bytes,data};
  });
  const files=new Set(index.files);
  for(const {id,bytes,data} of prepared){fs.writeFileSync(path.join(output,id,'graph.svg'),bytes);fs.writeFileSync(path.join(output,id,'case.json'),JSON.stringify(data,null,2)+'\n');files.add(`${id}/graph.svg`);}
  index.files=[...files].sort();fs.writeFileSync(path.join(output,'index.json'),JSON.stringify(index,null,2)+'\n');
  return prepared.map(({id,data})=>({id,nodes:data.graphArtifact.nodes.length,edges:data.graphArtifact.edges.length,sha256:data.graphArtifact.sha256}));
}
module.exports={parseFinalGraph,refreshReferenceGraphs};
if(require.main===module)console.log(JSON.stringify(refreshReferenceGraphs(),null,2));
