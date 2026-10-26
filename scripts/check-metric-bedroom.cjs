const { chromium } = require("playwright");
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const THREE = require("../frontend/node_modules/three/build/three.cjs");
const BASE = process.env.JYXJ_STUDIO_URL || "http://127.0.0.1:5173",
  OUT = path.resolve(process.env.JYXJ_QA_DIR || "artifacts/metric-bedroom-qa");
fs.mkdirSync(OUT, { recursive: true });
const near = (a, b) => assert(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.JYXJ_BROWSER_EXECUTABLE ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const errors = [],
    external = [],
    checks = [];
  const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE))
      external.push(r.url());
  });
  try {
    // Exercise furnished editing with an explicit test fixture when the live case is empty.
    const sourceRoom = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "../data/room-descriptions/L02-动静分区-房间估算.json",
        ),
        "utf8",
      ),
    );
    if (sourceRoom.furniture.length === 0) {
      const fixture = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "../frontend/tests/fixtures/L02-furniture.json"),
          "utf8",
        ),
      );
      await context.route("**/assets/room-L02.json", (route) =>
        route.fulfill({ json: { ...sourceRoom, ...fixture } }),
      );
      checks.push(
        "furnished_editing_uses_test_fixture_live_case_remains_empty",
      );
    }
    await page.goto(BASE, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".site-header,.site-footer").count(), 0);
    assert.equal(await page.locator("[data-scenario]").count(), 2);
    const oldStorage = JSON.stringify({
      version: 1,
      activeId: "L05",
      plans: {},
      floor: "warm",
    });
    await page.evaluate(
      (value) => localStorage.setItem("jyxj.studio.v1", value),
      oldStorage,
    );
    await page.getByRole("link", { name: "布置我的卧室", exact: true }).click();
    await page.locator(".metric-plan").waitFor();
    assert.equal(
      await page.locator(".metric-plan").getAttribute("data-width-m"),
      "3.6",
    );
    assert.equal(
      await page.locator(".metric-plan").getAttribute("data-depth-m"),
      "3.8",
    );
    assert.equal(
      await page.locator("[data-door]").getAttribute("data-hinge"),
      "0.05,0.5",
    );
    assert.equal(
      await page.locator("[data-door]").getAttribute("data-width-m"),
      "0.75",
    );
    assert.equal(
      await page.locator("[data-window]").getAttribute("data-rect"),
      "0.65,3.8,2.75,3.95",
    );
    assert.equal(
      await page.locator("[data-window]").getAttribute("data-sill-m"),
      "0.85",
    );
    assert.equal(await page.locator("[data-metric-item]").count(), 5);
    assert(
      (await page.locator(".metric-bedroom-page").innerText()).includes(
        "尺寸为图片估算",
      ),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(OUT, "metric-2d-desktop.png"),
      fullPage: true,
    });
    checks.push("home_entry_exact_metric_floor_and_openings");
    const svgPoint = async (x, y) =>
      page.locator(".metric-plan").evaluate(
        (svg, [x, y]) => {
          const p = svg.createSVGPoint();
          p.x = x * 1000;
          p.y = y * 1000;
          const q = p.matrixTransform(svg.getScreenCTM());
          return { x: q.x, y: q.y };
        },
        [x, y],
      );
    await page.locator(".metric-plan").scrollIntoViewIfNeeded();
    const start = await svgPoint(1.8, 3.04),
      end = await svgPoint(1.6, 2.8);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
    assert.equal(
      await page
        .locator('[data-metric-item="L02_chair"]')
        .getAttribute("data-center"),
      "1.6,2.8",
    );
    checks.push("actual_2d_drag_uses_meters");
    await page.getByRole("button", { name: "3D 房间", exact: true }).click();
    await page.waitForFunction(
      () =>
        !!document.querySelector(".metric-three-mount")?.dataset.modelSummary,
    );
    const summary = JSON.parse(
      await page
        .locator(".metric-three-mount")
        .getAttribute("data-model-summary"),
    );
    near(summary.floorWidth, 3.6);
    near(summary.floorDepth, 3.8);
    near(summary.wallHeight, 2.8);
    near(summary.windows[0].sill, 0.85);
    near(summary.windows[0].head, 2.35);
    near(summary.windows[0].width, 2.1);
    assert.deepEqual(summary.doors[0].hinge, [0.05, 0.5]);
    near(summary.doors[0].width, 0.75);
    near(summary.doors[0].height, 2.1);
    let furn = JSON.parse(
      await page
        .locator(".metric-three-mount")
        .getAttribute("data-furniture-summary"),
    );
    assert.equal(furn.find((f) => f.id === "L02_chair").x, 1.6);
    assert.equal(furn.find((f) => f.id === "L02_chair").z, 2.8);
    await page.screenshot({
      path: path.join(OUT, "metric-3d-desktop.png"),
      fullPage: true,
    });
    const pixels = await page
      .locator(".metric-three canvas")
      .evaluate((canvas) => {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext("2d");
        ctx.drawImage(canvas, 0, 0, 64, 64);
        const a = ctx.getImageData(0, 0, 64, 64).data,
          set = new Set();
        for (let i = 0; i < a.length; i += 4)
          set.add(`${a[i]},${a[i + 1]},${a[i + 2]}`);
        return set.size;
      });
    assert(pixels > 40, "WebGL scene should contain actual rendered geometry");
    checks.push("actual_webgl_geometry_matches_json_and_2d_drag");
    await page.locator('[data-furniture-select="L02_chair"]').click();
    await page.getByRole("spinbutton", { name: "家具中心X毫米" }).fill("1700");
    await page.waitForFunction(
      () =>
        JSON.parse(
          document.querySelector(".metric-three-mount").dataset
            .furnitureSummary,
        ).find((f) => f.id === "L02_chair").x === 1.7,
    );
    await page.getByRole("button", { name: "俯视", exact: true }).click();
    await page.locator(".metric-three canvas").scrollIntoViewIfNeeded();
    const canvasBox = await page.locator(".metric-three canvas").boundingBox(),
      cameraData = JSON.parse(
        await page
          .locator(".metric-three-mount")
          .getAttribute("data-camera-summary"),
      );
    function project(x, y, z) {
      const v = new THREE.Vector3(x, y, z)
        .applyMatrix4(new THREE.Matrix4().fromArray(cameraData.inverseWorld))
        .applyMatrix4(new THREE.Matrix4().fromArray(cameraData.projection));
      return {
        x: canvasBox.x + ((v.x + 1) / 2) * canvasBox.width,
        y: canvasBox.y + ((1 - v.y) / 2) * canvasBox.height,
      };
    }
    const a = project(1.7, 0.47, 2.8),
      b = project(1.85, 0.47, 2.66);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 15 });
    await page.mouse.up();
    furn = JSON.parse(
      await page
        .locator(".metric-three-mount")
        .getAttribute("data-furniture-summary"),
    );
    const chair = furn.find((f) => f.id === "L02_chair");
    assert(
      chair.x > 1.75 && chair.z < 2.75,
      "Actual 3D drag should move chair",
    );
    await page.screenshot({
      path: path.join(OUT, "metric-3d-top.png"),
      fullPage: true,
    });
    await page
      .getByRole("checkbox", { name: "开门示意", exact: true })
      .uncheck();
    const closed = JSON.parse(
      await page
        .locator(".metric-three-mount")
        .getAttribute("data-model-summary"),
    );
    near(closed.doors[0].openRotationY, 0);
    await page.getByRole("button", { name: "2D 平面图", exact: true }).click();
    assert.equal(
      await page
        .locator('[data-metric-item="L02_chair"]')
        .getAttribute("data-center"),
      `${chair.x},${chair.z}`,
    );
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "导出尺寸方案", exact: true })
      .click();
    const download = await downloadEvent;
    const saved = path.join(OUT, "exported-metric-room.json");
    await download.saveAs(saved);
    const exported = JSON.parse(fs.readFileSync(saved, "utf8"));
    assert.equal(exported.units, "mm");
    assert.equal(
      exported.furniture.find((f) => f.id === "L02_chair").cx,
      Math.round(chair.x * 1000),
    );
    assert.equal(exported.DOORS[0].len, 750);
    assert.equal(exported.WINS[0][0], 650);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".metric-plan").waitFor();
    assert.equal(
      await page
        .locator('[data-metric-item="L02_chair"]')
        .getAttribute("data-center"),
      `${chair.x},${chair.z}`,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("jyxj.studio.v1")),
      oldStorage,
    );
    checks.push(
      "actual_3d_drag_door_toggle_millimeter_export_and_isolated_persistence",
    );
    await page
      .getByRole("button", { name: "恢复初始布局", exact: true })
      .click();
    assert.equal(
      await page
        .locator('[data-metric-item="L02_chair"]')
        .getAttribute("data-center"),
      "1.8,3.04",
    );
    checks.push("reset_restores_json_furniture");
    await page
      .getByRole("link", { name: "查看六种视频参考布局", exact: false })
      .click();
    await page.waitForSelector('[data-bedroom-layout="L04"]');
    assert.equal(await page.locator("[data-bedroom-layout]").count(), 6);
    checks.push("legacy_six_reference_layouts_remain_available");
    await page.goto(BASE + "/custom", { waitUntil: "networkidle" });
    assert.equal(
      await page.locator(".custom-summary,.uploaded-file").count(),
      0,
    );
    assert.equal(await page.locator(".upload-empty").count(), 2);
    checks.push("custom_upload_empty_state_unchanged");
    const mobile = await context.newPage();
    mobile.on("pageerror", (e) => errors.push(String(e)));
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(BASE + "/bedroom", { waitUntil: "networkidle" });
    await mobile.locator(".metric-plan").waitFor();
    assert.equal(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await mobile.screenshot({
      path: path.join(OUT, "metric-2d-mobile.png"),
      fullPage: true,
    });
    await mobile.getByRole("button", { name: "3D 房间", exact: true }).click();
    await mobile.waitForFunction(
      () =>
        !!document.querySelector(".metric-three-mount")?.dataset.modelSummary,
    );
    assert.equal(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await mobile.screenshot({
      path: path.join(OUT, "metric-3d-mobile.png"),
      fullPage: true,
    });
    checks.push("390px_2d_3d_without_horizontal_overflow");
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    fs.writeFileSync(
      path.join(OUT, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          base: BASE,
          checks,
          threeGeometry: summary,
          pageErrors: errors,
          externalRequests: external,
          legacyStorageUnchanged: true,
        },
        null,
        2,
      ),
    );
    console.log("METRIC_BROWSER_OK", checks.length, "checks");
  } catch (e) {
    await page
      .screenshot({ path: path.join(OUT, "failure.png"), fullPage: true })
      .catch(() => {});
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
