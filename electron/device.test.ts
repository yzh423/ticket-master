import { describe, expect, it } from 'vitest';
import { adbExecutable, parseAdbDevices, quoteForAndroidShell } from './device';

describe('Android USB diagnostics', () => {
  it('distinguishes authorized, unauthorized and offline devices', () => {
    expect(
      parseAdbDevices(
        'List of devices attached\nA1 device usb:1-1 product:x model:vivo_X300_Ultra\nB2 unauthorized usb:1-2\nC3 offline\n',
      ),
    ).toEqual([
      { serial: 'A1', status: 'device', detail: 'usb:1-1 product:x model:vivo_X300_Ultra' },
      { serial: 'B2', status: 'unauthorized', detail: 'usb:1-2' },
      { serial: 'C3', status: 'offline', detail: '' },
    ]);
  });

  it('falls back to the system PATH when no known SDK location exists', () => {
    expect(adbExecutable({})).toBe('adb');
  });

  it('quotes an official URL as one Android shell argument', () => {
    expect(quoteForAndroidShell("https://example.com/a?x=1&y='test'")).toBe(
      "'https://example.com/a?x=1&y='\\''test'\\'''",
    );
  });
});
