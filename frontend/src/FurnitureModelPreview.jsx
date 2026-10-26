import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RotateCcw} from 'lucide-react';

function disposeObject(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material)materials.add(material);});
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
  for(const texture of textures){texture.dispose();texture.image?.close?.();}for(const geometry of geometries)geometry.dispose();
}
export default function FurnitureModelPreview({model}) {
  const mount=useRef(null),api=useRef(null);
  const [status,setStatus]=useState('loading'),[error,setError]=useState(''),[meshCount,setMeshCount]=useState(0);
  useEffect(()=>{
    const node=mount.current,abort=new AbortController();let disposed=false,renderer,controls,observer,frame;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100);
    scene.background=new THREE.Color('#f0f1e8');
    setStatus('loading');setError('');setMeshCount(0);
    const home={camera:new THREE.Vector3(2.3,1.7,2.8),target:new THREE.Vector3(0,.4,0)};
    const reset=()=>{camera.position.copy(home.camera);controls?.target.copy(home.target);controls?.update();};
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
      renderer.domElement.setAttribute('aria-label',`${model.label}的真实GLB模型，可拖动旋转及滚轮缩放`);renderer.domElement.tabIndex=0;node.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.55;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.51;controls.listenToKeyEvents(renderer.domElement);controls.addEventListener('change',()=>{node.dataset.camera=camera.position.toArray().map(v=>v.toFixed(4)).join(',');});reset();api.current={reset};
      scene.add(new THREE.HemisphereLight('#fffaf0','#909b86',2.2));
      const key=new THREE.DirectionalLight('#fff8ed',3);key.position.set(3,4,3);scene.add(key);
      const fill=new THREE.DirectionalLight('#e4edff',1.3);fill.position.set(-3,2,-2);scene.add(fill);
      const floor=new THREE.Mesh(new THREE.CircleGeometry(2.1,64),new THREE.MeshStandardMaterial({color:'#e5e9dd',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
      observer=new ResizeObserver(()=>{const width=Math.max(node.clientWidth,1),height=Math.max(node.clientHeight,1);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(node);
      const render=()=>{if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);};render();
      (async()=>{
        try {
          const response=await fetch(model.model,{signal:abort.signal});if(!response.ok)throw Error('模型文件读取失败。');
          const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
          if(disposed){disposeObject(gltf.scene);return;}
          const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);
          if(!Number.isFinite(extent)||extent<=0){disposeObject(gltf.scene);throw Error('模型缺少有效的几何边界。');}
          // Only the preview wrapper is centered/scaled. Source GLB transforms
          // and physical dimensions are preserved in the downloadable file.
          const wrapper=new THREE.Group(),scale=1.6/extent;wrapper.add(gltf.scene);wrapper.scale.setScalar(scale);wrapper.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);scene.add(wrapper);
          let count=0;gltf.scene.traverse(object=>{if(object.isMesh)count++;});
          home.target.set(0,size.y*scale*.45,0);home.camera.copy(home.target).add(new THREE.Vector3(2.3,1.55,2.8));reset();setMeshCount(count);setStatus('ready');
        }catch(problem){if(!disposed&&problem.name!=='AbortError'){setError(problem.message||'模型暂时无法打开。');setStatus('error');}}
      })();
    }catch{setStatus('error');setError('当前浏览器未能打开三维视图，可下载 GLB 文件查看。');}
    return()=>{disposed=true;abort.abort();api.current=null;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();disposeObject(scene);renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();};
  },[model.model,model.label]);
  return <div className="reference-model-preview">
    <div className="reference-model-canvas" ref={mount} data-model-url={model.model} data-model-ready={status==='ready'} data-mesh-count={meshCount}/>
    {status==='loading'&&<p className="reference-model-message" role="status">正在载入已保存模型…</p>}
    {error&&<p className="reference-model-error" role="alert">{error}</p>}
    <div className="reference-model-actions"><button type="button" disabled={status!=='ready'} onClick={()=>api.current?.reset()}><RotateCcw size={11}/>重置视角</button><a href={model.model} download={`${model.id}.glb`}>下载 GLB</a></div>
    <p className="reference-track-note">拖动旋转 · 滚轮缩放。已保存单品模型，未按房间实测尺寸定标。</p>
  </div>;
}
