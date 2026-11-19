import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { ContentRating } from '@shared/types';
import { useI18n } from '@/i18n';
import { storage } from '@/lib/storage';

const btn =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-[opacity,background-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50';
export const btnPrimary = `${btn} bg-brand-gradient text-white shadow-lg shadow-brand/25`;
export const btnGhost = `${btn} bg-white/10 text-fg active:bg-white/20`;
export const chip = (active: boolean) =>
  `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${active ? 'bg-brand-gradient text-white' : 'bg-surface-2 text-muted active:text-fg'}`;

export function Spinner({ className = 'size-7' }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={`animate-spin text-brand ${className}`} />;
}

export function Loading() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t('common.loading')} className="flex justify-center p-10">
      <Spinner />
    </div>
  );
}

export function ErrorRetry({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center gap-4 p-10 text-center text-sm text-muted">
      <p>{message ?? t('common.error')}</p>
      <button className={btnPrimary} onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="p-10 text-center text-sm text-muted">{text}</p>;
}

/** 与 DramaGrid 同尺寸的骨架，避免加载完成后跳动 */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="grid grid-cols-3 gap-x-2.5 gap-y-4">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="aspect-[3/4] animate-pulse rounded-card bg-surface-2" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}

/** 竖版封面；成人内容在未确认年龄时模糊 */
export function Cover({
  src,
  alt,
  rating,
  eager,
  children,
}: {
  src: string | null;
  alt: string;
  rating: ContentRating;
  eager?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const blur = rating === 'adult' && !storage.isAgeConfirmed();
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-surface-2">
      {src && <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className={`h-full w-full object-cover ${blur ? 'blur-xl' : ''}`} />}
      {rating === 'adult' && <span className="absolute left-1.5 top-1.5 rounded bg-danger px-1 text-[10px] font-bold text-white">{t('common.adult')}</span>}
      {children}
    </div>
  );
}

/** 页面标题栏（Tab 页） */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-bg/90 px-4 pb-2 pt-[max(0.75rem,var(--safe-top))] backdrop-blur-md">
      <div className="flex min-h-11 items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold">{title}</h1>
        {children}
      </div>
    </header>
  );
}
