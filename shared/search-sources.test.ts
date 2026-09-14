import { describe, expect, it } from 'vitest';
import { resolveSearch, searchSources } from './search-sources';
import { officialUrl } from './rules';

describe('多平台发现入口', () => {
  it('只给已核实直达搜索的平台拼接关键词', () => {
    expect(resolveSearch('damai', '邓紫棋').url).toContain('search.damai.cn/search.htm?keyword=');
    expect(resolveSearch('ticketmaster', 'Coldplay').url).toBe(
      'https://www.ticketmaster.com/search?q=Coldplay',
    );
    expect(resolveSearch('maoyan', '周杰伦').url).toBe('https://show-e.maoyan.com/');
  });

  it('仅允许所选平台的官方 HTTPS 网址', () => {
    expect(resolveSearch('axs', 'https://www.axs.com/events/123').url).toBe(
      'https://www.axs.com/events/123',
    );
    expect(() => resolveSearch('axs', 'https://www.axs.com.evil.example/')).toThrow();
    expect(() => resolveSearch('axs', 'https://www.ticketmaster.com/')).toThrow();
    expect(() => resolveSearch('axs', 'javascript://example')).toThrow();
    expect(() => resolveSearch('axs', '')).toThrow();
  });

  it('所有入口属于已验证的官方域名', () => {
    expect(searchSources.length).toBeGreaterThan(2);
    for (const source of searchSources)
      expect(officialUrl(source.platform, resolveSearch(source.platform, 'test').url)).toBe(true);
  });
});
