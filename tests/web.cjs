const { chromium } = require('playwright');
const { createServer } = require('vite');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

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
    await page.getByRole('button', { name: '发现演出' }).click();
    await page
      .getByLabel('演出关键词或大麦链接')
      .fill('https://detail.damai.cn.evil.example/item.htm?id=1');
    await page.getByRole('button', { name: '打开大麦活动' }).click();
    await page.getByRole('status').getByText('请使用大麦官方活动详情链接').waitFor();
    await context.route('https://search.damai.cn/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>大麦官方搜索</title>' }),
    );
    await page.getByLabel('演出关键词或大麦链接').fill('邓紫棋 深圳');
    const searchPage = context.waitForEvent('page');
    await page.getByRole('button', { name: '在大麦搜索' }).click();
    await (await searchPage).waitForURL(/search\.damai\.cn\/search\.htm\?keyword=/);
    await page.getByRole('button', { name: '我的任务' }).click();
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
    await page.getByRole('button', { name: '平台规则' }).click();
    await context.route('https://www.artist.bandsintown.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>官方资料</title>' }),
    );
    const knowledgePage = context.waitForEvent('page');
    await page
      .getByRole('region', { name: '同类工具能力对照' })
      .getByRole('button', { name: '查看官方资料' })
      .first()
      .click();
    await (await knowledgePage).waitForURL('https://www.artist.bandsintown.com/overview');
    await page.reload();
    await page.getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' }).waitFor();
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.locator('.event-row').filter({ hasText: '浏览器启动测试' }).click();
    await page.getByRole('button', { name: '添加机会' }).click();
    await page.getByText('粘贴公告，辅助提取时间').click();
    await page.getByLabel('官方公告文字').fill('公告正文：公开开售 2026-09-20 12:00');
    await page
      .getByRole('group', { name: '识别出的时间候选' })
      .getByRole('button', { name: /2026-09-20 12:00/ })
      .click();
    await page.getByLabel('我已在官方公告核对本场活动、开售时间、时区及来源').check();
    await page.getByRole('button', { name: '保存机会' }).click();
    await page.locator('.opportunity-time').getByText('2026/09/20 12:00').waitFor();
    const officialPage = context.waitForEvent('page');
    await page.getByRole('button', { name: '打开官方网页' }).click();
    const opened = await officialPage;
    await opened.waitForURL('https://www.damai.cn/');
    assert.equal(new URL(opened.url()).hostname, 'www.damai.cn');
    const sourcePage = context.waitForEvent('page');
    await page.getByRole('button', { name: '核对来源' }).click();
    await (await sourcePage).waitForURL('https://www.damai.cn/');
    await page.getByRole('button', { name: '网页版本说明' }).click();
    const backupDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载任务备份' }).click();
    const backup = readFileSync(await (await backupDownload).path(), 'utf8');
    assert.equal(JSON.parse(backup).events.length, 1);
    assert.equal(JSON.parse(backup).events[0].opportunities.length, 1);
    assert.equal(backup.includes('公告正文：'), false);
    await page.evaluate(async () => {
      const [event] = await window.ticket.list();
      await window.ticket.remove(event.id);
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#web-backup-file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backup),
    });
    await page.getByRole('status').getByText('已恢复 1 个任务。').waitFor();
    assert.equal((await page.evaluate(() => window.ticket.list())).length, 1);
    const unchanged = await page.evaluate(async () => {
      try {
        await window.ticket.importBackup('{"format":"wrong","events":[]}');
      } catch {
        /* invalid import must not replace the current tasks */
      }
      return (await window.ticket.list()).length;
    });
    assert.equal(unchanged, 1);
    assert.deepEqual(errors, []);
    const denied = await browser.newContext();
    try {
      await denied.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get() {
            throw new Error('Storage disabled');
          },
        });
      });
      const deniedPage = await denied.newPage();
      await deniedPage.goto(url);
      await deniedPage.getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' }).waitFor();
      await deniedPage
        .getByRole('alert')
        .getByText('浏览器禁止读取本站数据', { exact: false })
        .waitFor();
    } finally {
      await denied.close();
    }
    console.log('网页版本：启动、保存、官方入口、备份恢复通过');
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
