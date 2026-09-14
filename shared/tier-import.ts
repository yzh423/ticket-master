import type { Tier } from './model';

/** Reads only explicitly named, individually priced tiers from user-supplied text. */
export function parseTierText(text: string): Tier[] {
  const result: Tier[] = [];
  const seen = new Set<string>();
  for (const line of text.slice(0, 8000).split(/\r?\n/).slice(0, 100)) {
    const match = line
      .trim()
      .match(/^(.{2,55}?)\s*[:：·|\-]?\s*[¥￥]\s*(\d{1,6}(?:\.\d{1,2})?)\s*(?:元|\/张|每张)?\s*$/);
    if (!match) continue;
    const label = match[1]
      .trim()
      .replace(/[：:·|\-\s]+$/, '')
      .trim();
    if (!label || /[¥￥]\s*\d/.test(label)) continue;
    const unitPrice = Number(match[2]);
    const key = `${label}\u0000${unitPrice}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label, unitPrice });
    if (result.length === 80) break;
  }
  return result;
}
