import { describe, expect, it } from 'vitest';
import { parseTierText } from './tier-import';

describe('票档文字导入', () => {
  it('只接受明确命名和独立标价的行，去重且不猜价格范围', () => {
    expect(
      parseTierText(
        '价格范围 ¥380 - ¥1680\n看台区 ¥380元\n内场 A 区：¥1680/张\n看台区 ¥380元\n候补未知',
      ),
    ).toEqual([
      { label: '看台区', unitPrice: 380 },
      { label: '内场 A 区', unitPrice: 1680 },
    ]);
  });
});
