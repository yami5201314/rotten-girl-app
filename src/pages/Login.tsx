import { useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { ApiError } from '@shared/types';
import { confirmAge, errorKeys, login, register } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { errorText, useI18n } from '@/i18n';
import { href, navigate, replace } from '@/lib/router';
import { btnPrimary } from '@/components/ui';

const PASSWORD_MIN = 8;
const input = 'h-12 w-full rounded-xl border border-line bg-surface px-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand';

export function Login({ mode }: { mode: 'login' | 'register' }) {
  const { locale, t } = useI18n();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fail(e: ApiError) {
    // 登录接口的 401 表示邮箱或密码错误
    setError(mode === 'login' && e.error === 'UNAUTHENTICATED' ? t('errors.invalid_credentials') : errorText(locale, errorKeys(e)));
    const emailField = e.error === 'EMAIL_ALREADY_REGISTERED' || e.details?.field === 'email';
    (emailField ? emailRef : passwordRef).current?.focus();
  }

  async function onLoggedIn() {
    // 本机已确认年龄则同步登记到账号；失败不阻塞，受限内容由后端再次校验
    if (storage.isAgeConfirmed()) await confirmAge();
    await refresh();
    replace(href.me());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    if (mode === 'register' && password.length < PASSWORD_MIN) {
      setError(t('errors.weak_password'));
      passwordRef.current?.focus();
      return;
    }
    setSubmitting(true);
    if (mode === 'register') {
      const r = await register(email.trim(), password, locale);
      setSubmitting(false);
      // 注册不下发会话：成功提示前往邮箱验证
      if (r.ok) setNotice(t('auth.verifySent'));
      else fail(r.error);
      return;
    }
    const r = await login(email.trim(), password);
    setSubmitting(false);
    if (!r.ok) return fail(r.error);
    // 用户端登录不要求两步验证（用户 2026-11-16 选择），只有管理端登录才要求
    void onLoggedIn();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-sm space-y-4 px-6 pb-8 pt-[calc(max(0.5rem,var(--safe-top))+4rem)]">
      <button
        type="button"
        aria-label={t('player.back')}
        onClick={() => history.back()}
        className="fixed left-2 top-[max(0.5rem,var(--safe-top))] flex size-11 items-center justify-center rounded-full bg-surface"
      >
        <ChevronLeft aria-hidden="true" className="size-6" />
      </button>
      <p className="text-3xl font-black text-brand-gradient">rotten girl</p>
      <h1 className="pb-2 text-xl font-bold">{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h1>
      <label className="block space-y-1 text-sm">
        <span>{t('auth.email')}</span>
        <input
          ref={emailRef}
          className={input}
          type="email"
          autoComplete="email"
          required
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t('auth.password')}</span>
        <input
          ref={passwordRef}
          className={input}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'register' ? PASSWORD_MIN : undefined}
          placeholder={mode === 'register' ? t('auth.passwordHint', { min: PASSWORD_MIN }) : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      )}
      <button type="submit" className={`${btnPrimary} min-h-12 w-full`} disabled={submitting}>
        {submitting ? t('auth.submitting') : mode === 'login' ? t('auth.login') : t('auth.register')}
      </button>
      <button type="button" className="block min-h-11 w-full text-center text-sm text-brand" onClick={() => navigate(mode === 'login' ? href.register() : href.login())}>
        {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
      </button>
    </form>
  );
}
