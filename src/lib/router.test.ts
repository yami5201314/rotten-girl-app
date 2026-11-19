import { describe, expect, it } from 'vitest';
import { href, parseRoute } from './router';

describe('parseRoute', () => {
  it('空哈希与未知路径回到首页', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/nope')).toEqual({ name: 'home' });
  });

  it('播放页解析剧集 id 与集号（含编码字符）', () => {
    expect(parseRoute(href.play('d1', 'SP 1'))).toEqual({ name: 'play', id: 'd1', ep: 'SP 1' });
  });

  it('播放页缺集号回首页', () => {
    expect(parseRoute('#/play/d1')).toEqual({ name: 'home' });
  });

  it('发现页搜索词与标签写在查询参数', () => {
    expect(parseRoute(href.discover({ q: '甜 宠', tag: 'campus' }))).toEqual({ name: 'discover', q: '甜 宠', tag: 'campus' });
    expect(parseRoute(href.discover())).toEqual({ name: 'discover', q: '', tag: '' });
  });

  it('排行页未知榜单回退 24h', () => {
    expect(parseRoute(href.ranking('rising'))).toEqual({ name: 'ranking', tab: 'rising' });
    expect(parseRoute('#/ranking?tab=x')).toEqual({ name: 'ranking', tab: '24h' });
  });
});
