import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

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
    'settings.interval': 'Update interval',
    'settings.sourcePlaceholder': 'Enter URL...',
    'settings.addSource': 'Add Source',
    'settings.removeSource': 'Remove',
    'settings.levelNormalDesc': 'Checking configurations using server ping [Fast]',
    'settings.levelUltraDesc': 'Checking configurations using sing-box core, better than ping, but filters out more configurations that might have been working [Slow]',
    'settings.saving': 'Saving changes…',
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
    'sidebar.loading': 'Loading…',
    
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
    'settings.updateConfigsShort': 'Update',
    'settings.restartServerShort': 'Restart',
    'settings.intervalUnit': 'min',
    'settings.intervalHint': 'From 1 minute to 7 days',
    'settings.intervalPresets': 'Quick values',
    'settings.errIntervalEmpty': 'Enter the interval in minutes',
    'settings.errIntervalDigits': 'Digits only: a whole number of minutes',
    'settings.errIntervalMin': 'The shortest interval is 1 minute',
    'settings.errIntervalMax': 'The longest interval is 10080 minutes (7 days)',
    'unit.minutes': 'min',
    'unit.hours': 'h',
    'import.title': 'Import configs',
    'import.description': 'Download configs as a .txt file to import them into a VPN client.',
    'import.country': 'Country',
    'import.allCountries': 'All countries',
    'import.count': 'Count',
    'import.countPlaceholder': 'All',
    'import.countHint': 'Empty — all configs',
    'import.offset': 'Offset',
    'import.offsetHint': 'How many configs to skip from the start',
    'import.fileName': 'File name',
    'import.fileNameReset': 'Name after the filters',
    'import.download': 'Download',
    'import.downloading': 'Preparing…',
    'import.done': 'Downloaded',
    'import.available': 'Available',
    'import.empty': 'No configs match these filters. Lower the offset or choose another country.',
    'import.error': 'Could not get the configs. Check that the app is running and try again.',
    'import.errCount': 'Enter a whole number greater than 0',
    'import.errOffset': 'Enter a whole number, 0 or more',
    'import.errOffsetTooBig': 'The offset skips all available configs',
    'import.errFileName': 'The name must not be empty or contain \\ / : * ? " < > |',
    'import.countriesError': 'Could not load the countries',
    'sidebar.refreshed': 'The config list has been updated',
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
    'settings.interval': 'Интервал обновления',
    'settings.sourcePlaceholder': 'Введите ссылку...',
    'settings.addSource': 'Добавить источник',
    'settings.removeSource': 'Удалить',
    'settings.levelNormalDesc': 'Проверка конфигураций с помощью пинга сервера [Быстро]',
    'settings.levelUltraDesc': 'Проверка конфигураций с помощью ядра sing-box, лучше пинга, но отсеивает больше конфигураций, которые могли быть рабочими [Медленно]',
    'settings.saving': 'Сохранение изменений…',
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
    'sidebar.loading': 'Загрузка…',
    
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
    'settings.updateConfigsShort': 'Обновить',
    'settings.restartServerShort': 'Перезапуск',
    'settings.intervalUnit': 'мин',
    'settings.intervalHint': 'От 1 минуты до 7 дней',
    'settings.intervalPresets': 'Быстрый выбор',
    'settings.errIntervalEmpty': 'Укажите интервал в минутах',
    'settings.errIntervalDigits': 'Только цифры: целое число минут',
    'settings.errIntervalMin': 'Минимальный интервал — 1 минута',
    'settings.errIntervalMax': 'Максимальный интервал — 10080 минут (7 дней)',
    'unit.minutes': 'мин',
    'unit.hours': 'ч',
    'import.title': 'Импорт конфигов',
    'import.description': 'Скачайте конфиги файлом .txt, чтобы импортировать их в VPN-клиент.',
    'import.country': 'Страна',
    'import.allCountries': 'Все страны',
    'import.count': 'Количество',
    'import.countPlaceholder': 'Все',
    'import.countHint': 'Пусто — все конфиги',
    'import.offset': 'Смещение',
    'import.offsetHint': 'Сколько конфигов пропустить с начала',
    'import.fileName': 'Имя файла',
    'import.fileNameReset': 'Имя по фильтрам',
    'import.download': 'Скачать',
    'import.downloading': 'Подготовка…',
    'import.done': 'Скачано',
    'import.available': 'Доступно',
    'import.empty': 'По этим фильтрам конфигов нет. Уменьшите смещение или выберите другую страну.',
    'import.error': 'Не удалось получить конфиги. Проверьте, что приложение запущено, и попробуйте ещё раз.',
    'import.errCount': 'Введите целое число больше 0',
    'import.errOffset': 'Введите целое число от 0',
    'import.errOffsetTooBig': 'Смещение пропускает все доступные конфиги',
    'import.errFileName': 'Имя не должно быть пустым и содержать \\ / : * ? " < > |',
    'import.countriesError': 'Не удалось загрузить список стран',
    'sidebar.refreshed': 'Список конфигов обновлён',
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
 * Reads saved language preference from localStorage; defaults to Russian.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('wl-language');
    } catch {
      // Storage is unavailable (private mode, blocked site data): use the default
    }
    return (saved === 'ru' || saved === 'en') ? saved : 'ru';
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /** Updates current language and persists to localStorage */
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('wl-language', lang);
    } catch {
      // Not remembered, but still applied
    }
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
