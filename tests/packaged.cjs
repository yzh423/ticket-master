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
    assert.deepEqual(errors, []);
    console.log('打包版启动与渲染通过');
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
