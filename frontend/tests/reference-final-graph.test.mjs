import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {savedStageAvailability} from '../src/reference-pipeline.js';
import {maskLayerOpacity,furnitureMaskNumber,maskLabelPosition} from '../src/reference-mask-animation.js';
const project=fileURLToPath(new URL('../../',import.meta.url));
const {parseFinalGraph}=createRequire(import.meta.url)('../../scripts/refresh-reference-graphs.cjs');
const root=path.join(project,'data/reference-pipeline/v1');

test('六张最终Graph逐字节保留源SVG，底图尺寸、矩形框和关系节点均一致',()=>{
  const source=path.join(project,'../02-参考图解析/01-平面布局解析/03-Graph标注');
  for(let number=1;number<=6;number++){
    const id=`L0${number}`,data=JSON.parse(fs.readFileSync(path.join(root,id,'case.json'),'utf8'));
    const graph=fs.readFileSync(path.join(root,id,'graph.svg')),plan=fs.readFileSync(path.join(root,id,'plan.png'));
    assert.equal(crypto.createHash('sha256').update(graph).digest('hex'),data.graphArtifact.sha256);
    if(fs.existsSync(source))assert.deepEqual(graph,fs.readFileSync(path.join(source,data.graphArtifact.sourceFile)));
    const parsed=parseFinalGraph(graph,plan);
    assert.deepEqual(parsed.layout,data.layout);assert.deepEqual(parsed.graphNodes,data.graphArtifact.nodes);assert.deepEqual(parsed.graphEdges,data.graphArtifact.edges);
    assert.ok(parsed.graphNodes.some(node=>node.id==='A01'));
    assert.ok(parsed.graphEdges.every(edge=>edge.source==='A01'||edge.target==='A01'));
    assert.equal(data.layout.edges.length,0,'不得继续展示旧中心点最小生成树');
    assert.deepEqual(savedStageAvailability(data,'layout'),[true,true,true]);
  }
});
test('最终Graph缺失时不能用旧MST边冒充最终版本',()=>{
  assert.deepEqual(savedStageAvailability({plan:{image:'plan.png'},layout:{nodes:[{}],edges:[{}]}},'layout'),[true,true,false]);
});
test('导入拒绝与底图不匹配的Graph及包含脚本的SVG',()=>{
  const graph=fs.readFileSync(path.join(root,'L01/graph.svg')),plan=fs.readFileSync(path.join(root,'L01/plan.png'));
  assert.throws(()=>parseFinalGraph(graph,Buffer.from('wrong image')),/do not match/);
  assert.throws(()=>parseFinalGraph(Buffer.from(graph.toString().replace('<svg','<script/>\n<svg')),plan),/static image/);
});
test('mask图层透明度100到0对应opacity0到1，可暂停与回退且不越界',()=>{
  assert.deepEqual([0,.25,.5,.75,1].map(maskLayerOpacity),[0,.25,.5,.75,1]);
  assert.equal(maskLayerOpacity(-1),0);assert.equal(maskLayerOpacity(2),1);assert.equal(maskLayerOpacity(NaN),0);
});
test('家具编号沿用原始主体编号，筛选单件时不重新编号',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,'L01/case.json'),'utf8'));
  assert.deepEqual(data.furniture.map(item=>item.primaryNumber),[1,2,3,4,16]);
  assert.equal(furnitureMaskNumber(data.furniture.at(-1),0),'主16');
  for(let n=1;n<=6;n++){
    const current=JSON.parse(fs.readFileSync(path.join(root,`L0${n}/case.json`),'utf8'));
    assert.equal(new Set(current.furniture.map(item=>item.primaryNumber)).size,current.furniture.length);
    for(const item of current.furniture)assert.ok(Number.isInteger(item.primaryNumber)&&item.primaryNumber>0);
  }
});
test('编号锚点按原图矩形中心定位且在边缘保留可读空间',()=>{
  assert.deepEqual(maskLabelPosition([25,30,75,70],100,100),{left:50,top:50});
  assert.deepEqual(maskLabelPosition([99,99,100,100],100,100),{left:92,top:90});
});
