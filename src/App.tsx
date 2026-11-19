import { Compass, Flame, House, Tv, UserRound, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/i18n';
import { href, useRoute, type Route } from '@/lib/router';
import { AgeGate } from '@/components/AgeGate';
import { Feed } from '@/pages/Feed';
import { Discover } from '@/pages/Discover';
import { Ranking } from '@/pages/Ranking';
import { Library } from '@/pages/Library';
import { DramaDetail } from '@/pages/DramaDetail';
import { Player } from '@/pages/Player';
import { Me } from '@/pages/Me';
import { Login } from '@/pages/Login';

type TabName = 'home' | 'discover' | 'ranking' | 'library' | 'me';

const tabs: { name: TabName; to: string; label: string; Icon: LucideIcon }[] = [
  { name: 'home', to: href.home(), label: 'nav.home', Icon: House },
  { name: 'discover', to: href.discover(), label: 'app.discover', Icon: Compass },
  { name: 'ranking', to: href.ranking(), label: 'nav.ranking', Icon: Flame },
  { name: 'library', to: href.library(), label: 'app.library', Icon: Tv },
  { name: 'me', to: href.me(), label: 'nav.me', Icon: UserRound },
];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'discover':
      return <Discover q={route.q} tag={route.tag} />;
    case 'ranking':
      return <Ranking tab={route.tab} />;
    case 'library':
      return <Library />;
    case 'drama':
      return <DramaDetail id={route.id} />;
    case 'play':
      return <Player id={route.id} ep={route.ep} />;
    case 'me':
      return <Me />;
    case 'login':
      return <Login key={route.mode} mode={route.mode} />;
    default:
      return <Feed />;
  }
}

export function App() {
  const { t, locale } = useI18n();
  const route = useRoute();
  // 详情、播放、登录为全屏子页，不显示底部导航
  const showNav = route.name !== 'play' && route.name !== 'drama' && route.name !== 'login';
  const dark = route.name === 'home';
  return (
    <div lang={locale} className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg text-fg">
      <AgeGate>
        <main className={`flex-1 ${showNav ? 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]' : ''}`}>
          <Page route={route} />
        </main>
        {showNav && (
          <nav
            aria-label={t('nav.mainMenu')}
            className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md border-t pb-[env(safe-area-inset-bottom)] ${dark ? 'border-white/5 bg-black' : 'border-line bg-bg/95 backdrop-blur-md'}`}
          >
            {tabs.map(({ name, to, label, Icon }) => {
              const current = route.name === name;
              return (
                <a
                  key={name}
                  href={to}
                  aria-current={current ? 'page' : undefined}
                  className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium transition-colors ${current ? 'text-fg' : 'text-muted'}`}
                >
                  <Icon aria-hidden="true" className={`size-[22px] ${current ? 'text-brand' : ''}`} strokeWidth={current ? 2.4 : 1.8} />
                  <span className="w-full truncate text-center">{t(label)}</span>
                </a>
              );
            })}
          </nav>
        )}
      </AgeGate>
    </div>
  );
}
