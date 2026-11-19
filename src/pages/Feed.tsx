import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Play, Search } from 'lucide-react';
import type { FeedItem } from '@shared/types';
import { confirmAge, errorKeys, listFeed, newFeedSeed, tagName } from '@/lib/api';
import { usePlaybackSession } from '@/lib/usePlaybackSession';
import { useAuth } from '@/lib/auth';
import { errorText, useI18n } from '@/i18n';
import { href } from '@/lib/router';
import { VideoPlayer } from '@/components/VideoPlayer';
import { btnPrimary, ErrorRetry, Spinner } from '@/components/ui';

/** 距末尾不足该屏数时预取下一页 */
const NEAR_END = 3;
const BRAND_VISIBLE_MS = 2500;

type Status = 'loading' | 'idle' | 'done' | 'error';

/** 首页竖屏推荐流：scroll-snap 上下滑，只有当前屏挂载播放器，其余屏只显示封面 */
export function Feed() {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [active, setActive] = useState(0);
  const seed = useRef(newFeedSeed());
  const req = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (after: string | null) => {
      const my = ++req.current;
      setStatus('loading');
      const r = await listFeed(seed.current, after, locale);
      if (my !== req.current) return;
      if (!r.ok) return setStatus('error');
      setItems((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...r.data.items.filter((d) => !seen.has(d.id))];
      });
      setCursor(r.data.nextCursor);
      setStatus(r.data.nextCursor ? 'idle' : 'done');
    },
    [locale],
  );

  useEffect(() => {
    setItems([]);
    setActive(0);
    void load(null);
    return () => {
      req.current++;
    };
  }, [load]);

  useEffect(() => {
    if (status === 'idle' && cursor && active >= items.length - NEAR_END) void load(cursor);
  }, [active, items.length, status, cursor, load]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  const [showBrand, setShowBrand] = useState(true);
  useEffect(() => {
    setShowBrand(true);
    const timer = setTimeout(() => setShowBrand(false), BRAND_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] mx-auto max-w-md bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-[max(0.75rem,var(--safe-top))]">
        {/* 品牌名只在进入或切屏后短暂显示，随后淡出，避免压在视频画面上 */}
        <span aria-hidden={!showBrand} className={`text-lg font-black tracking-normal text-brand-gradient transition-opacity duration-500 ${showBrand ? 'opacity-100' : 'opacity-0'}`}>
          rotten girl
        </span>
        <a href={href.discover()} aria-label={t('drama.searchLabel')} className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-black/30 backdrop-blur">
          <Search aria-hidden="true" className="size-5" />
        </a>
      </div>
      <div ref={scroller} role="region" aria-label={t('feed.label')} className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
        {items.map((d, i) => (
          <section key={d.id} data-index={i} className="relative h-full snap-start snap-always">
            <FeedSlide item={d} active={i === active} eager={i < 2} />
          </section>
        ))}
        {status === 'loading' && (
          <div role="status" aria-label={t('common.loading')} className="flex h-full snap-start items-center justify-center">
            <Spinner className="size-10" />
          </div>
        )}
        {status === 'error' && (
          <div className="flex h-full snap-start items-center justify-center">
            <ErrorRetry onRetry={() => void load(cursor)} />
          </div>
        )}
        {status === 'done' && items.length === 0 && (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">{t('feed.empty')}</div>
        )}
      </div>
    </div>
  );
}

function FeedSlide({ item, active, eager }: { item: FeedItem; active: boolean; eager: boolean }) {
  const { locale, t } = useI18n();
  const { user, loading } = useAuth();
  const title = item.titleTranslation?.text ?? item.title;
  const synopsis = item.synopsisTranslation?.text ?? item.synopsis;
  const ep = item.firstEpisode;
  const free = ep.accessMode === 'FREE';
  const canPlay = active && free && !!user;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {item.coverUrl && (
        <>
          <img src={item.coverUrl} alt="" aria-hidden="true" loading={eager ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
          <img src={item.coverUrl} alt={title} loading={eager ? 'eager' : 'lazy'} className="absolute inset-0 h-full w-full object-contain" />
        </>
      )}
      {canPlay && <FeedPlayer episodeId={ep.id} />}

      {!free && (
        <CenterCard>
          <Lock aria-hidden="true" className="size-9 text-brand" />
          <p className="text-sm text-white/90">{t('feed.locked')}</p>
          <a href={href.play(item.id, ep.displayNumber)} className={btnPrimary}>
            {t('feed.unlock')}
          </a>
        </CenterCard>
      )}
      {free && !loading && !user && (
        <CenterCard>
          <p className="text-sm text-white/90">{t('feed.loginToWatch')}</p>
          <a href={href.login()} className={btnPrimary}>
            {t('feed.login')}
          </a>
        </CenterCard>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/60 to-transparent px-4 pb-12 pt-24">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.rating === 'adult' && <span className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-bold">{t('common.adult')}</span>}
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag.code} className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] backdrop-blur">
              {tagName(tag, locale)}
            </span>
          ))}
        </div>
        <h2 className="mt-2 line-clamp-2 text-lg font-bold leading-snug">{title}</h2>
        {item.titleTranslation && !item.titleTranslation.manual && <p className="text-[11px] text-white/60">{t('contentTranslation.machineTranslated')}</p>}
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/75">{synopsis}</p>
        <a
          href={href.drama(item.id)}
          className="pointer-events-auto mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold backdrop-blur active:bg-white/25"
        >
          <Play aria-hidden="true" className="size-4 fill-current" />
          <span className="truncate">{t('feed.detail')}</span>
        </a>
      </div>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-4 bg-black/40 p-8 text-center">{children}</div>;
}

/** 推荐流单屏播放：首集若非免费，服务端只给试看，推荐流不播试看，改为解锁提示 */
function FeedPlayer({ episodeId }: { episodeId: string }) {
  const { locale, t } = useI18n();
  const { state, reload, retry, fail, onTimeUpdate } = usePlaybackSession(episodeId, true);

  if (state.kind === 'loading')
    return (
      <div role="status" aria-label={t('player.loading')} className="absolute inset-0 z-[4] flex items-center justify-center">
        <Spinner className="size-10" />
      </div>
    );
  if (state.kind === 'login' || (state.kind === 'ready' && state.session.scope === 'PREVIEW')) return null;
  if (state.kind === 'error')
    return (
      <CenterCard>
        <p role="alert" className="text-sm text-white/90">
          {errorText(locale, state.keys)}
        </p>
        {state.code === 'AGE_CHECK_REQUIRED' ? (
          <button className={btnPrimary} onClick={() => void confirmAge().then((r) => (r.ok ? retry() : fail(r.error.error, errorKeys(r.error))))}>
            {t('ageGate.confirm')}
          </button>
        ) : (
          <button className={btnPrimary} onClick={retry}>
            {t('player.retry')}
          </button>
        )}
      </CenterCard>
    );
  return (
    // 不设 z-index：让播放器进度条（z-20）能盖在剧名信息层之上
    <div className="absolute inset-0">
      <VideoPlayer
        key={`${state.session.sessionId}-${reload}`}
        manifestUrl={state.session.manifestUrl}
        subtitles={state.session.subtitles}
        fit="cover"
        controls="gestures"
        onTimeUpdate={onTimeUpdate}
        onEnded={() => undefined}
        onError={() => fail('playback_failed')}
      />
    </div>
  );
}
