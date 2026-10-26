import {imageAsset} from './image-assets.js';
// Material descriptions are visual candidates for these six supplied examples,
// never claims about wood species, fabric composition or a manufacturer's spec.
const MATERIALS = {
  L01: [['木纹饰面', '衣柜、床架、床头柜', '浅暖木纹；木饰面或仿木板材', 'wood'], ['织物', '床品、盖毯、地毯', '米白与灰绿织物；纤维成分未知', 'fabric'], ['编织面', '床尾长凳', '藤编或其他编织材料外观', 'woven'], ['哑光墙面', '墙面、顶面', '暖米白涂饰外观', 'matte']],
  L02: [['涂饰柜面', '衣柜、储物柜', '奶白涂饰板材外观', 'matte'], ['软包织物', '床头、床品', '奶白软包与豆沙粉织物', 'fabric'], ['木纹与编织', '地面、座椅', '浅暖木纹、编织靠背外观', 'woven'], ['金属细节', '灯具、五金', '黄铜色金属外观；材质未知', 'metal']],
  L03: [['哑光板面', '衣柜、书桌', '灰白哑光涂饰外观', 'matte'], ['织物', '床品、窗帘、地毯', '暖灰与炭黑织物外观', 'fabric'], ['木纹地面', '地面', '浅暖木纹；木地板或仿木材料', 'wood'], ['深色硬质面', '边几、灯具', '深色涂饰或金属候选', 'metal']],
  L04: [['深木纹', '床架、柜体、书桌', '深暖木纹；木种未知', 'wood'], ['皮革外观', '床头、座椅', '棕色皮革或仿皮候选', 'leather'], ['织物', '床品、地毯', '奶咖织物与绒面外观', 'fabric'], ['金属细节', '灯具、五金', '暖金属色外观', 'metal']],
  L05: [['浅木纹', '床架、柜体、书桌', '自然浅木纹；木种未知', 'wood'], ['编织面', '座椅、地毯', '自然色编织纹理', 'woven'], ['肌理墙面', '墙面', '粗肌理涂料或类似饰面候选', 'matte'], ['织物与陶器', '床品、花瓶', '米白织物、陶土色织物与粗陶外观', 'fabric']],
  L06: [['深木纹', '衣柜、床架、书桌', '深木色饰面；木种未知', 'wood'], ['编织面', '边柜', '藤编或其他编织材料外观', 'woven'], ['织物', '床品、抱枕、地毯', '米白、深绿与暖色格纹', 'fabric'], ['金属细节', '灯具、柜体五金', '黄铜色五金与深绿色涂饰', 'metal']],
};
const distance = (a,b) => a.reduce((sum,v,i) => sum + (v-b[i])**2,0);
const hex = rgb => '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();

// Deterministic weighted clustering of actual image pixels. Shares refer to the
// image (including illumination and shadows), not physical surface areas.
export function extractPalette(pixels, count=6) {
  const bins = new Map();
  for(let i=0;i<pixels.length;i+=4) {
    if(pixels[i+3]<128)continue;
    const rgb=[pixels[i],pixels[i+1],pixels[i+2]], key=rgb.map(v=>v>>4).join(',');
    const bin=bins.get(key)||{rgb:[0,0,0],n:0};bin.n++;rgb.forEach((v,c)=>bin.rgb[c]+=v);bins.set(key,bin);
  }
  const points=[...bins.values()].map(bin=>({rgb:bin.rgb.map(v=>v/bin.n),n:bin.n})).sort((a,b)=>b.n-a.n);
  if(!points.length)throw Error('图片中没有可取样的像素。');
  const centers=[points[0].rgb];
  while(centers.length<Math.min(count,points.length)) {
    const candidate=points.reduce((best,p)=>{const score=Math.min(...centers.map(c=>distance(p.rgb,c)))*Math.sqrt(p.n);return score>best.score?{score,rgb:p.rgb}:best;},{score:-1});
    if(candidate.score<=0)break;centers.push(candidate.rgb);
  }
  let groups=[];
  for(let iteration=0;iteration<16;iteration++) {
    groups=centers.map(()=>({rgb:[0,0,0],n:0}));
    for(const p of points){let index=0;for(let c=1;c<centers.length;c++)if(distance(p.rgb,centers[c])<distance(p.rgb,centers[index]))index=c;groups[index].n+=p.n;p.rgb.forEach((v,c)=>groups[index].rgb[c]+=v*p.n);}
    groups.forEach((g,i)=>{if(g.n)centers[i]=g.rgb.map(v=>v/g.n);});
  }
  const total=groups.reduce((sum,g)=>sum+g.n,0);
  const result=groups.map((g,i)=>({hex:hex(centers[i]),share:g.n/total})).filter(p=>p.share>0).sort((a,b)=>b.share-a.share);
  const percentages=result.map(p=>Math.floor(p.share*100));
  const ranks=result.map((p,i)=>({i,remainder:p.share*100-percentages[i]})).sort((a,b)=>b.remainder-a.remainder);
  for(let i=0,left=100-percentages.reduce((a,b)=>a+b,0);i<left;i++)percentages[ranks[i%ranks.length].i]++;
  return result.map((p,i)=>({...p,percent:percentages[i]}));
}
export function materialCandidates(reference) {
  const known = MATERIALS[reference.exampleId];
  return known ? known.map(([name,location,note,texture])=>({name,location,note,texture})) : [];
}
export function analyzeReferenceStyle(reference, signal) {
  return new Promise((resolve,reject)=>{
    const source=new Image();
    const clear=()=>{source.onload=null;source.onerror=null;signal.removeEventListener('abort',abort);};
    const abort=()=>{clear();source.src='';reject(new DOMException('Aborted','AbortError'));};
    if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
    signal.addEventListener('abort',abort,{once:true});
    source.onload=()=>{
      try{
        const canvas=document.createElement('canvas');canvas.width=144;canvas.height=Math.max(1,Math.round(144*source.naturalHeight/source.naturalWidth));
        // Limit extremely tall uploads before allocating a pixel buffer.
        if(canvas.height>256){canvas.width=Math.max(1,Math.round(256*source.naturalWidth/source.naturalHeight));canvas.height=256;}
        const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,canvas.width,canvas.height);
        const palette=extractPalette(context.getImageData(0,0,canvas.width,canvas.height).data);
        clear();resolve({sourceUrl:reference.url,palette,materials:materialCandidates(reference),method:'local-pixel-clustering'});
      }catch(error){clear();reject(error);}
    };
    source.onerror=()=>{clear();reject(Error('图片取色失败，请重新选择图片。'));};
    source.src=imageAsset(reference.url,{exact:true});
  });
}
