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
    await page.getByRole('heading', { name: '搜索你想看的演出' }).waitFor();
    await page.getByRole('button', { name: /更多平台 · 20/ }).click();
    await page.getByRole('button', { name: /StubHub/ }).waitFor();
    await page.getByRole('button', { name: /收起平台/ }).click();
    await page.screenshot({ path: join(artifacts, 'discover-latest.png') });
    await page.getByLabel('演出关键词或官方活动链接').fill('邓紫棋 深圳');
    await page.getByRole('button', { name: '搜索演出' }).click();
    await page.getByRole('button', { name: '读取活动信息' }).waitFor();
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
      '搜索不得创建新窗口',
    );
    const discoveryView = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows()[0];
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.ok(discoveryView, '搜索网页应嵌入主窗口');
    await page.getByLabel('演出关键词或官方活动链接').fill('上海 音乐节');
    await page.getByRole('button', { name: '搜索演出' }).click();
    const discoveryViewAfter = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows()[0];
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.equal(discoveryViewAfter, discoveryView, '再次搜索应复用已有发现会话');
    const inspectError = await page.evaluate(async () => {
      try {
        await window.ticket.discoveryInspect();
        return '';
      } catch (error) {
        return String(error);
      }
    });
    assert.match(inspectError, /请先/);
    await page.getByRole('button', { name: /Ticketmaster/ }).click();
    await page.getByLabel('演出关键词或官方活动链接').fill('Coldplay');
    await page.getByRole('button', { name: '搜索演出' }).click();
    assert.equal(
      (await page.evaluate(() => window.ticket.discoveryState())).platform,
      'ticketmaster',
    );
    assert.deepEqual(
      (await page.evaluate(() => window.ticket.discoveryState())).tabs.map((tab) => tab.platform),
      ['damai', 'ticketmaster'],
      '两个平台应该保留各自的网页标签',
    );
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
      '跨平台搜索仍应留在主窗口',
    );
    await page.getByRole('status').filter({ hasText: '已在下方打开 Ticketmaster' }).waitFor();
    let inlineBounds;
    for (let i = 0; i < 20; i++) {
      inlineBounds = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children.at(-1).getBounds(),
      );
      if (inlineBounds.width > 200 && inlineBounds.height > 200) break;
      await page.waitForTimeout(50);
    }
    assert.ok(inlineBounds.width > 200 && inlineBounds.height > 200, '切换平台后官网区域应可见');
    await page.getByRole('tab', { name: '大麦' }).click();
    assert.equal((await page.evaluate(() => window.ticket.discoveryState())).platform, 'damai');
    await page.getByRole('tab', { name: 'Ticketmaster' }).click();
    assert.equal(
      (await page.evaluate(() => window.ticket.discoveryState())).platform,
      'ticketmaster',
    );
    await assert.rejects(
      page.evaluate(() => window.ticket.clearBrowserData('ticketmaster')),
      /请先关闭该平台的网页工作区/,
    );
    await page.getByRole('button', { name: '关闭站内网页' }).click();
    await page.evaluate(() => window.ticket.clearBrowserData('ticketmaster'));
    await page.getByRole('button', { name: /猫眼演出/ }).click();
    await page.getByLabel('演出关键词或官方活动链接').fill('邓紫棋');
    await page.getByRole('button', { name: '打开官网' }).click();
    assert.equal((await page.evaluate(() => window.ticket.discoveryState())).platform, 'maoyan');
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
    );
    await page.getByRole('button', { name: '关闭站内网页' }).click();
    await page
      .getByRole('group', { name: '筛选平台类别' })
      .getByRole('button', { name: '香港' })
      .click();
    await page.getByRole('button', { name: /URBTIX/ }).click();
    await page.getByLabel('演出关键词或官方活动链接').fill('');
    await page.getByRole('button', { name: '打开官网' }).click();
    assert.equal((await page.evaluate(() => window.ticket.discoveryState())).platform, 'urbtix');
    await page.getByRole('button', { name: '关闭站内网页' }).click();
    await page
      .getByRole('group', { name: '筛选平台类别' })
      .getByRole('button', { name: '全部' })
      .click();
    await page.getByRole('button', { name: '关闭站内网页' }).click();
    await page.getByRole('button', { name: '我的任务' }).click();
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
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('discovery:selected', {
        platform: 'damai',
        title: '自动识别测试巡演',
        dateHint: '2026.10.01-10.02',
        sessionLocal: '',
        sessions: [
          { local: '2026-10-01T19:30', label: '2026-10-01 周四 19:30' },
          { local: '2026-10-02T19:30', label: '2026-10-02 周五 19:30' },
        ],
        ticketOptions: [
          { label: '看台', unitPrice: 580 },
          { label: '内场', unitPrice: 1280 },
        ],
        priceRange: '¥380 - ¥1680',
        currency: 'CNY',
        venue: '测试体育场',
        appOnly: true,
        ruleNote: '页面提示仅 App 购票',
        eventUrl: 'https://detail.damai.cn/item.htm?id=1',
        sourceUrl: 'https://detail.damai.cn/item.htm?id=1',
      });
    });
    await page.getByRole('radio', { name: /2026-10-02 周五 19:30/ }).check();
    await page.getByRole('button', { name: /内场.*1,?280/ }).click();
    await page.getByRole('button', { name: /看台.*580/ }).click();
    await page.getByLabel('固定人数').selectOption('2');
    await page.getByRole('button', { name: '票面总价 +20%' }).click();
    await page.getByLabel('固定人数').selectOption('3');
    assert.equal(await page.getByLabel('含费用的总预算').inputValue(), '4608');
    await page.getByLabel('固定人数').selectOption('2');
    await page.screenshot({ path: join(artifacts, 'discovered-options.png') });
    await page.getByRole('button', { name: '查看识别详情与手动修改' }).click();
    assert.equal(
      await page.getByLabel('固定演出场次（当地时间）').inputValue(),
      '2026-10-02T19:30',
    );
    assert.equal(await page.getByLabel('票档 1 名称').inputValue(), '内场');
    assert.equal(await page.getByLabel('票档 2 名称').inputValue(), '看台');
    assert.equal(await page.getByLabel('含费用的总预算').inputValue(), '3072');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByRole('heading', { name: '自动识别测试巡演' }).waitFor();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '删除本地任务' }).click();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.send('discovery:selected', {
        platform: 'damai',
        title: '仅显示价格范围的项目',
        dateHint: '2026.10.01-10.02',
        sessionLocal: '',
        sessions: [{ local: '2026-10-01T19:30', label: '2026-10-01 周四 19:30' }],
        ticketOptions: [],
        priceRange: '¥380 - ¥1680',
        currency: 'CNY',
        venue: '测试体育场',
        appOnly: true,
        ruleNote: '',
        eventUrl: 'https://detail.damai.cn/item.htm?id=1',
        sourceUrl: 'https://detail.damai.cn/item.htm?id=1',
      });
    });
    await page.getByText('不会将价格上下限伪装成票档', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: /380.*张/ }).count(), 0);
    await page.getByRole('button', { name: '取消' }).click();
    await page.getByRole('button', { name: '我的任务' }).click();
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
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page
      .getByRole('region', { name: '下一步行动' })
      .getByRole('button', { name: /补全官方销售日历/ })
      .click();
    await page.getByRole('tab', { name: /官方机会/ }).waitFor();
    await page.getByRole('button', { name: '内置官方网页' }).click();
    await page
      .getByRole('region', { name: '当前任务购票条件' })
      .getByText('测试巡演 · 上海站')
      .waitFor();
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length),
      1,
      '从任务打开官网应留在主窗口',
    );
    const viewBefore = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows()[0];
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.ok(viewBefore, '任务官网应显示为主窗口内的 WebContentsView');
    await page.getByRole('button', { name: '返回任务' }).click();
    await page.getByRole('button', { name: '内置官方网页' }).click();
    const viewAfter = await app.evaluate(({ BrowserWindow }) => {
      const holder = BrowserWindow.getAllWindows()[0];
      const child = holder?.contentView.children[0];
      return child && 'webContents' in child ? child.webContents.id : null;
    });
    assert.equal(viewAfter, viewBefore, '再次打开同一任务不应重建网页会话');
    await page.screenshot({ path: join(artifacts, 'browser.png'), fullPage: true });
    await page.getByRole('button', { name: '设备与会话' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '清除该平台网页数据' }).click();
    await page
      .getByRole('status')
      .getByText('请先关闭该平台的网页工作区', { exact: false })
      .waitFor();
    await page.getByRole('button', { name: '发现演出' }).click();
    await page.getByRole('button', { name: '关闭站内网页' }).click();
    await page.getByRole('button', { name: '设备与会话' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '清除该平台网页数据' }).click();
    await page.getByRole('status').getByText('已清除。再次打开该平台', { exact: false }).waitFor();
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.locator('.event-row').filter({ hasText: '测试巡演 · 上海站' }).click();
    await page.getByRole('button', { name: '添加机会' }).click();
    await page.getByText('粘贴公告，辅助提取时间').click();
    await page
      .getByLabel('官方公告文字')
      .fill('演出 2026年10月1日 19:30；公开开售 2026年9月20日 12:00。');
    await page
      .getByRole('group', { name: '识别出的时间候选' })
      .getByRole('button', { name: /2026-09-20 12:00/ })
      .click();
    assert.equal(await page.getByLabel('开始（所在地时间）').inputValue(), '2026-09-20T12:00');
    await page.screenshot({ path: join(artifacts, 'opportunity-import.png') });
    await page.getByRole('button', { name: '保存机会' }).click();
    await page.getByRole('alert').getByText('请先在官方公告核对活动', { exact: false }).waitFor();
    await page.getByLabel('我已在官方公告核对本场活动、开售时间、时区及来源').check();
    await page.getByLabel('来源网址').fill('https://detail.damai.cn/new-announcement');
    assert.equal(
      await page.getByLabel('我已在官方公告核对本场活动、开售时间、时区及来源').isChecked(),
      false,
      '来源变更后必须重新核对',
    );
    await page.getByLabel('我已在官方公告核对本场活动、开售时间、时区及来源').check();
    await page.getByRole('button', { name: '保存机会' }).evaluate((button) => {
      button.click();
      button.click();
    });
    await page.locator('.opportunity-time').getByText('2026/09/20 12:00').waitFor();
    assert.equal(await page.locator('.opportunity').count(), 1, '双击保存不应生成重复机会');
    assert.equal(
      await page.evaluate(async () =>
        JSON.stringify(await window.ticket.list()).includes('演出 2026年10月1日 19:30'),
      ),
      false,
      '粘贴的公告原文不应保存到任务库',
    );
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByLabel('资格条件').fill('已核对本场资格');
    await page.getByLabel('本次销售渠道').selectOption('app_required');
    await page.getByRole('button', { name: '保存机会' }).click();
    await page.getByText('已核对本场资格').waitFor();
    await page.locator('.opportunity').getByRole('button', { name: '打开大麦 App' }).waitFor();
    await page.getByLabel('公开销售参与状态').selectOption('registered');
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page
      .getByRole('region', { name: '下一次官方机会' })
      .getByText('7 项准备待核对')
      .waitFor();
    await page.screenshot({ path: join(artifacts, 'focus.png'), fullPage: true });
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
    await page.getByLabel('本场购票渠道').selectOption('app_required');
    await page.getByRole('button', { name: '保存任务' }).click();
    await page.getByText('上海新体育馆').waitFor();
    await page.getByRole('button', { name: '在手机打开大麦 App' }).waitFor();
    await page.getByText('网页仅用于核对公告', { exact: false }).waitFor();
    await page.screenshot({ path: join(artifacts, 'app-only.png') });
    await page.getByRole('button', { name: '返回任务列表' }).click();
    await page.getByRole('button', { name: '销售日历' }).click();
    await page.getByRole('heading', { name: '销售日历' }).waitFor();
    await page.getByRole('button', { name: '平台规则' }).click();
    await page.getByRole('heading', { name: '平台规则与能力边界' }).waitFor();
    await page.getByRole('region', { name: '同类工具能力对照' }).getByText('Bandsintown').waitFor();
    await page.screenshot({ path: join(artifacts, 'comparison.png'), fullPage: true });
    assert.equal(
      await page.evaluate(() =>
        window.ticket.openKnowledgeSource('unknown').then(
          () => false,
          () => true,
        ),
      ),
      true,
      '未收录的外部资料不得打开',
    );
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
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.locator('.event-row').filter({ hasText: '测试巡演 · 上海站' }).click();
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
    await page.getByRole('button', { name: '我的任务' }).click();
    await page.locator('.event-row').filter({ hasText: '测试巡演 · 上海站' }).waitFor();
    await page.locator('.event-row').filter({ hasText: '测试巡演 · 上海站' }).click();
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
