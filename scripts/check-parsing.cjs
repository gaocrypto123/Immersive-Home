const { chromium } = require("playwright");
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const BASE = process.env.JYXJ_STUDIO_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(
  process.env.JYXJ_QA_DIR || "artifacts/three-plans-20261024-224117/qa",
);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
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
  const record = (p) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE))
        external.push(r.url());
    });
  };
  const clean = async (p) => {
    assert.equal(
      await p
        .locator('pre,.parsing-json,.parsing-height-form,input[type="number"]')
        .count(),
      0,
    );
    assert.equal(await p.getByRole("button", { name: /确认|JSON/ }).count(), 0);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  };
  try {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      }),
      p = await context.newPage();
    record(p);
    await p.goto(BASE);
    await p.getByRole("link", { name: /上传我的房间/ }).click();
    await p.waitForSelector(".parsing-empty");
    await clean(p);
    await p.getByRole("button", { name: "展开资料卡片", exact: true }).click();
    await p
      .getByRole("button", { name: "放入解析区：卧室 01", exact: true })
      .click();
    await p.waitForSelector(
      '.calibration-view[data-calibration-mode="dimension-labels"]',
    );
    assert.deepEqual(
      await p.locator(".parsing-stepper small").allTextContents(),
      ["尺寸解析", "描摹轮廓", "解析门窗", "生成空房"],
    );
    assert.equal(await p.locator("[data-dimension-token]").count(), 10);
    assert.match(
      await p.locator('[data-mm-per-pixel="x"]').innerText(),
      /4\.4720/,
    );
    checks.push("第一步高亮示例尺寸标注，正确展示mm/px");
    await p.waitForFunction(() => {
      const e = document.querySelector(".parsing-sequence");
      return (
        e && +e.dataset.revealOutline > 0.1 && +e.dataset.revealOutline < 0.9
      );
    });
    await p.getByRole("button", { name: "暂停", exact: true }).click();
    const a = await p.locator(".parsing-sequence").getAttribute("data-elapsed");
    await p.waitForTimeout(300);
    assert.equal(
      await p.locator(".parsing-sequence").getAttribute("data-elapsed"),
      a,
    );
    await p.screenshot({
      path: path.join(OUT, "01-outline-paused.png"),
      fullPage: true,
    });
    await clean(p);
    checks.push("实际描线中间状态与精确暂停，无表单/JSON");
    await p.getByRole("button", { name: "继续", exact: true }).click();
    await p.waitForSelector('.parsing-output[data-step="2"]');
    await p.waitForFunction(
      () =>
        +getComputedStyle(document.querySelector(".reveal-door")).opacity > 0.5,
    );
    assert.ok(
      +(await p.locator(".parsing-sequence").getAttribute("data-elapsed")) > +a,
    );
    await p.waitForSelector('.parsing-output[data-step="2"]');
    await p.waitForFunction(
      () =>
        +getComputedStyle(document.querySelector(".dimension-3")).opacity > 0.6,
    );
    await p.screenshot({
      path: path.join(OUT, "02-dimensions.png"),
      fullPage: true,
    });
    await clean(p);
    checks.push("门窗和尺寸依次显现，使用同一SVG");
    await p.waitForFunction(() => {
      const e = document.querySelector(".metric-three-mount");
      return (
        e &&
        +e.dataset.constructionProgress > 0.25 &&
        +e.dataset.constructionProgress < 0.85
      );
    });
    await p.getByRole("button", { name: "暂停", exact: true }).click();
    const middle = +(await p
      .locator(".metric-three-mount")
      .getAttribute("data-visible-wall-height"));
    assert.ok(middle > 0 && middle < 2.8);
    await p.waitForTimeout(300);
    assert.equal(
      +(await p
        .locator(".metric-three-mount")
        .getAttribute("data-visible-wall-height")),
      middle,
    );
    await p.screenshot({
      path: path.join(OUT, "03-walls-rising.png"),
      fullPage: true,
    });
    checks.push("真实三维墙体在中途停止，进度和高度同时冻结");
    await p.getByRole("button", { name: "继续", exact: true }).click();
    await p.waitForSelector('.parsing-output[data-completed="true"]', {
      timeout: 30000,
    });
    await p.waitForFunction(
      () =>
        Math.abs(
          +document.querySelector(".metric-three-mount").dataset
            .visibleWallHeight - 2.8,
        ) < 0.001,
    );
    assert.equal(await p.locator(".parsing-stepper li").count(), 4);
    assert.deepEqual(
      JSON.parse(
        await p
          .locator(".metric-three-mount")
          .getAttribute("data-furniture-summary"),
      ),
      [],
    );
    const model = JSON.parse(
      await p.locator(".metric-three-mount").getAttribute("data-model-summary"),
    );
    assert.equal(model.wallHeight, 2.8);
    assert.equal(model.doors[0].height, 2.1);
    assert.ok(Math.abs(model.windows[0].sill - 0.85) < 0.001);
    await p.getByRole("button", { name: "俯视", exact: true }).click();
    await clean(p);
    await p.screenshot({
      path: path.join(OUT, "04-final-3d.png"),
      fullPage: true,
    });
    checks.push("无需确认自动完成，目标2.8m且无家具，相机可切换");
    await p.getByRole("button", { name: "重新播放", exact: true }).click();
    await p.waitForSelector('.parsing-output[data-step="0"]');
    await p.waitForFunction(
      () =>
        +document.querySelector(".metric-three-mount").dataset
          .visibleWallHeight < 0.01,
    );
    checks.push("重播恢复平面，不累积缩放");
    await context.close();
    const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      m = await mobile.newPage();
    record(m);
    await m.goto(BASE + "/parse");
    await m.getByRole("button", { name: "展开资料卡片", exact: true }).click();
    await m
      .getByRole("button", { name: "放入解析区：卧室 03", exact: true })
      .click();
    await m.waitForSelector('.parsing-output[data-completed="true"]', {
      timeout: 60000,
    });
    assert.equal(
      await m
        .locator(".calibration-view")
        .getAttribute("data-calibration-mode"),
      "dimension-labels",
    );
    assert.match(
      await m.locator('[data-mm-per-pixel="x"]').innerText(),
      /4\.7285/,
    );
    const fallbackModel = JSON.parse(
      await m.locator(".metric-three-mount").getAttribute("data-model-summary"),
    );
    assert.equal(fallbackModel.doors[0].width, 0.8);
    assert.ok(Math.abs(fallbackModel.floorWidth - 2.7) < 0.001);
    assert.ok(Math.abs(fallbackModel.floorDepth - 4.5) < 0.001);
    assert.equal(fallbackModel.windows[0].width, 2);
    assert.ok(Math.abs(fallbackModel.windows[0].sill - 0.8) < 0.001);
    checks.push("第三张图按2700×4500mm定标，顶部800mm门与右侧2000mm窗");
    await clean(m);
    await m.screenshot({
      path: path.join(OUT, "05-mobile.png"),
      fullPage: true,
    });
    checks.push("390×844自动完成，无确认、JSON与横向溢出");
    await mobile.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    fs.writeFileSync(
      path.join(OUT, "checks.json"),
      JSON.stringify(
        { checks, errors, external, model, middleWallHeight: middle },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks, errors, external }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
