const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.JYXJ_STUDIO_URL||'http://127.0.0.1:5173',OUT=path.resolve('artifacts/saved-results-ui');
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.JYXJ_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],posts=[],computeRequests=[],failed=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1365,height:950},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).origin===new URL(BASE).origin)posts.push(r.url());if(/\/api\/sam3(?:\/|$)/i.test(r.url()))computeRequests.push(r.url());});
  page.on('response',r=>{if(r.url().startsWith(BASE+'/assets/')&&r.status()>=400)failed.push({url:r.url(),status:r.status()});});
  await page.goto(BASE+'/custom');
  // ModelScope redirects browser navigations to its Studio wrapper; the app
  // still reads the same static resources inside the hosted iframe.
  const app=new URL(page.url()).hostname.endsWith('modelscope.cn')?page.frameLocator('iframe#iFrameResizer0'):page;
  const workbench=app.locator('.reference-workbench');
  for(let n=1;n<=6;n++){
   const id='L0'+n,button=workbench.getByRole('button',{name:'放入解析区：参考图 '+String(n).padStart(2,'0'),exact:true});
   if(!await button.isEnabled())await workbench.getByRole('button',{name:'展开资料卡片',exact:true}).click();
   await button.click();const pipeline=app.locator('[data-pipeline-source="'+id+'"]');
   await pipeline.locator('.reference-playback-timeline').getByText('播放完成',{exact:true}).waitFor();
   assert.equal(await pipeline.locator('.reference-track').count(),3);
   await pipeline.getByRole('button',{name:'回看家具单品解析：家具实例分割',exact:true}).click();
   const masks=await pipeline.locator('[data-mask-id]').count();assert.ok(masks>0);
   await pipeline.getByRole('button',{name:'回看平面布局解析：获取布局 Graph 图',exact:true}).click();
   await pipeline.locator('[data-track="layout"] .reference-track-preview').waitFor();
   if(n===1){
    await pipeline.getByRole('button',{name:'回看家具单品解析：家具单品 3D 模型生成',exact:true}).click();
    await pipeline.locator('[data-model-ready="true"]').waitFor({timeout:30000});
    assert.equal(await pipeline.getByRole('combobox',{name:'选择家具3D模型'}).locator('option').count(),24);
   }else {
    await pipeline.getByRole('button',{name:'回看家具单品解析：家具单品 3D 模型生成',exact:true}).click();
    assert.equal(await pipeline.locator('[data-track="furniture"] [data-stage-status="pending"]').count(),1);
   }
   checks.push({id,masks,threeTracks:true,savedGraph:true});
  }
  assert.equal(await app.getByRole('button',{name:'运行 SAM 3',exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});assert.equal(await workbench.evaluate(el=>el.ownerDocument.documentElement.scrollWidth>el.ownerDocument.defaultView.innerWidth),false);
  await workbench.screenshot({path:path.join(OUT,'saved-results-mobile.png')});
  await page.setViewportSize({width:1365,height:950});await workbench.screenshot({path:path.join(OUT,'saved-results-desktop.png')});
  await app.locator('input[type="file"][aria-label="上传一张风格参考图"]').setInputFiles(path.resolve('data/reference-sources',fs.readdirSync('data/reference-sources')[0]));
  await app.locator('[data-pipeline-source]:not([data-pipeline-source^="L0"])').waitFor();
  await app.getByRole('button',{name:'回看色彩风格解析：配色解析',exact:true}).click();
  await app.locator('.reference-palette-strip').waitFor();assert.equal(await app.locator('[data-mask-id]').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(computeRequests,[]);assert.deepEqual(failed,[]);
  fs.writeFileSync(path.join(OUT,'browser-checks.json'),JSON.stringify({checks,uploadStaysLocal:true,mobile:true,errors,posts,computeRequests,failed},null,2));
  console.log('Saved cases, masks, Graphs, 24-model picker, local image preview and no inference requests passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
