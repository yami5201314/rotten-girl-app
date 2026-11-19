import { describe, expect, it } from 'vitest';
import { tapZone } from './VideoPlayer';

describe('tapZone', () => {
  it('双击左三分之一判为快退', () => expect(tapZone(50, 360)).toBe('back'));
  it('双击右三分之一判为快进', () => expect(tapZone(300, 360)).toBe('forward'));
  it('双击中间判为播放 / 暂停', () => expect(tapZone(180, 360)).toBe('center'));
});
