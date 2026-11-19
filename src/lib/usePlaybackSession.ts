import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackSession } from '@shared/types';
import { createPlaybackSession, errorKeys, isSessionGone, refreshPlaybackSession, sendHeartbeat } from './api';
import { storage } from './storage';

export const HEARTBEAT_INTERVAL_MS = 30_000;
/** 相邻两次 timeupdate 位置差超过该值视为拖动，不计入实际播放时长 */
const MAX_TICK_SEC = 3;

export type SessionState =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'error'; code: string; keys: string[] }
  | { kind: 'ready'; session: PlaybackSession };

/**
 * 播放会话（播放页与推荐流共用）：建会话 → 在 refresh_at 刷新令牌（会话失效则重建）→ active 时每 30 秒心跳，
 * 切后台与卸载时补发。旧请求的响应用序号丢弃。
 */
export function usePlaybackSession(episodeId: string | null, active: boolean) {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const sessionRef = useRef<PlaybackSession | null>(null);
  const seq = useRef(0);
  const position = useRef(0);
  const playedMs = useRef(0);

  useEffect(() => {
    if (!episodeId) return;
    const my = ++seq.current;
    setState({ kind: 'loading' });
    void createPlaybackSession(episodeId, storage.getDeviceRef()).then((r) => {
      if (my !== seq.current) return;
      if (r.ok) {
        sessionRef.current = r.data;
        position.current = 0;
        setState({ kind: 'ready', session: r.data });
      } else if (r.error.status === 401) setState({ kind: 'login' });
      else setState({ kind: 'error', code: r.error.error, keys: errorKeys(r.error) });
    });
    return () => {
      seq.current++;
    };
  }, [episodeId, reload]);

  const sessionId = state.kind === 'ready' ? state.session.sessionId : null;

  useEffect(() => {
    if (!sessionId || !sessionRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (at: string) => {
      timer = setTimeout(() => void run(), Math.max(0, Date.parse(at) - Date.now()));
    };
    const run = async () => {
      const cur = sessionRef.current;
      if (!cur) return;
      const r = await refreshPlaybackSession(cur.sessionId, cur.token);
      if (cancelled) return;
      if (r.ok) {
        sessionRef.current = r.data;
        schedule(r.data.refreshAt);
      } else if (isSessionGone(r.error)) setReload((n) => n + 1);
      else setState({ kind: 'error', code: r.error.error, keys: errorKeys(r.error) });
    };
    schedule(sessionRef.current.refreshAt);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !active) return;
    let beatSeq = 0;
    const beat = () => {
      const cur = sessionRef.current;
      if (!cur) return;
      const body = { seq: ++beatSeq, positionMs: Math.floor(position.current * 1000), playedMs: Math.round(playedMs.current), foreground: !document.hidden };
      playedMs.current = 0;
      void sendHeartbeat(cur.sessionId, body);
    };
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onHide = () => document.hidden && beat();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      beat();
    };
  }, [sessionId, active]);

  const onTimeUpdate = useCallback((sec: number) => {
    const delta = sec - position.current;
    if (delta > 0 && delta <= MAX_TICK_SEC) playedMs.current += delta * 1000;
    position.current = sec;
  }, []);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  const fail = useCallback((code: string, keys: string[] = [code]) => setState({ kind: 'error', code, keys }), []);

  return { state, reload, retry, fail, onTimeUpdate };
}
