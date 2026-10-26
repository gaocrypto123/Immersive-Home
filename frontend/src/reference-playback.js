export const TRACK_DURATIONS = {layout:[3200,7200,3200],furniture:[3200,3000,3200,2800],style:[3800,4200]};
export const LAYOUT_BOX_DRAW_DURATION=5200;
export function trackAnimationProgress(track,index,progress) {
  return track==='layout'&&index===1?Math.min(1,Math.max(0,progress)*TRACK_DURATIONS.layout[1]/LAYOUT_BOX_DRAW_DURATION):progress;
}
export function layoutBoxProgress(progress,index,count) {
  return count>0?Math.min(1,Math.max(0,progress*count-index)):0;
}
export const REFERENCE_PLAYBACK_DURATION = Math.max(...Object.values(TRACK_DURATIONS).map(times=>times.reduce((a,b)=>a+b,0)));
// One color at a time; seeking and pausing use the same deterministic clock.
export function paletteColorProgress(progress,index,count) {
  if(!Number.isFinite(progress)||count<=0)return 0;
  const t=Math.min(1,Math.max(0,progress*count-index));
  return t*t*(3-2*t);
}
export function stageStart(track,index) {return TRACK_DURATIONS[track].slice(0,index).reduce((a,b)=>a+b,0);}
export function referenceTrackFrame(track, elapsed, steps) {
  const durations=TRACK_DURATIONS[track], time=Math.max(0,elapsed);
  let index=0;
  while(index<durations.length-1 && time>=stageStart(track,index)+durations[index])index++;
  const blocked=steps.findIndex(step=>step.status!=='ready');
  if(blocked>=0)index=Math.min(index,blocked);
  const progress=Math.min(1,Math.max(0,(time-stageStart(track,index))/durations[index]));
  const completed=steps.filter((step,i)=>step.status==='ready' && time>=stageStart(track,i)+durations[i]).length;
  return {index,progress,completed,status:steps[index].status};
}
