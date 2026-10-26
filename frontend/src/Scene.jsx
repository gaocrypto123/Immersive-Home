import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OUTLINE, PALETTE, ROOM_RATIO } from "./model.js";
const W = 5,
  D = W * ROOM_RATIO;
function dispose(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.map && m.map.userData.owned) m.map.dispose();
        m.dispose();
      }
  });
}
function material(c) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.78 });
}
function box(parent, w, h, d, x, y, z, c, r = 0.025) {
  const g = r
    ? new RoundedBoxGeometry(
        Math.max(0.005, w),
        Math.max(0.005, h),
        Math.max(0.005, d),
        2,
        Math.min(r, w / 4, h / 4, d / 4),
      )
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(g, material(c));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function polygonMesh(poly, depth, c) {
  const s = new THREE.Shape();
  poly.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material(c));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function furniture(a) {
  const group = new THREE.Group();
  const [x0, y0, x1, y1] = a.bounds,
    w = (x1 - x0) * W,
    d = (y1 - y0) * D,
    c = a.color || PALETTE[a.category];
  const east = a.orientation?.includes("右"),
    headEast = a.category === "bed" && east;
  const leg = (x, z, h = 0.52) =>
    box(group, 0.055, h, 0.055, x, h / 2, z, "#695d4e", 0.009);
  if (a.category === "bed") {
    box(group, w, 0.24, d, 0, 0.21, 0, "#b09c85", 0.05);
    box(group, w * 0.97, 0.18, d * 0.97, 0, 0.41, 0, "#f4eee3", 0.07);
    if (headEast) {
      box(group, 0.1, 0.78, d + 0.02, w / 2, 0.52, 0, "#bba48d", 0.04);
      box(group, w * 0.63, 0.055, d * 0.96, -w * 0.17, 0.53, 0, c, 0.025);
      for (const z of [-0.23, 0.23])
        box(
          group,
          w * 0.17,
          0.12,
          d * 0.39,
          w * 0.31,
          0.57,
          d * z,
          "#e7dbcb",
          0.055,
        );
    } else {
      box(group, w + 0.02, 0.78, 0.1, 0, 0.52, -d / 2, "#bba48d", 0.04);
      box(group, w * 0.96, 0.055, d * 0.63, 0, 0.53, d * 0.17, c, 0.025);
      for (const x of [-0.23, 0.23])
        box(
          group,
          w * 0.39,
          0.12,
          d * 0.17,
          w * x,
          0.57,
          -d * 0.31,
          "#e7dbcb",
          0.055,
        );
    }
    for (const x of [-w * 0.4, w * 0.4])
      for (const z of [-d * 0.4, d * 0.4]) leg(x, z, 0.18);
  } else if (
    ["wardrobe", "storage_cabinet", "bedside_cabinet"].includes(a.category)
  ) {
    const tall = a.category === "wardrobe",
      h = tall ? 1.65 : 0.55;
    box(group, w, h, d, 0, h / 2, 0, tall ? "#eeeadd" : "#c8b49a", 0.02);
    box(
      group,
      w + 0.015,
      0.035,
      d + 0.015,
      0,
      h,
      0,
      tall ? "#eee9dc" : "#d9c5aa",
      0.012,
    );
    const vertical = d > w,
      n = Math.max(1, Math.round((vertical ? d : w) / 0.45));
    for (let i = 0; i < n; i++) {
      const offset = (i + 0.5) / n - 0.5;
      if (vertical) {
        const front = a.orientation?.includes("左") ? -1 : 1;
        box(
          group,
          0.012,
          h * 0.9,
          d / n - 0.018,
          front * (w / 2 + 0.008),
          h * 0.52,
          offset * d,
          c,
          0.004,
        );
        box(
          group,
          0.035,
          0.13,
          0.018,
          front * (w / 2 + 0.03),
          h * 0.55,
          offset * d + (d / n) * 0.28,
          "#8c8878",
          0.008,
        );
      } else {
        box(
          group,
          w / n - 0.018,
          h * 0.9,
          0.012,
          offset * w,
          h * 0.52,
          d / 2 + 0.008,
          c,
          0.004,
        );
        box(
          group,
          0.018,
          0.13,
          0.035,
          offset * w + (w / n) * 0.28,
          h * 0.55,
          d / 2 + 0.03,
          "#8c8878",
          0.008,
        );
      }
    }
  } else if (a.category === "desk") {
    if (a.polygon.length > 4) {
      const p = a.polygon.map(([u, v]) => [
        (u - a.center[0]) * W,
        (v - a.center[1]) * D,
      ]);
      const top = polygonMesh(p, 0.065, c);
      top.position.y = 0.76;
      group.add(top);
      for (const [x, z] of p.filter((_, i) => i % 2 === 0))
        leg(x * 0.95, z * 0.95, 0.76);
    } else {
      box(group, w, 0.065, d, 0, 0.79, 0, c, 0.025);
      for (const x of [-w * 0.42, w * 0.42])
        for (const z of [-d * 0.37, d * 0.37]) leg(x, z, 0.76);
      box(group, w * 0.32, 0.2, d * 0.85, w * 0.28, 0.63, 0, "#d9d0bc", 0.015);
    }
  } else if (a.category === "chair") {
    const scale = Math.min(w, d);
    box(group, w * 0.75, 0.1, d * 0.75, 0, 0.43, 0, c, 0.05);
    box(group, w * 0.75, 0.33, 0.06, 0, 0.64, -d * 0.34, c, 0.03);
    for (const x of [-w * 0.27, w * 0.27])
      for (const z of [-d * 0.27, d * 0.27]) leg(x, z, 0.4);
    if (a.orientation?.includes("下")) group.rotation.y = Math.PI;
    else if (east) group.rotation.y = -Math.PI / 2;
    else if (a.orientation?.includes("左")) group.rotation.y = Math.PI / 2;
  } else if (a.category === "walk_in_closet") {
    const p = a.polygon.map(([u, v]) => [
      (u - a.center[0]) * W,
      (v - a.center[1]) * D,
    ]);
    group.add(polygonMesh(p, 1.55, c));
    box(group, w * 0.58, 0.06, d * 0.28, -w * 0.16, 0.65, -d * 0.3, "#dfd8c8");
    box(group, w * 0.58, 0.06, d * 0.28, -w * 0.16, 1.1, -d * 0.3, "#dfd8c8");
  } else if (a.category === "plant") {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.32, w * 0.24, 0.32, 20),
      material("#c9b49a"),
    );
    pot.position.y = 0.16;
    group.add(pot);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(w * 0.24, 14, 10),
        material(i % 2 ? "#658675" : "#809b75"),
      );
      leaf.scale.set(0.7, 1.8, 0.6);
      leaf.position.set(
        Math.sin(i) * w * 0.22,
        0.55 + (i % 3) * 0.1,
        Math.cos(i) * d * 0.22,
      );
      leaf.rotation.z = Math.sin(i) * 0.5;
      group.add(leaf);
    }
  } else box(group, w, 1.6, d, 0, 0.8, 0, "#e0ddd1", 0.012);
  const inner = new THREE.Group();
  inner.add(group);
  inner.rotation.y = (-(a.rotation || 0) * Math.PI) / 180;
  inner.position.set((a.center[0] - 0.5) * W, 0, (a.center[1] - 0.5) * D);
  inner.traverse((o) => {
    if (o.isMesh) o.userData.itemId = a.id;
  });
  return inner;
}
function woodTexture(tone) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  const colors =
    tone === "light"
      ? ["#e3d5bb", "#dfcfb2", "#e8dac2"]
      : tone === "warm"
        ? ["#c9aa83", "#d5b68e", "#c4a27c"]
        : ["#d8d7ce", "#cdcdc4", "#e0dfd6"];
  for (let y = 0; y < 512; y += 64) {
    for (let x = -((y / 64) % 2) * 170; x < 512; x += 170) {
      c.fillStyle = colors[(y / 64 + Math.floor((x + 170) / 170)) % 3];
      c.fillRect(x, y, 169, 63);
      for (let i = 0; i < 7; i++) {
        c.strokeStyle = "rgba(110,86,59,.045)";
        c.beginPath();
        c.moveTo(x, y + 5 + i * 8);
        c.lineTo(x + 168, y + 6 + i * 8);
        c.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.owned = true;
  return t;
}
export default function Scene({
  items,
  selected,
  onSelect,
  onMove,
  onCommit,
  onReady,
  living,
  floor = "light",
  walls = true,
  grid = true,
  snap = false,
  light = 80,
  view = "iso",
  viewTick = 0,
}) {
  const host = useRef(),
    runtime = useRef(),
    latest = useRef({}),
    [status, setStatus] = useState("准备三维场景…"),
    [error, setError] = useState("");
  latest.current = {
    items,
    selected,
    onSelect,
    onMove,
    onCommit,
    onReady,
    living,
    floor,
    walls,
    grid,
    snap,
    light,
  };
  useEffect(() => {
    let disposed = false,
      raf,
      observer,
      controls,
      renderer,
      root,
      model,
      helper;
    const node = host.current;
    delete node.dataset.loaded;
    node.dataset.case = living?.id || "bedroom";
    setStatus(living ? "加载本地完整场景…" : "");
    setError("");
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-label", "交互三维房间");
      node.appendChild(renderer.domElement);
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(37, 1, 0.03, 180);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 2;
      controls.maxDistance = 38;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;
      const hemi = new THREE.HemisphereLight("#fff9ec", "#c1ccc0", 2.7);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight("#fff5e4", 3.6);
      sun.position.set(-3, 9, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -9;
      sun.shadow.camera.right = 9;
      sun.shadow.camera.top = 9;
      sun.shadow.camera.bottom = -9;
      sun.shadow.normalBias = 0.03;
      sun.shadow.bias = -0.0001;
      scene.add(sun);
      const fill = new THREE.DirectionalLight("#ffffff", 1.3);
      fill.position.set(5, 6, -5);
      scene.add(fill);
      const itemsGroup = new THREE.Group();
      scene.add(itemsGroup);
      root = new THREE.Group();
      scene.add(root);
      let roomWalls = [],
        gridHelper,
        base;
      if (!living) {
        base = polygonMesh(
          OUTLINE.map(([u, v]) => [(u - 0.5) * W, (v - 0.5) * D]),
          0.12,
          "#eee4d1",
        );
        base.position.y = -0.12;
        base.material.map = woodTexture(latest.current.floor);
        root.add(base);
        const addWall = (x, z, w, d, h) => {
          const m = box(root, w, h, d, x, h / 2, z, "#eeeae0", 0.008);
          roomWalls.push(m);
        };
        addWall((0.67 - 0.5) * W, -D / 2, W * 0.66, 0.09, 1.75);
        addWall(W / 2, 0, 0.09, D, 0.16);
        addWall(-W / 2, D * 0.075, 0.09, D * 0.85, 1.18);
        addWall((0.34 - 0.5) * W, -D * 0.425, 0.09, D * 0.15, 1.75);
        addWall(W * (0.12 - 0.5), D / 2, W * 0.24, 0.08, 0.18);
        addWall(W * (0.91 - 0.5), D / 2, W * 0.18, 0.08, 0.18);
        for (let i = 0; i < 2; i++)
          box(
            root,
            W * 0.58,
            0.035,
            0.04,
            W * 0.03,
            0.05 + i * 0.07,
            D / 2,
            "#d7ddd5",
            0.004,
          );
        const glass = box(
          root,
          W * 0.58,
          0.14,
          0.025,
          W * 0.03,
          0.11,
          D / 2,
          "#bed3cc",
          0.003,
        );
        glass.material.transparent = true;
        glass.material.opacity = 0.7;
        const doorArc = new THREE.EllipseCurve(
          -W / 2,
          -D * 0.35,
          W * 0.3,
          W * 0.3,
          0,
          Math.PI / 2,
          false,
          0,
        );
        const pts = doorArc
          .getPoints(40)
          .map((p) => new THREE.Vector3(p.x, 0.008, p.y));
        root.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
              color: "#a3b19f",
              transparent: true,
              opacity: 0.55,
            }),
          ),
        );
        gridHelper = new THREE.GridHelper(14, 70, "#bcc4b9", "#cbd2c9");
        gridHelper.position.y = -0.14;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.24;
        scene.add(gridHelper);
      }
      if (living) {
        gridHelper = new THREE.GridHelper(24, 60, "#bbc3b4", "#cbd2c2");
        gridHelper.position.y = -0.14;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.16;
        scene.add(gridHelper);
      }
      function select(id) {
        if (helper) {
          scene.remove(helper);
          dispose(helper);
          helper = null;
        }
        if (!id) return;
        const target = new THREE.Box3();
        if (living) {
          model?.traverse((o) => {
            if (o.isMesh && o.userData.instance_id === id)
              target.expandByObject(o);
          });
        } else {
          const g = itemsGroup.children.find((c) => c.userData.id === id);
          if (g) target.setFromObject(g);
        }
        if (!target.isEmpty()) {
          helper = new THREE.Box3Helper(target, "#3e7f66");
          helper.material.depthTest = false;
          helper.renderOrder = 10;
          scene.add(helper);
        }
      }
      function setData() {
        if (!living) {
          for (const child of [...itemsGroup.children]) {
            itemsGroup.remove(child);
            dispose(child);
          }
          for (const a of latest.current.items) {
            const g = furniture(a);
            g.userData.id = a.id;
            itemsGroup.add(g);
          }
        }
        select(latest.current.selected);
      }
      function appearance() {
        const p = latest.current;
        sun.intensity = 1.5 + p.light * 0.032;
        hemi.intensity = 1.7 + p.light * 0.012;
        roomWalls.forEach((m) => {
          m.visible = p.walls;
        });
        if (gridHelper) gridHelper.visible = p.grid;
        if (base && base.userData.tone !== p.floor) {
          base.material.map?.dispose();
          base.material.map = woodTexture(p.floor);
          base.userData.tone = p.floor;
        }
        if (living && model) {
          const cut = new Set(living.settings.cutaway_walls);
          model.traverse((o) => {
            if (!o.isMesh) return;
            o.visible =
              !o.name.startsWith("Ceiling_") &&
              !(cut.has(o.userData.wall_id) && !p.walls);
            if (
              runtime.current?.mode === "top" &&
              /^(Wall_|Frame_|Door_|Handle_|Glass_|Window|Bay)/.test(o.name) &&
              !p.walls
            )
              o.visible = false;
          });
        }
      }
      function setView(mode = "iso") {
        if (living) {
          const cfg =
            living.settings.views[
              mode === "top" ? "top" : mode === "living" ? "living" : "whole"
            ];
          camera.position.set(...cfg.position);
          camera.up.set(...cfg.up);
          controls.target.set(...cfg.target);
          camera.fov = cfg.fov;
        } else {
          camera.up.set(0, 1, 0);
          controls.target.set(0, 0.25, 0.08);
          camera.fov = 37;
          if (mode === "top") {
            camera.position.set(0, 13, 0.01);
            camera.up.set(0, 0, -1);
          } else if (mode === "living") camera.position.set(5.6, 4.0, 6.8);
          else camera.position.set(7.8, 9.4, 10.5);
        }
        const fitFactor = Math.max(1, 0.85 / camera.aspect);
        camera.position
          .sub(controls.target)
          .multiplyScalar(fitFactor)
          .add(controls.target);
        camera.updateProjectionMatrix();
        controls.update();
        if (runtime.current) runtime.current.mode = mode;
        appearance();
      }
      const api = {
        setData,
        appearance,
        setView,
        zoom: (f) => {
          const v = camera.position
            .clone()
            .sub(controls.target)
            .multiplyScalar(f);
          camera.position.copy(controls.target).add(v);
          controls.update();
        },
        capture: () => {
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL("image/png");
        },
        mode: "iso",
      };
      runtime.current = api;
      latest.current.onReady?.(api);
      setView();
      setData();
      appearance();
      if (living)
        new GLTFLoader().load(
          living.model,
          (gltf) => {
            if (disposed) {
              dispose(gltf.scene);
              return;
            }
            model = gltf.scene;
            scene.add(model);
            appearance();
            select(latest.current.selected);
            setStatus("");
            node.dataset.loaded = "true";
          },
          (event) => {
            if (!disposed && event.total)
              setStatus(
                `加载本地模型 ${Math.round((event.loaded / event.total) * 100)}%`,
              );
          },
          (e) => {
            if (!disposed) {
              setError("场景加载失败，请确认本地案例素材完整。");
              setStatus("");
              console.error(e);
            }
          },
        );
      else node.dataset.loaded = "true";
      const ray = new THREE.Raycaster(),
        mouse = new THREE.Vector2(),
        plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      let drag = null,
        down = null;
      function cast(e) {
        const r = renderer.domElement.getBoundingClientRect();
        mouse.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        ray.setFromCamera(mouse, camera);
      }
      function point() {
        return ray.ray.intersectPlane(plane, new THREE.Vector3());
      }
      const pointerDown = (e) => {
        if (e.button !== 0) return;
        cast(e);
        down = [e.clientX, e.clientY];
        const hit = ray
          .intersectObject(living ? model || itemsGroup : itemsGroup, true)
          .find((h) => h.object.visible);
        if (!hit) {
          latest.current.onSelect(null);
          return;
        }
        const id = living
          ? hit.object.userData.instance_id
          : hit.object.userData.itemId;
        if (!id) return;
        latest.current.onSelect(id);
        if (!living) {
          const p = point(),
            a = latest.current.items.find((a) => a.id === id);
          if (p && a) {
            drag = { id, start: p.clone(), center: [...a.center] };
            latest.current.onCommit();
            controls.enabled = false;
            renderer.domElement.setPointerCapture(e.pointerId);
          }
        }
      };
      const pointerMove = (e) => {
        if (!drag) return;
        cast(e);
        const p = point();
        if (!p) return;
        const step = latest.current.snap ? 0.02 : 0.001;
        const u = Math.max(
            0,
            Math.min(
              1,
              Math.round((drag.center[0] + (p.x - drag.start.x) / W) / step) *
                step,
            ),
          ),
          v = Math.max(
            0,
            Math.min(
              1,
              Math.round((drag.center[1] + (p.z - drag.start.z) / D) / step) *
                step,
            ),
          );
        latest.current.onMove(drag.id, [u, v]);
      };
      const pointerUp = () => {
        drag = null;
        controls.enabled = true;
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown);
      renderer.domElement.addEventListener("pointermove", pointerMove);
      renderer.domElement.addEventListener("pointerup", pointerUp);
      renderer.domElement.addEventListener("lostpointercapture", pointerUp);
      observer = new ResizeObserver(() => {
        const w = node.clientWidth,
          h = node.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        setView(runtime.current?.mode || "iso");
      });
      observer.observe(node);
      const tick = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        observer?.disconnect();
        controls.dispose();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
        });
        dispose(scene);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        runtime.current = null;
        latest.current.onReady?.(null);
      };
    } catch (e) {
      console.error(e);
      setError("当前浏览器无法创建三维画布，可切换到 2D 平面继续编辑。");
      renderer?.dispose();
    }
  }, [living?.id]);
  useEffect(() => runtime.current?.setData(), [items, selected]);
  useEffect(() => runtime.current?.appearance(), [floor, walls, grid, light]);
  useEffect(() => runtime.current?.setView(view), [view, viewTick]);
  return (
    <div className="scene-host">
      <div className="three-mount" ref={host} data-testid="three-scene" />
      {(status || error) && (
        <div className={`scene-message ${error ? "error" : ""}`}>
          {!error && <span className="loading-ring" />}
          {error || status}
        </div>
      )}
    </div>
  );
}
