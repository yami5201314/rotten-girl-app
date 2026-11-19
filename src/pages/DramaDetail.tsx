import { useEffect, useState } from 'react';
import { BookmarkCheck, BookmarkPlus, ChevronLeft, Heart, Lock, Play } from 'lucide-react';
import type { DramaDetail as Detail, DramaEngagement } from '@shared/types';
import { episodeProgress, getDrama, getDramaEngagement, setFavorite, setFollow, tagName } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorText, useI18n } from '@/i18n';
import { href, navigate } from '@/lib/router';
import { btnPrimary, ErrorRetry, Loading } from '@/components/ui';

type State = { kind: 'loading' } | { kind: 'error'; code: string } | { kind: 'ready'; drama: Detail };

export function DramaDetail({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [eng, setEng] = useState<DramaEngagement | null>(null);
  const [busy, setBusy] = useState(false);
  const [engError, setEngError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let stale = false;
    setState({ kind: 'loading' });
    void getDrama(id, locale).then((r) => {
      if (!stale) setState(r.ok ? { kind: 'ready', drama: r.data } : { kind: 'error', code: r.error.error });
    });
    return () => {
      stale = true;
    };
  }, [id, locale, reload]);

  useEffect(() => {
    let stale = false;
    setEng(null);
    if (!user) return;
    void getDramaEngagement(id).then((r) => {
      if (!stale && r.ok) setEng(r.data);
    });
    return () => {
      stale = true;
    };
  }, [id, user]);

  async function toggle(kind: 'favorited' | 'following') {
    if (!user) return navigate(href.login());
    if (!eng || busy) return;
    const on = !eng[kind];
    setBusy(true);
    setEngError(null);
    const r = await (kind === 'favorited' ? setFavorite(id, on) : setFollow(id, on));
    setBusy(false);
    // 以真实写入结果为准
    if (r.ok) setEng({ ...eng, [kind]: on });
    else setEngError(errorText(locale, [r.error.error]));
  }

  const back = (
    <button
      aria-label={t('player.back')}
      onClick={() => history.back()}
      className="fixed left-2 top-[max(0.5rem,var(--safe-top))] z-30 flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur"
    >
      <ChevronLeft aria-hidden="true" className="size-6" />
    </button>
  );

  if (state.kind === 'loading')
    return (
      <>
        {back}
        <div className="pt-20">
          <Loading />
        </div>
      </>
    );
  if (state.kind === 'error')
    return (
      <>
        {back}
        <div className="pt-20">
          <ErrorRetry message={state.code === 'RESOURCE_NOT_FOUND' ? errorText(locale, ['not_found']) : undefined} onRetry={() => setReload((n) => n + 1)} />
        </div>
      </>
    );

  const d = state.drama;
  const title = d.titleTranslation?.text ?? d.title;
  const synopsis = d.synopsisTranslation?.text ?? d.synopsis;
  const first = d.episodes[0];
  const progress = episodeProgress(d, d.episodes.length);
  const engDisabled = busy || (!!user && !eng);

  return (
    <div className="pb-28">
      {back}
      {/* 顶部：模糊封面背景 + 封面 + 标题 */}
      <section className="relative overflow-hidden px-4 pb-8 pt-[calc(max(0.5rem,var(--safe-top))+3.5rem)]">
        {d.coverUrl && <img src={d.coverUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-2xl" />}
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(7_7_10/0.3),rgb(7_7_10/0.75)_55%,var(--color-bg)_92%)]" />
        <div className="relative flex gap-4">
          <div className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-card bg-surface-2 shadow-2xl shadow-black/60">
            {d.coverUrl && <img src={d.coverUrl} alt={title} className="h-full w-full object-cover" />}
            {d.rating === 'adult' && <span className="absolute left-1.5 top-1.5 rounded bg-danger px-1 text-[10px] font-bold">{t('common.adult')}</span>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-2">
            <h1 className="text-xl font-extrabold leading-snug">{title}</h1>
            {d.titleTranslation && !d.titleTranslation.manual && <p className="text-[11px] text-muted">{t('contentTranslation.machineTranslated')}</p>}
            <p className="text-sm text-muted">{t(progress.key, progress.values)}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.tags.slice(0, 4).map((tag) => (
                <span key={tag.code} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                  {tagName(tag, locale)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6 px-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={engDisabled}
            aria-pressed={!!eng?.following}
            onClick={() => void toggle('following')}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-card text-sm font-semibold transition-colors disabled:opacity-50 ${eng?.following ? 'bg-brand/15 text-brand' : 'bg-surface'}`}
          >
            {eng?.following ? <BookmarkCheck aria-hidden="true" className="size-5" /> : <BookmarkPlus aria-hidden="true" className="size-5" />}
            {eng?.following ? t('engagement.following') : t('engagement.follow')}
          </button>
          <button
            disabled={engDisabled}
            aria-pressed={!!eng?.favorited}
            onClick={() => void toggle('favorited')}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-card text-sm font-semibold transition-colors disabled:opacity-50 ${eng?.favorited ? 'bg-brand/15 text-brand' : 'bg-surface'}`}
          >
            <Heart aria-hidden="true" className={`size-5 ${eng?.favorited ? 'fill-current' : ''}`} />
            {eng?.favorited ? t('engagement.favorited') : t('engagement.favorite')}
          </button>
        </div>
        {engError && (
          <p role="alert" className="-mt-4 text-xs text-danger">
            {engError}
          </p>
        )}

        {synopsis.trim() && (
        <section>
          <h2 className="mb-2 text-base font-bold">{t('app.synopsis')}</h2>
          {/* 点击简介展开 / 收起 */}
          <button aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} className="block w-full text-left">
            <span className={`whitespace-pre-line text-sm leading-relaxed text-white/75 ${expanded ? '' : 'line-clamp-4'}`}>{synopsis}</span>
          </button>
        </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-bold">
            {t('player.episodes')} <span className="text-sm font-normal text-muted">· {d.episodes.length}</span>
          </h2>
          {d.episodes.length === 0 ? (
            <p className="text-sm text-muted">{t('common.empty')}</p>
          ) : (
            <ul className="grid grid-cols-5 gap-2">
              {d.episodes.map((e) => {
                const locked = e.accessMode !== 'FREE';
                return (
                  <li key={e.id}>
                    <a
                      href={href.play(d.id, e.displayNumber)}
                      aria-label={locked ? t('drama.episodeLockedLabel', { index: e.displayNumber }) : t('drama.episodeLabel', { index: e.displayNumber })}
                      className="relative flex h-12 items-center justify-center rounded-lg bg-surface text-sm font-semibold active:bg-surface-2"
                    >
                      {e.displayNumber}
                      {locked && <Lock aria-hidden="true" className="absolute right-1 top-1 size-3 text-brand" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {first && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
          <a href={href.play(d.id, first.displayNumber)} className={`${btnPrimary} min-h-12 w-full text-base`}>
            <Play aria-hidden="true" className="size-5 fill-current" />
            {t('drama.startWatching')}
          </a>
        </div>
      )}
    </div>
  );
}
