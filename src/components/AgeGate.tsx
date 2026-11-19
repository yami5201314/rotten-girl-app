import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { confirmAge } from '@/lib/api';
import { storage } from '@/lib/storage';
import { useI18n } from '@/i18n';
import { btnGhost, btnPrimary } from './ui';

/**
 * 首次启动的年龄确认，未确认前不渲染任何内容。仅为交互拦截，成人内容的真实放行由后端校验。
 * 选择"离开"后只保留确认入口，不展示内容。
 */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState(() => storage.isAgeConfirmed());
  const [left, setLeft] = useState(false);
  if (confirmed) return <>{children}</>;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-title" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div aria-hidden="true" className="absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-brand-gradient opacity-30 blur-3xl" />
      <div className="relative flex w-full max-w-xs flex-col items-center gap-5">
        <p className="text-3xl font-black text-brand-gradient">rotten girl</p>
        <span className="flex size-16 items-center justify-center rounded-full bg-surface-2">
          <ShieldCheck aria-hidden="true" className="size-8 text-brand" />
        </span>
        <h1 id="age-title" className="text-xl font-bold">
          {t('ageGate.title')}
        </h1>
        {!left && <p className="text-sm leading-relaxed text-muted">{t('ageGate.description')}</p>}
        <div className="flex w-full flex-col gap-3">
          <button
            className={`${btnPrimary} min-h-12`}
            onClick={() => {
              storage.confirmAge();
              setConfirmed(true);
              // 已登录时同步登记到账号；访客返回 UNAUTHENTICATED，失败不阻塞
              void confirmAge();
            }}
          >
            {t('ageGate.confirm')}
          </button>
          {!left && (
            <button className={`${btnGhost} min-h-12`} onClick={() => setLeft(true)}>
              {t('ageGate.leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
