import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, Lock } from 'lucide-react';
import type { DramaDetail } from '@shared/types';
import { confirmAge, errorKeys, getDrama } from '@/lib/api';
import { usePlaybackSession } from '@/lib/usePlaybackSession';
import { errorText, useI18n } from '@/i18n';
import { href, replace } from '@/lib/router';
import { setLandscape } from '@/lib/screen';
import { VideoPlayer } from '@/components/VideoPlayer';
import { btnGhost, btnPrimary, ErrorRetry, Loading, Spinner } from '@/components/ui';

/** 试看时长：播放到该秒数即结束试看（与网站一致，用户 2026-11-15 选择播放器截断） */
export const PREVIEW_SEC = 10;
const SWIPE_MIN_PX = 80;

/** 竖屏全屏播放；上下滑切集 */
export function Player({ id, ep }: { id: string; ep: string }) {
  const { locale } = useI18n();
  const [drama, setDrama] = useState<DramaDetail | null>(null);
  const [dramaError, setDramaError] = useState(false);
  const [reloadDrama, setReloadDrama] = useState(0);

  useEffect(() => {
    let stale = false;
    setDramaError(false);
    void getDrama(id, locale).then((r) => {
      if (stale) return;
      if (r.ok) setDrama(r.data);
      else setDramaError(true);
    });
    return () => {
      stale = true;
    };
  }, [id, locale, reloadDrama]);

  if (dramaError) return <ErrorRetry onRetry={() => setReloadDrama((n) => n + 1)} />;
  if (!drama) return <Loading />;
  return <EpisodePlayer key={ep} drama={drama} ep={ep} />;
}

function Overlay({ children, role = 'status' }: { children: React.ReactNode; role?: string }) {
  return (
    <div role={role} className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-8 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function EpisodePlayer({ drama, ep }: { drama: DramaDetail; ep: string }) {
  const { locale, t } = useI18n();
  const pos = drama.episodes.findIndex((e) => e.displayNumber === ep);
  const episode = drama.episodes[pos];
  const prev = drama.episodes[pos - 1];
  const next = drama.episodes[pos + 1];
  const goTo = useCallback((n: string) => replace(href.play(drama.id, n)), [drama.id]);
  const { state, reload, retry, fail, onTimeUpdate } = usePlaybackSession(episode?.id ?? null, true);
  const [previewEnded, setPreviewEnded] = useState(false);
  const preview = state.kind === 'ready' && state.session.scope === 'PREVIEW';

  const onTime = useCallback(
    (sec: number) => {
      onTimeUpdate(sec);
      if (preview && sec >= PREVIEW_SEC) setPreviewEnded(true);
    },
    [onTimeUpdate, preview],
  );

  const [fullscreen, setFullscreen] = useState(false);
  const [chrome, setChrome] = useState(true);
  useEffect(() => {
    setLandscape(fullscreen);
  }, [fullscreen]);
  // 离开播放页（返回、切集重挂载）时恢复竖屏
  useEffect(() => () => setLandscape(false), []);

  const touchY = useRef<number | null>(null);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current === null || fullscreen) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (dy < -SWIPE_MIN_PX && next) goTo(next.displayNumber);
    else if (dy > SWIPE_MIN_PX && prev) goTo(prev.displayNumber);
  };

  if (!episode) return <ErrorRetry message={errorText(locale, ['not_found'])} onRetry={() => replace(href.drama(drama.id))} />;
  const title = drama.titleTranslation?.text ?? drama.title;

  return (
    <div className="fixed inset-0 z-50 bg-black" onTouchStart={(e) => (touchY.current = e.touches[0].clientY)} onTouchEnd={onTouchEnd}>
      {state.kind === 'ready' && (
        <VideoPlayer
          key={`${ep}-${reload}`}
          manifestUrl={state.session.manifestUrl}
          subtitles={state.session.subtitles}
          paused={previewEnded}
          controls="full"
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((f) => !f)}
          onChromeChange={setChrome}
          onTimeUpdate={onTime}
          onEnded={() => (preview ? setPreviewEnded(true) : next && goTo(next.displayNumber))}
          onError={() => fail('playback_failed')}
        />
      )}

      <div
        className={`absolute inset-x-0 top-0 z-30 flex items-center gap-1 bg-gradient-to-b from-black/80 to-transparent px-1 pb-6 transition-opacity duration-300 motion-reduce:transition-none ${fullscreen ? 'pt-2' : 'pt-[max(0.5rem,var(--safe-top))]'} ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <button aria-label={fullscreen ? t('app.exitFullscreen') : t('player.back')} onClick={() => (fullscreen ? setFullscreen(false) : history.back())} className="flex size-11 items-center justify-center">
          <ChevronLeft aria-hidden="true" className="size-7" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{title}</p>
          <p className="text-xs text-white/70">
            {t('player.episodeN', { index: ep })}
            {preview && ` · ${t('drama.preview')}`}
          </p>
        </div>
      </div>

      {/* 上下滑之外的常驻切集入口 */}
      <div className={`absolute bottom-36 right-2 z-30 flex flex-col gap-2 transition-opacity duration-300 motion-reduce:transition-none ${chrome && !fullscreen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button aria-label={t('player.prev')} disabled={!prev} onClick={() => prev && goTo(prev.displayNumber)} className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur disabled:opacity-30">
          <ChevronUp aria-hidden="true" className="size-6" />
        </button>
        <button aria-label={t('player.next')} disabled={!next} onClick={() => next && goTo(next.displayNumber)} className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur disabled:opacity-30">
          <ChevronDown aria-hidden="true" className="size-6" />
        </button>
      </div>

      {state.kind === 'loading' && (
        <div role="status" aria-label={t('player.loading')} className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-10" />
        </div>
      )}
      {state.kind === 'login' && (
        <Overlay role="alert">
          <p className="text-sm text-white/80">{t('player.loginToWatch')}</p>
          <a href={href.login()} className={btnPrimary}>
            {t('player.login')}
          </a>
        </Overlay>
      )}
      {previewEnded && (
        <Overlay>
          <Lock aria-hidden="true" className="size-9 text-brand" />
          <p className="text-sm text-white/80">{t('player.previewEnded')}</p>
          {/* 解锁入口：App 内支付未接通，按规范标注即将上线 */}
          <button className={btnPrimary} disabled>
            {t('commerce.unlockTitle')} · {t('common.comingSoon')}
          </button>
          <button
            className={btnGhost}
            onClick={() => {
              setPreviewEnded(false);
              retry();
            }}
          >
            {t('player.retry')}
          </button>
        </Overlay>
      )}
      {state.kind === 'error' && (
        <Overlay role="alert">
          <p className="text-sm text-white/80">{errorText(locale, state.keys)}</p>
          {state.code === 'AGE_CHECK_REQUIRED' ? (
            <button className={btnPrimary} onClick={() => void confirmAge().then((r) => (r.ok ? retry() : fail(r.error.error, errorKeys(r.error))))}>
              {t('ageGate.confirm')}
            </button>
          ) : (
            <button className={btnPrimary} onClick={retry}>
              {t('player.retry')}
            </button>
          )}
        </Overlay>
      )}
    </div>
  );
}
