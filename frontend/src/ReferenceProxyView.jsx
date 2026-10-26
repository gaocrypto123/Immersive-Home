import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export default function ReferenceProxyView({ url, selected, onSelect }) {
  const mount=useRef(null),api=useRef(null),latest=useRef({selected,onSelect});
  const [error,setError]=useState(''),[ready,setReady]=useState(false);
  const [transparent,setTransparent]=useState(true);
  latest.current={selected,onSelect,transparent};
  useEffect(()=>{
    const node=mount.current;let disposed=false,frame,observer,renderer,controls,model;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeee4');
    const camera=new THREE.PerspectiveCamera(40,1,.01,50);camera.position.set(1.65,1.35,1.80);
    setError('');setReady(false);
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    function highlight(){model?.traverse(o=>{
      if(!o.isMesh)return;
      if(o.material?.emissive)o.material.emissive.set(o.userData.instance_id===latest.current.selected?'#35482b':'#000000');
      const seeThrough=latest.current.transparent&&(o.name.startsWith('proxy-')&&o.name.includes('wall')||o.userData.instance_id?.endsWith('-curtain'));
      o.material.transparent=!!seeThrough;o.material.opacity=seeThrough?.14:1;o.material.depthWrite=!seeThrough;
    });}
    function pick(event){
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
      const hit=ray.intersectObjects(model?.children||[],true).find(h=>h.object.userData.instance_id);
      if(hit)latest.current.onSelect?.(hit.object.userData.instance_id);
    }
    try {
      renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-label','参考图归一化3D草模，可拖动旋转');node.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.5,.22,.5);controls.minDistance=.5;controls.maxDistance=5;controls.enableDamping=true;controls.update();
      scene.add(new THREE.HemisphereLight('#fff9e9','#a0a68a',2.5));const light=new THREE.DirectionalLight('#fff6df',3);light.position.set(2,4,3);scene.add(light);
      observer=new ResizeObserver(()=>{const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(node);
      renderer.domElement.addEventListener('click',pick);
      new GLTFLoader().load(url,gltf=>{
        if(disposed){gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});return;}
        model=gltf.scene;scene.add(model);api.current={highlight};highlight();setReady(true);
      },undefined,()=>{if(!disposed)setError('草模文件加载失败，可下载文件检查。');});
      function draw(){if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);}draw();
    }catch{setError('当前浏览器未能打开3D视图，可下载GLB草模。');}
    return()=>{disposed=true;api.current=null;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();model?.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});if(renderer){renderer.domElement.removeEventListener('click',pick);renderer.dispose();renderer.domElement.remove();}};
  },[url]);
  useEffect(()=>api.current?.highlight(),[selected,transparent]);
  return <div className="reference-proxy-wrapper"><label className="reference-proxy-toggle"><input type="checkbox" checked={transparent} onChange={e=>setTransparent(e.target.checked)}/>透视墙体与窗帘</label><div ref={mount} className="reference-proxy-canvas" data-model-ready={ready} />{error?<p role="alert">{error}</p>:!ready?<p role="status">正在加载草模…</p>:null}<p>拖动旋转 · 滚轮缩放 · 点击家具关联实例</p></div>;
}
