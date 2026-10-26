import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {REFERENCE_EXAMPLES} from '../src/reference-examples.js';
const project = fileURLToPath(new URL('../../', import.meta.url));
const root = path.join(project, 'data/reference-pipeline/v1');
test('六组成果对应当前六张原图，全部白名单文件存在且家具实例不串图', () => {
  const index=JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
  assert.equal(index.cases.length,6);
  for(const name of index.files){assert.ok(!name.includes('..')&&!path.isAbsolute(name));assert.ok(fs.statSync(path.join(root,name)).size>0);}
  let count=0;
  for(const example of REFERENCE_EXAMPLES){
    const data=JSON.parse(fs.readFileSync(path.join(root,example.id,'case.json'),'utf8'));
    const source=fs.readFileSync(path.join(project,'data/reference-sources',example.sourceFile));
    assert.equal(data.source.sha256,crypto.createHash('sha256').update(source).digest('hex'));
    assert.equal(data.source.url,example.sourceImage);assert.equal(data.id,example.id);assert.equal(data.mode,'saved-results');
    for(const item of data.furniture){assert.ok(item.id.startsWith(example.id+'-'));assert.ok(item.mask.startsWith('/assets/reference-pipeline/v1/'+example.id+'/'));if(example.id==='L01')assert.ok(item.model?.endsWith(`/${item.id}.glb`));else assert.equal(item.model,null);count++;}
  }
  assert.equal(count,30);
});
