const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function inspectGlb(bytes) {
  if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Incomplete or invalid GLB');
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  if(!json.meshes?.length)throw Error('GLB has no mesh');
  for(const item of [...(json.buffers||[]),...(json.images||[])])if(item.uri&&!item.uri.startsWith('data:'))throw Error('External model resource would break offline sharing');
  if(json.extensionsRequired?.length)throw Error('Model needs an unsupported decoder: '+json.extensionsRequired.join(','));
  const positionAccessors=json.meshes.flatMap(mesh=>mesh.primitives.map(p=>json.accessors[p.attributes.POSITION]));
  if(positionAccessors.some(a=>!a||!a.count||!a.min||!a.max||[...a.min,...a.max].some(v=>!Number.isFinite(v))))throw Error('Missing finite model position bounds');
  return {meshCount:json.meshes.length,vertexCount:positionAccessors.reduce((n,a)=>n+a.count,0),embeddedImages:json.images?.length||0};
}
function importReferenceModels({project=path.resolve(__dirname,'..'),source=path.join(project,'..','02-参考图解析')}={}) {
  const folder=path.join(source,'02-家具单品解析/04-家具单品3D模型生成/L01-原木清新');
  if(!fs.existsSync(folder))return {imported:0};
  const root=path.join(project,'data/reference-pipeline/v1'),data=JSON.parse(fs.readFileSync(path.join(root,'L01/case.json'),'utf8'));
  const instances=JSON.parse(fs.readFileSync(path.join(source,'SAM3-全物件分割-20261025/L01/instances.json'),'utf8'));
  if(instances.source.sha256!==data.source.sha256)throw Error('Model source reference does not match L01');
  const items=new Map(instances.objects.map((item,index)=>[item.id,{...item,sourceOrder:index}]));
  const primary=new Map(instances.objects.filter(item=>!item.is_part).map((item,index)=>[item.id,`主${String(index+1).padStart(2,'0')}`]));
  const parts=new Map(instances.objects.filter(item=>item.is_part).map((item,index)=>[item.id,`部${String(index+1).padStart(2,'0')}`]));
  const prepared=fs.readdirSync(folder).filter(name=>/^L01-[a-z0-9-]+\.glb$/.test(name)).map(name=>{
    const id=name.slice(0,-4),item=items.get(id);if(!item)throw Error('Unmatched model: '+id);
    const bytes=fs.readFileSync(path.join(folder,name)),inspection=inspectGlb(bytes);
    return {bytes,entry:{id,label:item.label,numberLabel:primary.get(id)||parts.get(id),group:item.group,isPart:!!item.is_part,isFurniture:item.group==='furniture'&&!item.is_part,sourceOrder:item.sourceOrder,model:`/assets/reference-pipeline/v1/L01/models/${name}`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...inspection}};
  });
  prepared.sort((a,b)=>Number(b.entry.isFurniture)-Number(a.entry.isFurniture)||a.entry.sourceOrder-b.entry.sourceOrder);
  const byId=new Map(prepared.map(model=>[model.entry.id,model.entry]));
  for(const item of data.furniture)item.model=byId.get(item.id)?.model||null;
  data.modelCatalog=prepared.map(model=>model.entry);data.modelService='saved-models';
  const index=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8')),files=new Set(index.files);
  fs.mkdirSync(path.join(root,'L01/models'),{recursive:true});
  for(const {entry,bytes} of prepared){const relative=`L01/models/${entry.id}.glb`;fs.writeFileSync(path.join(root,relative),bytes);files.add(relative);}
  index.files=[...files].sort();index.cases.find(entry=>entry.id==='L01').modelCount=prepared.length;
  fs.writeFileSync(path.join(root,'L01/case.json'),JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(root,'index.json'),JSON.stringify(index,null,2)+'\n');
  return {imported:prepared.length,furniture:data.furniture.filter(item=>item.model).length,bytes:prepared.reduce((n,m)=>n+m.bytes.length,0)};
}
module.exports={inspectGlb,importReferenceModels};
if(require.main===module)console.log(JSON.stringify(importReferenceModels()));
