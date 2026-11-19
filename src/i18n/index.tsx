import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import zhCN from '@messages/zh-CN.json';
import zhTW from '@messages/zh-TW.json';
import ko from '@messages/ko.json';
import ja from '@messages/ja.json';
import th from '@messages/th.json';
import vi from '@messages/vi.json';
import { storage } from '@/lib/storage';
import { defaultLocale, isLocale, locales, type Locale } from './routing';

// 文案在 messages/*.json，新增键时 6 个语言文件同时补齐（i18n.test.ts 校验）
type Messages = Record<string, unknown>;
const catalogs: Record<Locale, Messages> = { 'zh-CN': zhCN, 'zh-TW': zhTW, ko, ja, th, vi };

function lookup(messages: Messages, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** 缺译回退默认语言并在开发环境告警，不显示键名以外的占位 */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let text = lookup(catalogs[locale], key);
  if (text === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing ${locale}:${key}`);
    text = lookup(catalogs[defaultLocale], key) ?? key;
  }
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

/** 首次启动按系统语言推断，之后用保存的偏好 */
export function initialLocale(saved: string | null, languages: readonly string[]): Locale {
  if (isLocale(saved)) return saved;
  for (const lang of languages) {
    if (isLocale(lang)) return lang;
    const lower = lang.toLowerCase();
    if (lower.startsWith('zh')) return /tw|hk|mo|hant/.test(lower) ? 'zh-TW' : 'zh-CN';
    const base = locales.find((l) => l === lower.split('-')[0]);
    if (base) return base;
  }
  return defaultLocale;
}

/** 键在当前或默认语言中存在 */
export const hasMessage = (locale: Locale, key: string) => lookup(catalogs[locale], key) !== undefined || lookup(catalogs[defaultLocale], key) !== undefined;

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale(storage.getLocale(), navigator.languages));
  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale: (l) => {
        storage.setLocale(l);
        setLocaleState(l);
      },
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 按错误码映射文案：details.reason > code_field > code，全不存在回退 errors.unknown */
export function errorText(locale: Locale, keys: string[]): string {
  const key = keys.map((k) => `errors.${k}`).find((k) => hasMessage(locale, k));
  return translate(locale, key ?? 'errors.unknown');
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
