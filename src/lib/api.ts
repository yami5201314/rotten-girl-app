import { invoke } from '@tauri-apps/api/core';
import type {
  ApiError,
  ApiResult,
  ContentRating,
  CursorPage,
  Drama,
  DramaDetail,
  DramaEngagement,
  DramaRankingEntry,
  DramaSummary,
  Episode,
  EpisodeAccessMode,
  FavoriteItem,
  FeedItem,
  FollowingUpdate,
  HomeSection,
  KnownTranslation,
  PlaybackHeartbeat,
  PlaybackSession,
  RankingSnapshot,
  Tag,
  User,
} from '@shared/types';

/** Rust 代发的原始响应；后端信封 { data, meta } / { error: { code, details } } */
interface RawResponse {
  status: number;
  body: unknown;
}

/** 唯一的后端出口：invoke('api_request')，Rust 负责 Cookie / Origin / CSRF */
export async function api<T>(path: string, init?: { method?: string; body?: unknown; idempotencyKey?: string }): Promise<ApiResult<T>> {
  let res: RawResponse;
  try {
    res = await invoke<RawResponse>('api_request', {
      method: init?.method ?? 'GET',
      path,
      // 后端 jsonOnly 要求写请求带 JSON 体，无参数时发 {}
      body: init?.body ?? (init?.method && init.method !== 'GET' ? {} : null),
      idempotencyKey: init?.idempotencyKey ?? null,
    });
  } catch {
    return { ok: false, error: { error: 'network_error', status: 0 } };
  }
  return toResult<T>(res);
}

export function toResult<T>(res: RawResponse): ApiResult<T> {
  const body = res.body as { data?: unknown; error?: { code?: unknown; details?: unknown } } | null;
  if (res.status >= 200 && res.status < 300) return { ok: true, data: (body && 'data' in body ? body.data : null) as T };
  const code = typeof body?.error?.code === 'string' ? body.error.code : 'unknown';
  const details = body?.error?.details && typeof body.error.details === 'object' ? (body.error.details as Record<string, unknown>) : undefined;
  return { ok: false, error: details ? { error: code, status: res.status, details } : { error: code, status: res.status } };
}

/** 站点上的媒体 / 封面 / 字幕地址（绝对或相对）改写为 rgmedia 协议，由 Rust 带 Cookie 转发（Android WebView 为 http://rgmedia.localhost） */
export function mediaUrl(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    const u = new URL(siteUrl, 'http://rgmedia.localhost');
    return `http://rgmedia.localhost${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

/** 错误码 → errors 命名空间翻译键候选，按优先级：details.reason > `${code}_${details.field}` > code（与网站一致） */
export function errorKeys(e: ApiError): string[] {
  const keys: string[] = [];
  const { reason, field } = e.details ?? {};
  if (typeof reason === 'string') keys.push(reason);
  if (typeof field === 'string') keys.push(`${e.error}_${field}`);
  keys.push(e.error);
  return keys;
}

const q = encodeURIComponent;

// ---- 剧集 ----

interface RawDrama {
  id: string;
  title: string;
  synopsis: string;
  original_language: string;
  rating: ContentRating;
  cover_url: string | null;
  ai_disclosure: Record<string, unknown> | null;
  episode_count: number;
  planned_episodes?: number | null;
  is_finished?: boolean;
  last_release_at: string | null;
  title_translation?: KnownTranslation | null;
  synopsis_translation?: KnownTranslation | null;
  tags?: { code: string; dimension: string; localized_names: Record<string, string> | null }[];
}

interface RawEpisode {
  id: string;
  display_number: string;
  access_mode: EpisodeAccessMode;
  title: string;
  ai_disclosure: Record<string, unknown> | null;
  title_translation?: KnownTranslation | null;
}

/** 003 US1 集数徽标，与 Web 端 episodeProgress 一致：已完结 → common.finished；有计划总集数 → common.updatedTo；否则 common.episodes */
export function episodeProgress(
  d: Pick<Drama, 'episodeCount' | 'plannedEpisodes' | 'isFinished'>,
  published = d.episodeCount,
): { key: 'common.finished' | 'common.updatedTo' | 'common.episodes'; values: Record<string, number> } {
  if (d.isFinished) return { key: 'common.finished', values: { count: published } };
  if (d.plannedEpisodes !== null) return { key: 'common.updatedTo', values: { count: published, total: d.plannedEpisodes } };
  return { key: 'common.episodes', values: { count: published } };
}

export function toDrama(r: RawDrama): Drama {
  return {
    id: r.id,
    title: r.title,
    synopsis: r.synopsis,
    originalLanguage: r.original_language,
    coverUrl: mediaUrl(r.cover_url),
    rating: r.rating,
    episodeCount: r.episode_count,
    plannedEpisodes: r.planned_episodes ?? null,
    isFinished: r.is_finished === true,
    aiDisclosure: r.ai_disclosure ?? {},
    lastReleaseAt: r.last_release_at,
    views: null,
    tags: (r.tags ?? []).map((t) => ({ code: t.code, dimension: t.dimension, localizedNames: t.localized_names ?? {} })),
    titleTranslation: r.title_translation ?? null,
    synopsisTranslation: r.synopsis_translation ?? null,
  };
}

const toEpisode = (r: RawEpisode): Episode => ({
  id: r.id,
  displayNumber: r.display_number,
  accessMode: r.access_mode,
  title: r.title,
  aiDisclosure: r.ai_disclosure ?? {},
  titleTranslation: r.title_translation ?? null,
});

export async function listHomeSections(locale: string): Promise<ApiResult<HomeSection[]>> {
  const r = await api<{ sections: (Omit<HomeSection, 'items'> & { items: RawDrama[] })[] }>(`/api/v1/home?locale=${q(locale)}`);
  return r.ok ? { ok: true, data: r.data.sections.map((s) => ({ code: s.code, title: s.title, kind: s.kind, items: s.items.map(toDrama) })) } : r;
}

/** 搜索词上限与后端一致（去首尾空白后 50 字符） */
export const SEARCH_MAX = 50;

export async function listDramas(
  locale: string,
  opts: { cursor?: string | null; search?: string; tag?: string } = {},
): Promise<ApiResult<{ items: Drama[]; nextCursor: string | null }>> {
  const c = opts.cursor ? `&cursor=${q(opts.cursor)}` : '';
  const s = opts.search ? `&q=${q(opts.search)}` : '';
  const g = opts.tag ? `&tag=${q(opts.tag)}` : '';
  const r = await api<{ items: RawDrama[]; next_cursor: string | null }>(`/api/v1/dramas?limit=24&locale=${q(locale)}${c}${s}${g}`);
  return r.ok ? { ok: true, data: { items: r.data.items.map(toDrama), nextCursor: r.data.next_cursor } } : r;
}

// ---- 竖屏推荐流（003 T321）：同一种子分页顺序稳定 ----

export const FEED_PAGE_SIZE = 10;

export function newFeedSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function listFeed(seed: string, cursor: string | null, locale: string): Promise<ApiResult<{ items: FeedItem[]; nextCursor: string | null }>> {
  const c = cursor ? `&cursor=${q(cursor)}` : '';
  const r = await api<{ items: (RawDrama & { first_episode: { id: string; display_number: string; access_mode: EpisodeAccessMode } })[]; next_cursor: string | null }>(
    `/api/v1/feed?seed=${q(seed)}&limit=${FEED_PAGE_SIZE}&locale=${q(locale)}${c}`,
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      items: r.data.items.map((x) => ({ ...toDrama(x), firstEpisode: { id: x.first_episode.id, displayNumber: x.first_episode.display_number, accessMode: x.first_episode.access_mode } })),
      nextCursor: r.data.next_cursor,
    },
  };
}

// ---- 标签 ----

export async function listTags(): Promise<ApiResult<Tag[]>> {
  const r = await api<{ items: { id: string; code: string; dimension: string; localized_names: Record<string, string> | null }[] }>('/api/v1/tags');
  return r.ok ? { ok: true, data: r.data.items.map((t) => ({ id: t.id, code: t.code, dimension: t.dimension, localizedNames: t.localized_names ?? {} })) } : r;
}

/** 标签名按界面语言，缺失回退 zh-CN 再回退 code */
export function tagName(tag: Pick<Tag, 'code' | 'localizedNames'>, locale: string): string {
  const names = tag.localizedNames as Record<string, string | undefined>;
  return names[locale] ?? names['zh-CN'] ?? tag.code;
}

// ---- 排行榜（快照由后端计算，前端只展示） ----

export const RANKING_LIMIT = 20;

interface RawRanking {
  published_at: string | null;
  items: { rank: number; drama: { id: string; title: string; cover_url: string | null; rating: ContentRating; episode_count: number }; score: number; exploring: boolean }[];
}

const toRanking = (r: RawRanking): Pick<RankingSnapshot<DramaRankingEntry>, 'publishedAt' | 'entries'> => ({
  publishedAt: r.published_at,
  entries: (r.items ?? []).map((i) => ({
    rank: i.rank,
    drama: { id: i.drama.id, title: i.drama.title, coverUrl: mediaUrl(i.drama.cover_url), rating: i.drama.rating, episodeCount: i.drama.episode_count },
    score: i.score,
    exploring: i.exploring,
  })),
});

export async function getRanking(tab: '24h' | '7d' | 'rising'): Promise<ApiResult<Pick<RankingSnapshot<DramaRankingEntry>, 'publishedAt' | 'entries'>>> {
  const path = tab === 'rising' ? `/api/v1/rankings/rising?limit=${RANKING_LIMIT}` : `/api/v1/rankings/dramas?window=${tab}&limit=${RANKING_LIMIT}`;
  const r = await api<RawRanking>(path);
  return r.ok ? { ok: true, data: toRanking(r.data) } : r;
}

export async function getDrama(id: string, locale: string): Promise<ApiResult<DramaDetail>> {
  const r = await api<RawDrama & { episodes: RawEpisode[] }>(`/api/v1/dramas/${q(id)}?locale=${q(locale)}`);
  // App 外壳暂不展示作者卡片（003 US6），creator 置空以满足共享类型
  return r.ok ? { ok: true, data: { ...toDrama(r.data), episodes: r.data.episodes.map(toEpisode), creator: null } } : r;
}

// ---- 播放会话 ----

interface RawPlaybackSession {
  session_id: string;
  manifest_url: string;
  token: string;
  token_delivery: string;
  scope: 'FULL' | 'PREVIEW';
  expires_at: string;
  refresh_at: string;
  session_expires_at: string;
  ai_label: Record<string, unknown> | null;
  subtitles: { locale: string; url: string }[];
}

/** manifest / 字幕改写到 rgmedia；AES 密钥在清单内为相对路径，会自动落到同一协议 */
const toSession = (r: RawPlaybackSession): PlaybackSession => ({
  sessionId: r.session_id,
  manifestUrl: mediaUrl(r.manifest_url) ?? '',
  token: r.token,
  tokenDelivery: r.token_delivery,
  scope: r.scope,
  expiresAt: r.expires_at,
  refreshAt: r.refresh_at,
  sessionExpiresAt: r.session_expires_at,
  aiLabel: r.ai_label ?? {},
  subtitles: r.subtitles.flatMap((s) => {
    const url = mediaUrl(s.url);
    return url ? [{ locale: s.locale, url }] : [];
  }),
});

export async function createPlaybackSession(episodeId: string, deviceRef: string): Promise<ApiResult<PlaybackSession>> {
  const r = await api<RawPlaybackSession>(`/api/v1/episodes/${q(episodeId)}/playback-sessions`, { method: 'POST', body: { device_ref: deviceRef } });
  return r.ok ? { ok: true, data: toSession(r.data) } : r;
}

/** 刷新播放令牌；409 SESSION_EXPIRED / 403 PLAYBACK_REVOKED 需重新建会话 */
export async function refreshPlaybackSession(sessionId: string, currentToken: string): Promise<ApiResult<PlaybackSession>> {
  const r = await api<RawPlaybackSession>(`/api/v1/playback-sessions/${q(sessionId)}/refresh`, { method: 'POST', body: { current_token: currentToken } });
  return r.ok ? { ok: true, data: toSession(r.data) } : r;
}

export async function sendHeartbeat(sessionId: string, h: PlaybackHeartbeat): Promise<ApiResult<unknown>> {
  return api(`/api/v1/playback-sessions/${q(sessionId)}/heartbeats`, {
    method: 'POST',
    body: { seq: h.seq, position_ms: h.positionMs, played_ms: h.playedMs, foreground: h.foreground },
  });
}

export function isSessionGone(error: ApiError): boolean {
  const reason = error.details?.reason;
  return (error.status === 409 && reason === 'SESSION_EXPIRED') || (error.status === 403 && reason === 'PLAYBACK_REVOKED');
}

// ---- 认证 ----

type ConsentVersions = { consent_versions: Record<string, string>; age_policy_version: number };
const getConsentVersions = () => api<ConsentVersions>('/api/v1/legal/consent-versions');

export const getMe = () => api<User>('/api/v1/me');

export const login = (email: string, password: string) =>
  api<{ user_id: string; expires_at: string; mfa_required: boolean }>('/api/v1/auth/login', { method: 'POST', body: { login: email, password } });

/** 注册前取当前法律文档版本一并提交；注册不下发会话，需先完成邮箱验证再登录 */
export async function register(email: string, password: string, language: string): Promise<ApiResult<{ user_id: string }>> {
  const v = await getConsentVersions();
  if (!v.ok) return v;
  return api('/api/v1/auth/register', { method: 'POST', body: { email, password, consent_versions: v.data.consent_versions, language } });
}

export const logout = () => api<null>('/api/v1/auth/logout', { method: 'POST' });

/** 登记年龄确认（需登录，访客返回 UNAUTHENTICATED） */
export async function confirmAge(): Promise<ApiResult<unknown>> {
  const v = await getConsentVersions();
  if (!v.ok) return v;
  return api('/api/v1/me/age-attestations', { method: 'POST', body: { policy_version: v.data.age_policy_version, confirmed: true } });
}

// ---- 收藏 / 追剧 ----

interface RawSummary {
  id: string;
  title: string;
  cover_url: string | null;
  rating: ContentRating;
}

const toSummary = (r: RawSummary): DramaSummary => ({ id: r.id, title: r.title, coverUrl: mediaUrl(r.cover_url), rating: r.rating });
const pageQuery = (cursor: string | null) => `?limit=20${cursor ? `&cursor=${q(cursor)}` : ''}`;

export async function getDramaEngagement(dramaId: string): Promise<ApiResult<DramaEngagement>> {
  const r = await api<{ favorited: boolean; following: boolean; notify_enabled: boolean }>(`/api/v1/me/dramas/${q(dramaId)}/state`);
  return r.ok ? { ok: true, data: { favorited: r.data.favorited, following: r.data.following, notifyEnabled: r.data.notify_enabled, progress: null } } : r;
}

export const setFavorite = (dramaId: string, on: boolean) => api<unknown>(`/api/v1/me/favorites/${q(dramaId)}`, { method: on ? 'PUT' : 'DELETE' });
export const setFollow = (dramaId: string, on: boolean) => api<unknown>(`/api/v1/me/follows/${q(dramaId)}`, { method: on ? 'PUT' : 'DELETE' });

export async function listFavorites(cursor: string | null): Promise<ApiResult<CursorPage<FavoriteItem>>> {
  const r = await api<{ items: { drama: RawSummary; favorited_at: string }[]; next_cursor: string | null }>(`/api/v1/me/favorites${pageQuery(cursor)}`);
  return r.ok ? { ok: true, data: { items: r.data.items.map((i) => ({ drama: toSummary(i.drama), favoritedAt: i.favorited_at })), nextCursor: r.data.next_cursor } } : r;
}

export async function listFollowing(cursor: string | null): Promise<ApiResult<CursorPage<Pick<FollowingUpdate, 'drama' | 'latestEpisode'>>>> {
  const r = await api<{ items: { drama: RawSummary; latest_episode: { episode_id: string; display_number: string } | null }[]; next_cursor: string | null }>(
    `/api/v1/me/following-updates${pageQuery(cursor)}`,
  );
  return r.ok
    ? {
        ok: true,
        data: {
          items: r.data.items.map((i) => ({
            drama: toSummary(i.drama),
            latestEpisode: i.latest_episode && { episodeId: i.latest_episode.episode_id, displayNumber: i.latest_episode.display_number },
          })),
          nextCursor: r.data.next_cursor,
        },
      }
    : r;
}
