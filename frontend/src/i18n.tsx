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
    'header.donate': 'Donate',

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
    'statsView.description': 'Application metrics and status',
    'statsView.uptime': 'Uptime',
    'statsView.countries': 'Countries',
    'statsView.lastUpdate': 'Last Configs Update',
    'statsView.nextUpdate': 'Next Configs Update',
    'statsView.calculating': 'Calculating...',
    'statsView.soon': 'Soon',
    'statsView.never': 'Never',

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
    'control.statistics': 'Statistics',

    // Logs modal
    'logs.title': 'Server Logs',
    'logs.loading': 'Loading logs...',
    'logs.empty': 'No logs available',
    'logs.error': 'Failed to load logs',

    // Settings modal
    'settings.title': 'Settings',
    'settings.subtitle': 'Configure your whitelist download server parameters.',
    'settings.loading': 'Loading settings...',
    'settings.loadError': 'Failed to load settings',
    'settings.general': 'General',
    'settings.network': 'Network',
    'settings.timing': 'Timing',
    'settings.sources': 'Sources',
    'settings.appName': 'Application Name',
    'settings.subTitle': 'Subscription Title',
    'settings.description': 'Description Text',
    'settings.port': 'Port',
    'settings.forcedIp': 'Forced IP',
    'settings.subPath': 'Subscription Path',
    'settings.interval': 'Update Interval (min)',
    'settings.sourcePlaceholder': 'Enter URL...',
    'settings.addSource': 'Add Source',
    'settings.removeSource': 'Remove',
    'settings.levelNormalDesc': 'Checking configurations using server ping [Fast]',
    'settings.levelUltraDesc': 'Checking configurations using sing-box core, better than ping, but filters out more configurations that might have been working [Slow]',
    'settings.close': 'Close',
    'settings.updateConfigs': 'Update Configurations',
    'settings.restartServer': 'Restart Server',
    'settings.workingLevel': 'Working Check Level',
    'settings.levelNormal': 'Normal',
    'settings.levelUltra': 'Ultra',
    'settings.updates': 'Updates',
    'settings.autoUpdateMajor': 'Auto-download major updates',
    'settings.autoUpdatePatch': 'Auto-download bug fixes & improvements',
    'settings.autoBrowserOpen': 'Auto-open browser on startup',
    'sub.noLimit': 'No limit',

    // Updates
    'update.downloading': 'Downloading update...',
    'update.installing': 'Installing...',
    'update.reload': 'Reload the page',
    'update.downloadInstall': 'Download & Install',
    'update.upToDate': 'You are up to date!',
    'update.error': 'Update Error',
    'update.noNotes': 'No release notes provided.',
    'update.newVersion': 'New version',

    // Sidebar & Details
    'sidebar.filter': 'Filter by Country',
    'sidebar.all': 'All',
    'sidebar.allRegions': 'All Countries',
    'sidebar.aggregated': 'Aggregated subscription',
    'sidebar.unknown': 'Unknown',
    'sidebar.loading': 'Loading...',
    'sidebar.loadError': 'Failed to load configs',
    
    'details.globalSub': 'Global Subscription',
    'details.sub': 'Subscription',
    'details.scanOrCopy': 'Scan the QR code or copy the link to import into your.',
    'details.paginationConfig': 'Pagination Configuration',
    'details.limit': 'Limit',

    'details.unknownLocation': 'Unknown Location',
    'details.config': 'Config',
    'details.protocol': 'Protocol',
    'details.port': 'Port',
    'details.uuid': 'UUID',
    'details.parameters': 'Parameters',
    'details.parseError': 'Failed to parse configuration.',

    // Theme
    'theme.dark': 'Dark',
    'theme.light': 'Light',

    // Uptime formatting
    'time.days': 'd',
    'time.hours': 'h',
    'time.minutes': 'm',

    // Save status (header slot)
    'status.saved': 'All changes saved',
    'status.saving': 'Saving changes…',
    'status.restart': 'Restart required',
    'status.error': 'Not saved — retry',
    'status.invalid': 'Fix errors to save',

    // Update interval
    'interval.errNumber': 'Enter a whole number of minutes',
    'interval.errMin': 'Minimum is {min} minutes',
    'interval.errMax': 'Maximum is {max} minutes (24 hours)',
    'interval.presets': 'Quick values',
    'time.min': '{n} min',
    'time.hour': '{n} h',

    // Country select
    'country.all': 'All countries',
    'country.loading': 'Loading…',
    'country.error': 'Failed to load countries',
    'country.retry': 'Retry',
    'country.empty': 'No configs yet',
    'country.select': 'Country',

    // Import configs
    'import.title': 'Import configs',
    'import.description': 'Download configs as a .txt file, one link per line.',
    'import.count': 'Count',
    'import.countPlaceholder': 'All',
    'import.offset': 'Offset',
    'import.offsetHint': 'How many configs to skip from the start of the selection',
    'import.available': 'Available: {n}',
    'import.fileName': 'File name',
    'import.resetName': 'Generate from filters',
    'import.download': 'Download',
    'import.downloading': 'Downloading…',
    'import.done': 'Downloaded: {n}',
    'import.empty': 'No configs match these filters',
    'import.error': 'Failed to download configs. Check that the server is running and try again.',
    'import.errInteger': 'Only whole numbers',
    'import.errCountMin': 'At least 1',
    'import.errCountMax': 'No more than {max}',
    'import.errOffsetMax': 'Only {total} configs available — this offset skips all of them',
    'import.errFileName': 'Enter a file name',
  },
  ru: {
    // Header
    'header.title': 'Whitelist Download',
    'header.subtitle': 'Open-source конфиги для обхода белых списков',
    'header.github': 'GitHub',
    'header.donate': 'Пожертвовать',

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
    'statsView.description': 'Показатели и статус приложения',
    'statsView.uptime': 'Время работы',
    'statsView.countries': 'Количество стран',
    'statsView.lastUpdate': 'Последнее обновление',
    'statsView.nextUpdate': 'Следующее обновление',
    'statsView.calculating': 'Вычисление...',
    'statsView.soon': 'Скоро',
    'statsView.never': 'Никогда',

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
    'control.statistics': 'Статистика',

    // Logs modal
    'logs.title': 'Логи сервера',
    'logs.loading': 'Загрузка логов...',
    'logs.empty': 'Логи отсутствуют',
    'logs.error': 'Не удалось загрузить логи',

    // Settings modal
    'settings.title': 'Настройки',
    'settings.subtitle': 'Настройте параметры вашего сервера.',
    'settings.loading': 'Загрузка настроек...',
    'settings.loadError': 'Не удалось загрузить настройки',
    'settings.general': 'Основные',
    'settings.network': 'Сеть',
    'settings.timing': 'Таймеры',
    'settings.sources': 'Источники',
    'settings.appName': 'Название приложения',
    'settings.subTitle': 'Название подписки',
    'settings.description': 'Описание подписки',
    'settings.port': 'Порт',
    'settings.forcedIp': 'Принудительный IP',
    'settings.subPath': 'Путь подписки',
    'settings.interval': 'Интервал обновления (мин)',
    'settings.sourcePlaceholder': 'Введите ссылку...',
    'settings.addSource': 'Добавить источник',
    'settings.removeSource': 'Удалить',
    'settings.levelNormalDesc': 'Проверка конфигураций с помощью пинга сервера [Быстро]',
    'settings.levelUltraDesc': 'Проверка конфигураций с помощью ядра sing-box, лучше пинга, но отсеивает больше конфигураций, которые могли быть рабочими [Медленно]',
    'settings.close': 'Закрыть',
    'settings.updateConfigs': 'Обновить конфигурации',
    'settings.restartServer': 'Перезагрузить сервер',
    'settings.workingLevel': 'Уровень проверки конфигов',
    'settings.levelNormal': 'Обычный',
    'settings.levelUltra': 'Ультра',
    'settings.updates': 'Обновления',
    'settings.autoUpdateMajor': 'Автоматически скачивать крупные обновления',
    'settings.autoUpdatePatch': 'Автоматически скачивать исправления багов и улучшения',
    'settings.autoBrowserOpen': 'Автоматически открывать браузер при запуске',
    'sub.noLimit': 'Без лимита',

    // Updates
    'update.downloading': 'Загрузка обновления...',
    'update.installing': 'Установка...',
    'update.reload': 'Перезагрузите страницу',
    'update.downloadInstall': 'Скачать и установить',
    'update.upToDate': 'У вас последняя версия!',
    'update.error': 'Ошибка обновления',
    'update.noNotes': 'Описание обновления не предоставлено.',
    'update.newVersion': 'Новая версия',

    // Sidebar & Details
    'sidebar.filter': 'Фильтр по странам',
    'sidebar.all': 'Все',
    'sidebar.allRegions': 'Все страны',
    'sidebar.aggregated': 'Объединенная подписка',
    'sidebar.unknown': 'Неизвестно',
    'sidebar.loading': 'Загрузка...',
    'sidebar.loadError': 'Не удалось загрузить конфиги',
    
    'details.globalSub': 'Глобальная подписка',
    'details.sub': 'Подписка',
    'details.scanOrCopy': 'Отсканируйте QR-код или скопируйте ссылку для импорта в клиент.',
    'details.paginationConfig': 'Настройка пагинации',
    'details.limit': 'Лимит',

    'details.unknownLocation': 'Неизвестная локация',
    'details.config': 'Конфиг',
    'details.protocol': 'Протокол',
    'details.port': 'Порт',
    'details.uuid': 'UUID',
    'details.parameters': 'Параметры',
    'details.parseError': 'Не удалось распознать конфигурацию.',

    // Theme
    'theme.dark': 'Тёмная',
    'theme.light': 'Светлая',

    // Uptime formatting
    'time.days': 'д',
    'time.hours': 'ч',
    'time.minutes': 'м',

    // Save status (header slot)
    'status.saved': 'Все изменения сохранены',
    'status.saving': 'Сохранение изменений…',
    'status.restart': 'Требуется рестарт',
    'status.error': 'Не сохранено — повторить',
    'status.invalid': 'Исправьте ошибки',

    // Update interval
    'interval.errNumber': 'Введите целое число минут',
    'interval.errMin': 'Минимум {min} минут',
    'interval.errMax': 'Максимум {max} минут (24 часа)',
    'interval.presets': 'Быстрые значения',
    'time.min': '{n} мин',
    'time.hour': '{n} ч',

    // Country select
    'country.all': 'Все страны',
    'country.loading': 'Загрузка…',
    'country.error': 'Не удалось загрузить страны',
    'country.retry': 'Повторить',
    'country.empty': 'Конфигов пока нет',
    'country.select': 'Страна',

    // Import configs
    'import.title': 'Импорт конфигов',
    'import.description': 'Скачайте конфиги в .txt файле, по одной ссылке в строке.',
    'import.count': 'Количество',
    'import.countPlaceholder': 'Все',
    'import.offset': 'Оффсет',
    'import.offsetHint': 'Сколько конфигов пропустить с начала выборки',
    'import.available': 'Доступно: {n}',
    'import.fileName': 'Имя файла',
    'import.resetName': 'Сгенерировать по фильтрам',
    'import.download': 'Скачать',
    'import.downloading': 'Скачивание…',
    'import.done': 'Скачано: {n}',
    'import.empty': 'По выбранным фильтрам конфигов не найдено',
    'import.error': 'Не удалось скачать конфиги. Проверьте, что сервер запущен, и попробуйте ещё раз.',
    'import.errInteger': 'Только целые числа',
    'import.errCountMin': 'Минимум 1',
    'import.errCountMax': 'Не больше {max}',
    'import.errOffsetMax': 'Доступно всего {total} — такой оффсет пропускает все конфиги',
    'import.errFileName': 'Введите имя файла',
  },
};

/** Context value shape for i18n */
interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translates a key; "{name}" placeholders are replaced with params */
  t: (key: string, params?: Record<string, string | number>) => string;
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
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const text = translations[language][key] || key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
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
// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
