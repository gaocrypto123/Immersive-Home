import React,{useState} from 'react';
import layers from './graph-assets.generated.js';
import {imageAsset} from './image-assets.js';

export function graphWarmUrls(src) {
  const layer=layers[src];
  return layer?[layer.plan,layer.overlay]:[src];
}
export default function GraphArtwork({src,alt}) {
  const [failed,setFailed]=useState(false),layer=layers[src];
  if(!layer||failed)return <img src={src} alt={alt}/>;
  const [x,y,width,height]=layer.viewBox.split(/\s+/).map(Number);
  return <svg className="reference-graph-art" viewBox={layer.viewBox} role="img" aria-label={alt} style={{'--graph-aspect':width/height}}>
    <image href={imageAsset(layer.plan,{exact:true})} width={layer.width} height={layer.height} onError={()=>setFailed(true)}/>
    <image href={layer.overlay} x={x} y={y} width={width} height={height} onError={()=>setFailed(true)}/>
  </svg>;
}
