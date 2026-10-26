import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  captureArchitecture,
  applyArchitectureGrowth,
  clamp01,
  smooth,
} from "./parsing-animation.js";
import {
  buildMetricArchitecture,
  buildMetricFurniture,
  disposeMetric,
  setMetricDoor,
} from "./metric-three.js";

export default function MetricScene({
  room,
  items,
  selected,
  onSelect,
  onMove,
  doorOpen,
  transparentFront,
  cameraMode,
  onReady,
  constructionProgress,
}) {
  const mount = useRef(null),
    api = useRef(null),
    latest = useRef({}),
    [error, setError] = useState("");
  latest.current = {
    items,
    selected,
    onSelect,
    onMove,
    doorOpen,
    transparentFront,
    cameraMode,
    onReady,
    constructionProgress,
  };
  useEffect(() => {
    const node = mount.current;
    let renderer, controls, frame, observer, selection;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f2ea");
    let arch,
      constructionCapture,
      lastGrowth = null,
      notified = false,
      drag = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute(
        "aria-label",
        "按估算尺寸生成的三维卧室",
      );
      node.appendChild(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 80);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 3;
      controls.maxDistance = 15;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;
      scene.add(new THREE.HemisphereLight("#fff7e9", "#b6c4b4", 2.8));
      const sun = new THREE.DirectionalLight("#fff3dd", 3.5);
      sun.position.set(-3, 8, 7);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, {
        left: -6,
        right: 6,
        top: 6,
        bottom: -6,
      });
      sun.shadow.normalBias = 0.025;
      scene.add(sun);
      const fill = new THREE.DirectionalLight("#f2f8ff", 1.2);
      fill.position.set(6, 5, -3);
      scene.add(fill);
      const furniture = new THREE.Group();
      scene.add(furniture);
      function setArch() {
        if (arch) {
          scene.remove(arch.group);
          disposeMetric(arch.group);
        }
        arch = buildMetricArchitecture(
          room,
          latest.current.transparentFront,
          latest.current.doorOpen,
        );
        scene.add(arch.group);
        node.dataset.modelSummary = JSON.stringify(arch.summary);
        constructionCapture = latest.current.constructionProgress
          ? captureArchitecture(arch)
          : null;
        lastGrowth = null;
        notified = false;
      }
      function setSelection() {
        node.dataset.selectedId = latest.current.selected || "";
        if (selection) {
          scene.remove(selection);
          disposeMetric(selection);
          selection = null;
        }
        const target = furniture.children.find(
          (c) => c.userData.itemId === latest.current.selected,
        );
        if (target) {
          selection = new THREE.Box3Helper(
            new THREE.Box3().setFromObject(target),
            "#3b8863",
          );
          selection.material.depthTest = false;
          selection.renderOrder = 20;
          scene.add(selection);
        }
      }
      function setItems() {
        for (const child of [...furniture.children]) {
          furniture.remove(child);
          disposeMetric(child);
        }
        for (const item of latest.current.items)
          furniture.add(buildMetricFurniture(item));
        node.dataset.furnitureSummary = JSON.stringify(
          furniture.children.map((g) => ({
            id: g.userData.itemId,
            x: g.position.x,
            z: g.position.z,
            rotationY: g.rotation.y,
          })),
        );
        setSelection();
      }
      function setDoor() {
        arch.doorPivots.forEach(({ door, pivot }) =>
          setMetricDoor(pivot, door, latest.current.doorOpen),
        );
        const summary = {
          ...arch.summary,
          doors: arch.summary.doors.map((d, i) => ({
            ...d,
            openRotationY: arch.doorPivots[i].pivot.rotation.y,
          })),
        };
        node.dataset.modelSummary = JSON.stringify(summary);
      }
      function view() {
        const cx = room.width / 2,
          cz = room.depth / 2,
          aspect = camera.aspect;
        controls.target.set(cx, 0.6, cz);
        const scale = aspect < 0.9 ? 1.35 : 1;
        camera.up.set(0, 1, 0);
        if (latest.current.cameraMode === "top") {
          camera.position.set(cx, 9.5 * scale, cz + 0.001);
          camera.up.set(0, 0, -1);
          controls.target.set(cx, 0, cz);
        } else
          camera.position.set(cx - 4.7 * scale, 8.5 * scale, cz + 5.4 * scale);
        camera.lookAt(controls.target);
        controls.update();
        camera.updateMatrixWorld(true);
        node.dataset.cameraSummary = JSON.stringify({
          projection: camera.projectionMatrix.elements,
          inverseWorld: camera.matrixWorldInverse.elements,
        });
      }
      function resize() {
        const b = node.getBoundingClientRect();
        renderer.setSize(b.width, Math.max(1, b.height), false);
        camera.aspect = b.width / Math.max(1, b.height);
        camera.updateProjectionMatrix();
        view();
      }
      const ray = new THREE.Raycaster(),
        pointer = new THREE.Vector2(),
        plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      function cast(e) {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        ray.setFromCamera(pointer, camera);
      }
      function floorPoint(e) {
        cast(e);
        return ray.ray.intersectPlane(plane, new THREE.Vector3());
      }
      function down(e) {
        if (e.button !== 0) return;
        cast(e);
        const hit = ray.intersectObjects(furniture.children, true)[0];
        if (!hit) {
          latest.current.onSelect(null);
          return;
        }
        let obj = hit.object;
        while (obj && !obj.userData.itemId) obj = obj.parent;
        const item = latest.current.items.find(
            (f) => f.id === obj?.userData.itemId,
          ),
          p = floorPoint(e);
        if (!item || !p) return;
        controls.enabled = false;
        drag = { id: item.id, offset: [item.cx - p.x, item.cy - p.z] };
        latest.current.onSelect(item.id);
        renderer.domElement.setPointerCapture(e.pointerId);
      }
      function move(e) {
        if (!drag) return;
        const p = floorPoint(e);
        if (p)
          latest.current.onMove(drag.id, [
            p.x + drag.offset[0],
            p.z + drag.offset[1],
          ]);
      }
      function up() {
        drag = null;
        controls.enabled =
          !latest.current.constructionProgress ||
          latest.current.constructionProgress.current >= 1;
      }
      renderer.domElement.addEventListener("pointerdown", down, true);
      renderer.domElement.addEventListener("pointermove", move);
      renderer.domElement.addEventListener("pointerup", up);
      renderer.domElement.addEventListener("lostpointercapture", up);
      observer = new ResizeObserver(resize);
      observer.observe(node);
      api.current = { setItems, setSelection, setArch, setDoor, view };
      setArch();
      setItems();
      resize();
      function notifyReady() {
        if (notified) return;
        notified = true;
        latest.current.onReady?.({
          ...arch.summary,
          wallHeight: Math.max(
            ...arch.group.children
              .filter((o) => o.userData.wallId)
              .map(
                (o) =>
                  new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3())
                    .y,
              ),
          ),
        });
      }
      function updateConstruction() {
        if (!constructionCapture) return;
        const p = clamp01(latest.current.constructionProgress.current);
        if (p === lastGrowth) return;
        lastGrowth = p;
        const growth = applyArchitectureGrowth(constructionCapture, p);
        node.dataset.constructionProgress = String(p);
        const wall = arch.group.children.find((o) => o.userData.wallId);
        node.dataset.visibleWallHeight = String(
          growth
            ? new THREE.Box3().setFromObject(wall).getSize(new THREE.Vector3())
                .y
            : 0,
        );
        if (p < 1) {
          notified = false;
          controls.enabled = false;
          const cx = room.width / 2,
            cz = room.depth / 2,
            scale = camera.aspect < 0.9 ? 1.35 : 1,
            tilt = smooth(p);
          controls.target.set(cx, 0.6 * tilt, cz);
          camera.up.set(0, 1, 0);
          camera.position.set(
            cx - 4.7 * scale * tilt,
            (9.5 - tilt) * scale,
            cz + 0.001 + (5.4 * scale - 0.001) * tilt,
          );
          camera.lookAt(controls.target);
        } else {
          controls.enabled = true;
          view();
          notifyReady();
        }
      }
      function render() {
        frame = requestAnimationFrame(render);
        updateConstruction();
        controls.update();
        renderer.render(scene, camera);
      }
      render();
      setError("");
      if (!constructionCapture) notifyReady();
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        renderer.domElement.removeEventListener("pointerdown", down, true);
        renderer.domElement.removeEventListener("pointermove", move);
        renderer.domElement.removeEventListener("pointerup", up);
        renderer.domElement.removeEventListener("lostpointercapture", up);
        controls.dispose();
        disposeMetric(scene);
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };
    } catch (e) {
      setError(`三维暂不可用：${e.message}。仍可使用 2D 平面图。`);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      controls?.dispose();
      disposeMetric(scene);
      renderer?.dispose();
      renderer?.domElement.remove();
      api.current = null;
    }
  }, [room]);
  useEffect(() => api.current?.setItems(), [items]);
  useEffect(() => api.current?.setSelection(), [selected]);
  useEffect(() => api.current?.setDoor(), [doorOpen]);
  useEffect(() => api.current?.setArch(), [transparentFront]);
  useEffect(() => api.current?.view(), [cameraMode]);
  return (
    <div className="metric-three">
      <div ref={mount} className="metric-three-mount" />
      {error && (
        <p className="metric-three-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
