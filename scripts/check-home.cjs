const { chromium } = require("playwright");
const assert = require("assert/strict"), fs = require("fs"), path = require("path");
const BASE = process.env.JYXJ_STUDIO_URL || "http://127.0.0.1:5173";
const OUT = path.resolve(process.env.JYXJ_QA_DIR || "artifacts/custom-three-steps-20261024-230116/regression");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.JYXJ_BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const errors = [], external = [], posts = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(BASE)) external.push(r.url());
      if (r.method() === "POST") posts.push(r.url());
    });
    const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto(BASE);
    assert.equal(await page.locator(".home-hero h1").innerText(), "家有新解");
    assert.equal(await page.locator("[data-scenario]").count(), 1);
    assert.equal(await page.locator('[data-scenario="custom"]').count(), 1);
    assert.equal(await page.locator('a[href="/bedroom"],a[href="/parse"],.site-header,.site-footer').count(), 0);
    await noOverflow();
    await page.getByRole("link", { name: "开始布置我的家", exact: true }).click();
    await page.waitForSelector(".parsing-empty");
    assert.deepEqual(await page.locator(".custom-step-heading h2").allTextContents(), ["平面图解析", "参考图解析", "最终布局生成"]);
    assert.equal(await page.locator("textarea,select,input[type=number],pre,.site-header,.site-footer").count(), 0);
    const assertStack = async () => {
      const boxes = await page.locator("[data-custom-step]").evaluateAll(nodes => nodes.map(e => ({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})));
      assert.equal(boxes.length,3); assert(boxes[1].top >= boxes[0].bottom); assert(boxes[2].top >= boxes[1].bottom);
    };
    await assertStack();
    await page.getByRole("button", { name: "展开资料卡片", exact: true }).click();
    await page.getByRole("button", { name: "放入解析区：卧室 02", exact: true }).click();
    await page.waitForSelector('.parsing-output[data-completed="true"]');
    await page.waitForSelector('.custom-step-state.is-ready');
    assert.match(await page.locator(".custom-layout-inputs").innerText(), /卧室 02.*空房就绪/);
    const file = { name:"reference.png", mimeType:"image/png", buffer:fs.readFileSync("frontend/public/assets/reference/layout-01.png") };
    await page.getByLabel("上传风格参考图", { exact: true }).setInputFiles(file);
    assert.equal(await page.locator(".custom-reference-item img").count(), 1);
    assert.match(await page.locator(".custom-layout-inputs").innerText(), /1张参考图.*待解析/);
    assert.equal(await page.getByRole("button", { name: "生成布局（待接入）", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "移除参考图 1", exact: true }).click();
    assert.equal(await page.locator(".custom-reference-item img").count(), 0);
    await page.getByLabel("上传风格参考图", { exact: true }).setInputFiles({name:"bad.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-demo")});
    assert.match(await page.getByRole("alert").innerText(), /JPG.*PNG.*WebP/);
    await page.getByRole("button", { name: "移出资料", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".custom-layout-inputs")?.textContent.includes("等待平面图解析"));
    assert.match(await page.locator(".custom-layout-inputs").innerText(), /等待平面图解析/);
    await noOverflow();
    await page.screenshot({path:path.join(OUT,"custom-desktop.png"),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await assertStack(); await noOverflow();
    await page.screenshot({path:path.join(OUT,"custom-mobile.png"),fullPage:true});
    await page.goto(BASE+"/parse");
    await page.waitForSelector("[data-custom-step=layout]");
    assert.equal(await page.locator("[data-custom-step]").count(), 3);
    await page.goto(BASE);
    assert.equal(await page.locator("[data-scenario]").count(), 1); await noOverflow();
    assert.deepEqual(errors,[]); assert.deepEqual(external,[]); assert.deepEqual(posts,[]);
    fs.writeFileSync(path.join(OUT,"checks.json"),JSON.stringify({home:"one custom entry",steps:3,vertical:true,uploads:true,staleRoomCleared:true,errors,external,posts},null,2));
    console.log("Home and custom three-step regression passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
