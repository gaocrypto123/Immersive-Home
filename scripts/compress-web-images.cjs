/* Offline asset preparation with the official Squoosh WASM codecs.
 * Run with: node --no-experimental-fetch --no-experimental-global-navigator
 * scripts/compress-web-images.cjs. No codec code is shipped to the website. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const project=path.resolve(__dirname,'..'),base=path.dirname(project);
const {ImagePool}=require(path.join(base,'.runtime/squoosh/node_modules/@squoosh/lib'));
const input=path.join(project,'frontend/public/assets'),output=path.join(project,'data/web-images');
fs.mkdirSync(path.join(output,'files'),{recursive:true});
const reportFile=path.join(output,'compression-report.json');
const previous=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')).images:[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(ent=>ent.name==='optimized'?[]:ent.isDirectory()?walk(path.join(folder,ent.name)):[path.join(folder,ent.name)]);}
const sources=walk(input).filter(file=>/\.(png|jpe?g|webp)$/i.test(file)).sort();
const images=[],pool=new ImagePool(1);
function alphaAndQuality(before,after){let squared=0,weight=0;for(let i=0;i<before.length;i+=4){if(before[i+3]!==after[i+3])throw Error('Alpha pixels changed');if(!before[i+3])continue;for(let c=0;c<3;c++){squared+=(before[i+c]-after[i+c])**2;weight++;}}return squared?10*Math.log10(255*255/(squared/weight)):99;}
function pixelBytes(bitmap){return Buffer.from(bitmap.data.buffer,bitmap.data.byteOffset,bitmap.data.byteLength);}
async function compress(file){
  const relative=path.relative(input,file).replace(/\\/g,'/'),url='/assets/'+relative,bytes=fs.readFileSync(file),sourceSha=hash(bytes);
  const exact=/^(parsing|reference-sources)\//.test(relative)||/\/(plan\.png|masks\/|segmentation\.)/.test(relative);
  const old=previous.find(row=>row.source===url&&row.sourceSha256===sourceSha&&row.policy==='squoosh-v1'&&row.lossless===exact);
  if(old&&(!old.output||fs.existsSync(path.join(output,old.output))))return old;
  const row={source:url,sourceBytes:bytes.length,sourceSha256:sourceSha,policy:'squoosh-v1',lossless:exact,output:null,bytes:bytes.length};
  if(bytes.length<12*1024)return row;
  const image=pool.ingestImage(bytes),decoded=await image.decoded,before=pixelBytes(decoded.bitmap);
  let encoder='webp',options=exact?{lossless:1,quality:100,method:6,near_lossless:100,exact:1}:{quality:88,method:6,alpha_quality:100,exact:1,use_sharp_yuv:1};
  await image.encode({webp:options});let encoded=image.encodedWith.webp.binary;
  let back=await pool.ingestImage(encoded).decoded;
  if(back.bitmap.width!==decoded.bitmap.width||back.bitmap.height!==decoded.bitmap.height)throw Error('Image dimensions changed: '+relative);
  if(exact&&Buffer.compare(before,pixelBytes(back.bitmap)))throw Error('Lossless pixel mismatch: '+relative);
  let psnr=alphaAndQuality(before,pixelBytes(back.bitmap));
  if(!exact&&psnr<36){options={...options,quality:94};await image.encode({webp:options});encoded=image.encodedWith.webp.binary;back=await pool.ingestImage(encoded).decoded;psnr=alphaAndQuality(before,pixelBytes(back.bitmap));}
  if(exact&&encoded.length>=bytes.length&&/\.png$/.test(file)){
    await image.encode({oxipng:{level:2,interlace:false}});encoded=image.encodedWith.oxipng.binary;encoder='oxipng';options=image.encodedWith.oxipng.optionsUsed;
    back=await pool.ingestImage(encoded).decoded;if(Buffer.compare(before,pixelBytes(back.bitmap)))throw Error('OxiPNG pixel mismatch: '+relative);
  }
  Object.assign(row,{width:decoded.bitmap.width,height:decoded.bitmap.height,pixelSha256:exact?hash(before):null,psnr:Math.round(psnr*100)/100,alphaPreserved:true});
  if(encoded.length<bytes.length*.92&&bytes.length-encoded.length>=2048){
    const name=hash(bytes).slice(0,20)+(exact?'-exact':'-q'+options.quality)+(encoder==='oxipng'?'.png':'.webp');
    fs.writeFileSync(path.join(output,'files',name),encoded);
    Object.assign(row,{output:'files/'+name,url:'/assets/optimized/'+name,bytes:encoded.length,sha256:hash(encoded),encoder,options});
  }
  return row;
}
function save(){
  const sourceBytes=images.reduce((sum,row)=>sum+row.sourceBytes,0),bytes=images.reduce((sum,row)=>sum+row.bytes,0);
  fs.writeFileSync(reportFile,JSON.stringify({tool:'@squoosh/lib@0.5.3',policy:'squoosh-v1',sourceBytes,bytes,savedBytes:sourceBytes-bytes,images},null,2)+'\n');
}
(async()=>{try{
  for(const file of sources){const row=await compress(file);images.push(row);save();if(images.length%10===0)console.log(JSON.stringify({processed:images.length,total:sources.length,sourceBytes:images.reduce((n,r)=>n+r.sourceBytes,0),bytes:images.reduce((n,r)=>n+r.bytes,0)}));}
  const map=Object.fromEntries(images.filter(row=>row.output||row.thumbnail).map(row=>[row.source,{url:row.url||row.source,lossless:row.lossless,width:row.width,height:row.height,...(row.thumbnail?{thumbnail:row.thumbnail.url}:{})}]));
  const publicOut=path.join(project,'frontend/public/assets/optimized');fs.mkdirSync(publicOut,{recursive:true});
  for(const row of images)for(const file of [row.output,row.thumbnail?.output].filter(Boolean))fs.copyFileSync(path.join(output,file),path.join(publicOut,path.basename(file)));
  fs.writeFileSync(path.join(project,'frontend/src/image-assets.generated.json'),JSON.stringify(map,null,2)+'\n');
  fs.writeFileSync(path.join(project,'frontend/src/image-assets.generated.js'),'// Generated by scripts/compress-web-images.cjs\nexport default '+JSON.stringify(map,null,2)+';\n');
  console.log(JSON.stringify({status:'passed',images:images.length,optimized:Object.keys(map).length,sourceBytes:images.reduce((n,r)=>n+r.sourceBytes,0),bytes:images.reduce((n,r)=>n+r.bytes,0)}));
}finally{await pool.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
