import type { DamaiPublicFields, StructuredPublicFields } from './discovery';

// This function is also serialized into the isolated official page. Keep it self-contained.
export function collectDamaiPageFields(doc: Document): DamaiPublicFields {
  const text = (selector: string) => doc.querySelector(selector)?.textContent?.trim() || '';
  const notice = text('.notice0');
  const performDates: string[] = [];
  let priceRange = '';
  let purchaseLimit = 0;
  let appOnly = /该渠道不支持(?:购票|购买)|请到大麦\s*App\s*购买/i.test(doc.body?.innerText || '');
  const scripts = Array.from(doc.querySelectorAll('script')).slice(0, 100);
  // Some public item data is rendered as text, while long bootstrap scripts put
  // the performance rules well after the first few hundred KB.
  const sources = [
    ...scripts.map((script) => (script.textContent || '').slice(0, 1_000_000)),
    (doc.body?.innerText || '').slice(0, 1_000_000),
    (doc.body?.textContent || '').slice(0, 2_000_000),
  ];
  for (const raw of sources) {
    const source = raw.replaceAll('\\"', '"');
    if (
      /"(?:buyBtnText|buyBtnTip)"\s*:\s*"(?:该渠道不支持(?:购票|购买)|请到大麦\s*App\s*购买)"/i.test(
        source,
      )
    )
      appOnly = true;
    for (const match of source.matchAll(/"performDate"\s*:\s*"([^"\\]{8,80})"/g)) {
      if (performDates.length >= 80) break;
      performDates.push(match[1]);
    }
    if (!priceRange) {
      const match = source.match(/"priceRange"\s*:\s*"([^"\\]{1,80})"/);
      priceRange = match?.[1] || '';
    }
    if (!purchaseLimit) {
      const match = source.match(/"purchaseLimitation"\s*:\s*(\d{1,2})/);
      purchaseLimit = Number(match?.[1] || 0);
    }
  }
  return {
    title: text('.hd .title span'),
    dateText: text('.hd .time'),
    venueText: text('.hd .addr'),
    appOnly,
    limitText:
      notice.match(/每笔订单最多购买[^。]{0,120}。/)?.[0] ||
      (purchaseLimit > 0 && purchaseLimit <= 20 ? `每笔订单最多购买${purchaseLimit}张。` : ''),
    performDates,
    ticketOptions: [],
    priceRange,
  };
}

// This function is also serialized into the isolated official page.
export function collectStructuredPageFields(doc: Document): StructuredPublicFields {
  const empty = {
    title: '',
    dateText: '',
    dateOptions: [] as string[],
    venueText: '',
    ticketOptions: [] as { label: string; unitPrice: number }[],
    currency: '',
  };
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(
    0,
    40,
  );
  for (const script of scripts) {
    try {
      const queue: unknown[] = [JSON.parse((script.textContent || '').slice(0, 100_000))];
      for (let i = 0; i < queue.length && i < 100; i++) {
        const value = queue[i];
        if (Array.isArray(value)) {
          queue.push(...value.slice(0, 40));
          continue;
        }
        if (!value || typeof value !== 'object') continue;
        const item = value as Record<string, unknown>;
        if (item['@graph']) queue.push(item['@graph']);
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.some((type) => typeof type === 'string' && /(^|\/)\w*Event$/.test(type)))
          continue;
        const subEvents = Array.isArray(item.subEvent) ? item.subEvent.slice(0, 40) : [];
        const dateOptions = [item.startDate, ...subEvents.map((entry) => entry?.startDate)].filter(
          (entry): entry is string => typeof entry === 'string',
        );
        const offers = Array.isArray(item.offers) ? item.offers.slice(0, 80) : [item.offers];
        const ticketOptions: { label: string; unitPrice: number }[] = [];
        const currencies = new Set<string>();
        let currencyMissing = false;
        for (const offer of offers) {
          if (!offer || typeof offer !== 'object') continue;
          const record = offer as Record<string, unknown>;
          const label = typeof record.name === 'string' ? record.name.trim() : '';
          const rawPrice = record.price;
          if (
            !label ||
            !(
              typeof rawPrice === 'number' ||
              (typeof rawPrice === 'string' && /^\d+(?:\.\d{1,2})?$/.test(rawPrice))
            )
          )
            continue;
          const unitPrice = Number(rawPrice);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) continue;
          ticketOptions.push({ label, unitPrice });
          if (typeof record.priceCurrency === 'string') currencies.add(record.priceCurrency);
          else currencyMissing = true;
        }
        const place = item.location;
        return {
          title: typeof item.name === 'string' ? item.name : '',
          dateText: typeof item.startDate === 'string' ? item.startDate : '',
          dateOptions,
          venueText:
            place &&
            typeof place === 'object' &&
            typeof (place as { name?: unknown }).name === 'string'
              ? (place as { name: string }).name
              : '',
          ticketOptions,
          currency: !currencyMissing && currencies.size === 1 ? [...currencies][0] : '',
        };
      }
    } catch {
      // Ignore malformed public markup and inspect the next script.
    }
  }
  return empty;
}
