import { describe, expect, it } from 'vitest';
import { episodeProgress, errorKeys, mediaUrl, toResult } from './api';

describe('toResult', () => {
  it('2xx 取出信封 data', () => {
    expect(toResult<{ a: number }>({ status: 200, body: { data: { a: 1 }, meta: {} } })).toEqual({ ok: true, data: { a: 1 } });
  });

  it('错误信封映射为 code / status / details', () => {
    expect(toResult({ status: 403, body: { error: { code: 'FORBIDDEN', details: { reason: 'X' } } } })).toEqual({
      ok: false,
      error: { error: 'FORBIDDEN', status: 403, details: { reason: 'X' } },
    });
  });

  it('非 JSON 错误回退 unknown', () => {
    expect(toResult({ status: 502, body: null })).toEqual({ ok: false, error: { error: 'unknown', status: 502 } });
  });
});

describe('mediaUrl', () => {
  it('站点封面地址改写为 rgmedia 本地代理，保留路径与查询', () => {
    expect(mediaUrl('https://example.invalid/covers/abc?v=1')).toBe('http://rgmedia.localhost/covers/abc?v=1');
  });

  it('相对路径（字幕）同样改写到 rgmedia', () => {
    expect(mediaUrl('/api/v1/playback-sessions/s/subtitles/ko')).toBe('http://rgmedia.localhost/api/v1/playback-sessions/s/subtitles/ko');
  });

  it('空值与非法地址返回 null', () => {
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl('http://[bad')).toBeNull();
  });
});

describe('errorKeys', () => {
  it('按 reason > code_field > code 排序', () => {
    expect(errorKeys({ error: 'INVALID_ARGUMENT', status: 400, details: { field: 'email', reason: 'EMAIL_NOT_VERIFIED' } })).toEqual([
      'EMAIL_NOT_VERIFIED',
      'INVALID_ARGUMENT_email',
      'INVALID_ARGUMENT',
    ]);
  });
});

describe('episodeProgress', () => {
  it('已完结优先于计划总集数，按已发布集数计', () => {
    expect(episodeProgress({ episodeCount: 9, plannedEpisodes: 8, isFinished: true }, 10)).toEqual({ key: 'common.finished', values: { count: 10 } });
  });
  it('连载中且有计划总集数显示更新至 x/y', () => {
    expect(episodeProgress({ episodeCount: 3, plannedEpisodes: 12, isFinished: false })).toEqual({ key: 'common.updatedTo', values: { count: 3, total: 12 } });
  });
  it('未设置计划总集数回退共 x 集', () => {
    expect(episodeProgress({ episodeCount: 3, plannedEpisodes: null, isFinished: false })).toEqual({ key: 'common.episodes', values: { count: 3 } });
  });
});
