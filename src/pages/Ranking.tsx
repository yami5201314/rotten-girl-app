import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import type { DramaRankingEntry } from '@shared/types';
import { getRanking } from '@/lib/api';
import { useI18n } from '@/i18n';
import { href, replace, type RankingTab } from '@/lib/router';
import { chip, Empty, ErrorRetry, PageHeader } from '@/components/ui';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; publishedAt: string | null; entries: DramaRankingEntry[] };

const tabs: RankingTab[] = ['24h', '7d', 'rising'];

/** 剧热榜（24h / 7d）与潜力榜；数据来自后端快照，前端不计算 */
export function Ranking({ tab }: { tab: RankingTab }) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stale = false;
    setState({ kind: 'loading' });
    void getRanking(tab).then((r) => {
      if (!stale) setState(r.ok ? { kind: 'ready', ...r.data } : { kind: 'error' });
    });
    return () => {
      stale = true;
    };
  }, [tab, reload]);

  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: tab === 'rising' ? 2 : 1 });
  const label = (x: RankingTab) => (x === 'rising' ? t('ranking.boards.rising') : `${t('ranking.boards.dramas')} · ${t(`ranking.windows.${x}`)}`);

  return (
    <div className="pb-6">
      <PageHeader title={t('nav.ranking')} />
      <nav aria-label={t('ranking.boardLabel')} className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3">
        {tabs.map((x) => (
          <button key={x} aria-current={tab === x ? 'page' : undefined} onClick={() => replace(href.ranking(x))} className={chip(tab === x)}>
            {label(x)}
          </button>
        ))}
      </nav>
      <div className="px-4">
        {tab === 'rising' && <p className="mb-3 text-xs text-muted">{t('ranking.risingHint')}</p>}
        {state.kind === 'loading' && (
          <ol aria-hidden="true" className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-card bg-surface" />
            ))}
          </ol>
        )}
        {state.kind === 'error' && <ErrorRetry onRetry={() => setReload((n) => n + 1)} />}
        {state.kind === 'ready' &&
          (state.entries.length === 0 ? (
            <Empty text={t('ranking.empty')} />
          ) : (
            <>
              {state.publishedAt && (
                <p className="mb-3 text-xs text-muted">
                  {t('ranking.updatedAt', { time: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(state.publishedAt)) })}
                </p>
              )}
              <ol className="space-y-3">
                {state.entries.map(({ rank, drama, score, exploring }) => (
                  <li key={drama.id}>
                    <a href={href.drama(drama.id)} className="flex items-center gap-3 rounded-card bg-surface p-2.5 active:bg-surface-2">
                      <span className="relative w-16 shrink-0">
                        <span className="block aspect-[3/4] overflow-hidden rounded-lg bg-surface-2">
                          {drama.coverUrl && <img src={drama.coverUrl} alt="" loading={rank <= 6 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />}
                        </span>
                        <span
                          className={`absolute -left-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full text-sm font-black ${rank <= 3 ? 'bg-brand-gradient text-white' : 'bg-surface-2 text-muted'}`}
                        >
                          {rank}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{drama.title}</span>
                        <span className="mt-1 block text-xs text-muted">{t('common.episodes', { count: drama.episodeCount })}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 text-brand">
                            <Flame aria-hidden="true" className="size-3.5" />
                            {tab === 'rising' ? t('ranking.growth', { value: nf.format(score) }) : t('ranking.score', { value: nf.format(score) })}
                          </span>
                          {exploring && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{t('ranking.exploring')}</span>}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </>
          ))}
      </div>
    </div>
  );
}
