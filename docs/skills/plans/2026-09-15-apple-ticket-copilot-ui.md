# Apple Ticket Copilot UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild 候票台 around one short path—search, choose sessions, choose ticket tiers, choose quantity, open the verified official purchase route—while preserving all existing task, backup, browser, and Android capabilities.

**Architecture:** Keep the existing React/Electron/SQLite data layer and move presentation into three top-level destinations: Discover, Tasks, and Settings. Reuse `EventForm` purchase logic as an inline `PurchaseSetupPanel`, keep manual editing in a modal, and use a small shell component plus view-specific CSS so the native embedded browser can resize beside the setup panel.

**Tech Stack:** React 19, TypeScript 5.9, Electron 44 WebContentsView, SQLite via sql.js, plain CSS, Lucide icons, Playwright, Vitest.

## Global Constraints

- The main navigation contains exactly `找票`, `任务`, and `设置`.
- The default path asks for only session, accepted ticket tiers, and quantity when public data is available.
- No new UI framework, remote font, database migration, account credential storage, identity document storage, CAPTCHA handling, automated clicking, or payment automation.
- Official pages remain inside the desktop window whenever the platform permits embedding.
- Copy must not claim live inventory, queue advantage, automatic checkout, or guaranteed success.
- Controls are at least 44×44px; text contrast meets WCAG AA; reduced motion is supported.

---

### Task 1: Lock the Three-Destination Information Architecture

**Files:**
- Modify: `src/App.tsx`
- Modify: `tests/smoke.cjs`
- Modify: `tests/web.cjs`

**Interfaces:**
- Produces: `type Page = 'discover' | 'tasks' | 'settings'`
- Preserves: `openEvent(id, tab)`, `startOfficialPurchase(event)`, backup APIs, device APIs.

- [ ] **Step 1: Write failing navigation assertions**

Update the smoke tests to require three navigation controls and reject the removed top-level destinations:

```js
for (const name of ['找票', '任务', '设置']) {
  assert.equal(await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name }).count(), 1);
}
for (const name of ['销售日历', '平台规则', '设备与会话']) {
  assert.equal(await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name }).count(), 0);
}
```

- [ ] **Step 2: Run the UI tests and confirm they fail**

Run: `pnpm run test:ui`

Expected: FAIL because the old five-item navigation is still rendered.

- [ ] **Step 3: Replace the page union and navigation**

Use the exact page model below and route the old dashboard to `tasks`:

```ts
type Page = 'discover' | 'tasks' | 'settings';
const [page, setPage] = useState<Page>('discover');
```

Render only the three required labels. Move calendar rendering into a Tasks view selector and render the old guide/device/data sections under Settings subsections.

- [ ] **Step 4: Run type and UI checks**

Run: `pnpm run typecheck && pnpm run test:ui && pnpm run test:web`

Expected: all commands exit 0 and navigation assertions pass.

- [ ] **Step 5: Commit the information architecture**

```bash
git add src/App.tsx tests/smoke.cjs tests/web.cjs
git commit -m "refactor: reduce app navigation to three destinations"
```

### Task 2: Establish the Apple-Calm Shell and Design Tokens

**Files:**
- Create: `src/apple-ui.css`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/smoke.cjs`

**Interfaces:**
- Produces CSS tokens: `--app-bg`, `--app-surface`, `--app-text`, `--app-muted`, `--app-accent`, `--app-border`, `--app-radius-control`, `--app-radius-panel`, `--motion-fast`, `--motion-panel`.
- Produces structural classes: `.app-sidebar`, `.app-topbar`, `.app-content`, `.bottom-nav`.

- [ ] **Step 1: Add failing visual-system assertions**

Assert a 3-item nav, a visible focus outline, `min-height >= 44px` for nav controls, and snapshot light, dark, and 1024×768 layouts.

- [ ] **Step 2: Import the new design layer last**

```ts
import './styles.css';
import './theme.css';
import './journey.css';
import './adaptive.css';
import './apple-ui.css';
```

- [ ] **Step 3: Define tokens and shell rules**

Start with these exact light tokens and paired dark tokens:

```css
:root {
  --app-bg: #f5f5f7;
  --app-surface: #ffffff;
  --app-text: #1d1d1f;
  --app-muted: #6e6e73;
  --app-accent: #007aff;
  --app-border: rgba(60, 60, 67, 0.16);
  --app-radius-control: 8px;
  --app-radius-panel: 12px;
  --motion-fast: 180ms;
  --motion-panel: 240ms;
}
```

Remove visible grid textures, glowing dots, decorative all-caps eyebrow text, large gradients, and redundant border boxes. Use blur only on the sidebar/topbar and setup sheet.

- [ ] **Step 4: Add reduced-motion and responsive navigation**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
@media (max-width: 760px) {
  .app-sidebar { display: none; }
  .bottom-nav { display: grid; grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 5: Verify shell screenshots and accessibility**

Run: `pnpm run typecheck && pnpm run test:ui`

Expected: light/dark screenshots have no horizontal overflow and every main navigation target is at least 44px high.

- [ ] **Step 6: Commit the shell**

```bash
git add src/apple-ui.css src/main.tsx src/App.tsx tests/smoke.cjs
git commit -m "feat: add Apple-calm application shell"
```

### Task 3: Turn Discovery Into Search Plus In-Window Workspace

**Files:**
- Modify: `src/components/DiscoverPage.tsx`
- Modify: `src/components/discover.css`
- Modify: `src/App.tsx`
- Modify: `tests/smoke.cjs`

**Interfaces:**
- Add to `DiscoverPage` props: `setupPanel?: ReactNode` and `setupOpen?: boolean`.
- Produce classes: `.discover-command`, `.discover-platform-menu`, `.discover-browser-layout`, `.discover-browser-layout.has-setup`, `.discover-setup-slot`.

- [ ] **Step 1: Write failing discovery layout tests**

Assert that the first heading is `找演出`, only one search field is present, platform choices are collapsed behind `选择平台`, the browser remains alive when a setup panel opens, and the Electron window count remains one.

- [ ] **Step 2: Replace the large discovery hero**

Render one compact header and command bar:

```tsx
<header className="discover-command">
  <div><h1>找演出</h1><p>搜索活动或粘贴官方链接</p></div>
  <form className="discover-search">{/* existing validated input and action */}</form>
</header>
```

Keep platform category and source buttons inside a disclosure menu. Keep recent/open official site tabs in the workspace toolbar.

- [ ] **Step 3: Add the split workspace contract**

```tsx
<div className={`discover-browser-layout${setupOpen ? ' has-setup' : ''}`}>
  <section className="discover-workspace">{/* existing browser toolbar and pane */}</section>
  {setupOpen && <aside className="discover-setup-slot">{setupPanel}</aside>}
</div>
```

Because the BrowserView bounds are measured from `.discover-browser-pane`, the native view must shrink automatically when the aside appears.

- [ ] **Step 4: Remove below-fold preparation cards**

Delete the Account/Attendees promotional cards. Keep login/session actions contextually in the browser toolbar and move explanatory material to Settings.

- [ ] **Step 5: Verify browser behavior**

Run: `pnpm run typecheck && pnpm run test:ui`

Expected: searches reuse one Electron window, platform tabs retain their sessions, and the browser pane width decreases while the setup aside is visible.

- [ ] **Step 6: Commit discovery workspace**

```bash
git add src/components/DiscoverPage.tsx src/components/discover.css src/App.tsx tests/smoke.cjs
git commit -m "feat: simplify discovery into an in-window workspace"
```

### Task 4: Convert Quick Creation Into an Inline Purchase Setup Panel

**Files:**
- Modify: `src/components/EventForm.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/apple-ui.css`
- Modify: `tests/smoke.cjs`

**Interfaces:**
- Add `presentation?: 'dialog' | 'panel'` to `EventForm`.
- Preserve `onSave(event, startNow?)` and all existing validation.
- Quick panel exposes labels `场次`, `票档`, `人数`, primary CTA `准备并打开官方购票`, secondary CTA `仅保存`.

- [ ] **Step 1: Update quick-flow tests to fail on the old modal**

Require the quick setup to be an `<aside aria-label="购票准备">`, verify the official browser remains visible, and assert there is only one primary action.

- [ ] **Step 2: Add the presentation contract**

```ts
presentation = 'dialog'
```

For `panel`, render a semantic aside without overlay/backdrop and without dialog focus trapping. For manual creation/editing, retain the existing modal.

- [ ] **Step 3: Simplify quick labels and footer**

Remove numbered legends and use compact section labels. Keep selection order badges on ticket tiers. Render:

```tsx
<button type="submit" className="button primary">准备并打开官方购票</button>
<button type="submit" className="button quiet">仅保存</button>
```

The primary action calls `onSave(event, true)` and must remain disabled until one session and one tier are selected.

- [ ] **Step 4: Keep only necessary exceptions visible**

If time zone or currency is unknown, show the required control inline. Put all other imported fields under `识别详情`. Keep price-range-only/App-only behavior honest and actionable.

- [ ] **Step 5: Verify quick and manual paths**

Run: `pnpm run test:ui && pnpm run test:web`

Expected: selected sessions only are saved, tier order is preserved, quantity limit is respected, manual legacy task creation still works, and app-only sources do not fabricate ticket tiers.

- [ ] **Step 6: Commit purchase setup panel**

```bash
git add src/components/EventForm.tsx src/App.tsx src/styles.css src/apple-ui.css tests/smoke.cjs tests/web.cjs
git commit -m "feat: add inline three-choice purchase setup"
```

### Task 5: Merge Tasks, Calendar, Rules, and Device Pages

**Files:**
- Create: `src/components/TaskHub.tsx`
- Create: `src/components/SettingsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/apple-ui.css`
- Modify: `tests/smoke.cjs`
- Modify: `tests/web.cjs`

**Interfaces:**
- `TaskHub` consumes events, upcoming opportunities, pending orders, clock, and `openEvent`/`setPage` callbacks.
- `SettingsPage` consumes `web`, ADB/device state, backup state, theme state, guide data, and existing handlers.

- [ ] **Step 1: Write failing merged-page tests**

Assert Tasks has one urgent action, a segmented view with `列表` and `按时间`, and no old summary strip. Assert Settings contains `手机连接`, `官方会话`, `通知与数据`, and `平台说明` groups.

- [ ] **Step 2: Extract and simplify TaskHub**

Use one priority card followed by one list. Add a `list | timeline` local view state. Do not render the old focus hero, summary strip, action-card grid, and task list simultaneously.

- [ ] **Step 3: Extract SettingsPage**

Move the existing device diagnostics, account/session controls, backup import/export, and platform guide into four accessible sections. Use an in-page settings sidebar on wide screens and stacked disclosure sections below 900px.

- [ ] **Step 4: Preserve behavior through props**

Move JSX only; retain the existing handlers and data APIs. Do not change database persistence or Electron IPC contracts.

- [ ] **Step 5: Verify data and settings**

Run: `pnpm test && pnpm run test:ui && pnpm run test:web`

Expected: tasks survive restart, calendar opportunities appear in `按时间`, backup restore keeps task count, ADB state remains distinguishable, and platform references still open verified HTTPS URLs.

- [ ] **Step 6: Commit merged destinations**

```bash
git add src/components/TaskHub.tsx src/components/SettingsPage.tsx src/App.tsx src/apple-ui.css tests/smoke.cjs tests/web.cjs
git commit -m "refactor: merge task timeline and application settings"
```

### Task 6: Add Focus Mode and Complete Responsive Verification

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/apple-ui.css`
- Modify: `tests/smoke.cjs`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- `EventDetail` gets a root class `event-detail focus-mode` when an opportunity is active or within the existing attention window.
- Focus mode preserves tabs and result recording but shows browser/app action, countdown, choice summary, and next preparation gap first.

- [ ] **Step 1: Add focus-mode and responsive assertions**

Test 1024×768, 1440×900, and 700×900 viewports; require zero horizontal overflow. Test reduced motion with Playwright `reducedMotion: 'reduce'`. Assert valid order status changes the primary action to `处理订单`.

- [ ] **Step 2: Reorder EventDetail for high-pressure use**

Place activity/session/countdown first, official route second, selected tiers/quantity/readiness third, and detailed sales/results history after it. Hide tutorial and comparison content in focus mode.

- [ ] **Step 3: Finish responsive CSS**

At 1100px reduce the setup panel to 360px. At 900px stack workspace and setup panel. At 760px use bottom navigation and safe-area padding. Preserve the native browser measurement target at every breakpoint.

- [ ] **Step 4: Update product documentation and version**

Update README screenshots and describe the three-destination flow. Set the package version to `0.13.0`.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
pnpm test
pnpm run typecheck
pnpm run format:check
pnpm run test:ui
pnpm run test:web
pnpm run dist
node .test-artifacts/packaged-smoke.cjs
```

Expected: 0 exit status for every command, no browser console errors, no overflow at tested sizes, and the packaged app opens Discover successfully.

- [ ] **Step 6: Install without changing user data**

Back up `%APPDATA%\ticket-window\tickets.sqlite`, close the running app normally, install `release\候票台 Setup 0.13.0.exe`, run the installed smoke test, compare the database SHA-256 to the backup, then open the app.

- [ ] **Step 7: Commit the release-ready UI**

```bash
git add README.md package.json docs/images src/App.tsx src/apple-ui.css tests/smoke.cjs
git commit -m "release: complete simplified ticket copilot UI"
```

