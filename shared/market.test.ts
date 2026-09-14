import { expect, it } from 'vitest';
import { marketComparisons, marketSource } from './market';

it('同类工具资料只能打开内置核实的来源', () => {
  expect(marketSource('bandsintown')).toBe('https://www.artist.bandsintown.com/overview');
  expect(() => marketSource('https://evil.example')).toThrow('资料来源无效');
  expect(new Set(marketComparisons.map((item) => item.id)).size).toBe(marketComparisons.length);
});
