import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPalette,materialCandidates} from '../src/reference-style.js';
import {referenceTrackFrame,stageStart,REFERENCE_PLAYBACK_DURATION,paletteColorProgress,trackAnimationProgress,layoutBoxProgress} from '../src/reference-playback.js';
import {validateReferenceSelection} from '../src/reference-input.js';
const ready=n=>Array.from({length:n},()=>({status:'ready'}));

test('同一时钟逐步推进三栏，各栏保留自己的步骤数和时长',()=>{
  for(const [key,n] of [['layout',3],['furniture',4],['style',2]])assert.equal(referenceTrackFrame(key,0,ready(n)).index,0);
  assert.equal(referenceTrackFrame('layout',3300,ready(3)).index,1);
  assert.equal(referenceTrackFrame('style',3300,ready(2)).index,0);
  assert.equal(referenceTrackFrame('style',3900,ready(2)).index,1);
  assert.equal(referenceTrackFrame('furniture',REFERENCE_PLAYBACK_DURATION,ready(4)).completed,4);
  assert.equal(referenceTrackFrame('layout',stageStart('layout',2)-1,ready(3)).index,1);
});
test('缺失成果阻断该栏，时间推进也不能越过待接入步骤',()=>{
  const steps=[{status:'ready'},{status:'pending'},{status:'idle'}];
  const frame=referenceTrackFrame('layout',REFERENCE_PLAYBACK_DURATION,steps);
  assert.equal(frame.index,1);assert.equal(frame.completed,1);assert.equal(frame.status,'pending');
  assert.equal(referenceTrackFrame('style',REFERENCE_PLAYBACK_DURATION,ready(2)).completed,2);
});
test('单图约束同时保护文件选择与拖入，多图拒绝而不是静默取第一张',()=>{
  const file={name:'one.png',type:'image/png',size:1024};
  assert.equal(validateReferenceSelection([file]),'');
  assert.match(validateReferenceSelection([file,file]),/只能解析一张/);
  assert.equal(validateReferenceSelection([]),'');
});
test('真实像素取色、比例合计100且透明像素不污染结果',()=>{
  const rgba=new Uint8ClampedArray([255,0,0,255,255,0,0,255,0,0,255,255,0,255,0,0]);
  const palette=extractPalette(rgba);
  assert.deepEqual(palette.map(color=>color.hex),['#FF0000','#0000FF']);
  assert.deepEqual(palette.map(color=>color.percent),[67,33]);
  assert.equal(palette.reduce((sum,color)=>sum+color.percent,0),100);
  assert.throws(()=>extractPalette(new Uint8ClampedArray()),/没有可取样/);
});
test('材质候选按当前案例区分，不为上传图继承其他图片的材质',()=>{
  assert.match(materialCandidates({exampleId:'L01'})[0].note,/浅暖木纹/);
  assert.match(materialCandidates({exampleId:'L06'})[0].note,/深木色/);
  assert.deepEqual(materialCandidates({url:'blob:upload'}),[]);
});
test('六段配色逐个淡入，同一时刻仅一段处于过渡且此前颜色保持显示',()=>{
  const at=progress=>Array.from({length:6},(_,i)=>paletteColorProgress(progress,i,6));
  assert.deepEqual(at(0),[0,0,0,0,0,0]);assert.deepEqual(at(.25),[1,.5,0,0,0,0]);
  assert.deepEqual(at(.5),[1,1,1,0,0,0]);assert.deepEqual(at(1),[1,1,1,1,1,1]);
  for(let t=0;t<=1;t+=.01)assert.ok(at(t).filter(alpha=>alpha>0&&alpha<1).length<=1);
});
test('所有矩形框描完后完整停留2秒，再进入Graph',()=>{
  for(const time of [8400,9000,10000,10399]){
    const frame=referenceTrackFrame('layout',time,ready(3));
    assert.equal(frame.index,1);const progress=trackAnimationProgress('layout',1,frame.progress);
    assert.equal(progress,1);
    assert.ok(Array.from({length:10},(_,i)=>layoutBoxProgress(progress,i,10)).every(p=>p===1));
  }
  assert.equal(referenceTrackFrame('layout',10400,ready(3)).index,2);
  assert.equal(layoutBoxProgress(.25,0,8),1);assert.equal(layoutBoxProgress(.25,2,8),0);
});
