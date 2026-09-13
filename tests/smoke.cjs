const { _electron: electron } = require('playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

async function contrastRatio(locator) {
  return locator.evaluate((node) => {
    const color = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const style = getComputedStyle(node);
    const foreground = luminance(color(style.color));
    const background = luminance(color(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

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
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.getByRole('button', { name: '切换深色模式' }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.waitForTimeout(240);
    assert.ok((await contrastRatio(page.getByRole('button', { name: '新建任务' }))) >= 4.5);
    await page.screenshot({ path: join(artifacts, 'dark.png') });
    await page.getByRole('button', { name: '切换浅色模式' }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.waitForTimeout(240);
    assert.ok((await contrastRatio(page.getByRole('button', { name: '新建任务' }))) >= 4.5);
    await page.screenshot({ path: join(artifacts, 'empty.png') });
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
    const browserWindow = app.waitForEvent('window', {
      predicate: (candidate) => candidate.url().includes('browser.html'),
    });
    await page.getByRole('button', { name: '内置官方网页' }).click();
    const browser = await browserWindow;
    await browser.getByText('本次购票硬条件').waitFor();
    assert.equal(
      await browser
        .locator('.browser-shell')
        .evaluate((node) => getComputedStyle(node).backgroundColor),
      'rgb(245, 247, 250)',
      '内置网页工作区应遵循浅色外观',
    );
    const viewBefore = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows().find((item) =>
        item.getTitle().includes('官方网页工作区'),
      );
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.ok(viewBefore, '内置官方网页应有独立 WebContentsView');
    await page.getByRole('button', { name: '内置官方网页' }).click();
    const viewAfter = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows().find((item) =>
        item.getTitle().includes('官方网页工作区'),
      );
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.equal(viewAfter, viewBefore, '再次打开同一任务不应重建网页会话');
    await browser.screenshot({ path: join(artifacts, 'browser.png'), fullPage: true });
    await page.getByRole('button', { name: '设备与会话' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '清除该平台网页数据' }).click();
    await page
      .getByRole('status')
      .getByText('请先关闭该平台的网页工作区', { exact: false })
      .waitFor();
    await browser.getByRole('button', { name: '关闭网页工作区' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '清除该平台网页数据' }).click();
    await page.getByRole('status').getByText('已清除。再次打开该平台', { exact: false }).waitFor();
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.getByRole('button', { name: /测试巡演 · 上海站/ }).click();
    await page.getByRole('button', { name: '添加机会' }).click();
    await page.getByLabel('开始（所在地时间）').fill('2026-09-20T12:00');
    await page.getByRole('button', { name: '保存机会' }).evaluate((button) => {
      button.click();
      button.click();
    });
    await page.locator('.opportunity-time').getByText('2026/09/20 12:00').waitFor();
    assert.equal(await page.locator('.opportunity').count(), 1, '双击保存不应生成重复机会');
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByLabel('资格条件').fill('已核对本场资格');
    await page.getByRole('button', { name: '保存机会' }).click();
    await page.getByText('已核对本场资格').waitFor();
    await page.getByLabel('公开销售参与状态').selectOption('registered');
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByText('7 项准备待核对').waitFor();
    await page.screenshot({ path: join(artifacts, 'focus.png') });
    await page.getByRole('button', { name: '先核对准备' }).click();
    await page.getByRole('tab', { name: /开售准备/ }).evaluate((node) => {
      if (node.getAttribute('aria-selected') !== 'true') throw new Error('未进入准备步骤');
    });
    await page.getByRole('tab', { name: /开售准备/ }).click();
    await page.getByLabel('已登录正确账号并核对手机号').check();
    await page.getByLabel('实名、证件及购买资格已核对').check();
    await page.waitForTimeout(300);
    assert.equal(await page.getByLabel('已登录正确账号并核对手机号').isChecked(), true);
    assert.equal(await page.getByLabel('实名、证件及购买资格已核对').isChecked(), true);
    await page.getByRole('tab', { name: /票档判断/ }).click();
    await page.getByLabel('B 看台页面状态').selectOption('available');
    await page.getByText('建议先核对 B 看台').waitFor();
    await page.getByRole('button', { name: '编辑规则' }).click();
    await page.getByLabel('票档 1 名称').fill('B 新看台');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByRole('tab', { name: /票档判断/ }).click();
    assert.equal(await page.getByLabel('B 新看台页面状态').inputValue(), 'unknown');
    await page.getByLabel('B 新看台页面状态').selectOption('available');
    await page.getByRole('tab', { name: /订单结果/ }).click();
    await page.getByLabel('当前阶段').selectOption('pending_payment');
    await page.getByLabel('对应销售机会').selectOption({ label: '公开销售 · 2026/09/20 12:00' });
    const paymentDeadline = await page.evaluate(() => {
      const date = new Date(Date.now() + 10 * 60_000);
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    });
    await page.getByLabel('支付截止（本机当地时间，选填）').fill(paymentDeadline);
    await page.getByLabel('确认依据').fill('官方订单号后四位 1234');
    await page.getByRole('button', { name: '记录当前结果' }).evaluate((button) => {
      button.click();
      button.click();
    });
    await page.getByText('待支付订单即将截止').waitFor();
    assert.equal(await page.locator('.journal-row').count(), 1, '双击结果保存不应生成重复订单');
    await page.screenshot({ path: join(artifacts, 'payment.png'), fullPage: true });
    await page.getByRole('tab', { name: /票档判断/ }).click();
    await page.getByText('已有待完成或已确认订单').waitFor();
    await page.screenshot({ path: join(artifacts, 'detail.png'), fullPage: true });
    await page.getByRole('tab', { name: /官方机会/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByText('还没有有来源的销售时间').waitFor();
    await page.getByRole('tab', { name: /订单结果/ }).click();
    await page.getByText('待支付订单即将截止').waitFor();
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByRole('region', { name: '待支付订单' }).getByText('测试巡演 · 上海站').waitFor();
    await page.getByRole('button', { name: '查看订单结果' }).click();
    await page.getByRole('button', { name: '编辑规则' }).click();
    await page.getByLabel('场馆 / 城市').fill('上海新体育馆');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByText('上海新体育馆').waitFor();
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByRole('button', { name: '销售日历' }).click();
    await page.getByRole('heading', { name: '销售日历' }).waitFor();
    await page.getByRole('button', { name: '平台规则' }).click();
    await page.getByRole('heading', { name: '平台规则与能力边界' }).waitFor();
    await page.getByRole('button', { name: '设备与会话' }).click();
    await page.getByRole('heading', { name: '设备与网页会话' }).waitFor();
    await page.getByRole('button', { name: '检查连接' }).click();
    await page
      .locator('.preline')
      .getByText(/adb|Android/)
      .waitFor();
    await page.getByRole('button', { name: '切换深色模式' }).click();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((item) => !item.getTitle().includes('官方网页工作区'))
        ?.setSize(900, 700);
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      true,
      '最小窗口宽度不应出现横向溢出',
    );
    assert.deepEqual(errors, [], `渲染器错误: ${errors.join('; ')}`);
    console.log('UI smoke: 创建任务、机会、清单、票档和结果记录通过');
  } finally {
    await app.close();
  }
  const restarted = await electron.launch(options);
  try {
    const page = await restarted.firstWindow();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: /测试巡演 · 上海站/ }).click();
    await page.getByRole('tab', { name: /票档判断/ }).click();
    await page.getByText('已有待完成或已确认订单').waitFor();
    console.log('UI smoke: 重启后结果仍在；截图位于 .test-artifacts');
  } finally {
    await restarted.close();
  }
  writeFileSync(join(appData, 'tickets.sqlite'), 'corrupted database');
  const recovered = await electron.launch(options);
  try {
    const page = await recovered.firstWindow();
    await page.getByRole('alert').getByText('已从本机备份载入任务', { exact: false }).waitFor();
    await page.getByRole('button', { name: /测试巡演 · 上海站/ }).waitFor();
    await page.getByRole('button', { name: /测试巡演 · 上海站/ }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '删除本地任务' }).click();
    await page.getByText('先从一场确定的演出开始').waitFor();
    console.log('UI smoke: 主数据库损坏时可见备份恢复提示和原任务');
  } finally {
    await recovered.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
