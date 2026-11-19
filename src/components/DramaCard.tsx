import type { Drama } from '@shared/types';
import { useI18n } from '@/i18n';
import { episodeProgress } from '@/lib/api';
import { href } from '@/lib/router';
import { Cover } from './ui';

export function DramaCard({ drama, eager }: { drama: Drama; eager?: boolean }) {
  const { t } = useI18n();
  const title = drama.titleTranslation?.text ?? drama.title;
  const progress = episodeProgress(drama);
  return (
    <a href={href.drama(drama.id)} className="block transition-transform duration-150 active:scale-[0.97]">
      <Cover src={drama.coverUrl} alt={title} rating={drama.rating} eager={eager}>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-6 text-[11px] font-medium text-white/90">
          <span className="block truncate">{t(progress.key, progress.values)}</span>
        </span>
      </Cover>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug">{title}</p>
    </a>
  );
}

export function DramaGrid({ items }: { items: Drama[] }) {
  return (
    <ul className="grid grid-cols-3 gap-x-2.5 gap-y-4">
      {items.map((d, i) => (
        <li key={d.id} className="min-w-0">
          <DramaCard drama={d} eager={i < 6} />
        </li>
      ))}
    </ul>
  );
}

/** 横向轨道（只允许局部横滑） */
export function DramaRail({ items }: { items: Drama[] }) {
  return (
    <ul className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4">
      {items.map((d) => (
        <li key={d.id} className="w-28 shrink-0">
          <DramaCard drama={d} />
        </li>
      ))}
    </ul>
  );
}
