import { useEffect, useRef, useState } from 'react';
import { Play, Search, X } from 'lucide-react';
import type { Drama, Tag } from '@shared/types';
import { listDramas, listHomeSections, listTags, SEARCH_MAX, tagName } from '@/lib/api';
import { useI18n } from '@/i18n';
import { href, replace } from '@/lib/router';
import { DramaGrid, DramaRail } from '@/components/DramaCard';
import { btnGhost, chip, Empty, ErrorRetry, GridSkeleton } from '@/components/ui';

type ListState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: Drama[]; nextCursor: string | null; more: 'idle' | 'loading' | 'error' };
type Sections = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; sections: { title: string; items: Drama[] }[] };

/** 发现页：搜索 + 标签筛选 + 精选大图 + 栏目轨道 + 全部短剧；搜索词与标签写进路由 */
export function Discover({ q, tag }: { q: string; tag: string }) {
  const { locale, t } = useI18n();
  const [input, setInput] = useState(q);
  const [tags, setTags] = useState<Tag[]>([]);
  const filtering = !!q || !!tag;

  useEffect(() => setInput(q), [q]);

  // 输入 300ms 防抖后更新路由
  useEffect(() => {
    const v = input.trim().slice(0, SEARCH_MAX);
    if (v === q) return;
    const timer = setTimeout(() => replace(href.discover({ q: v, tag })), 300);
    return () => clearTimeout(timer);
  }, [input, q, tag]);

  useEffect(() => {
    let stale = false;
    // 标签失败只隐藏筛选条，不阻塞列表
    void listTags().then((r) => !stale && r.ok && setTags(r.data));
    return () => {
      stale = true;
    };
  }, []);

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-10 bg-bg/90 px-4 pb-2 pt-[max(0.75rem,var(--safe-top))] backdrop-blur-md">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            replace(href.discover({ q: input.trim().slice(0, SEARCH_MAX), tag }));
          }}
          className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4"
        >
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <input
            type="search"
            aria-label={t('drama.searchLabel')}
            placeholder={t('drama.searchPlaceholder')}
            maxLength={SEARCH_MAX}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {input && (
            <button type="button" aria-label={t('drama.searchClear')} onClick={() => setInput('')} className="-mr-2 flex size-9 items-center justify-center text-muted">
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </form>
        {tags.length > 0 && (
          <nav aria-label={t('drama.filterLabel')} className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <a href={href.discover({ q })} aria-current={!tag ? 'page' : undefined} className={chip(!tag)}>
              {t('tags.all')}
            </a>
            {tags.map((x) => (
              <a key={x.id} href={href.discover({ q, tag: x.code })} aria-current={tag === x.code ? 'page' : undefined} className={chip(tag === x.code)}>
                {tagName(x, locale)}
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className="space-y-7 px-4 pt-3">
        {!filtering && <Featured />}
        {q && <h2 className="text-sm font-semibold text-muted">{t('drama.searchResults', { q })}</h2>}
        <AllDramas key={`${q}|${tag}`} q={q} tag={tag} showTitle={!filtering} />
      </div>
    </div>
  );
}

/** 栏目：第一个栏目的首部剧做大图横幅，其余栏目为横向轨道 */
function Featured() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<Sections>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stale = false;
    setState({ kind: 'loading' });
    void listHomeSections(locale).then((r) => {
      if (stale) return;
      if (!r.ok) return setState({ kind: 'error' });
      setState({
        kind: 'ready',
        sections: r.data.filter((s) => s.items.length > 0).map((s) => ({ title: s.title[locale] ?? s.title['zh-CN'] ?? s.code, items: s.items })),
      });
    });
    return () => {
      stale = true;
    };
  }, [locale, reload]);

  if (state.kind === 'loading') return <div aria-hidden="true" className="aspect-[16/10] animate-pulse rounded-card bg-surface-2" />;
  if (state.kind === 'error') return <ErrorRetry onRetry={() => setReload((n) => n + 1)} />;
  const hero = state.sections[0]?.items[0];
  return (
    <>
      {hero && <Hero drama={hero} label={t('app.featured')} />}
      {state.sections.map((s) => (
        <section key={s.title}>
          <h2 className="mb-3 text-[17px] font-bold">{s.title}</h2>
          <DramaRail items={s.items} />
        </section>
      ))}
    </>
  );
}

function Hero({ drama, label }: { drama: Drama; label: string }) {
  const { t } = useI18n();
  const title = drama.titleTranslation?.text ?? drama.title;
  return (
    <a href={href.drama(drama.id)} className="relative block aspect-[16/10] overflow-hidden rounded-card bg-surface-2 active:opacity-90">
      {drama.coverUrl && (
        <>
          <img src={drama.coverUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
          <img src={drama.coverUrl} alt={title} className="absolute bottom-3 right-3 top-3 aspect-[3/4] rounded-lg object-cover shadow-2xl" />
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
      <div className="absolute inset-y-0 left-0 flex w-3/5 flex-col justify-end gap-2 p-4">
        <span className="w-fit rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold">{label}</span>
        <p className="line-clamp-2 text-lg font-extrabold leading-snug">{title}</p>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
          <Play aria-hidden="true" className="size-3.5 fill-current" />
          {t('app.watchNow')}
        </span>
      </div>
    </a>
  );
}

function AllDramas({ q, tag, showTitle }: { q: string; tag: string; showTitle: boolean }) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    setState({ kind: 'loading' });
    void listDramas(locale, { search: q || undefined, tag: tag || undefined }).then((r) => {
      if (my !== seq.current) return;
      setState(r.ok ? { kind: 'ready', items: r.data.items, nextCursor: r.data.nextCursor, more: 'idle' } : { kind: 'error' });
    });
  }, [locale, q, tag, reload]);

  async function loadMore() {
    if (state.kind !== 'ready' || !state.nextCursor || state.more === 'loading') return;
    const my = seq.current;
    setState({ ...state, more: 'loading' });
    const r = await listDramas(locale, { cursor: state.nextCursor, search: q || undefined, tag: tag || undefined });
    if (my !== seq.current) return;
    setState(r.ok ? { kind: 'ready', items: [...state.items, ...r.data.items], nextCursor: r.data.nextCursor, more: 'idle' } : { ...state, more: 'error' });
  }

  return (
    <section>
      {showTitle && <h2 className="mb-3 text-[17px] font-bold">{t('app.allDramas')}</h2>}
      {state.kind === 'loading' && <GridSkeleton />}
      {state.kind === 'error' && <ErrorRetry onRetry={() => setReload((n) => n + 1)} />}
      {state.kind === 'ready' &&
        (state.items.length === 0 ? (
          <Empty text={t('common.empty')} />
        ) : (
          <>
            <DramaGrid items={state.items} />
            {state.nextCursor && (
              <div className="flex flex-col items-center gap-2 pt-5">
                {state.more === 'error' && (
                  <p role="alert" className="text-sm text-muted">
                    {t('common.error')}
                  </p>
                )}
                <button className={btnGhost} disabled={state.more === 'loading'} onClick={() => void loadMore()}>
                  {state.more === 'loading' ? t('common.loading') : state.more === 'error' ? t('common.retry') : t('drama.loadMore')}
                </button>
              </div>
            )}
          </>
        ))}
    </section>
  );
}
