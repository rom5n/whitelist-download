import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/** Supported languages */
export type Language = 'en' | 'ru';

/** All translatable keys used across the dashboard */
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    'header.title': 'Whitelist Download',
    'header.subtitle': 'Open-source configs for whitelist bypass',
    'header.github': 'GitHub',

    // Subscription card
    'sub.title': 'Subscription',
    'sub.configCount': 'Config count',
    'sub.offset': 'Starting from',
    'sub.copyLink': 'Copy Link',
    'sub.copied': 'Copied!',
    'sub.loading': 'Loading data...',

    // Statistics card
    'stats.title': 'Network Statistics',
    'stats.configs': 'Configs',
    'stats.uptime': 'Uptime',
    'stats.lastUpdate': 'Last Update',
    'stats.countries': 'Countries',
    'stats.byRegion': 'By Region',
    'stats.loading': 'Loading...',
    'stats.updating': 'Updating...',

    // Control panel
    'control.title': 'Controls',
    'control.updateConfigs': 'Update Configs',
    'control.updating': 'Updating...',
    'control.success': 'Success',
    'control.error': 'Error',
    'control.restart': 'Restart',
    'control.restarting': 'Restarting...',
    'control.done': 'Done',
    'control.settings': 'Settings',
    'control.logs': 'Logs',

    // Logs modal
    'logs.title': 'Server Logs',
    'logs.loading': 'Loading logs...',
    'logs.empty': 'No logs available',
    'logs.error': 'Failed to load logs',

    // Settings modal
    'settings.title': 'System Settings',
    'settings.general': 'General',
    'settings.network': 'Network',
    'settings.files': 'Files',
    'settings.timing': 'Timing',
    'settings.sources': 'Sources',
    'settings.appName': 'Application Name',
    'settings.subTitle': 'Subscription Title',
    'settings.description': 'Description Text',
    'settings.port': 'Port',
    'settings.forcedIp': 'Forced IP',
    'settings.subPath': 'Subscription Path',
    'settings.configsPath': 'Configs Path',
    'settings.logsPath': 'Logs Path',
    'settings.interval': 'Update Interval (min)',
    'settings.sourcePlaceholder': 'Source URL',
    'settings.addSource': 'Add',
    'settings.removeSource': 'Remove',
    'settings.save': 'Save Changes',
    'settings.saving': 'Saving...',
    'settings.saved': 'Saved!',
    'settings.saveError': 'Error',
    'settings.restartRequired': 'Restart required',
    'settings.close': 'Close',

    // Theme
    'theme.dark': 'Dark',
    'theme.light': 'Light',

    // Uptime formatting
    'time.days': 'd',
    'time.hours': 'h',
    'time.minutes': 'm',
  },
  ru: {
    // Header
    'header.title': 'Whitelist Download',
    'header.subtitle': 'Open-source конфиги для обхода белых списков',
    'header.github': 'GitHub',

    // Subscription card
    'sub.title': 'Подключение',
    'sub.configCount': 'Количество конфигов',
    'sub.offset': 'Начиная с',
    'sub.copyLink': 'Копировать ссылку',
    'sub.copied': 'Скопировано!',
    'sub.loading': 'Загрузка данных...',

    // Statistics card
    'stats.title': 'Статистика сети',
    'stats.configs': 'Конфиги',
    'stats.uptime': 'Аптайм',
    'stats.lastUpdate': 'Последнее обновление',
    'stats.countries': 'Страны',
    'stats.byRegion': 'По регионам',
    'stats.loading': 'Загрузка...',
    'stats.updating': 'Обновление...',

    // Control panel
    'control.title': 'Управление',
    'control.updateConfigs': 'Обновить подписки',
    'control.updating': 'Обновление...',
    'control.success': 'Успешно',
    'control.error': 'Ошибка',
    'control.restart': 'Рестарт',
    'control.restarting': 'Запуск...',
    'control.done': 'Готово',
    'control.settings': 'Настройки',
    'control.logs': 'Логи',

    // Logs modal
    'logs.title': 'Логи сервера',
    'logs.loading': 'Загрузка логов...',
    'logs.empty': 'Логи отсутствуют',
    'logs.error': 'Не удалось загрузить логи',

    // Settings modal
    'settings.title': 'Системные настройки',
    'settings.general': 'Основные',
    'settings.network': 'Сеть',
    'settings.files': 'Файлы',
    'settings.timing': 'Таймеры',
    'settings.sources': 'Источники',
    'settings.appName': 'Название приложения',
    'settings.subTitle': 'Название подписки',
    'settings.description': 'Описание подписки',
    'settings.port': 'Порт',
    'settings.forcedIp': 'Принудительный IP',
    'settings.subPath': 'Путь подписки',
    'settings.configsPath': 'Путь к конфигам',
    'settings.logsPath': 'Путь к логам',
    'settings.interval': 'Интервал обновления (мин)',
    'settings.sourcePlaceholder': 'URL источника',
    'settings.addSource': 'Добавить',
    'settings.removeSource': 'Удалить',
    'settings.save': 'Сохранить изменения',
    'settings.saving': 'Сохранение...',
    'settings.saved': 'Сохранено!',
    'settings.saveError': 'Ошибка',
    'settings.restartRequired': 'Требуется рестарт',
    'settings.close': 'Закрыть',

    // Theme
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',

    // Uptime formatting
    'time.days': 'д',
    'time.hours': 'ч',
    'time.minutes': 'м',
  },
};

/** Context value shape for i18n */
interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/**
 * Provides translation context to all child components.
 * Reads saved language preference from localStorage; defaults to English.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('wl-language');
    return (saved === 'ru' || saved === 'en') ? saved : 'en';
  });

  /** Updates current language and persists to localStorage */
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('wl-language', lang);
  }, []);

  /** Translates a key to the current language; returns the key itself if not found */
  const t = useCallback((key: string): string => {
    return translations[language][key] || key;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to access the translation function and current language.
 * Must be used within an I18nProvider.
 */
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
