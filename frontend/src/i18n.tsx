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
    'statsView.paused': 'Paused',

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
    'settings.sourcePlaceholder': 'Enter URL...',
    'settings.addSource': 'Add Source',
    'settings.removeSource': 'Remove',
    'settings.levelNormalDesc': 'Checking configurations using server ping [Fast]',
    'settings.levelUltraDesc': 'Checking configurations using sing-box core, better than ping, but filters out more configurations that might have been working [Slow]',
    'settings.saving': 'Saving...',
    'settings.saved': 'Saved!',
    'settings.saveError': 'Error',
    'settings.restartRequired': 'Restart required',
    'settings.close': 'Close',
    'settings.updateConfigs': 'Update Configurations',
    'settings.restartServer': 'Restart Server',
    'settings.workingLevel': 'Working Check Level',
    'settings.levelNormal': 'Normal',
    'settings.levelUltra': 'Ultra',
    'settings.autosaveSaved': 'All changes saved',
    'settings.autosaveInvalid': 'Not saved: fix the highlighted fields',
    'settings.autosaveError': 'Could not save the changes',
    'settings.retry': 'Retry',
    'settings.errName': 'Must not be empty or contain slashes',
    'settings.errPort': 'Enter a port from 1 to 65535',
    'settings.errSubPath': 'Must start with / and contain only letters, digits and . _ ~ - (e.g. /sub)',
    'settings.errSubPathReserved': 'This path is used by the dashboard',
    'settings.errRequired': 'This field is required',
    'settings.errInterval': 'Enter a whole number of minutes from 1 to 10080',
    'settings.errForcedIp': 'Enter an IP address or host name without spaces',
    'settings.updates': 'App updates',
    'settings.autoUpdateMajor': 'Auto-download major updates',
    'settings.autoUpdatePatch': 'Auto-download bug fixes & improvements',
    'settings.autoBrowserOpen': 'Auto-open browser on startup',
    'settings.appliedInstantly': 'Applied immediately',
    'settings.autoRefresh': 'Configs auto-update',

    // Pause of configs auto-update
    'pause.active': 'Active',
    'pause.paused': 'Paused',
    'pause.activeDesc': 'Configs refresh automatically on schedule',
    'pause.foreverDesc': 'Paused until you resume manually',
    'pause.resumesAt': 'Resumes at',
    'pause.resuming': 'Resuming...',
    'pause.resume': 'Resume',
    'pause.pauseFor': 'Pause for',
    'pause.m15': '15 min',
    'pause.h1': '1 hour',
    'pause.h4': '4 hours',
    'pause.h24': '24 hours',
    'pause.forever': 'Forever',
    'pause.note': 'The "Update Configurations" button still works while paused.',
    'pause.error': 'Could not change the auto-update state. Try again.',
    'pause.badge': 'Updates paused',
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
    
    'details.globalSub': 'Global Subscription',
    'details.sub': 'Subscription',
    'details.scanOrCopy': 'Scan the QR code or copy the link into your VPN app.',
    'details.paginationConfig': 'Which configs to include',
    'details.limit': 'Limit',

    'details.unknownLocation': 'Unknown Location',
    'details.config': 'Config',
    'details.protocol': 'Protocol',
    'details.port': 'Port',
    'details.uuid': 'UUID',
    'details.parameters': 'Parameters',
    'details.parseError': 'Failed to parse configuration.',

    'nav.main': 'Sections',
    'nav.subscription': 'Subscription',
    'header.language': 'Language',
    'theme.toLight': 'Light theme',
    'theme.toDark': 'Dark theme',
    'sidebar.emptyTitle': 'No configs yet',
    'sidebar.emptyText': 'They appear after the first update of the sources.',
    'sidebar.list': 'Configs',
    'details.back': 'Back',
    'details.link': 'Subscription link',
    'details.configLink': 'Config link',
    'details.qr': 'QR code',
    'common.loadError': 'Could not reach the app. Check that Whitelist Download is running.',
    'statsView.configs': 'Configs',
    'statsView.byCountry': 'Configs by country',
    'statsView.noData': 'No data yet',
    'logs.jumpLatest': 'Jump to latest',
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
    'statsView.paused': 'На паузе',

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
    'settings.sourcePlaceholder': 'Введите ссылку...',
    'settings.addSource': 'Добавить источник',
    'settings.removeSource': 'Удалить',
    'settings.levelNormalDesc': 'Проверка конфигураций с помощью пинга сервера [Быстро]',
    'settings.levelUltraDesc': 'Проверка конфигураций с помощью ядра sing-box, лучше пинга, но отсеивает больше конфигураций, которые могли быть рабочими [Медленно]',
    'settings.saving': 'Сохранение...',
    'settings.saved': 'Сохранено!',
    'settings.saveError': 'Ошибка',
    'settings.restartRequired': 'Требуется рестарт',
    'settings.close': 'Закрыть',
    'settings.updateConfigs': 'Обновить конфигурации',
    'settings.restartServer': 'Перезагрузить сервер',
    'settings.workingLevel': 'Уровень проверки конфигов',
    'settings.levelNormal': 'Обычный',
    'settings.levelUltra': 'Ультра',
    'settings.autosaveSaved': 'Все изменения сохранены',
    'settings.autosaveInvalid': 'Не сохранено: исправьте выделенные поля',
    'settings.autosaveError': 'Не удалось сохранить изменения',
    'settings.retry': 'Повторить',
    'settings.errName': 'Не должно быть пустым или содержать слэши',
    'settings.errPort': 'Введите порт от 1 до 65535',
    'settings.errSubPath': 'Должен начинаться с / и содержать только буквы, цифры и . _ ~ - (например, /sub)',
    'settings.errSubPathReserved': 'Этот путь занят дашбордом',
    'settings.errRequired': 'Поле обязательно',
    'settings.errInterval': 'Введите целое число минут от 1 до 10080',
    'settings.errForcedIp': 'Введите IP-адрес или имя хоста без пробелов',
    'settings.updates': 'Обновления приложения',
    'settings.autoUpdateMajor': 'Автоматически скачивать крупные обновления',
    'settings.autoUpdatePatch': 'Автоматически скачивать исправления багов и улучшения',
    'settings.autoBrowserOpen': 'Автоматически открывать браузер при запуске',
    'settings.appliedInstantly': 'Применяется сразу',
    'settings.autoRefresh': 'Автообновление конфигов',

    // Pause of configs auto-update
    'pause.active': 'Работает',
    'pause.paused': 'На паузе',
    'pause.activeDesc': 'Конфиги обновляются автоматически по расписанию',
    'pause.foreverDesc': 'Пауза до ручного возобновления',
    'pause.resumesAt': 'Возобновится в',
    'pause.resuming': 'Возобновление...',
    'pause.resume': 'Возобновить',
    'pause.pauseFor': 'Приостановить на',
    'pause.m15': '15 мин',
    'pause.h1': '1 час',
    'pause.h4': '4 часа',
    'pause.h24': '24 часа',
    'pause.forever': 'Навсегда',
    'pause.note': 'Кнопка «Обновить конфигурации» работает и во время паузы.',
    'pause.error': 'Не удалось изменить состояние автообновления. Попробуйте ещё раз.',
    'pause.badge': 'Обновления на паузе',
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
    
    'details.globalSub': 'Глобальная подписка',
    'details.sub': 'Подписка',
    'details.scanOrCopy': 'Отсканируйте QR-код или скопируйте ссылку в VPN-клиент.',
    'details.paginationConfig': 'Какие конфиги включить',
    'details.limit': 'Лимит',

    'details.unknownLocation': 'Неизвестная локация',
    'details.config': 'Конфиг',
    'details.protocol': 'Протокол',
    'details.port': 'Порт',
    'details.uuid': 'UUID',
    'details.parameters': 'Параметры',
    'details.parseError': 'Не удалось распознать конфигурацию.',

    'nav.main': 'Разделы',
    'nav.subscription': 'Подписка',
    'header.language': 'Язык',
    'theme.toLight': 'Светлая тема',
    'theme.toDark': 'Тёмная тема',
    'sidebar.emptyTitle': 'Конфигов пока нет',
    'sidebar.emptyText': 'Они появятся после первого обновления источников.',
    'sidebar.list': 'Конфиги',
    'details.back': 'Назад',
    'details.link': 'Ссылка на подписку',
    'details.configLink': 'Ссылка на конфиг',
    'details.qr': 'QR-код',
    'common.loadError': 'Нет связи с приложением. Проверьте, что Whitelist Download запущен.',
    'statsView.configs': 'Конфигов',
    'statsView.byCountry': 'Конфиги по странам',
    'statsView.noData': 'Данных пока нет',
    'logs.jumpLatest': 'К последним записям',
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
// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
