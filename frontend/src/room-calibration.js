// Example annotation positions are stored in source pixels. Ratios and the
// resulting room geometry are computed here, independently of the animation.
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const positive = (n) => Number.isFinite(n) && n > 0;
export function calibrateSource(source) {
  const annotations = (source.tokens || [])
    .map(([text, rect], index) => ({ index, text, mm: Number(text), rect }))
    .filter((t) => positive(t.mm));
  const samples = (source.dimensionAnchors || [])
    .map((anchor) => {
      const token = annotations.find((t) => t.index === anchor.token),
        pixels = length(anchor.from, anchor.to);
      return token && positive(pixels)
        ? { ...anchor, mm: token.mm, pixels, mmPerPixel: token.mm / pixels }
        : null;
    })
    .filter(Boolean);
  if (samples.length) {
    const x = samples.find((s) => s.axis === "x"),
      y = samples.find((s) => s.axis === "y");
    if (!x || !y) throw Error("当前示例缺少两个方向的尺寸基准。");
    return {
      mode: "dimension-labels",
      estimated: false,
      annotations,
      samples,
      mmPerPixelX: x.mmPerPixel,
      mmPerPixelY: y.mmPerPixel,
      box: [x.from[0], y.from[1], x.to[0], y.to[1]],
      widthMM: x.mm,
      depthMM: y.mm,
      anisotropic:
        Math.abs(x.mmPerPixel - y.mmPerPixel) /
          ((x.mmPerPixel + y.mmPerPixel) / 2) >
        0.005,
    };
  }
  const ref = source.doorReference;
  if (annotations.length)
    throw Error("发现尺寸标注，但缺少有效尺线端点，不能计算比例尺。");
  if (!ref || !positive(length(ref.hinge, ref.closed)))
    throw Error("无尺寸标注，也缺少可用于估算的门洞位置。");
  const pixels = length(ref.hinge, ref.closed),
    ratio = 900 / pixels,
    box = source.roomBox;
  return {
    mode: "door-assumption",
    estimated: true,
    annotations: [],
    samples: [],
    door: ref,
    doorPixels: pixels,
    assumedDoorMM: 900,
    mmPerPixelX: ratio,
    mmPerPixelY: ratio,
    box: [...box],
    widthMM: (box[2] - box[0]) * ratio,
    depthMM: (box[3] - box[1]) * ratio,
    anisotropic: false,
  };
}
export function calibratedRoomData(base, source) {
  const calibration = calibrateSource(source),
    data = JSON.parse(JSON.stringify(base));
  data.furniture = [];
  delete data.FURNITURE_DETAILS;
  data.DIMENSIONS.ceiling_height_mm = 2800;
  if (source.roomTemplate) {
    const t = source.roomTemplate,
      fx = calibration.widthMM / t.width,
      fy = calibration.depthMM / t.depth;
    const point = (p) => [p[0] * fx, p[1] * fy],
      rect = (r) => [r[0] * fx, r[1] * fy, r[2] * fx, r[3] * fy, ...r.slice(4)];
    const poly = t.outline.map(point),
      windowRect = rect(t.window.rect),
      start = point(t.window.start),
      end = point(t.window.end),
      span = Math.hypot(end[0] - start[0], end[1] - start[1]);
    Object.assign(data.ROOMS[0], {
      id: source.id,
      name: source.name,
      poly,
      at: [calibration.widthMM / 2, calibration.depthMM / 2],
    });
    data.WALLS = t.walls.map(rect);
    data.WINS = [windowRect];
    Object.assign(data.DOORS[0], {
      id: `${source.id}-door`,
      name: "卧室门",
      rect: rect(t.door.rect),
      h: point(t.door.h),
      c: [...t.door.c],
      o: [...t.door.o],
      len: t.door.len * (t.door.c[0] ? fx : fy),
      height_mm: 2100,
      location: "按当前平面图人工标注定位",
      swing: "按图中门扇弧线向室内开启",
    });
    delete data.DOORS[0].estimated_width_range_mm;
    delete data.DOORS[0].swing_envelope_mm;
    Object.assign(data.WINDOW_DETAILS[0], {
      id: `${source.id}-window`,
      name: start[0] === end[0] ? "右侧窗" : "下侧窗",
      wall: start[0] === end[0] ? "右侧墙" : "下侧墙",
      start_mm: start,
      end_mm: end,
      opening_width_mm: span,
      sill_height_mm: t.window.sill,
      opening_height_mm: t.window.height,
      head_height_mm: t.window.sill + t.window.height,
      note: "窗位置与宽度采用当前图中标注；高度与窗台高采用图中假设值。",
    });
    for (const key of [
      "estimated_width_range_mm",
      "offset_from_left_inner_corner_mm",
      "offset_from_right_inner_corner_mm",
    ])
      delete data.WINDOW_DETAILS[0][key];
    Object.assign(data.DIMENSIONS, {
      clear_bbox_width_mm: calibration.widthMM,
      clear_bbox_depth_mm: calibration.depthMM,
      upper_left_notch_width_mm: 0,
      upper_left_notch_depth_mm: 0,
      net_floor_area_m2:
        Math.abs(
          poly.reduce((sum, p, i) => {
            const q = poly[(i + 1) % poly.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2e6,
    });
    delete data.DIMENSIONS.estimated_ranges_mm;
    delete data.DIMENSIONS.range_note;
    data.coordinate_system.origin =
      "当前房间净轮廓外接框左上角，X向右、Y向下，单位mm。";
    data.estimation = {
      summary: "根据当前示例图中的毫米标注与人工轮廓定位建模，非实测。",
      notes: t.notes || [],
    };
  } else {
    const c = calibration,
      s = c.mmPerPixelX,
      [left, top] = c.box,
      point = (p) => [(p[0] - left) * s, (p[1] - top) * s],
      fx = c.widthMM / base.DIMENSIONS.clear_bbox_width_mm,
      fy = c.depthMM / base.DIMENSIONS.clear_bbox_depth_mm;
    const [nw, ny] = c.estimated
      ? point(source.notchReference)
      : [
          base.DIMENSIONS.upper_left_notch_width_mm * fx,
          base.DIMENSIONS.upper_left_notch_depth_mm * fy,
        ];
    const hx = c.estimated ? point(c.door.hinge)[0] : base.DOORS[0].h[0] * fx,
      W = c.widthMM,
      D = c.depthMM,
      t = base.DIMENSIONS.wall_thickness_mm,
      doorWidth = c.estimated ? 900 : base.DOORS[0].len * fx;
    const wl = c.estimated
        ? (source.windowReference[0] - left) * s
        : base.WINS[0][0] * fx,
      wr = c.estimated
        ? (source.windowReference[1] - left) * s
        : base.WINS[0][2] * fx,
      end = hx + doorWidth;
    const poly = [
      [nw, 0],
      [W, 0],
      [W, D],
      [0, D],
      [0, ny],
      [nw, ny],
    ];
    data.ROOMS[0].poly = poly;
    data.ROOMS[0].at = [W / 2, D / 2];
    data.WALLS = [
      [nw - t, -t, W + t, 0, "e"],
      [W, 0, W + t, D + t, "e"],
      [wr, D, W, D + t, "e"],
      [-t, D, wl, D + t, "e"],
      [-t, ny - t, 0, D, "e"],
      [0, ny - t, hx, ny, "e"],
      [nw - t, 0, nw, ny, "e"],
    ];
    if (end < nw - t) data.WALLS.push([end, ny - t, nw - t, ny, "e"]);
    data.WINS = [[wl, D, wr, D + t]];
    Object.assign(data.DOORS[0], {
      rect: [hx, ny - t, end, ny],
      h: [hx, ny],
      len: doorWidth,
      location: c.estimated
        ? "按图中人工门洞参考点、宽900mm假设换算"
        : base.DOORS[0].location,
      estimated_width_range_mm: undefined,
      swing_envelope_mm: [hx, ny, end, ny + doorWidth],
    });
    Object.assign(data.WINDOW_DETAILS[0], {
      start_mm: [wl, D],
      end_mm: [wr, D],
      opening_width_mm: wr - wl,
      offset_from_left_inner_corner_mm: wl,
      offset_from_right_inner_corner_mm: W - wr,
      estimated_width_range_mm: undefined,
      note: c.estimated
        ? "按人工窗位置参考点和门宽900mm的比例尺换算"
        : base.WINDOW_DETAILS[0].note,
    });
    Object.assign(data.DIMENSIONS, {
      clear_bbox_width_mm: W,
      clear_bbox_depth_mm: D,
      upper_left_notch_width_mm: nw,
      upper_left_notch_depth_mm: ny,
      net_floor_area_m2: (W * D - nw * ny) / 1e6,
    });
    if (c.estimated) {
      delete data.DIMENSIONS.estimated_ranges_mm;
      data.estimation = {
        summary: "无尺寸标注，以门洞宽900mm假设估计平面尺度。",
        assumed_door_width_mm: 900,
        reference_door_px: c.doorPixels,
        limitation:
          "门洞和轮廓位置为示例人工标注，900mm为用户指定估算基准，不能视为实测。",
      };
    }
  }
  if (source.sha256)
    data.source = {
      ...data.source,
      image: source.image,
      image_sha256: source.sha256,
      image_size_px: [source.width, source.height],
      image_kind: "当前房产中介风格示例平面图，标注尺寸为估算，非实测。",
    };
  data.parse_demo = {
    mode: "preannotated_example_replay",
    input: source.name,
    image: source.image,
    real_time_image_recognition: false,
    real_time_ocr: false,
    geometry_source: calibration.estimated
      ? "门洞900mm假设与像素参考点实时换算"
      : "尺寸示例标注与已校对轮廓",
    heights_status: "default_assumptions_not_measured",
    default_wall_height_mm: 2800,
    calibration,
    notes: source.roomTemplate?.notes || [],
  };
  return data;
}
export const displayMM = (value, estimated = false) =>
  `${Math.round(value / (estimated ? 10 : 1)) * (estimated ? 10 : 1)}`;
