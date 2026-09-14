import { describe, expect, it } from 'vitest';
import { extractAnnouncementTimes } from './announcement-import';

describe('官方公告时间辅助提取', () => {
  it('提取完整的中文、横线及斜线日期，保留原文顺序', () => {
    const text = '预售 2026年9月18日 10:00；公开开售 2026-09-20 12:00；补票 2026/09/25 20:30。';
    expect(extractAnnouncementTimes(text, 'Asia/Shanghai').map((item) => item.localTime)).toEqual([
      '2026-09-18T10:00',
      '2026-09-20T12:00',
      '2026-09-25T20:30',
    ]);
  });

  it('不猜测缺少年份的时间，也不接受无效日期或夏令时缺口', () => {
    const text = '9月20日12:00；2026-02-30 12:00；2026-03-08 02:30；2026-03-09 10:00';
    expect(
      extractAnnouncementTimes(text, 'America/New_York').map((item) => item.localTime),
    ).toEqual(['2026-03-09T10:00']);
  });

  it('重复时间只呈现一次，忽略过长输入后的部分', () => {
    const text = '开售 2026年9月20日 12:00；再次强调 2026-09-20 12:00';
    expect(extractAnnouncementTimes(text, 'Asia/Shanghai')).toHaveLength(1);
    const many = Array.from(
      { length: 18 },
      (_, hour) => `2026-09-20 ${String(hour).padStart(2, '0')}:00`,
    ).join('；');
    expect(extractAnnouncementTimes(many, 'Asia/Shanghai')).toHaveLength(12);
    expect(
      extractAnnouncementTimes(`${'x'.repeat(10_000)}2026-09-20 12:00`, 'Asia/Shanghai'),
    ).toEqual([]);
  });
});
