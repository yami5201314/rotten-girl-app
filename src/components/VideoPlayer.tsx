import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { FastForward, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { SubtitleTrack } from '@shared/types';
import { useI18n } from '@/i18n';
import { localeNames, isLocale } from '@/i18n/routing';
import { Spinner } from './ui';

interface Props {
  /** 已改写为 rgmedia 的 HLS 清单地址；Cookie 由 Rust 代理携带 */
  manifestUrl: string;
  subtitles: SubtitleTrack[];
  /** 外部要求暂停（推荐流非当前屏、试看结束等） */
  paused?: boolean;
  /** cover：竖屏流铺满；contain：完整显示（播放页） */
  fit?: 'cover' | 'contain';
  /** full：播放页完整控件栏（单击显隐）；gestures：推荐流只保留手势与进度条（单击暂停） */
  controls?: 'full' | 'gestures';
  /** 传入时显示全屏按钮 */
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** full 模式控件显隐变化，供外层同步隐藏顶栏等 */
  onChromeChange?: (visible: boolean) => void;
  onTimeUpdate: (sec: number) => void;
  onEnded: () => void;
  onError: () => void;
}

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const SEEK_SEC = 10;
const HOLD_RATE = 2;
const HOLD_MS = 450;
const DOUBLE_TAP_MS = 280;
const MOVE_CANCEL_PX = 12;
const CHROME_HIDE_MS = 3000;

const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

/** 双击落点：左三分之一快退，右三分之一快进，中间播放 / 暂停 */
export function tapZone(x: number, width: number): 'back' | 'center' | 'forward' {
  if (x < width / 3) return 'back';
  if (x > (width * 2) / 3) return 'forward';
  return 'center';
}

/**
 * hls.js + 自绘控件。手势：单击（播放页显隐控件 / 推荐流暂停）、双击左右侧快退快进 10 秒、长按临时 2 倍速。
 * 每集通过 key 重新挂载，卸载时销毁实例与计时器；切后台暂停。
 */
export function VideoPlayer(props: Props) {
  const { t, locale } = useI18n();
  const full = props.controls === 'full';
  const ref = useRef<HTMLVideoElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [userPaused, setUserPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [holding, setHolding] = useState(false);
  const [speedMenu, setSpeedMenu] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [seekHint, setSeekHint] = useState<{ dir: 'back' | 'forward'; n: number } | null>(null);

  const gesture = useRef<{ x: number; y: number; holdTimer?: number; held: boolean } | null>(null);
  const lastTap = useRef<{ at: number; timer?: number }>({ at: 0 });
  const hintTimer = useRef<number>(undefined);
  const chromeTimer = useRef<number>(undefined);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) propsRef.current.onError();
      });
      hls.loadSource(propsRef.current.manifestUrl);
      hls.attachMedia(video);
    } else {
      video.src = propsRef.current.manifestUrl;
    }
    const onVisibility = () => document.hidden && video.pause();
    document.addEventListener('visibilitychange', onVisibility);
    const tapState = lastTap.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      hls?.destroy();
      clearTimeout(gesture.current?.holdTimer);
      clearTimeout(tapState.timer);
      clearTimeout(hintTimer.current);
      clearTimeout(chromeTimer.current);
    };
  }, []);

  const shouldPlay = !props.paused && !userPaused;
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    // WebView 可能拦截自动播放，失败时显示播放按钮由用户点击
    if (shouldPlay) void video.play().catch(() => setUserPaused(true));
    else video.pause();
  }, [shouldPlay]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = holding ? HOLD_RATE : rate;
  }, [rate, holding]);

  // 播放中控件 3 秒后自动隐藏；暂停或打开倍速菜单时常驻
  useEffect(() => {
    if (!full) return;
    clearTimeout(chromeTimer.current);
    if (chrome && playing && !speedMenu) chromeTimer.current = window.setTimeout(() => setChrome(false), CHROME_HIDE_MS);
  }, [full, chrome, playing, speedMenu, time]);

  useEffect(() => {
    if (full) propsRef.current.onChromeChange?.(chrome || !playing);
  }, [full, chrome, playing]);

  const seekBy = (delta: number) => {
    const video = ref.current;
    if (!video || !duration) return;
    const v = Math.min(Math.max(0, video.currentTime + delta), duration);
    video.currentTime = v;
    setTime(v);
    const dir = delta < 0 ? 'back' : 'forward';
    // 连续双击累加提示秒数
    setSeekHint((h) => ({ dir, n: h?.dir === dir ? h.n + Math.abs(delta) : Math.abs(delta) }));
    clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setSeekHint(null), 700);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = { x: e.clientX, y: e.clientY, held: false, holdTimer: undefined as number | undefined };
    g.holdTimer = window.setTimeout(() => {
      if (!playing) return;
      g.held = true;
      setHolding(true);
    }, HOLD_MS);
    gesture.current = g;
  };
  const endHold = () => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.holdTimer);
    if (g.held) setHolding(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    // 位移过大视为滑动（上下切集 / 推荐流翻页），取消长按与点击
    if (g && !g.held && Math.hypot(e.clientX - g.x, e.clientY - g.y) > MOVE_CANCEL_PX) {
      endHold();
      gesture.current = null;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    endHold();
    gesture.current = null;
    if (!g || g.held) return;
    const now = Date.now();
    const tap = lastTap.current;
    if (now - tap.at < DOUBLE_TAP_MS) {
      clearTimeout(tap.timer);
      tap.at = 0;
      const rect = e.currentTarget.getBoundingClientRect();
      const zone = tapZone(e.clientX - rect.left, rect.width);
      if (zone === 'center') setUserPaused((p) => !p);
      else seekBy(zone === 'back' ? -SEEK_SEC : SEEK_SEC);
      return;
    }
    tap.at = now;
    // 单击延迟执行，等待判断是否为双击
    tap.timer = window.setTimeout(() => {
      tap.at = 0;
      if (full) {
        setSpeedMenu(false);
        setChrome((c) => !c);
      } else setUserPaused((p) => !p);
    }, DOUBLE_TAP_MS);
  };

  const showChrome = !full || chrome || !playing;
  const iconBtn = 'flex size-11 shrink-0 items-center justify-center rounded-full active:bg-white/15';

  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full bg-black ${props.fit === 'cover' ? 'object-cover' : 'object-contain'}`}
        playsInline
        crossOrigin="anonymous"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          props.onTimeUpdate(e.currentTarget.currentTime);
        }}
        onEnded={() => props.onEnded()}
        onError={() => {
          // hls.js 接管时由其 ERROR 事件判定致命错误
          if (!Hls.isSupported()) props.onError();
        }}
      >
        {props.subtitles.map((s) => (
          <track key={s.locale} kind="subtitles" srcLang={s.locale} src={s.url} label={isLocale(s.locale) ? localeNames[s.locale] : s.locale} default={s.locale === locale} />
        ))}
      </video>

      {/* 手势层：不阻止默认滚动，上下滑仍交给外层切集 / 翻页 */}
      <div
        data-testid="gesture-layer"
        className="absolute inset-0 select-none [-webkit-touch-callout:none]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          endHold();
          gesture.current = null;
        }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {holding && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-[max(4.5rem,calc(var(--safe-top)+3.5rem))] z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold backdrop-blur">
          <FastForward aria-hidden="true" className="size-4 fill-current" />
          {t('app.holdSpeed', { rate: HOLD_RATE })}
        </div>
      )}
      {seekHint && (
        <div
          role="status"
          className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold tabular-nums backdrop-blur ${seekHint.dir === 'back' ? 'left-8' : 'right-8'}`}
        >
          {t(seekHint.dir === 'back' ? 'app.rewindN' : 'app.forwardN', { n: seekHint.n })}
        </div>
      )}

      {buffering && shouldPlay && (
        <div role="status" aria-label={t('player.loading')} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="size-10" />
        </div>
      )}
      {!playing && !buffering && (
        <button
          aria-label={t('app.play')}
          onClick={() => setUserPaused(false)}
          className="absolute left-1/2 top-1/2 z-10 flex size-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
        >
          <Play aria-hidden="true" className="ml-1 size-9 fill-white text-white" />
        </button>
      )}

      {duration > 0 && (
        <div
          className={`absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-opacity duration-300 motion-reduce:transition-none ${full ? 'bg-gradient-to-t from-black/70 to-transparent pt-8' : ''} ${showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          {!full && (
            <div className="mb-0.5 flex justify-end text-[11px] tabular-nums text-white/70">
              {fmt(time)} / {fmt(duration)}
            </div>
          )}
          <input
            type="range"
            aria-label={t('app.seek')}
            min={0}
            max={duration}
            step={0.1}
            value={Math.min(time, duration)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (ref.current) ref.current.currentTime = v;
              setTime(v);
            }}
            className="h-6 w-full cursor-pointer accent-brand"
          />
          {full && (
            <div className="relative flex items-center gap-1">
              <button aria-label={playing ? t('app.pause') : t('app.play')} onClick={() => setUserPaused((p) => !p)} className={iconBtn}>
                {playing ? <Pause aria-hidden="true" className="size-6 fill-current" /> : <Play aria-hidden="true" className="size-6 fill-current" />}
              </button>
              <button aria-label={t('app.rewind10')} onClick={() => seekBy(-SEEK_SEC)} className={iconBtn}>
                <RotateCcw aria-hidden="true" className="size-5" />
              </button>
              <button aria-label={t('app.forward10')} onClick={() => seekBy(SEEK_SEC)} className={iconBtn}>
                <RotateCw aria-hidden="true" className="size-5" />
              </button>
              <span className="ml-1 min-w-0 flex-1 truncate text-xs tabular-nums text-white/80">
                {fmt(time)} / {fmt(duration)}
              </span>
              <button
                aria-label={t('app.speed')}
                aria-expanded={speedMenu}
                onClick={() => setSpeedMenu((v) => !v)}
                className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums active:bg-white/15"
              >
                {rate === 1 ? t('app.speed') : `${rate}×`}
              </button>
              {props.onToggleFullscreen && (
                <button aria-label={props.fullscreen ? t('app.exitFullscreen') : t('app.fullscreen')} onClick={props.onToggleFullscreen} className={iconBtn}>
                  {props.fullscreen ? <Minimize aria-hidden="true" className="size-5" /> : <Maximize aria-hidden="true" className="size-5" />}
                </button>
              )}
              {speedMenu && (
                <ul role="menu" aria-label={t('app.speed')} className="absolute bottom-12 right-0 overflow-hidden rounded-xl bg-surface/95 py-1 shadow-xl backdrop-blur">
                  {SPEEDS.map((s) => (
                    <li key={s}>
                      <button
                        role="menuitemradio"
                        aria-checked={s === rate}
                        onClick={() => {
                          setRate(s);
                          setSpeedMenu(false);
                        }}
                        className={`flex h-11 w-24 items-center justify-center text-sm tabular-nums ${s === rate ? 'font-bold text-brand' : 'text-white'}`}
                      >
                        {s}×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
