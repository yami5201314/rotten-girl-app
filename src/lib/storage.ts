// App 端唯一的本地持久化入口（语言、年龄确认、设备标识），组件不直接读写 localStorage
const KEYS = {
  locale: 'rg:locale',
  ageConfirmed: 'rg:age-confirmed',
  deviceRef: 'rg:device-ref',
} as const;

export const storage = {
  getLocale: () => localStorage.getItem(KEYS.locale),
  setLocale: (l: string) => localStorage.setItem(KEYS.locale, l),
  isAgeConfirmed: () => localStorage.getItem(KEYS.ageConfirmed) === '1',
  confirmAge: () => localStorage.setItem(KEYS.ageConfirmed, '1'),
  // 播放会话的设备标识（随机生成，仅用于会话并发与风控，不含个人信息）
  getDeviceRef: (): string => {
    const stored = localStorage.getItem(KEYS.deviceRef);
    if (stored) return stored;
    const ref = crypto.randomUUID();
    localStorage.setItem(KEYS.deviceRef, ref);
    return ref;
  },
};
