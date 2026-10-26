// Keep each request short enough for embedded hosting proxies. The original
// GLB bytes are assembled in order; geometry and textures are never rewritten.
export async function downloadModel(url,{signal,onProgress=()=>{},fetcher=fetch,chunkSize=8*1024*1024,concurrency=3}={}) {
  // ModelScope permits Range GET but rejects HEAD at its public proxy.
  const probe=await fetcher(url,{signal,cache:'no-store',headers:{Range:'bytes=0-31'}});
  const range=/^bytes 0-(\d+)\/(\d+)$/.exec(probe.headers.get('content-range')||'');
  if(probe.status!==206||!range){await probe.body?.cancel();throw Error('无法读取模型文件信息，请重试。');}
  const total=Number(range[2]);
  const first=new Uint8Array(await probe.arrayBuffer());if(first.length!==Math.min(32,total)||Number(range[1])!==first.length-1)throw Error('模型文件信息不完整。');
  if(!Number.isSafeInteger(total)||total<=0)throw Error('模型文件大小无效。');
  const output=new Uint8Array(total),count=Math.ceil(total/chunkSize);let next=0,received=0;
  async function worker(){
    while(next<count){
      signal?.throwIfAborted();const index=next++,start=index*chunkSize,end=Math.min(total-1,start+chunkSize-1);let lastError;
      for(let attempt=0;attempt<2;attempt++){
        try {
          const response=await fetcher(url,{signal,cache:'no-store',headers:{Range:`bytes=${start}-${end}`}});
          if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${end}/${total}`)throw Error('模型地址未返回正确的分段内容。');
          const bytes=new Uint8Array(await response.arrayBuffer());signal?.throwIfAborted();
          if(bytes.length!==end-start+1)throw Error('模型分段未完整下载。');
          output.set(bytes,start);received+=bytes.length;onProgress(received/total);lastError=null;break;
        }catch(error){if(signal?.aborted)throw error;lastError=error;}
      }
      if(lastError)throw lastError;
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,count)},worker));
  return output.buffer;
}
