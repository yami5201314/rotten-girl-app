import { useState } from 'react';
import { ChevronRight, Globe, Heart, LogOut, Tv, UserRound } from 'lucide-react';
import { logout } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { localeNames, locales, type Locale } from '@/i18n/routing';
import { href } from '@/lib/router';
import { btnGhost, btnPrimary, Loading, PageHeader } from '@/components/ui';

export function Me() {
  const { locale, setLocale, t } = useI18n();
  const { user, loading, refresh } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    setError(false);
    const r = await logout();
    setLoggingOut(false);
    if (r.ok) await refresh();
    else setError(true);
  }

  return (
    <div className="pb-6">
      <PageHeader title={t('nav.me')} />
      <div className="space-y-5 px-4">
        {/* 账号卡片 */}
        <section className="relative overflow-hidden rounded-card bg-surface p-4">
          <div aria-hidden="true" className="absolute -right-10 -top-12 size-40 rounded-full bg-brand-gradient opacity-25 blur-3xl" />
          {loading ? (
            <Loading />
          ) : (
            <div className="relative flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-gradient">
                <UserRound aria-hidden="true" className="size-7 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{user ? user.email : t('app.guest')}</p>
                {!user && <p className="mt-0.5 text-xs text-muted">{t('auth.guestDesc')}</p>}
              </div>
            </div>
          )}
          {!loading && !user && (
            <div className="relative mt-4 grid grid-cols-2 gap-2">
              <a href={href.login()} className={btnPrimary}>
                {t('auth.login')}
              </a>
              <a href={href.register()} className={btnGhost}>
                {t('auth.register')}
              </a>
            </div>
          )}
        </section>

        {user && (
          <section className="grid grid-cols-2 gap-2">
            <a href={href.library()} className="flex min-h-16 items-center gap-3 rounded-card bg-surface px-4 active:bg-surface-2">
              <Tv aria-hidden="true" className="size-5 text-brand" />
              <span className="text-sm font-semibold">{t('engagement.followingTitle')}</span>
            </a>
            <a href={href.library()} className="flex min-h-16 items-center gap-3 rounded-card bg-surface px-4 active:bg-surface-2">
              <Heart aria-hidden="true" className="size-5 text-brand" />
              <span className="text-sm font-semibold">{t('engagement.favoritesTitle')}</span>
            </a>
          </section>
        )}

        <section className="overflow-hidden rounded-card bg-surface">
          <h2 className="px-4 pb-1 pt-3 text-xs font-semibold text-muted">{t('app.settings')}</h2>
          <label className="flex min-h-14 items-center gap-3 px-4">
            <Globe aria-hidden="true" className="size-5 text-muted" />
            <span className="flex-1 text-sm">{t('nav.language')}</span>
            <span className="relative flex items-center">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="h-10 appearance-none rounded-lg bg-surface-2 py-0 pl-3 pr-8 text-sm"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {localeNames[l]}
                  </option>
                ))}
              </select>
              <ChevronRight aria-hidden="true" className="pointer-events-none absolute right-2 size-4 rotate-90 text-muted" />
            </span>
          </label>
        </section>

        {user && (
          <div className="space-y-2">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {t('common.error')}
              </p>
            )}
            <button className={`${btnGhost} w-full`} disabled={loggingOut} onClick={() => void onLogout()}>
              <LogOut aria-hidden="true" className="size-4" />
              {loggingOut ? t('auth.submitting') : t('auth.logout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
