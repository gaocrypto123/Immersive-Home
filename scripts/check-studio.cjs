const { chromium } = require("playwright");
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const BASE = process.env.JYXJ_STUDIO_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.env.JYXJ_QA_DIR || "artifacts/studio");
fs.mkdirSync(OUT, { recursive: true });
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
  const checks = [],
    errors = [],
    remote = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE))
        remote.push(r.url());
    });
    await page.goto(BASE + "/studio", { waitUntil: "networkidle" });
    await page.waitForSelector(
      '[data-testid="three-scene"][data-loaded="true"]',
    );
    assert.equal(await page.locator("canvas").count(), 1);
    assert.equal(await page.locator("[data-layout]").count(), 6);
    await page.screenshot({ path: path.join(OUT, "desktop.png") });
    await page.getByRole("button", { name: "床", exact: true }).click();
    const initial3dX = Number(
      await page
        .getByRole("spinbutton", { name: "X · 左右", exact: true })
        .inputValue(),
    );
    const initial3dY = Number(
      await page
        .getByRole("spinbutton", { name: "Y · 上下", exact: true })
        .inputValue(),
    );
    await page.getByRole("button", { name: "俯视", exact: true }).click();
    await page.waitForTimeout(200);
    const cb = await page.locator("canvas").boundingBox(),
      ppu = cb.height / (2 * 12.75 * Math.tan((37 * Math.PI) / 360));
    const sx = cb.x + cb.width / 2 + (initial3dX / 100 - 0.5) * 5 * ppu,
      sy =
        cb.y + cb.height / 2 + ((initial3dY / 100 - 0.5) * 5.75 - 0.08) * ppu;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 35, sy + 15, { steps: 8 });
    await page.mouse.up();
    assert.notEqual(
      Number(
        await page
          .getByRole("spinbutton", { name: "X · 左右", exact: true })
          .inputValue(),
      ),
      initial3dX,
    );
    await page
      .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
      .click();
    await page.getByRole("button", { name: "鸟瞰", exact: true }).click();
    checks.push("actual_3d_pointer_drag_and_synced_properties");
    for (const id of ["L01", "L02", "L03", "L04", "L05", "L06"]) {
      await page.locator(`[data-layout="${id}"]`).click();
      await page.waitForFunction(
        (id) =>
          document.querySelector(".layout-card.chosen")?.dataset.layout === id,
        id,
      );
      assert((await page.locator(".canvas-topline h1").innerText()).length > 0);
    }
    checks.push("six_reference_layouts_and_real_webgl");
    await page.locator('[data-layout="L04"]').click();
    await page.getByRole("button", { name: "2D 平面", exact: true }).click();
    await page.locator('.plan-item[data-item="bed"]').click();
    const x = page.getByRole("spinbutton", { name: "X · 左右", exact: true });
    await x.fill("70");
    await x.press("Tab");
    assert.equal(await x.inputValue(), "70");
    await page.getByRole("button", { name: "旋转90度", exact: true }).click();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "旋转角度", exact: true })
        .inputValue(),
      "90",
    );
    await page.keyboard.press("Control+z");
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "旋转角度", exact: true })
        .inputValue(),
      "0",
    );
    await page
      .getByRole("button", { name: "重做 (Ctrl+Shift+Z)", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "旋转角度", exact: true })
        .inputValue(),
      "90",
    );
    const beforeCount = await page.locator(".plan-item").count();
    await page.getByRole("button", { name: "复制", exact: true }).click();
    assert.equal(await page.locator(".plan-item").count(), beforeCount + 1);
    await page.getByRole("button", { name: "移除", exact: true }).click();
    assert.equal(await page.locator(".plan-item").count(), beforeCount);
    await page
      .getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true })
      .click();
    assert.equal(await page.locator(".plan-item").count(), beforeCount + 1);
    checks.push("properties_rotation_copy_delete_undo_redo");
    const bed = page.locator('.plan-item[data-item="bed"]');
    const bounds = await bed.boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 - 45,
      bounds.y + bounds.height / 2 + 25,
      { steps: 8 },
    );
    await page.mouse.up();
    assert.notEqual(await x.inputValue(), "70");
    checks.push("actual_2d_pointer_drag");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("jyxj.studio.v1")),
    );
    assert(saved.plans.L04.length === beforeCount + 1);
    let event = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出方案", exact: true }).click();
    let dl = await event;
    const jsonPath = path.join(OUT, "exported-plan.json");
    await dl.saveAs(jsonPath);
    const exported = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    assert.equal(exported.schema, "jyxj.studio-plan.v1");
    assert.equal(exported.metricScale, null);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(
      '[data-testid="three-scene"][data-loaded="true"]',
    );
    assert.deepEqual(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("jyxj.studio.v1")).plans.L04,
      ),
      saved.plans.L04,
    );
    checks.push("explicit_save_auto_restore_and_json_export");
    event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "导出当前视图 PNG", exact: true })
      .click();
    dl = await event;
    const pngPath = path.join(OUT, "exported-scene.png");
    await dl.saveAs(pngPath);
    assert(fs.statSync(pngPath).size > 10000);
    await page.locator('input[type="file"]').setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema":"wrong"}'),
    });
    await page
      .getByRole("status")
      .filter({ hasText: "请选择家有新解" })
      .waitFor();
    await page.locator('input[type="file"]').setInputFiles(jsonPath);
    await page.getByRole("status").filter({ hasText: "方案已导入" }).waitFor();
    checks.push("png_download_invalid_import_rejected_valid_import");
    await page.getByTitle("家具库", { exact: true }).click();
    const added = await page.locator(".object-list>button").count();
    await page
      .locator(".furniture-library>button")
      .filter({ hasText: "床头柜" })
      .click();
    assert.equal(await page.locator(".object-list>button").count(), added + 1);
    checks.push("library_add_furniture");
    await page.getByRole("button", { name: "2D 平面", exact: true }).click();
    await page.getByRole("button", { name: "测量", exact: true }).click();
    const plan = page.locator(".plan-canvas"),
      p = await plan.boundingBox();
    await page.mouse.click(p.x + p.width * 0.35, p.y + p.height * 0.48);
    await page.mouse.click(p.x + p.width * 0.6, p.y + p.height * 0.7);
    assert.equal(
      await page.locator('.plan-canvas line[stroke="#b47755"]').count(),
      1,
    );
    checks.push("relative_measurement");
    event = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "导出当前视图 PNG", exact: true })
      .click();
    dl = await event;
    const planPng = path.join(OUT, "exported-2d.png");
    await dl.saveAs(planPng);
    assert(fs.statSync(planPng).size > 10000);
    checks.push("actual_2d_png_export");
    await page.getByRole("button", { name: "方案对比", exact: true }).click();
    assert.equal(await page.locator("[data-compare]").count(), 6);
    await page.locator('[data-compare="L06"]').click();
    assert.equal(
      await page.locator(".canvas-topline h1").innerText(),
      "床后转角工作区",
    );
    await page.getByRole("button", { name: "参考原图", exact: false }).click();
    await page.waitForFunction(() => {
      const img = document.querySelector(".large-reference");
      return img?.complete && img.naturalWidth > 0;
    });
    await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
    checks.push("compare_modal_and_original_reference");
    await page
      .getByRole("combobox", { name: "选择案例" })
      .selectOption("living");
    await page.waitForSelector('[data-case="P04-R01"][data-loaded="true"]', {
      timeout: 120000,
    });
    assert.equal(await page.locator(".object-list>button").count(), 17);
    assert((await page.locator(".budget").innerText()).includes("5,164.96"));
    await page.screenshot({ path: path.join(OUT, "living-p04.png") });
    await page
      .locator(".existing-layouts>button")
      .filter({ hasText: "P03-R01" })
      .click();
    await page.waitForSelector('[data-case="P03-R01"][data-loaded="true"]', {
      timeout: 120000,
    });
    await page.screenshot({ path: path.join(OUT, "living-p03.png") });
    checks.push("p04_p03_real_local_glb_and_17_quote_items");
    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    mobile.on("pageerror", (e) => errors.push(String(e)));
    await mobile.goto(BASE + "/studio", { waitUntil: "networkidle" });
    await mobile.waitForSelector("canvas");
    assert.equal(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await mobile.screenshot({ path: path.join(OUT, "mobile.png") });
    await mobile.getByTitle("布局方案", { exact: true }).click();
    await mobile.locator('[data-layout="L01"]').click();
    await mobile
      .getByRole("button", { name: "收起左侧栏", exact: true })
      .click();
    assert.equal(
      await mobile.locator(".canvas-topline h1").innerText(),
      "居中双侧床头柜",
    );
    checks.push("mobile_no_overflow_and_usable_layout_drawer");
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    fs.writeFileSync(
      path.join(OUT, "acceptance.json"),
      JSON.stringify(
        {
          passed: true,
          base: BASE,
          checks,
          pageErrors: errors,
          externalRequests: remote,
        },
        null,
        2,
      ),
    );
    console.log("STUDIO_BROWSER_OK", checks.length, "checks");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
