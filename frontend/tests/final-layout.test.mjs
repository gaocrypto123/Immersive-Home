import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {FINAL_LAYOUT,MERGE_DURATION,referenceCompleted,canGenerateLayout,mergeFlight} from '../src/final-layout-state.js';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('最终布局必须等两项解析完成，回看、缺失成果及更换图片均不能误启用',()=>{
  const reference={exampleId:'L01',url:'/L01.png'},data={id:'L01',source:{url:'/L01.png'},graphArtifact:{image:'/graph.svg'},modelCatalog:[{model:'/bed.glb'}]},style={sourceUrl:'/L01.png',materials:[{}]};
  const tracks={layout:Array.from({length:3},()=>({status:'ready'})),furniture:Array.from({length:4},()=>({status:'ready'})),style:Array.from({length:2},()=>({status:'ready'}))};
  const input={reference,data,style,tracks,elapsed:13600};
  assert.equal(referenceCompleted(input),true);assert.equal(referenceCompleted({...input,elapsed:13599}),false);
  assert.equal(referenceCompleted({...input,reference:{...reference,url:'/other.png'}}),false);
  assert.equal(referenceCompleted({...input,tracks:{...tracks,furniture:[{status:'pending'}]}}),false);
  const room={room:{outline:[[0,0],[3,0],[3,4],[0,4]]}},result={id:'L01',sourceUrl:'/L01.png'};
  assert.equal(canGenerateLayout(room,result,reference),true);assert.equal(canGenerateLayout(null,result,reference),false);assert.equal(canGenerateLayout(room,null,reference),false);
  assert.equal(canGenerateLayout(room,null,null),false);assert.equal(canGenerateLayout(room,null,undefined),false);
  assert.equal(canGenerateLayout(room,result,{...reference,url:'/new.png'}),false);
});
test('三个图标分别飞入容器，所有图标抵达后才切换三维视窗',()=>{
  for(let i=0;i<3;i++){
    const start=mergeFlight(0,i),middle=mergeFlight(900+i*420,i),end=mergeFlight(MERGE_DURATION,i);
    assert.equal(start.opacity,1);assert.equal(start.arrived,false);assert.ok(middle.opacity>0);assert.ok(middle.scale<1);
    assert.deepEqual({x:end.x,y:end.y,opacity:end.opacity,arrived:end.arrived},{x:360,y:225,opacity:0,arrived:true});
  }
  assert.equal(mergeFlight(2000,2).arrived,false);
});
test('默认清晰版约16MB、保留完整场景面数，7.9MB与106MB仍可回退',()=>{
  assert.equal(FINAL_LAYOUT.model,'/assets/final-layout/L01/balanced-layout-16.glb');
  const balanced=fs.readFileSync(path.join(project,'data/final-layout/L01/balanced-layout-16.glb'));
  assert.equal(balanced.length,15907636);assert.ok(balanced.length<16000000&&balanced.length>15000000);
  assert.equal(crypto.createHash('sha256').update(balanced).digest('hex'),'0b76df4eea3a14ab97cd6a5124fb3b0d4f1d30c1113f048eb13b54bf0f2e2371');
  assert.equal(balanced.readUInt32LE(8),balanced.length);
  const balancedJson=JSON.parse(balanced.subarray(20,20+balanced.readUInt32LE(12)));
  assert.equal(balancedJson.nodes.filter(n=>n.extras?.source).length,18);
  assert.ok(balancedJson.extensionsRequired.includes('EXT_meshopt_compression'));
  assert.ok([...(balancedJson.images||[]),...(balancedJson.buffers||[])].every(item=>!item.uri));
  const sceneTriangles=balancedJson.nodes.filter(n=>n.mesh!==undefined).reduce((sum,node)=>sum+balancedJson.meshes[node.mesh].primitives.reduce((n,p)=>n+balancedJson.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
  assert.equal(sceneTriangles,860630);assert.equal(FINAL_LAYOUT.profile,'mobile-balanced');assert.equal(FINAL_LAYOUT.pixelRatioCap,2);
  const lite=fs.readFileSync(path.join(project,'data/final-layout/L01/mobile-layout.glb'));
  assert.equal(lite.length,7942480);assert.equal(lite.readUInt32LE(8),lite.length);
  const lightJson=JSON.parse(lite.subarray(20,20+lite.readUInt32LE(12)));
  assert.equal(crypto.createHash('sha256').update(lite).digest('hex'),'7349c04301017e7133df59a1606d43685253987fe497ade2c121311d4e687fe0');
  assert.equal(lite.readUInt32LE(0),0x46546c67);assert.equal(lite.readUInt32LE(4),2);
  assert.equal(lightJson.meshes.length,34);
  assert.ok([...(lightJson.images||[]),...(lightJson.buffers||[])].every(item=>!item.uri));
  assert.deepEqual(lightJson.extensionsRequired,['KHR_mesh_quantization']);
  assert.equal(lightJson.nodes.filter(n=>n.extras?.source).length,18);
  assert.ok(lite.length<10*1024*1024);
  const buffer=fs.readFileSync(path.join(project,'data/final-layout/L01/full-layout.glb'));
  assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);assert.equal(buffer.readUInt32LE(8),buffer.length);
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),'e94e05504d52b53943cf21ffbb672614485270cd51911a3b3b2ee338aeed067d');
  const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
  assert.equal(json.meshes.length,38);assert.equal(json.nodes.filter(node=>node.extras?.source).length,18);
  assert.ok(!(json.extensionsRequired||[]).length);assert.ok([...(json.images||[]),...(json.buffers||[])].every(item=>!item.uri));
});
