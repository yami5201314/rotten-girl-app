import { useEffect, useState } from 'react';

export type RankingTab = '24h' | '7d' | 'rising';

// 哈希路由：每次跳转写入 WebView 历史，Android 返回键即可回退（不引入路由库）
export type Route =
  | { name: 'home' }
  | { name: 'discover'; q: string; tag: string }
  | { name: 'ranking'; tab: RankingTab }
  | { name: 'library' }
  | { name: 'drama'; id: string }
  | { name: 'play'; id: string; ep: string }
  | { name: 'me' }
  | { name: 'login'; mode: 'login' | 'register' };

const rankingTabs: readonly RankingTab[] = ['24h', '7d', 'rising'];

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case 'discover':
      return { name: 'discover', q: params.get('q') ?? '', tag: params.get('tag') ?? '' };
    case 'ranking': {
      const tab = params.get('tab');
      return { name: 'ranking', tab: rankingTabs.find((x) => x === tab) ?? '24h' };
    }
    case 'library':
      return { name: 'library' };
    case 'drama':
      return parts[1] ? { name: 'drama', id: parts[1] } : { name: 'home' };
    case 'play':
      return parts[1] && parts[2] ? { name: 'play', id: parts[1], ep: parts[2] } : { name: 'home' };
    case 'me':
      return { name: 'me' };
    case 'login':
      return { name: 'login', mode: 'login' };
    case 'register':
      return { name: 'login', mode: 'register' };
    default:
      return { name: 'home' };
  }
}

const e = encodeURIComponent;

export const href = {
  home: () => '#/',
  discover: (p: { q?: string; tag?: string } = {}) => {
    const s = new URLSearchParams();
    if (p.q) s.set('q', p.q);
    if (p.tag) s.set('tag', p.tag);
    const qs = s.toString();
    return qs ? `#/discover?${qs}` : '#/discover';
  },
  ranking: (tab: RankingTab = '24h') => `#/ranking?tab=${tab}`,
  library: () => '#/library',
  drama: (id: string) => `#/drama/${e(id)}`,
  play: (id: string, ep: string) => `#/play/${e(id)}/${e(ep)}`,
  me: () => '#/me',
  login: () => '#/login',
  register: () => '#/register',
};

export const navigate = (to: string) => {
  window.location.hash = to;
};

/** 替换当前记录（播放页切集、筛选切换不堆积历史） */
export const replace = (to: string) => window.location.replace(to);

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
