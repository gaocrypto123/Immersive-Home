import {REFERENCE_PLAYBACK_DURATION} from './reference-playback.js';

export const FINAL_LAYOUT = {
  id:'L01', label:'L01 · 原木清新',
  model:'/assets/final-layout/L01/balanced-layout-16.glb',
  bytes:15907636, profile:'mobile-balanced', pixelRatioCap:2,
  downloadName:'L01-原木清新-手机清晰版16MB.glb',
};
export const MERGE_DURATION = 3400;

export function referenceCompleted({reference, data, style, tracks, elapsed}) {
  return !!(reference?.exampleId && data?.id===reference.exampleId && data.source?.url===reference.url &&
    style?.sourceUrl===reference.url && data.graphArtifact?.image && data.modelCatalog?.length && style.materials?.length &&
    elapsed>=REFERENCE_PLAYBACK_DURATION && Object.keys(tracks).length===3 &&
    Object.values(tracks).every(steps=>steps.length>0&&steps.every(step=>step.status==='ready')));
}
export function canGenerateLayout(parsedRoom, referenceResult, activeReference) {
  return !!(parsedRoom?.room?.outline?.length && referenceResult && activeReference && referenceResult.sourceUrl===activeReference.url &&
    referenceResult?.id===activeReference?.exampleId);
}
export function mergeFlight(elapsed,index) {
  const p=Math.max(0,Math.min(1,(elapsed-450-index*420)/1350)), ease=1-Math.pow(1-p,3);
  const start=[{x:130,y:76},{x:360,y:44},{x:590,y:76}][index];
  return {x:start.x+(360-start.x)*ease,y:start.y+(225-start.y)*ease-Math.sin(Math.PI*p)*45,
    opacity:p>.8?(1-p)/.2:1,scale:1-.66*ease,arrived:p===1};
}
