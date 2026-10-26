import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RotateCcw} from 'lucide-react';
import {downloadModel} from './model-download.js';

function disposeScene(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material)materials.add(material);});
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures){texture.dispose();texture.image?.close?.();}for(const geometry of geometries)geometry.dispose();
}
export default function FinalLayoutViewer({model}) {
  const mount=useRef(null),api=useRef(null);
  const [status,setStatus]=useState('loading'),[progress,setProgress]=useState(0),[error,setError]=useState(''),[wallMode,setWallMode]=useState('low'),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const node=mount.current,abort=new AbortController();let disposed=false,renderer,controls,observer,frame,dirty=true,lastFrame=0;
    const lite=model.profile?.startsWith('mobile');
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.02,100),walls=[],architecture=[];
    scene.background=new THREE.Color('#eeede7');
    setStatus('loading');setProgress(0);setError('');setWallMode('low');node.dataset.meshCount='0';
    const target=new THREE.Vector3(1.8,.5,1.9),home=new THREE.Vector3(-3.8,5.9,7.5);
    const reset=()=>{const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.position.copy(home);controls.target.copy(target);controls.update();controls.enableDamping=damping;};
    const setWalls=mode=>{dirty=true;for(const {object,position,scale,lo,hi} of walls){const top=mode==='full'?hi:Math.min(hi,.28);object.visible=top>lo;object.scale.copy(scale);object.position.copy(position);if(object.visible&&mode!=='full'){object.scale.y*=(top-lo)/(hi-lo);object.position.y=(top+lo)/2;}}for(const object of architecture)object.visible=mode==='full';};
    try {
      renderer=new THREE.WebGLRenderer({antialias:model.profile==='mobile-balanced'||!lite,preserveDrawingBuffer:false,powerPreference:lite?'low-power':'default'});renderer.setPixelRatio(Math.min(devicePixelRatio,model.pixelRatioCap||(lite?1:1.5)));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
      renderer.shadowMap.enabled=!lite;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','原木清新完整家具布局，可拖动旋转、滚轮缩放及右键平移');node.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1.2;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.495;controls.listenToKeyEvents(renderer.domElement);controls.addEventListener('change',()=>{dirty=true;node.dataset.camera=camera.position.toArray().map(v=>v.toFixed(4)).join(',');});reset();
      api.current={reset,setWalls};
      scene.add(new THREE.HemisphereLight('#fff7e5','#8b9387',2.5));
      const sun=new THREE.DirectionalLight('#fff2d9',3.1);sun.position.set(-1,8,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5});sun.shadow.bias=-.0003;scene.add(sun);
      const fill=new THREE.DirectionalLight('#f4f9ff',1.3);fill.position.set(6,4,-4);scene.add(fill);
      const resize=()=>{const width=Math.max(node.clientWidth,1),height=Math.max(node.clientHeight,1);renderer.setSize(width,height);dirty=true;camera.aspect=width/height;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(node);resize();
      const render=time=>{if(disposed)return;frame=requestAnimationFrame(render);if(document.hidden||(lite&&time-lastFrame<1000/30))return;lastFrame=time;const moved=controls.update();if(!lite||dirty||moved){renderer.render(scene,camera);dirty=false;node.dataset.renderedTriangles=String(renderer.info.render.triangles);}};frame=requestAnimationFrame(render);node.dataset.renderProfile=model.profile||'full';node.dataset.pixelRatio=String(renderer.getPixelRatio());node.dataset.shadows=String(renderer.shadowMap.enabled);node.dataset.antialias=String(renderer.getContext().getContextAttributes().antialias);
      (async()=>{
        try {
          const buffer=await downloadModel(model.model,{signal:abort.signal,onProgress:value=>{if(!disposed)setProgress(value*.95);}});
          if(disposed)return;const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer,'');if(disposed){disposeScene(gltf.scene);return;}
          let count=0;gltf.scene.traverse(object=>{
            if(object.isMesh){count++;object.castShadow=true;object.receiveShadow=true;}
            if(Number.isFinite(object.userData.lo)&&Number.isFinite(object.userData.hi))walls.push({object,lo:object.userData.lo,hi:object.userData.hi,position:object.position.clone(),scale:object.scale.clone()});
            else if(/^(窗竖框|窗横框|窗玻璃|入户门_)/.test(object.name))architecture.push(object);
            if(object.name.includes('L01-ceiling-'))object.visible=false;
          });
          const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());if(!count||!Number.isFinite(size.length())||size.length()===0){disposeScene(gltf.scene);throw Error('完整布局模型没有有效的几何内容。');}
          // Preserve the supplied GLB's physical dimensions and all furniture poses.
          // The low-wall view only changes the architectural display for visibility.
          scene.add(gltf.scene);setWalls('low');target.set((bounds.min.x+bounds.max.x)/2,.5,(bounds.min.z+bounds.max.z)/2);
          const halfFov=THREE.MathUtils.degToRad(camera.fov/2),radius=Math.hypot(size.x,size.z)/2;
          const distance=Math.max(8.8,radius/Math.sin(Math.atan(Math.tan(halfFov)*Math.min(1,camera.aspect)))*1.12);
          home.copy(target).add(new THREE.Vector3(-5.6,5.4,5.6).normalize().multiplyScalar(distance));reset();node.dataset.meshCount=String(count);setProgress(1);setStatus('ready');
        }catch(problem){if(!disposed&&problem.name!=='AbortError'){setError(problem.message||'模型暂时无法打开。');setStatus('error');}}
      })();
    }catch {setError('当前浏览器未能打开三维视图，可下载 GLB 文件查看。');setStatus('error');}
    return()=>{disposed=true;abort.abort();api.current=null;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();disposeScene(scene);renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
  },[model.model,model.profile,model.pixelRatioCap,retry]);
  return <div className="final-model-preview">
    <div className="final-model-stage"><div className="final-model-canvas" ref={mount} data-model-url={model.model} data-model-ready={status==='ready'}/>
      {status==='loading'&&<div className="final-model-loading" role="status"><span>{progress>=.95?'正在展开模型与材质…':`正在载入完整布局 ${Math.round(progress*100)}%`}</span><progress max="1" value={progress}/><small>首次载入约 {(model.bytes/1000000).toFixed(1)} MB，优先保留主要家具贴图细节。</small></div>}
    </div>
    {error&&<p className="final-model-error" role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>重新载入</button></p>}
    <div className="final-model-toolbar"><div><button type="button" disabled={status!=='ready'} onClick={()=>api.current?.reset()}><RotateCcw size={13}/>重置视角</button><label>墙体<select aria-label="完整布局墙体显示" value={wallMode} disabled={status!=='ready'} onChange={event=>{setWallMode(event.target.value);api.current?.setWalls(event.target.value);}}><option value="low">低墙</option><option value="full">完整墙体</option></select></label><a href={model.model} download={model.downloadName||'L01-原木清新-手机轻量版.glb'}>下载 GLB</a></div><span>单指旋转 · 双指缩放 / 平移</span></div>
  </div>;
}
