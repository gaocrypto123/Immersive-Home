import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {GLTFLoader} from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {Box3} from '../frontend/node_modules/three/build/three.module.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'data/reference-analysis/v1');
import sharp from 'sharp';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json(path.join(dir,'index.json'));
assert.equal(index.cases.length,6);assert.equal(index.types.length,7);
const checks=[];let modelCount=0,instanceCount=0;
for(const entry of index.cases){
  const folder=path.join(dir,entry.id),data=await json(path.join(folder,'analysis.json'));
  const items=data.furniture_inventory.items,ids=new Set(items.map(i=>i.instance_id));
  assert.equal(ids.size,items.length);assert.equal(items.length,entry.instance_count);instanceCount+=items.length;
  for(const type of entry.types){const d=await json(path.join(dir,type.file));assert.equal(d.case_id,entry.case_id);assert.equal(d.room_id,entry.room_id);assert.equal(d.type,type.key);}
  const nodes=data.plan_graph.nodes,nodeMap=new Map(nodes.map(n=>[n.id,n]));
  assert.equal(data.plan_graph.hierarchy_definition.length,4);assert.equal(data.plan_graph.edges.length,nodes.length-1);
  const children=new Set();for(const edge of data.plan_graph.edges){assert(nodeMap.has(edge.from)&&nodeMap.has(edge.to));assert.equal(nodeMap.get(edge.to).level,nodeMap.get(edge.from).level+1);assert(!children.has(edge.to));children.add(edge.to);}
  assert.deepEqual(new Set(nodes.filter(n=>n.level===3).map(n=>n.id)),ids);
  const sceneNodes=new Set(data.scene_graph.nodes.map(n=>n.id));for(const edge of data.scene_graph.edges){assert(sceneNodes.has(edge.from));assert(sceneNodes.has(edge.to));}
  const maskIds=new Set(data.masks_attributes.instances.map(m=>m.instance_id));assert.deepEqual(maskIds,ids);assert.deepEqual(new Set(data.models.instances.map(m=>m.instance_id)),ids);
  assert.equal(data.room_properties.area_m2,null);assert.deepEqual(Object.values(data.room_properties.dimensions_m),[null,null,null]);
  for(const surface of data.finish_materials.surfaces)assert.equal(surface.material_identity_verified,false);
  const cropFile=(await json(path.join(root,'data/reference-inspiration/crop-manifest.json'))).references.find(c=>c.id===entry.id).file;
  const source=await readFile(path.join(root,'data/reference-inspiration',cropFile));assert.equal(createHash('sha256').update(source).digest('hex').toUpperCase(),data.source.sha256);
  const {data:labels,info}=await sharp(path.join(folder,'instance-ids.png')).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,1);assert.equal(info.width,data.source.width_px);assert.equal(info.height,data.source.height_px);
  const valid=new Set([0,...items.map(i=>i.mask.label_value)]);for(const label of labels)assert(valid.has(label));
  for(const item of items){
    assert.equal(item.case_id,entry.case_id);assert.equal(item.room_id,entry.room_id);assert.equal(item.proxy.physical_scale_known,false);assert.equal(item.mask.precision,'coarse_not_pixel_accurate');
    if(item.supported_by)assert(ids.has(item.supported_by));
    const binary=await sharp(path.join(folder,item.mask.file)).removeAlpha().greyscale().raw().toBuffer();assert.equal(binary.length,labels.length);
    let area=0;for(let i=0;i<labels.length;i++){assert.equal(binary[i],labels[i]===item.mask.label_value?255:0);if(binary[i])area++;}assert.equal(area,item.mask.visible_area_px);assert(area>0);
  }
  const paths=['room-proxy.glb',...items.map(i=>i.model_file)];
  for(const file of paths){
    const bytes=await readFile(path.join(folder,file));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.updateMatrixWorld(true);const bounds=new Box3().setFromObject(gltf.scene);assert(!bounds.isEmpty());assert([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));
    let meshCount=0;gltf.scene.traverse(o=>{if(o.isMesh){meshCount++;if(file!=='room-proxy.glb')assert(ids.has(o.userData.instance_id));o.geometry.dispose();o.material.dispose();}});assert(meshCount>0);modelCount++;
  }
  checks.push({id:entry.id,types:7,instances:items.length,linkedIds:true,sourceHash:true,metricUnknownsPreserved:true,maskPixelsAndOwnership:true,glbLoaderPass:paths.length});
}
const result={cases:6,structured_documents:42,instances:instanceCount,glb_files_loaded:modelCount,checks};
await mkdir(path.join(root,'artifacts/reference-analysis-20261025'),{recursive:true});
await writeFile(path.join(root,'artifacts/reference-analysis-20261025/data-checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
