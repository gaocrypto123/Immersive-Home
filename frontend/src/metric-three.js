import * as THREE from "three";

export function disposeMetric(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      m?.dispose();
  });
}
function box(parent, w, h, d, x, y, z, color, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
    }),
  );
  m.position.set(x, y, z);
  m.castShadow = opacity === 1;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function rectBox(parent, r, low, high, color, opacity = 1) {
  return box(
    parent,
    r[2] - r[0],
    high - low,
    r[3] - r[1],
    (r[0] + r[2]) / 2,
    (low + high) / 2,
    (r[1] + r[3]) / 2,
    color,
    opacity,
  );
}
export function setMetricDoor(pivot, door, open) {
  const vector = open ? door.open : door.closed;
  pivot.rotation.y = -Math.atan2(vector[1], vector[0]);
}
export function buildMetricArchitecture(
  room,
  transparentFront = true,
  doorOpen = true,
) {
  const group = new THREE.Group(),
    doorPivots = [],
    windowPanes = [];
  const shape = new THREE.Shape();
  room.outline.forEach(([x, z], i) =>
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: "#e1cfad", roughness: 0.9 }),
  );
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  group.add(floor);
  const opacity = (r) =>
    transparentFront && (r[2] <= 1e-5 || r[1] >= room.depth - 1e-5) ? 0.16 : 1;
  room.walls.forEach((w) => {
    const m = rectBox(
      group,
      w.rect,
      0,
      room.height,
      "#f0eee3",
      opacity(w.rect),
    );
    m.userData.wallId = w.id;
  });
  for (const d of room.doors) {
    rectBox(group, d.rect, d.height, room.height, "#f0eee3", opacity(d.rect));
    const pivot = new THREE.Group();
    pivot.position.set(d.hinge[0], 0, d.hinge[1]);
    const leaf = box(
      pivot,
      d.width,
      d.height,
      d.thickness,
      d.width / 2,
      d.height / 2,
      0,
      "#bfa27e",
    );
    leaf.userData.doorId = d.id;
    box(
      pivot,
      0.025,
      0.09,
      0.035,
      d.width - 0.065,
      1,
      d.thickness / 2 + 0.012,
      "#756a54",
    );
    setMetricDoor(pivot, d, doorOpen);
    group.add(pivot);
    doorPivots.push({ door: d, pivot, leaf });
    const a0 = Math.atan2(d.closed[1], d.closed[0]),
      a1 = Math.atan2(d.open[1], d.open[0]);
    const pts = Array.from({ length: 33 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / 32;
      return new THREE.Vector3(
        d.hinge[0] + Math.cos(a) * d.width,
        0.008,
        d.hinge[1] + Math.sin(a) * d.width,
      );
    });
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: "#8fa184",
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
  }
  for (const win of room.windows) {
    const r = win.rect,
      head = win.sill + win.height;
    rectBox(group, r, 0, win.sill, "#f0eee3", opacity(r));
    rectBox(group, r, head, room.height, "#f0eee3", opacity(r));
    const horizontal = r[2] - r[0] > r[3] - r[1],
      width = horizontal ? r[2] - r[0] : r[3] - r[1];
    const cx = (r[0] + r[2]) / 2,
      cz = (r[1] + r[3]) / 2;
    const pane = box(
      group,
      horizontal ? width : 0.018,
      win.height,
      horizontal ? 0.018 : width,
      cx,
      win.sill + win.height / 2,
      cz,
      "#99c6c3",
      0.22,
    );
    pane.userData.windowId = win.id;
    windowPanes.push({ window: win, pane });
    for (const y of [win.sill + 0.018, head - 0.018])
      box(
        group,
        horizontal ? width : 0.055,
        0.036,
        horizontal ? 0.055 : width,
        cx,
        y,
        cz,
        "#aeb6a3",
      );
    const divisions = Math.max(1, Math.round(width / 0.75));
    for (let i = 0; i <= divisions; i++) {
      const t = -width / 2 + 0.02 + ((width - 0.04) * i) / divisions;
      box(
        group,
        0.04,
        win.height,
        0.04,
        cx + (horizontal ? t : 0),
        win.sill + win.height / 2,
        cz + (horizontal ? 0 : t),
        "#aeb6a3",
      );
    }
  }
  group.updateMatrixWorld(true);
  const floorBox = new THREE.Box3().setFromObject(floor),
    floorSize = new THREE.Vector3();
  floorBox.getSize(floorSize);
  const summary = {
    floorWidth: floorSize.x,
    floorDepth: floorSize.z,
    wallHeight: room.height,
    doors: doorPivots.map(({ door, pivot, leaf }) => ({
      id: door.id,
      hinge: [pivot.position.x, pivot.position.z],
      width: leaf.geometry.parameters.width,
      height: leaf.geometry.parameters.height,
      openRotationY: pivot.rotation.y,
    })),
    windows: windowPanes.map(({ window, pane }) => {
      const b = new THREE.Box3().setFromObject(pane);
      return {
        id: window.id,
        width: Math.max(b.max.x - b.min.x, b.max.z - b.min.z),
        sill: b.min.y,
        head: b.max.y,
        center: [pane.position.x, pane.position.z],
      };
    }),
  };
  return { group, summary, doorPivots, windowPanes, floor };
}
export function buildMetricFurniture(f) {
  const g = new THREE.Group(),
    { w, d, height: h, color: c } = f;
  if (f.type === "bed") {
    box(g, w, 0.26, d, 0, 0.18, 0, "#ac8f70");
    box(g, w - 0.06, 0.15, d - 0.09, 0, 0.385, 0, "#f4ecde");
    box(g, w - 0.07, 0.024, d * 0.66, 0, 0.472, d * 0.12, c);
    box(g, w, h, 0.07, 0, h / 2, -d / 2 + 0.035, "#baa084");
    for (const x of [-w * 0.23, w * 0.23])
      box(g, w * 0.41, 0.05, 0.33, x, 0.475, -d * 0.32, "#fbf5e7");
  } else if (f.type === "wardrobe" || f.type === "cabinet") {
    box(g, w, h, d, 0, h / 2, 0, "#d5c2a0");
    const n = Math.max(1, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n;
      box(g, w / n - 0.012, h - 0.035, 0.014, x, h / 2, d / 2 - 0.007, c);
      box(
        g,
        0.016,
        0.12,
        0.025,
        x + (w / n) * 0.3,
        h * 0.52,
        d / 2 - 0.014,
        "#736e5a",
      );
    }
  } else if (f.type === "desk") {
    box(g, w, 0.04, d, 0, h - 0.02, 0, c);
    for (const x of [-w / 2 + 0.035, w / 2 - 0.035])
      for (const z of [-d / 2 + 0.035, d / 2 - 0.035])
        box(g, 0.045, h - 0.04, 0.045, x, (h - 0.04) / 2, z, "#b69974");
    box(g, w * 0.27, 0.16, d * 0.88, w * 0.33, h - 0.14, 0, "#d4bb97");
  } else if (f.type === "chair") {
    box(g, w * 0.9, 0.065, d * 0.88, 0, 0.43, 0, c);
    box(g, w * 0.9, h - 0.43, 0.055, 0, (h + 0.43) / 2, -d * 0.4, c);
    for (const x of [-w * 0.35, w * 0.35])
      for (const z of [-d * 0.33, d * 0.33])
        box(g, 0.034, 0.4, 0.034, x, 0.2, z, "#8d826d");
  }
  g.position.set(f.cx, 0, f.cy);
  g.rotation.y = (-f.rot * Math.PI) / 180;
  g.userData.itemId = f.id;
  return g;
}
