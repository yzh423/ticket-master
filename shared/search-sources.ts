import { platformLabels, type PlatformId } from './model';
import { officialUrl } from './rules';
import { damaiDiscoveryUrl } from './discovery';

export type SearchGroup = 'mainland' | 'hongkong' | 'international' | 'attractions' | 'resale';
export type SearchSource = {
  platform: PlatformId;
  label: string;
  region: string;
  group: SearchGroup;
  mode: 'keyword' | 'site';
  home: string;
};

// A site entry opens the official site. It does not imply a shared search API or live inventory.
export const searchSources: SearchSource[] = [
  {
    platform: 'damai',
    label: '大麦',
    region: '中国内地',
    group: 'mainland',
    mode: 'keyword',
    home: 'https://www.damai.cn/',
  },
  {
    platform: 'maoyan',
    label: '猫眼演出',
    region: '中国内地',
    group: 'mainland',
    mode: 'site',
    home: 'https://show-e.maoyan.com/',
  },
  {
    platform: 'showstart',
    label: '秀动',
    region: '中国内地',
    group: 'mainland',
    mode: 'site',
    home: 'https://www.showstart.com/',
  },
  {
    platform: 'moretickets',
    label: '摩天轮票务',
    region: '转售 / 内地',
    group: 'resale',
    mode: 'site',
    home: 'https://www.moretickets.com/',
  },
  {
    platform: 'cityline',
    label: 'Cityline',
    region: '香港',
    group: 'hongkong',
    mode: 'site',
    home: 'https://www.cityline.com/',
  },
  {
    platform: 'hkticketing',
    label: 'HK Ticketing',
    region: '香港',
    group: 'hongkong',
    mode: 'site',
    home: 'https://hkt.hkticketing.com/',
  },
  {
    platform: 'urbtix',
    label: 'URBTIX',
    region: '香港',
    group: 'hongkong',
    mode: 'site',
    home: 'https://www.urbtix.hk/',
  },
  {
    platform: 'ticketmaster',
    label: 'Ticketmaster',
    region: '国际',
    group: 'international',
    mode: 'keyword',
    home: 'https://www.ticketmaster.com/',
  },
  {
    platform: 'axs',
    label: 'AXS',
    region: '国际',
    group: 'international',
    mode: 'site',
    home: 'https://www.axs.com/',
  },
  {
    platform: 'dice',
    label: 'DICE',
    region: '国际',
    group: 'international',
    mode: 'site',
    home: 'https://dice.fm/',
  },
  {
    platform: 'eventbrite',
    label: 'Eventbrite',
    region: '国际',
    group: 'international',
    mode: 'site',
    home: 'https://www.eventbrite.com/',
  },
  {
    platform: 'seetickets',
    label: 'See Tickets',
    region: '国际',
    group: 'international',
    mode: 'site',
    home: 'https://www.seetickets.com/',
  },
  {
    platform: 'livenation',
    label: 'Live Nation',
    region: '国际',
    group: 'international',
    mode: 'site',
    home: 'https://www.livenation.com/',
  },
  {
    platform: 'seatgeek',
    label: 'SeatGeek',
    region: '一级 / 转售',
    group: 'resale',
    mode: 'site',
    home: 'https://seatgeek.com/',
  },
  {
    platform: 'stubhub',
    label: 'StubHub',
    region: '转售',
    group: 'resale',
    mode: 'site',
    home: 'https://www.stubhub.com/',
  },
  {
    platform: 'vividseats',
    label: 'Vivid Seats',
    region: '转售',
    group: 'resale',
    mode: 'site',
    home: 'https://www.vividseats.com/',
  },
  {
    platform: 'tickpick',
    label: 'TickPick',
    region: '转售',
    group: 'resale',
    mode: 'site',
    home: 'https://www.tickpick.com/',
  },
  {
    platform: 'klook',
    label: 'Klook',
    region: '景点',
    group: 'attractions',
    mode: 'site',
    home: 'https://www.klook.com/zh-CN/',
  },
  {
    platform: 'kkday',
    label: 'KKday',
    region: '景点',
    group: 'attractions',
    mode: 'site',
    home: 'https://www.kkday.com/',
  },
  {
    platform: 'trip',
    label: 'Trip.com',
    region: '景点',
    group: 'attractions',
    mode: 'site',
    home: 'https://www.trip.com/things-to-do/',
  },
];

export function resolveSearch(
  platform: PlatformId,
  input: string,
): { url: string; source: SearchSource } {
  const source = searchSources.find((item) => item.platform === platform);
  const value = input.trim();
  if (/^https?:/i.test(value)) {
    if (value.length > 2048) throw new Error('官方链接不能超过 2048 字');
    if (!officialUrl(platform, value)) throw new Error('请使用所选平台的官方 HTTPS 链接');
    return {
      url: value,
      source: source ?? {
        platform,
        label: platformLabels[platform],
        region: '指定官方链接',
        group: 'mainland',
        mode: 'site',
        home: value,
      },
    };
  }
  if (value.length > 120) throw new Error('关键词不能超过 120 字');
  if (!source) throw new Error('该平台暂无经核实的网页入口，请粘贴具体官方活动链接或使用官方 App');
  if (value.includes('://')) throw new Error('请使用所选平台的官方 HTTPS 链接');
  if (!value) return { url: source.home, source };
  if (platform === 'damai') return { url: damaiDiscoveryUrl(value), source };
  if (platform === 'ticketmaster') {
    const url = new URL('https://www.ticketmaster.com/search');
    url.searchParams.set('q', value);
    return { url: url.toString(), source };
  }
  return { url: source.home, source };
}
