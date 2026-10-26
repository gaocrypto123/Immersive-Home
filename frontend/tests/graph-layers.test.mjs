import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import layers from '../src/graph-assets.generated.js';
import {imageAsset} from '../src/image-assets.js';

const root=new URL('../../data/reference-pipeline/v1/',import.meta.url);
test('六张Graph仅分离原底图，其余矢量、文字、坐标与关系逐字保留',()=>{
  assert.equal(Object.keys(layers).length,6);
  for(let n=1;n<=6;n++){
    const id=`L0${n}`,data=JSON.parse(fs.readFileSync(new URL(`${id}/case.json`,root)));
    const original=fs.readFileSync(new URL(`${id}/graph.svg`,root),'utf8');
    const overlay=fs.readFileSync(new URL(`${id}/graph-overlay.svg`,root),'utf8');
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'),data.graphArtifact.sha256);
    assert.equal(overlay,original.replace(/<image\b[^>]*\/>/,''));
    assert.doesNotMatch(overlay,/<image\b|data:image|<script\b/);
    assert.ok(Buffer.byteLength(overlay)<16000);
    assert.ok(Buffer.byteLength(overlay)<Buffer.byteLength(original)*.01);
    const layer=layers[data.graphArtifact.image];
    assert.equal(layer.plan,data.plan.image);
    assert.equal(layer.viewBox,data.graphArtifact.viewBox);
    assert.equal(layer.width,data.layout.width);assert.equal(layer.height,data.layout.height);
    // The plan and Graph base request resolve to the same lossless resource.
    assert.equal(imageAsset(layer.plan,{exact:true}),imageAsset(data.plan.image));
    assert.equal((overlay.match(/class="graph-edge"/g)||[]).length,data.graphArtifact.edges.length);
    assert.equal((overlay.match(/class="graph-node /g)||[]).length,data.graphArtifact.nodes.length);
  }
});
