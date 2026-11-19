import { useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import type { DramaSummary } from '@shared/types';
import { listFavorites, listFollowing } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { href } from '@/lib/router';
import { btnPrimary, chip, Cover, Empty, ErrorRetry, GridSkeleton, Loading, PageHeader } from '@/components/ui';

type Tab = 'following' | 'favorites';
/** badge：追更的最新集号 */
type Item = { drama: DramaSummary; badge: string | null };
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: Item[]; nextCursor: string | null; more: 'idle' | 'loading' | 'error' };

/** 追剧：追更 / 收藏两个列表，游标分页 */
export function Library() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('following');

  return (
    <div className="pb-6">
      <PageHeader title={t('app.library')} />
      {loading ? (
        <Loading />
      ) : !user ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface-2">
            <BookmarkPlus aria-hidden="true" className="size-8 text-brand" />
          </span>
          <p className="text-sm text-muted">{t('engagement.loginRequired')}</p>
          <a href={href.login()} className={btnPrimary}>
            {t('engagement.loginLink')}
          </a>
        </div>
      ) : (
        <>
          <div role="tablist" className="flex gap-2 px-4 pb-3">
            {(['following', 'favorites'] as const).map((x) => (
              <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={chip(tab === x)}>
                {t(x === 'following' ? 'engagement.followingTitle' : 'engagement.favoritesTitle')}
              </button>
            ))}
          </div>
          <div className="px-4">
            <List key={tab} tab={tab} />
          </div>
        </>
      )}
    </div>
  );
}

async function fetchPage(tab: Tab, cursor: string | null): Promise<{ items: Item[]; nextCursor: string | null } | null> {
  if (tab === 'following') {
    const r = await listFollowing(cursor);
    return r.ok ? { items: r.data.items.map((i) => ({ drama: i.drama, badge: i.latestEpisode?.displayNumber ?? null })), nextCursor: r.data.nextCursor } : null;
  }
  const r = await listFavorites(cursor);
  return r.ok ? { items: r.data.items.map((i) => ({ drama: i.drama, badge: null })), nextCursor: r.data.nextCursor } : null;
}

function List({ tab }: { tab: Tab }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stale = false;
    setState({ kind: 'loading' });
    void fetchPage(tab, null).then((p) => !stale && setState(p ? { kind: 'ready', ...p, more: 'idle' } : { kind: 'error' }));
    return () => {
      stale = true;
    };
  }, [tab, reload]);

  async function loadMore() {
    if (state.kind !== 'ready' || !state.nextCursor || state.more === 'loading') return;
    setState({ ...state, more: 'loading' });
    const p = await fetchPage(tab, state.nextCursor);
    setState(p ? { kind: 'ready', items: [...state.items, ...p.items], nextCursor: p.nextCursor, more: 'idle' } : { ...state, more: 'error' });
  }

  if (state.kind === 'loading') return <GridSkeleton />;
  if (state.kind === 'error') return <ErrorRetry onRetry={() => setReload((n) => n + 1)} />;
  if (state.items.length === 0) return <Empty text={t(tab === 'following' ? 'engagement.followingEmpty' : 'engagement.favoritesEmpty')} />;
  return (
    <>
      <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4">
        {state.items.map(({ drama, badge }) => (
          <li key={drama.id} className="min-w-0">
            <a href={href.drama(drama.id)} className="block active:opacity-80">
              <Cover src={drama.coverUrl} alt={drama.title} rating={drama.rating}>
                {badge && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-6 text-[11px] font-medium">{t('engagement.latestEpisode', { index: badge })}</span>
                )}
              </Cover>
              <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug">{drama.title}</p>
            </a>
          </li>
        ))}
      </ul>
      {state.nextCursor && (
        <div className="flex flex-col items-center gap-2 pt-5">
          {state.more === 'error' && (
            <p role="alert" className="text-sm text-muted">
              {t('engagement.loadError')}
            </p>
          )}
          <button className={`${chip(false)} h-11 px-5`} disabled={state.more === 'loading'} onClick={() => void loadMore()}>
            {state.more === 'loading' ? t('engagement.loading') : t('engagement.loadMore')}
          </button>
        </div>
      )}
    </>
  );
}
