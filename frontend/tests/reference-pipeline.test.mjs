import test from 'node:test';
import assert from 'node:assert/strict';
import {initialReferenceTracks, runReferenceTracks} from '../src/reference-pipeline.js';
const reference = id => ({exampleId:id,url:`/assets/reference-sources/${id}.png`});
const result = (id, layout=true) => ({id,mode:'saved-results',source:{url:reference(id).url},plan:{image:'plan.png'},layout:layout?{nodes:[{}],edges:[]}:null,graphArtifact:layout?{image:'graph.svg'}:null,segmentation:{image:'mask.jpg'},furniture:[{id:'bed',product:'bed.png',model:null}]});
test('三路在读取成果前同时启动，步骤数为3、4、2', async () => {
  const events=[]; let loaded=false;
  await runReferenceTracks({reference:reference('L01'),signal:new AbortController().signal,pace:0,onData:()=>{},onTrack:(key,steps)=>events.push({key,steps,loaded}),loadCase:async()=>{loaded=true;return result('L01');}});
  assert.deepEqual(events.slice(0,3).map(event=>[event.key,event.steps.length,event.loaded]),[['layout',3,false],['furniture',4,false],['style',2,false]]);
  assert.equal(events.filter(event=>event.key==='layout').at(-1).steps.every(step=>step.status==='ready'),true);
  assert.deepEqual(events.filter(event=>event.key==='furniture').at(-1).steps.map(step=>step.status),['ready','ready','ready','pending']);
});

test('自定义图片可独立取色，缺少材质标注时不捏造材质', async()=>{
  const state=initialReferenceTracks();let received;
  await runReferenceTracks({reference:{url:'blob:one'},signal:new AbortController().signal,pace:0,onData:()=>assert.fail('上传图不能套用案例'),onStyle:data=>received=data,onTrack:(key,steps)=>state[key]=steps,loadCase:()=>assert.fail('不应读取案例'),loadStyle:async()=>({sourceUrl:'blob:one',palette:[{hex:'#123456'}],materials:[]})});
  assert.equal(received.sourceUrl,'blob:one');assert.deepEqual(state.style.map(step=>step.status),['ready','pending']);assert.equal(state.layout[0].status,'pending');
});

test('旧图片的取色请求在替换后不能发布', async()=>{
  const controller=new AbortController();let complete;
  const running=runReferenceTracks({reference:{url:'blob:old'},signal:controller.signal,onData:()=>{},onStyle:()=>assert.fail('旧取色不应发布'),onTrack:()=>{},loadStyle:()=>new Promise(resolve=>complete=resolve)});
  controller.abort();complete({sourceUrl:'blob:old',palette:[{}],materials:[]});await running;
});
test('布局标注缺失只停止该路，家具路仍推进到白底图', async () => {
  const state=initialReferenceTracks();await runReferenceTracks({reference:reference('L02'),signal:new AbortController().signal,pace:0,onData:()=>{},onTrack:(key,steps)=>state[key]=steps,loadCase:async()=>result('L02',false)});
  assert.deepEqual(state.layout.map(step=>step.status),['ready','pending','idle']);
  assert.equal(state.furniture[2].status,'ready');
});
test('切换参考图后迟到的旧请求不能覆盖新图', async () => {
  const old=new AbortController();let finish;const events=[];
  const running=runReferenceTracks({reference:reference('L01'),signal:old.signal,pace:0,onTrack:(...value)=>events.push(value),onData:()=>assert.fail('旧结果不应发布'),loadCase:()=>new Promise(resolve=>finish=resolve)});
  old.abort();const count=events.length;finish(result('L01'));await running;assert.equal(events.length,count);
});
test('源图不匹配及未知上传均不套用已有案例结果', async () => {
  for(const upload of [false,true]){
    const state=initialReferenceTracks();await runReferenceTracks({reference:upload?{url:'blob:upload'}:reference('L01'),signal:new AbortController().signal,pace:0,onData:()=>assert.fail('不得展示别图成果'),onTrack:(key,steps)=>state[key]=steps,loadCase:async()=>result('L02')});
    assert.equal(state.layout[0].status,upload?'pending':'error');assert.equal(state.furniture[0].status,upload?'pending':'error');
  }
});
