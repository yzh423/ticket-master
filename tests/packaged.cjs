const { _electron: electron } = require('playwright');
const { join } = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = join(__dirname, '..');
  const app = await electron.launch({
    executablePath: join(root, 'release', 'win-unpacked', '候票台.exe'),
    args: [`--user-data-dir=${join(root, '.test-data', 'packaged-profile')}`],
    cwd: root,
  });
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await page
      .getByRole('heading', { name: '把每次机会，准备成一次有效尝试。' })
      .waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '平台规则' }).click();
    await page.getByRole('region', { name: '同类工具能力对照' }).getByText('Bandsintown').waitFor();
    const browserIncluded = await app.evaluate(async ({ app, BrowserWindow }) => {
      const browser = new BrowserWindow({ show: false });
      try {
        await browser.loadFile(`${app.getAppPath()}/dist/browser.html`);
        return true;
      } finally {
        browser.destroy();
      }
    });
    assert.equal(browserIncluded, true, '安装包应包含内置网页工作区');
    assert.deepEqual(errors, []);
    console.log('打包版启动与渲染通过');
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
