// 由网站仓库 src/types/index.ts 按 App 实际引用抽取（含依赖闭包），与后端接口契约保持一致；改接口时同步更新。
import type { Locale } from '@/i18n/routing';

export type ContentRating = 'general' | 'adult';

/** 与后端 GET /api/v1/dramas 字段一致（lib/api 层做 snake→camel 映射） */
export interface Drama {
  id: string;
  title: string;
  synopsis: string;
  originalLanguage: string;
  coverUrl: string | null;
  /** Mock 无封面图时的占位底色；真实数据无此字段 */
  coverColor?: string;
  rating: ContentRating;
  episodeCount: number;
  /** 计划总集数（003 US1），未设置为 null */
  plannedEpisodes: number | null;
  isFinished: boolean;
  /** 非空对象表示 AI 生成/辅助制作，需展示标识 */
  aiDisclosure: Record<string, unknown>;
  lastReleaseAt: string | null; // ISO 8601
  /** 后端暂未提供，为 null 时隐藏 */
  views: number | null;
  tags: ContentTag[];
  /** 请求 locale 下已有的译文（人工优先于机器）；无译文 / 同语言为 null（T086） */
  titleTranslation: KnownTranslation | null;
  synopsisTranslation: KnownTranslation | null;
  /** 当前语言译文缺失、后端已派发机器翻译（T097）；为 true 时显示"翻译中" */
  translationPending?: boolean;
}

/** 首页栏目（GET /api/v1/home，T096）；title 按界面语言取值，缺失回退 zh-CN */
export interface HomeSection {
  code: string;
  title: Record<string, string>;
  kind: 'MANUAL' | 'LATEST';
  items: Drama[];
}

/** 竖屏推荐流条目（GET /api/v1/feed，003 T321）：每屏固定播第 1 集 */
export interface FeedItem extends Drama {
  firstEpisode: Pick<Episode, 'id' | 'displayNumber' | 'accessMode'>;
}

/** 后端已存储的内容译文；manual=false 为机器翻译，需显示标识 */
export interface KnownTranslation {
  text: string;
  manual: boolean;
}

/** 受控标签（GET /api/v1/tags，contracts §3.2i）；显示名按 locale 取 localizedNames，缺失回退 zh-CN */
export interface Tag {
  id: string;
  /** 如 THEME、STYLE；维度由后台维护，前端不枚举 */
  dimension: string;
  code: string;
  localizedNames: Partial<Record<Locale, string>>;
}

/** 剧 / 小说 item 上附带的 ACTIVE 标签 */
export type ContentTag = Omit<Tag, 'id'>;

export type EpisodeAccessMode = 'FREE' | 'SUBSCRIPTION' | 'INDIVIDUAL';

export interface Episode {
  id: string;
  /** 播放页路由 [episode] 使用该集号；后端为 TEXT（如 "2"、"SP1"、"1.5"），不做算术 */
  displayNumber: string;
  accessMode: EpisodeAccessMode;
  title: string;
  aiDisclosure: Record<string, unknown>;
  titleTranslation: KnownTranslation | null;
}

export interface DramaDetail extends Drama {
  episodes: Episode[];
  /** 作者摘要（003 US6）；Mock 与非 ACTIVE 创作者为 null */
  creator: CreatorRef | null;
}

export interface SubtitleTrack {
  locale: string;
  url: string;
}

/** 播放会话：manifest 地址短期有效，前端不缓存；scope=PREVIEW 为试看 */
export interface PlaybackSession {
  sessionId: string;
  manifestUrl: string;
  token: string;
  tokenDelivery: string;
  scope: 'FULL' | 'PREVIEW';
  expiresAt: string;
  refreshAt: string;
  sessionExpiresAt: string;
  aiLabel: Record<string, unknown>;
  subtitles: SubtitleTrack[];
}

export interface PlaybackHeartbeat {
  seq: number;
  positionMs: number;
  playedMs: number;
  foreground: boolean;
}

/** 与后端 GET /api/v1/me 字段一致 */
export interface User {
  id: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  preferred_language: Locale;
  email_verified: boolean;
  age_attested: boolean;
  roles: string[];
  mfa_enabled: boolean;
  /** 注销冷静期内为计划执行时间（ISO），否则 null */
  deletion_scheduled_at: string | null;
}

export interface DramaRankingEntry {
  rank: number;
  drama: { id: string; title: string; coverUrl: string | null; rating: ContentRating; episodeCount: number };
  /** 后端计算的热度分，前端只展示不计算 */
  score: number;
  /** 曝光样本不足，显示"探索中" */
  exploring: boolean;
}

/** 无快照时 entries 为空且时间字段为 null */
export interface RankingSnapshot<E> {
  algorithmVersion: number | null;
  market: string;
  windowStart: string | null;
  windowEnd: string | null;
  publishedAt: string | null;
  entries: E[];
}

// ---- 收藏、追剧、观看进度与站内追更通知（contracts §3.2f） ----

/** 列表中引用的剧摘要 */
export interface DramaSummary {
  id: string;
  title: string;
  coverUrl: string | null;
  rating: ContentRating;
}

/** 服务端观看进度（以毫秒计） */
export interface WatchState {
  episodeId: string;
  displayNumber: string;
  positionMs: number;
  durationMs: number;
}

export interface FavoriteItem {
  drama: DramaSummary;
  favoritedAt: string;
}

export interface FollowingUpdate {
  drama: DramaSummary;
  notifyEnabled: boolean;
  latestEpisode: { episodeId: string; displayNumber: string } | null;
  unreadCount: number;
  lastWatched: WatchState | null;
  /** 继续播放目标，由服务端按进度决定 */
  resume: { episodeId: string; displayNumber: string; positionMs: number } | null;
}

/** 剧详情页的个人状态 */
export interface DramaEngagement {
  favorited: boolean;
  following: boolean;
  notifyEnabled: boolean;
  progress: WatchState | null;
}

// ---- 作者主页与关注创作者（003 US6） ----

/** 剧详情里的作者摘要；头像被运营隐藏时 avatarUrl 为 null */
export interface CreatorRef {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiError {
  error: string;
  status: number;
  /** C.1 错误信封的 details（如 field、reason），旧格式接口没有 */
  details?: Record<string, unknown>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
