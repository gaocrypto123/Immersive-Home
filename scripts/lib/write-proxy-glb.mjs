// Minimal glTF 2.0 writer for the local Three.js proxy meshes, with no external files.
import { writeFile } from 'node:fs/promises';
export async function writeProxyGlb(group, file, extras = {}) {
  const doc={asset:{version:'2.0',generator:'家有新解 normalized reference proxies',extras:{physical_scale:'unknown; do not interpret the proxy normalization as measured metres',...extras}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};
  const chunks=[];let offset=0;
  function accessor(array,components,type,target) {
    const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});
    chunks.push(bytes);offset+=bytes.length;
    const componentType=array instanceof Float32Array?5126:array instanceof Uint32Array?5125:5123;
    const a={bufferView:view,componentType,count:array.length/components,type};
    if(type==='VEC3'&&target===34962){a.min=[0,1,2].map(c=>{let min=Infinity;for(let i=c;i<array.length;i+=3)min=Math.min(min,array[i]);return min;});a.max=[0,1,2].map(c=>{let max=-Infinity;for(let i=c;i<array.length;i+=3)max=Math.max(max,array[i]);return max;});}
    doc.accessors.push(a);return doc.accessors.length-1;
  }
  group.updateMatrixWorld(true);
  group.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry,mat=object.material;
    const position=accessor(new Float32Array(geometry.attributes.position.array),3,'VEC3',34962);
    const normal=accessor(new Float32Array(geometry.attributes.normal.array),3,'VEC3',34962);
    const material=doc.materials.length;
    doc.materials.push({name:'proxy surface',pbrMetallicRoughness:{baseColorFactor:[mat.color.r,mat.color.g,mat.color.b,1],metallicFactor:0,roughnessFactor:.85},doubleSided:false});
    const primitive={attributes:{POSITION:position,NORMAL:normal},material};
    if(geometry.index)primitive.indices=accessor(geometry.index.array instanceof Uint32Array?new Uint32Array(geometry.index.array):new Uint16Array(geometry.index.array),1,'SCALAR',34963);
    const mesh=doc.meshes.length;doc.meshes.push({name:object.name,primitives:[primitive]});
    const node=doc.nodes.length;doc.nodes.push({name:object.name,mesh,matrix:object.matrixWorld.toArray(),extras:object.userData});doc.scenes[0].nodes.push(node);
  });
  const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
  doc.buffers[0].byteLength=offset;
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const binary=Buffer.concat(chunks),header=Buffer.alloc(12),jheader=Buffer.alloc(8),bheader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+binary.length,8);
  jheader.writeUInt32LE(json.length,0);jheader.writeUInt32LE(0x4e4f534a,4);bheader.writeUInt32LE(binary.length,0);bheader.writeUInt32LE(0x004e4942,4);
  await writeFile(file,Buffer.concat([header,jheader,json,bheader,binary]));
  return {mesh_count:doc.meshes.length,node_count:doc.nodes.length,byte_length:header.readUInt32LE(8)};
}
