// Dependency-free, loopback-only server for the redistributable website.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const WEB=path.join(ROOT,'www');
const INFO=JSON.parse(fs.readFileSync(path.join(ROOT,'package-info.json'),'utf8'));
const args=process.argv.slice(2),portAt=args.indexOf('--port');
const firstPort=portAt<0?5266:Number(args[portAt+1]);
if(!Number.isInteger(firstPort)||firstPort<1024||firstPort>65525)throw Error('Port must be an integer between 1024 and 65525.');
const noOpen=args.includes('--no-open');
const ROUTES=new Set(['/','/bedroom','/party','/custom','/studio','/parse']);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.ico':'image/x-icon','.woff2':'font/woff2'};
let currentPort=firstPort;
function openBrowser(url){if(noOpen)return;const command=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const argv=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(command,argv,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Open this address in a browser:',url));child.unref();}
function reply(res,status,message){const body=Buffer.from(message);res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);}
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method))return reply(res,405,'Method not allowed');
  if(![`127.0.0.1:${currentPort}`,`localhost:${currentPort}`].includes(req.headers.host))return reply(res,403,'Invalid host');
  let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{return reply(res,400,'Invalid URL');}
  if(name.includes('\\')||name.includes(':')||name.includes('\0')||name.split('/').some(p=>p.startsWith('.')))return reply(res,404,'Not found');
  if(name==='/__jyxj_health'){const data=Buffer.from(JSON.stringify({app:'jyxj-share',packageId:INFO.packageId}));res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:data);}
  const target=path.resolve(WEB,'.'+(ROUTES.has(name)?'/index.html':name));
  if(!target.startsWith(WEB+path.sep))return reply(res,404,'Not found');
  let info,real;try{[info,real]=await Promise.all([fsp.stat(target),fsp.realpath(target)]);}catch{return reply(res,404,'Not found');}
  if(!info.isFile()||!real.startsWith(WEB+path.sep))return reply(res,404,'Not found');
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}if(!match[1]){start=Math.max(0,info.size-Number(match[2]));}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start> end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}status=206;}
  const headers={'Content-Type':MIME[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
  if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  res.writeHead(status,headers);if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(target,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }catch(error){if(!res.headersSent)reply(res,500,'Unable to read this file');else res.destroy();console.error(error.message);}
});
function existing(port){return new Promise(resolve=>{const req=http.get(`http://127.0.0.1:${port}/__jyxj_health`,res=>{let data='';res.on('data',b=>{data+=b;if(data.length>4096)req.destroy()});res.on('end',()=>{try{resolve(JSON.parse(data).packageId===INFO.packageId)}catch{resolve(false)}})});req.setTimeout(700,()=>req.destroy());req.on('error',()=>resolve(false));});}
server.on('error',async error=>{if(error.code!=='EADDRINUSE'){console.error(error.message);process.exitCode=1;return;}if(await existing(currentPort)){const url=`http://127.0.0.1:${currentPort}/`;console.log('This demo is already running:',url);openBrowser(url);return;}if(currentPort>=firstPort+10){console.error('No free local port. Use --port with another port.');process.exitCode=1;return;}currentPort++;server.listen(currentPort,'127.0.0.1');});
server.on('listening',()=>{const url=`http://127.0.0.1:${currentPort}/`;console.log('\n家有新解 · 网站分享包\n'+url+'\n\nKeep this window open. Press Ctrl+C to stop.\n');openBrowser(url);});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
server.listen(currentPort,'127.0.0.1');
