import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {imageAsset} from '../src/image-assets.js';
const project=fileURLToPath(new URL('../../',import.meta.url));
test('图片优化输出可追溯到未改写的原图，关键像素图只使用无损版本',()=>{
  const report=JSON.parse(fs.readFileSync(path.join(project,'data/web-images/compression-report.json')));
  assert.equal(report.tool,'@squoosh/lib@0.5.3');assert.ok(report.savedBytes>0);
  for(const image of report.images){
    const source=fs.readFileSync(path.join(project,'frontend/public',image.source));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'),image.sourceSha256);
    if(image.thumbnail){
      const thumb=fs.readFileSync(path.join(project,'data/web-images',image.thumbnail.output));
      assert.equal(crypto.createHash('sha256').update(thumb).digest('hex'),image.thumbnail.sha256);
      assert.equal(thumb.length,image.thumbnail.bytes);assert.ok(Math.max(image.thumbnail.width,image.thumbnail.height)<=800);
      assert.equal(imageAsset(image.source,{thumbnail:true}),image.thumbnail.url);
      assert.equal(imageAsset(image.source,{thumbnail:true,exact:true}),image.lossless?(image.url||image.source):image.source);
    }
    if(!image.output)continue;
    const output=fs.readFileSync(path.join(project,'data/web-images',image.output));
    assert.equal(output.length,image.bytes);assert.equal(crypto.createHash('sha256').update(output).digest('hex'),image.sha256);
    assert.ok(image.bytes<image.sourceBytes);assert.ok(image.width>0&&image.height>0);assert.equal(image.alphaPreserved,true);
    assert.equal(imageAsset(image.source),image.url);
    assert.equal(imageAsset(image.source+'?v=1'),image.url+'?v=1');
    if(image.lossless){assert.ok(image.pixelSha256);assert.equal(image.psnr,99);assert.equal(imageAsset(image.source,{exact:true}),image.url);}
    else assert.equal(imageAsset(image.source,{exact:true}),image.source);
  }
  for(let i=1;i<=6;i++){const source=`/assets/reference-sources/L0${i}.png`;const row=report.images.find(image=>image.source===source);assert.equal(row.lossless,true);}
});
test('上传图片、未知地址和SVG仍保留原始路径',()=>{
  for(const source of ['blob:local-upload','data:image/png;base64,AAA','/assets/user-new.png','/assets/reference-pipeline/v1/L01/graph.svg'])assert.equal(imageAsset(source),source);
  assert.equal(imageAsset(null),null);assert.equal(imageAsset(undefined),undefined);
});
