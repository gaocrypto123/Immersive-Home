import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {savedStageAvailability} from '../src/reference-pipeline.js';
const project=fileURLToPath(new URL('../../',import.meta.url));
const root=path.join(project,'data/reference-pipeline/v1');
const {inspectGlb}=createRequire(import.meta.url)('../../scripts/import-reference-models.cjs');
test('L01的24个真实GLB完整自包含，匹配实例ID且文件哈希与导入记录一致',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,'L01/case.json'),'utf8'));
  const index=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
  assert.equal(data.modelCatalog.length,24);assert.equal(data.modelCatalog.filter(m=>m.isFurniture).length,5);
  assert.equal(new Set(data.modelCatalog.map(m=>m.id)).size,24);
  let bytes=0;
  for(const model of data.modelCatalog){
    const relative=`L01/models/${model.id}.glb`,file=fs.readFileSync(path.join(root,relative));
    assert.ok(index.files.includes(relative));assert.equal(model.model,'/assets/reference-pipeline/v1/'+relative);
    assert.equal(model.sha256,crypto.createHash('sha256').update(file).digest('hex'));assert.equal(model.bytes,file.length);
    const inspection=inspectGlb(file);assert.ok(inspection.meshCount>0);assert.ok(inspection.vertexCount>0);
    bytes+=file.length;
  }
  assert.equal(bytes,133987860);
  for(const item of data.furniture)assert.equal(item.model,data.modelCatalog.find(model=>model.id===item.id).model);
  assert.deepEqual(savedStageAvailability(data,'furniture'),[true,true,true,true]);
  for(let n=2;n<=6;n++){const other=JSON.parse(fs.readFileSync(path.join(root,`L0${n}/case.json`),'utf8'));assert.equal(savedStageAvailability(other,'furniture')[3],false);}
});
test('拒绝截断的GLB，避免显示尚未写完的模型',()=>{
  const first=JSON.parse(fs.readFileSync(path.join(root,'L01/case.json'),'utf8')).modelCatalog[0];
  const bytes=fs.readFileSync(path.join(root,'L01/models',first.id+'.glb'));
  assert.throws(()=>inspectGlb(bytes.subarray(0,100)),/Incomplete/);
});
