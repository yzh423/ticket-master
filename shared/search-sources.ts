import type { PlatformId } from './model';
import { officialUrl } from './rules';
import { damaiDiscoveryUrl } from './discovery';

export type SearchSource = {
  platform: PlatformId;
  label: string;
  region: string;
  mode: 'keyword' | 'site';
  home: string;
};

export const searchSources: SearchSource[] = [
  {
    platform: 'damai',
    label: '大麦',
    region: '中国内地',
    mode: 'keyword',
    home: 'https://www.damai.cn/',
  },
  {
    platform: 'maoyan',
    label: '猫眼演出',
    region: '中国内地',
    mode: 'site',
    home: 'https://show-e.maoyan.com/',
  },
  {
    platform: 'ticketmaster',
    label: 'Ticketmaster',
    region: '国际',
    mode: 'keyword',
    home: 'https://www.ticketmaster.com/',
  },
  { platform: 'axs', label: 'AXS', region: '国际', mode: 'site', home: 'https://www.axs.com/' },
  {
    platform: 'eventbrite',
    label: 'Eventbrite',
    region: '国际',
    mode: 'site',
    home: 'https://www.eventbrite.com/',
  },
  {
    platform: 'cityline',
    label: 'Cityline',
    region: '香港',
    mode: 'site',
    home: 'https://www.cityline.com/',
  },
  {
    platform: 'hkticketing',
    label: 'HK Ticketing',
    region: '香港',
    mode: 'site',
    home: 'https://hkt.hkticketing.com/',
  },
  {
    platform: 'klook',
    label: 'Klook',
    region: '景点',
    mode: 'site',
    home: 'https://www.klook.com/zh-CN/',
  },
];

export function resolveSearch(
  platform: PlatformId,
  input: string,
): { url: string; source: SearchSource } {
  const source = searchSources.find((item) => item.platform === platform);
  if (!source) throw new Error('该平台暂未接入发现页');
  const value = input.trim();
  if (!value || value.length > 120) throw new Error('请输入 1–120 字的关键词或官方活动链接');
  if (/^https?:/i.test(value)) {
    if (!officialUrl(platform, value)) throw new Error('请使用所选平台的官方 HTTPS 链接');
    return { url: value, source };
  }
  if (value.includes('://')) throw new Error('请使用所选平台的官方 HTTPS 链接');
  if (platform === 'damai') return { url: damaiDiscoveryUrl(value), source };
  if (platform === 'ticketmaster') {
    const url = new URL('https://www.ticketmaster.com/search');
    url.searchParams.set('q', value);
    return { url: url.toString(), source };
  }
  return { url: source.home, source };
}
