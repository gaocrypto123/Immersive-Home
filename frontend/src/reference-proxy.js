import * as THREE from 'three';

// Geometry is a normalized, uncalibrated proxy. It is never a photo reconstruction.
export const PROXY_HEIGHTS = {
  bed:.23, wardrobe:.66, wall_cabinet:.20, cabinet:.30, nightstand:.20,
  desk:.25, chair:.29, bench:.16, rug:.004, curtain:.64,
  table_lamp:.15, wall_lamp:.05, plant:.18, vase:.13, wall_art:.24, record_player:.025,
};
export function createInstanceProxy(item) {
  const group = new THREE.Group();
  group.name = item.instance_id;
  group.userData = { instance_id:item.instance_id, case_id:item.case_id, room_id:item.room_id, geometry_status:'uncalibrated_proxy' };
  const [x0,z0,x1,z1] = item.proxy.footprint_uv;
  const w=x1-x0, d=z1-z0, h=item.proxy.height_units;
  group.position.set((x0+x1)/2, item.proxy.base_y_units, (z0+z1)/2);
  const material = new THREE.MeshStandardMaterial({ color:item.appearance.display_color, roughness:.8 });
  const pale = new THREE.MeshStandardMaterial({color:'#e7dfcb',roughness:.95});
  const dark = new THREE.MeshStandardMaterial({color:'#484c3e',roughness:.8});
  function mesh(geometry, mat, x,y,z) {
    const object = new THREE.Mesh(geometry, mat || material);
    object.position.set(x,y,z); object.userData = {...group.userData};
    object.name = `${group.name}-part-${group.children.length+1}`;
    group.add(object); return object;
  }
  const box=(a,b,c,x=0,y=b/2,z=0,mat=material)=>mesh(new THREE.BoxGeometry(a,b,c),mat,x,y,z);
  const cylinder=(r1,r2,height,x,y,z,mat=material)=>mesh(new THREE.CylinderGeometry(r1,r2,height,16),mat,x,y,z);
  const parts=item.proxy.parts_uv || [[x0,z0,x1,z1]];
  if (item.category==='bed') {
    box(w,.065,d,0,.035,0);
    box(w*.94,.09,d*.94,0,.105,0,pale);
    if (item.proxy.head_direction==='east') {
      box(.025,h,d,w/2-.012,h/2,0);
      box(w*.17,.035,d*.37,w*.30,.17,-d*.23,pale);
      box(w*.17,.035,d*.37,w*.30,.17,d*.23,pale);
      box(w*.22,.012,d*.95,-w*.23,.158,0,dark);
    } else {
      box(w,h,.025,0,h/2,-d/2+.012);
      box(w*.4,.035,d*.16,-w*.23,.17,-d*.32,pale);
      box(w*.4,.035,d*.16,w*.23,.17,-d*.32,pale);
      box(w*.95,.012,d*.23,0,.158,d*.23,dark);
    }
  } else if (item.category==='desk' || item.category==='bench') {
    for (const p of parts) {
      const pw=p[2]-p[0],pd=p[3]-p[1],cx=(p[0]+p[2]-x0-x1)/2,cz=(p[1]+p[3]-z0-z1)/2;
      box(pw,.018,pd,cx,h-.009,cz);
      for (const sx of [-1,1]) for (const sz of [-1,1]) box(.015,h-.018,.015,cx+sx*(pw/2-.015),(h-.018)/2,cz+sz*(pd/2-.015));
    }
  } else if (['wardrobe','cabinet','wall_cabinet','nightstand'].includes(item.category)) {
    parts.forEach((p,i)=>{
      const pw=p[2]-p[0],pd=p[3]-p[1],cx=(p[0]+p[2]-x0-x1)/2,cz=(p[1]+p[3]-z0-z1)/2;
      const ph=item.proxy.part_heights_units?.[i] || h;
      box(pw,ph,pd,cx,ph/2,cz);
    });
  } else if (item.category==='chair') {
    box(w*.86,.025,d*.80,0,.13,0);
    box(w*.86,.15,.025,0,.215,-d*.39);
    for(const sx of [-1,1])for(const sz of [-1,1])box(.013,.12,.013,sx*w*.33,.06,sz*d*.30,dark);
  } else if (item.category==='plant' || item.category==='vase') {
    const r=Math.min(w,d)*.35;
    cylinder(r*.85,r,h*.45,0,h*.225,0);
    for(let i=0;i<7;i++) {
      const angle=i*Math.PI*2/7;
      const leaves=mesh(new THREE.SphereGeometry(r*.8,10,7),dark,Math.cos(angle)*r*.65,h*(.5+(i%3)*.13),Math.sin(angle)*r*.65);
      leaves.scale.set(1,.55,1);
    }
  } else if (item.category==='table_lamp') {
    const r=Math.min(w,d)*.45;
    cylinder(r,r,.01,0,.005,0,dark);
    cylinder(.005,.005,h*.65,0,h*.33,0,dark);
    cylinder(r*.70,r,h*.35,0,h*.80,0,pale);
  } else if (item.category==='record_player') {
    box(w,h,d);
    cylinder(Math.min(w,d)*.34,Math.min(w,d)*.34,.003,0,h+.001,0,dark);
  } else if(item.category==='curtain') {
    for(let i=0;i<10;i++)box(w/10*.93,h,d,(i-4.5)*w/10,h/2,0,i%2?pale:material);
  } else {
    box(w,h,d);
  }
  return group;
}
export function createReferenceProxyScene(items, roomId) {
  const group = new THREE.Group(); group.name=roomId;
  const mat = new THREE.MeshStandardMaterial({color:'#d9d1b9',roughness:1});
  function shell(name,w,h,d,x,y,z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.name=name; m.position.set(x,y,z); m.userData={room_id:roomId,geometry_status:'uncalibrated_proxy'};group.add(m);
  }
  shell('proxy-floor',1,.015,1,.5,-.009,.5);
  shell('proxy-back-wall',1,.70,.015,.5,.35,-.008);
  shell('proxy-right-wall',.015,.70,1,1.008,.35,.5);
  shell('proxy-left-wall-after-entry',.015,.70,.72,-.008,.35,.64);
  for(const item of items)group.add(createInstanceProxy(item));
  return group;
}
