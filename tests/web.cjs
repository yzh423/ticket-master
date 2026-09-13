const { chromium } = require('playwright');
const { createServer } = require('vite');
const assert = require('node:assert/strict');

(async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(url);
    await page.getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' }).waitFor();
    await page.getByRole('button', { name: '新建任务' }).click();
    await page.getByLabel('活动名称').fill('浏览器启动测试');
    await page.getByLabel('场馆 / 城市').fill('上海');
    await page.getByLabel('固定演出场次（当地时间）').fill('2026-10-01T19:30');
    await page.getByLabel('固定人数').fill('2');
    await page.getByLabel('含费用的总预算').fill('1200');
    await page.getByLabel('票档 1 名称').fill('看台');
    await page.getByLabel('票档 1 单张参考价格').fill('580');
    await page.getByLabel('官方购票网址（可暂空）').fill('https://www.damai.cn/');
    await page.getByLabel('项目规则来源 / 公告网址').fill('https://www.damai.cn/');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByRole('heading', { name: '浏览器启动测试' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' }).waitFor();
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.getByRole('button', { name: /浏览器启动测试/ }).click();
    const officialPage = context.waitForEvent('page');
    await page.getByRole('button', { name: '打开官方网页' }).click();
    const opened = await officialPage;
    await opened.waitForURL('https://www.damai.cn/');
    assert.equal(new URL(opened.url()).hostname, 'www.damai.cn');
    assert.deepEqual(errors, []);
    console.log('网页版本：启动、创建任务、刷新后本地保存通过');
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
