import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadModel} from '../src/model-download.js';
test('模型分段并行读取后字节顺序正确，网络失败只重试该段',async()=>{
  const source=Uint8Array.from({length:37},(_,i)=>i),calls=[],progress=[];let failed=false;
  const fetcher=async(url,options)=>{
    if(options.headers.Range==='bytes=0-31')return new Response(source.slice(0,32),{status:206,headers:{'content-range':`bytes 0-31/${source.length}`}});
    calls.push(options.headers.Range);const [,lo,hi]=/bytes=(\d+)-(\d+)/.exec(options.headers.Range),start=Number(lo),end=Number(hi);
    if(start===8&&!failed){failed=true;throw Error('temporary network interruption');}
    return new Response(source.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${source.length}`}});
  };
  const result=await downloadModel('/model.glb',{fetcher,chunkSize:8,onProgress:value=>progress.push(value)});
  assert.deepEqual(new Uint8Array(result),source);assert.equal(calls.filter(range=>range==='bytes=8-15').length,2);
  assert.equal(calls.filter(range=>range==='bytes=0-7').length,1);assert.equal(progress.at(-1),1);assert.ok(progress.every((value,i)=>i===0||value>=progress[i-1]));
});
test('截断或不匹配的模型分段不能被当作完整GLB解析',async()=>{
  const fetcher=async(url,options)=>options.headers.Range==='bytes=0-31'?new Response(new Uint8Array(8),{status:206,headers:{'content-range':'bytes 0-7/8'}}):new Response(new Uint8Array(2),{status:206,headers:{'content-range':'bytes 0-7/8'}});
  await assert.rejects(downloadModel('/model.glb',{fetcher,chunkSize:8}),/未完整/);
});
test('更换输入后中止分段加载，不继续读取后续模型片段',async()=>{
  const controller=new AbortController();let gets=0;
  const fetcher=async(url,options)=>{if(options.headers.Range==='bytes=0-31')return new Response(new Uint8Array(32),{status:206,headers:{'content-range':'bytes 0-31/32'}});gets++;controller.abort();throw new DOMException('Cancelled','AbortError');};
  await assert.rejects(downloadModel('/model.glb',{fetcher,chunkSize:8,concurrency:1,signal:controller.signal}),/Cancelled/);assert.equal(gets,1);
});
