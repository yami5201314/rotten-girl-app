import { describe, expect, it } from 'vitest';
import zhCN from '@messages/zh-CN.json';
import zhTW from '@messages/zh-TW.json';
import ko from '@messages/ko.json';
import ja from '@messages/ja.json';
import th from '@messages/th.json';
import vi from '@messages/vi.json';
import { initialLocale, translate } from './index';
import { locales } from './routing';

const keysOf = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

describe('i18n', () => {
  it('6 个语言文件键完全一致', () => {
    const base = keysOf(zhCN).sort();
    for (const m of [zhTW, ko, ja, th, vi]) expect(keysOf(m).sort()).toEqual(base);
    expect(locales).toHaveLength(6);
  });

  it('读取共享 messages 并替换变量', () => {
    expect(translate('zh-CN', 'common.episodes', { count: 3 })).toBe('共 3 集');
  });

  it('缺失键回退默认语言，再缺返回键名', () => {
    expect(translate('ko', 'no.such.key')).toBe('no.such.key');
  });

  it('首选已保存语言，其次按系统语言推断', () => {
    expect(initialLocale('ja', ['ko-KR'])).toBe('ja');
    expect(initialLocale(null, ['zh-Hant-TW'])).toBe('zh-TW');
    expect(initialLocale(null, ['ko-KR'])).toBe('ko');
    expect(initialLocale(null, ['en-US'])).toBe('zh-CN');
  });
});
