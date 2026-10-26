import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Bundled into each offline HTML. The model is embedded, never fetched.
const meta = JSON.parse(document.getElementById("room-meta").textContent);
const mount = document.getElementById("room-view");
const status = document.getElementById("status");
const picture = document.getElementById("stage-picture");
const tools = document.getElementById("view-tools");
let root, controls, renderer, camera, top = false, open = true, transparent = true;
const walls = [], pivots = [];
function view() {
  const cx = meta.width / 2, cz = meta.depth / 2;
  const scale = camera.aspect < 0.9 ? 1.35 : 1;
  camera.up.set(0, 1, 0);
  controls.target.set(cx, top ? 0 : 0.6, cz);
  if (top) {
    camera.position.set(cx, 9.5 * scale, cz + 0.001);
    camera.up.set(0, 0, -1);
  } else camera.position.set(cx - 4.7 * scale, 8.5 * scale, cz + 5.4 * scale);
  camera.lookAt(controls.target);
  controls.update();
}
function resize() {
  if (!renderer || !mount.clientWidth || !mount.clientHeight) return;
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  camera.aspect = mount.clientWidth / mount.clientHeight;
  camera.updateProjectionMatrix();
  view();
}
function setWalls() {
  for (const wall of walls) {
    const materials = Array.isArray(wall.material) ? wall.material : [wall.material];
    for (const m of materials) {
      m.opacity = transparent ? 0.16 : 1;
      m.transparent = transparent;
      m.depthWrite = !transparent;
      m.needsUpdate = true;
    }
  }
}
for (const button of document.querySelectorAll("[data-stage]")) {
  button.addEventListener("click", () => {
    const stage = button.dataset.stage;
    document.querySelectorAll("[data-stage]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    const is3d = stage === "4";
    picture.hidden = is3d;
    mount.hidden = !is3d;
    tools.hidden = !is3d;
    if (!is3d) {
      picture.src = meta.stages[Number(stage) - 1];
      picture.alt = button.textContent;
    } else resize();
  });
}
document.getElementById("camera").addEventListener("click", () => {
  top = !top; view();
  document.getElementById("camera").textContent = top ? "切换鸟瞰" : "切换俯视";
});
document.getElementById("door").addEventListener("click", () => {
  open = !open;
  pivots.forEach(p => p.rotation.y = open ? p.userData.openY : p.userData.closedY);
  document.getElementById("door").textContent = open ? "关闭房门" : "打开房门";
});
document.getElementById("walls").addEventListener("click", () => {
  transparent = !transparent; setWalls();
  document.getElementById("walls").textContent = transparent ? "显示完整墙体" : "前墙透明";
});
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-label", "可旋转的三维空房，单位米，房高2.8米");
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f1f2ea");
  camera = new THREE.PerspectiveCamera(38, 1, 0.02, 80);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 15;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  scene.add(new THREE.HemisphereLight("#fff7e9", "#b6c4b4", 2.8));
  const sun = new THREE.DirectionalLight("#fff3dd", 3.5);
  sun.position.set(-3, 8, 7); scene.add(sun);
  const fill = new THREE.DirectionalLight("#f2f8ff", 1.2);
  fill.position.set(6, 5, -3); scene.add(fill);
  const bytes = Uint8Array.from(atob(document.getElementById("room-bytes").textContent.trim()), c => c.charCodeAt(0));
  new GLTFLoader().parse(bytes.buffer, "", gltf => {
    root = gltf.scene; scene.add(root);
    root.traverse(o => {
      if (o.userData.frontWall && o.material) {
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        walls.push(o);
      }
      if (o.userData.exportDoorPivot) pivots.push(o);
    });
    setWalls(); resize();
    mount.dataset.ready = "true";
    mount.dataset.modelWidth = String(meta.width);
    mount.dataset.modelDepth = String(meta.depth);
    mount.dataset.wallHeight = "2.8";
    mount.dataset.meshes = String(meta.meshes);
    status.textContent = "拖动旋转 · 滚轮缩放 · GLB 已载入 · 单位 m";
    document.querySelectorAll("#view-tools button").forEach(b => b.disabled = false);
    renderer.setAnimationLoop(() => {
      if (!mount.hidden) { controls.update(); renderer.render(scene, camera); }
    });
  }, error => {
    status.textContent = "三维读取失败：" + error.message;
    mount.dataset.error = error.message;
  });
  new ResizeObserver(resize).observe(mount);
} catch (error) {
  status.textContent = "当前浏览器无法开启 WebGL；SVG 与 GLB 文件仍可单独打开。";
  mount.dataset.error = error.message;
}
