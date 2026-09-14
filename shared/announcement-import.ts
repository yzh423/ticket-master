import { parseLocalInstant } from './rules';

export type AnnouncementTimeCandidate = {
  localTime: string;
  excerpt: string;
};

const dateTimePattern =
  /(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?\s*(?:[（(]?\s*(?:星期|周)[一二三四五六日天]\s*[）)]?\s*)?(\d{1,2})\s*[:：]\s*(\d{2})/g;

const pad = (value: string) => value.padStart(2, '0');

/** Only explicit full dates are candidates; the user must confirm event, sale stage and source. */
export function extractAnnouncementTimes(
  text: string,
  timeZone: string,
): AnnouncementTimeCandidate[] {
  const input = text.slice(0, 10_000);
  const candidates: AnnouncementTimeCandidate[] = [];
  const seen = new Set<string>();
  for (const match of input.matchAll(dateTimePattern)) {
    const localTime = `${match[1]}-${pad(match[2])}-${pad(match[3])}T${pad(match[4])}:${match[5]}`;
    if (seen.has(localTime)) continue;
    try {
      parseLocalInstant(localTime, timeZone);
    } catch {
      continue;
    }
    seen.add(localTime);
    const clauseStart = Math.max(
      0,
      input.lastIndexOf('；', match.index) + 1,
      input.lastIndexOf(';', match.index) + 1,
      input.lastIndexOf('。', match.index) + 1,
    );
    const excerpt = input
      .slice(
        Math.max(clauseStart, match.index - 40),
        Math.min(input.length, match.index + match[0].length + 28),
      )
      .replace(/\s+/g, ' ')
      .trim();
    candidates.push({ localTime, excerpt });
    if (candidates.length === 12) break;
  }
  return candidates;
}
