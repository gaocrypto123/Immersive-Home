export const REFERENCE_TRACKS = {
  layout: ['生成平面图', '提取家具布局', '获取布局 Graph 图'],
  furniture: ['家具实例分割', '家具列表', '家具单品图片生成', '家具单品 3D 模型生成'],
  style: ['配色解析', '材质解析'],
};
export function initialReferenceTracks() {
  return Object.fromEntries(Object.entries(REFERENCE_TRACKS).map(([key, names]) => [key, names.map(name => ({name, status: 'idle', note: '等待上一步'}))]));
}
function pause(ms, signal) {
  if (!ms || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms); signal.addEventListener('abort', done, {once: true});
  });
}
export function savedStageAvailability(data, track) {
  if(track==='style')return [!!data.palette?.length,!!data.materials?.length];
  return track === 'layout'
    ? [!!data.plan?.image, !!data.layout?.nodes?.length, !!data.graphArtifact?.image]
    : [!!data.segmentation?.image && !!data.furniture?.length, !!data.furniture?.length,
      !!data.furniture?.some(item => item.product), !!data.furniture?.some(item => item.model)];
}
// Three tracks share one source identity. Pixel sampling runs locally and does
// not depend on saved layout/furniture results or an online inference service.
export async function runReferenceTracks({reference, loadCase, loadStyle, onTrack, onData, onStyle = ()=>{}, signal, pace = 0}) {
  const tracks = initialReferenceTracks();
  const publish = key => { if (!signal.aborted) onTrack(key, tracks[key].map(step => ({...step}))); };
  for (const key of Object.keys(tracks)) {
    tracks[key][0] = {...tracks[key][0], status: 'loading', note: '读取当前参考图的已保存成果…'}; publish(key);
  }
  const styleRun = (async()=>{
    try {
      if(!loadStyle)throw Error('配色取样服务不可用。');
      const style=await loadStyle(reference,signal);
      if(signal.aborted)return;
      if(style.sourceUrl!==reference.url)throw Error('取色结果与当前图片不匹配。');
      onStyle(style);
      const available=savedStageAvailability(style,'style');
      for(let i=0;i<tracks.style.length;i++)tracks.style[i]={...tracks.style[i],status:available[i]?'ready':'pending',note:i===1?'当前图片尚无材质外观标注，无法仅凭取色判断材质。':'图片中没有可用的配色取样。'};
    }catch(error){
      if(signal.aborted)return;
      tracks.style[0]={...tracks.style[0],status:'error',note:error.message||'取色失败，请重试。'};
    }
    publish('style');
  })();
  const savedRun = (async()=>{
   if (!reference.exampleId) {
    for (const key of ['layout','furniture']) {
      tracks[key][0] = {...tracks[key][0], status: 'pending', note: '自定义图片的在线生成服务尚未接入。'}; publish(key);
    }
    return;
  }
  let data;
  try {
    data = await loadCase(reference.exampleId, signal);
    if (signal.aborted) return;
    if (data.id !== reference.exampleId || data.source?.url !== reference.url || data.mode !== 'saved-results') throw Error('成果与当前参考图不匹配，已停止载入。');
    onData(data);
  } catch (error) {
    if (signal.aborted) return;
    for (const key of ['layout','furniture']) {
      tracks[key][0] = {...tracks[key][0], status: 'error', note: error.message || '成果读取失败，请重试。'}; publish(key);
    }
    return;
  }
  await Promise.all(['layout','furniture'].map(async key => {
    const available = savedStageAvailability(data, key);
    for (let index = 0; index < tracks[key].length; index++) {
      if (signal.aborted) return;
      tracks[key][index] = {...tracks[key][index], status: 'loading', note: '载入已保存成果…'}; publish(key);
      await pause(pace, signal);
      if (signal.aborted) return;
      if (!available[index]) {
        const note = key === 'layout' ? '尚无与这张平面图对应的布局标注，等待补充。' : '单品 3D 生成服务尚未接入，当前不展示生成模型。';
        tracks[key][index] = {...tracks[key][index], status: 'pending', note}; publish(key); return;
      }
      tracks[key][index] = {...tracks[key][index], status: 'ready', note: '已保存成果'}; publish(key);
    }
  }));
  })();
  await Promise.all([savedRun,styleRun]);
}
