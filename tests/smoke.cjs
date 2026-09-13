const { _electron: electron } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

(async () => {
  const root = join(__dirname, '..');
  const appData = join(root, '.test-data', randomUUID());
  const artifacts = join(root, '.test-artifacts');
  mkdirSync(appData, { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  const options = {
    executablePath: require('electron'),
    args: ['.'],
    cwd: root,
    env: { ...process.env, TICKET_WINDOW_TEST_DATA_DIR: appData },
  };
  const app = await electron.launch(options);
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' }).waitFor();
    await page.screenshot({ path: join(artifacts, 'empty.png'), fullPage: true });
    await page.getByRole('button', { name: '新建任务' }).click();
    await page.getByLabel('活动名称').fill('测试巡演 · 上海站');
    await page.getByLabel('场馆 / 城市').fill('上海体育馆');
    await page.getByLabel('固定演出场次（当地时间）').fill('2026-10-01T19:30');
    await page.getByLabel('固定人数').fill('2');
    await page.getByLabel('含费用的总预算').fill('1200');
    await page.getByLabel('票档 1 名称').fill('B 看台');
    await page.getByLabel('票档 1 单张参考价格').fill('580');
    await page.getByLabel('官方购票网址（可暂空）').fill('https://detail.damai.cn/item.htm?id=1');
    await page.getByLabel('项目规则来源 / 公告网址').fill('https://detail.damai.cn/item.htm?id=1');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByRole('heading', { name: '测试巡演 · 上海站' }).waitFor();
    await page.getByRole('button', { name: '添加机会' }).click();
    await page.getByLabel('开始（所在地时间）').fill('2026-09-20T12:00');
    await page.getByRole('button', { name: '保存机会' }).click();
    await page.locator('.opportunity-time').getByText('2026/09/20 12:00').waitFor();
    await page.getByLabel('已登录正确账号并核对手机号').check();
    await page.getByLabel('B 看台页面状态').selectOption('available');
    await page.getByText('建议先核对 B 看台').waitFor();
    await page.getByLabel('当前阶段').selectOption('pending_payment');
    await page.getByLabel('对应销售机会').selectOption({ label: '公开销售 · 2026/09/20 12:00' });
    await page.getByLabel('确认依据').fill('官方订单号后四位 1234');
    await page.getByRole('button', { name: '记录当前结果' }).click();
    await page.getByText('已有待完成或已确认订单').waitFor();
    await page.screenshot({ path: join(artifacts, 'detail.png'), fullPage: true });
    assert.deepEqual(errors, [], `渲染器错误: ${errors.join('; ')}`);
    console.log('UI smoke: 创建任务、机会、清单、票档和结果记录通过');
  } finally {
    await app.close();
  }
  const restarted = await electron.launch(options);
  try {
    const page = await restarted.firstWindow();
    await page.getByRole('button', { name: /测试巡演 · 上海站/ }).click();
    await page.getByText('已有待完成或已确认订单').waitFor();
    console.log('UI smoke: 重启后结果仍在；截图位于 .test-artifacts');
  } finally {
    await restarted.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
