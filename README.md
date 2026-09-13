# 候票台

一款在 Windows 本机运行的官方购票流程辅助工具。它把固定场次、人数、预算、可接受票档、开售日历、准备清单和人工确认的订单结果放在同一处。首版优先支持大麦 App / 网页的准备与官方入口；其他平台可记录机会与规则，适配能力仍以每场官方公告为准。

**它不自动购票。**没有自动刷新、验证码处理、排队控制、库存抓取、第三方下单或支付。页面显示可买不代表成功占票；真正的订单与出票状态只能依据平台确认。应用关闭时没有桌面提醒，官方 App 消息通知应继续开启。没有可靠公告就不生成猜测的补票时间。

## 运行和打包

需要 Node.js 24 与 pnpm 11（在 Windows PowerShell 中）：

```powershell
pnpm install
pnpm run dev
```

`pnpm run dev` 会先构建再启动 Electron。首次可从“新建任务”填入场次、人数、总预算、来源与可接受票档；在任务详情添加官方开售/候补机会，并逐项确认准备工作。日期使用活动所在地的 IANA 时区，如 `Asia/Shanghai` 或 `America/New_York`。通知在应用运行期间于开售前 24 小时、30 分钟、5 分钟和开售时尝试发送；Windows 通知权限由系统控制。

创建 Windows 安装包：

```powershell
pnpm run dist
```

生成的安装文件位于 `release/`。数据保存在本机 Electron 用户数据目录的 `tickets.sqlite`；升级前可以备份这个文件。不在本工具中填入密码、完整证件号或支付凭据。

## Android 连接

如需检测手机，安装 Google Android Platform Tools 并让 `adb` 可从 PATH 调用，打开手机 USB 调试并授权这台 Windows 设备。应用可以检测已授权连接，并在检测到包名 `cn.damai` 时尝试打开大麦 App。不同安装渠道的包名可能不同；无法确认时仍可人工打开 App。应用不读取屏幕或模拟触控。

## 开发验证

```powershell
pnpm test
pnpm run typecheck
pnpm run test:ui
```

逻辑测试覆盖时区、预算选择、未知库存、官方域名、SQLite 重启保存与提醒去重。UI 冒烟测试使用隔离的 Electron 用户数据目录，创建任务、机会和结果，再重启确认持久化；截图保存在 `.test-artifacts/`。

资料依据及首版能力边界记录在 [设计文档](docs/skills/specs/2026-09-14-ticket-assistant-design.md)。平台规则会变化，应以每场官方公告为准。我们没有真实抢票的对照数据，因而不宣称提升某个成功率百分比。
