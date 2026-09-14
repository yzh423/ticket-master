import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PlatformId } from '../shared/model';
import { officialUrl } from '../shared/rules';

const run = promisify(execFile);

export function adbExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const candidates = [
    env.TICKET_WINDOW_ADB,
    env.ANDROID_HOME && join(env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    env.ANDROID_SDK_ROOT && join(env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'ticket-window-tools', 'platform-tools', 'adb.exe'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) => existsSync(candidate)) ?? 'adb';
}

export type AndroidDevice = { serial: string; status: string; detail: string };

export function parseAdbDevices(output: string): AndroidDevice[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\s+(device|unauthorized|offline)(?:\s|$)/.test(line))
    .map((line) => {
      const [serial, status, ...detail] = line.split(/\s+/);
      return { serial, status, detail: detail.join(' ') };
    });
}

async function adb(args: string[]): Promise<string> {
  const result = await run(adbExecutable(), args, { timeout: 8000, windowsHide: true });
  return result.stdout;
}

async function windowsUsbHint(): Promise<string> {
  if (process.platform !== 'win32') return '';
  try {
    const script =
      "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -in @('USB','USBDevice','WPD') -and $_.FriendlyName -match 'ADB|Android|vivo|OPPO|HUAWEI|Xiaomi|Samsung|iPhone|Apple Mobile' } | Select-Object -ExpandProperty FriendlyName";
    const result = await run('powershell.exe', ['-NoProfile', '-Command', script], {
      timeout: 8000,
      windowsHide: true,
    });
    return result.stdout.trim().split(/\r?\n/).filter(Boolean).slice(0, 4).join('、');
  } catch {
    return '';
  }
}

export async function usbStatus(): Promise<string> {
  try {
    const devices = parseAdbDevices(await adb(['devices', '-l']));
    if (!devices.length) {
      const hint = await windowsUsbHint();
      if (/iPhone|Apple Mobile/i.test(hint))
        return `Windows 已识别 ${hint}。iPhone 不支持 ADB；请使用 Apple Devices 并在手机上允许“信任此电脑”。`;
      return hint
        ? `Windows 已识别 ${hint}，但 adb 尚未看到已授权的 Android 手机。请解锁手机、开启 USB 调试并允许此电脑；仍无响应时检查 USB 数据模式和驱动。`
        : '未检测到 Android 调试设备。请使用数据线连接、解锁手机并开启 USB 调试；iPhone 请使用 Apple Devices 检查连接。';
    }
    return devices
      .map(({ serial, status, detail }) => {
        const model = detail.match(/model:([^\s]+)/)?.[1]?.replace(/_/g, ' ');
        const label = model || serial;
        if (status === 'device') return `${label} · Android 已连接并授权`;
        if (status === 'unauthorized') return `${label} · 等待在手机上允许 USB 调试授权`;
        return `${label} · 连接离线，请重新插线并解锁手机`;
      })
      .join('\n');
  } catch (error) {
    const hint = await windowsUsbHint();
    if (/iPhone|Apple Mobile/i.test(hint))
      return `Windows 已识别 ${hint}。iPhone 不支持 ADB；请使用 Apple Devices 检查连接。`;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return `${hint ? `Windows 已识别 ${hint}。` : ''}未找到 Android Platform Tools 的 adb；请从 Google 官方页面安装到 Android SDK，或把 adb.exe 所在目录加入 PATH，再重新检查。`;
    return `无法运行 adb：${error instanceof Error ? error.message : String(error)}。请检查手机授权、USB 驱动和 Platform Tools。`;
  }
}

async function onlyAuthorizedAndroid(): Promise<string> {
  let devices: AndroidDevice[];
  try {
    devices = parseAdbDevices(await adb(['devices', '-l']));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error('未找到 adb。请在“设备与会话”打开 Google 官方 Platform Tools 页面并安装');
    throw error;
  }
  const ready = devices.filter((device) => device.status === 'device');
  if (ready.length !== 1) {
    if (ready.length > 1) throw new Error('检测到多台已授权手机，请暂时只连接要使用的一台');
    if (devices.some((device) => device.status === 'unauthorized'))
      throw new Error('请在手机上允许这台电脑进行 USB 调试');
    throw new Error('没有已授权的 Android 手机。请先点“检查连接”查看原因');
  }
  return ready[0].serial;
}

export async function launchDamai(): Promise<string> {
  const serial = await onlyAuthorizedAndroid();
  const installed = await adb(['-s', serial, 'shell', 'pm', 'path', 'cn.damai']);
  if (!installed.includes('package:')) return '手机上未检测到大麦 App，请从官方渠道安装。';
  await adb(['-s', serial, 'shell', 'monkey', '-p', 'cn.damai', '1']);
  return '已尝试打开手机大麦。请在手机上核对活动、场次及订单。';
}

export async function openOfficialOnAndroid(platform: PlatformId, url: string): Promise<string> {
  if (!officialUrl(platform, url)) throw new Error('仅可向手机发送所选平台的官方 HTTPS 链接');
  const serial = await onlyAuthorizedAndroid();
  const quotedUrl = quoteForAndroidShell(url);
  await adb(['-s', serial, 'shell', `am start -a android.intent.action.VIEW -d ${quotedUrl}`]);
  return '已将官方链接发送到 Android 手机。若该平台未关联 App，手机会用浏览器打开；请在手机上确认页面。';
}

export function quoteForAndroidShell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
