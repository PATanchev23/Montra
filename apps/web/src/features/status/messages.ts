import { defineMessages } from '../../i18n';

/** Vite's standard build modes in Bulgarian. */
const BULGARIAN_MODES: Record<string, string> = {
  development: 'Разработка',
  production: 'Продукция',
  test: 'Тест',
};

export const statusMessages = defineMessages(
  {
    headline: {
      unreachable: 'The API is unreachable',
      erroring: 'The API is returning errors',
      checking: 'Checking connections…',
      databaseDown: 'The database is unreachable',
      operational: 'All systems operational',
    },
    uptime: {
      days: (d: number, h: number) => `${d}d ${h}h`,
      hours: (h: number, m: number) => `${h}h ${m}m`,
      minutes: (m: number) => `${m}m`,
      seconds: (s: number) => `${s}s`,
    },
    tier: { up: 'Connected', degraded: 'Degraded', down: 'Unreachable', unknown: 'Unknown' },
    page: {
      eyebrow: 'System',
      title: 'System status',
      description: 'Montra runs as three separate tiers. This page checks every link in the chain.',
      checkNow: 'Check now',
      lastChecked: (time: string) => `Last checked ${time}`,
      waiting: 'Waiting for first check',
      refreshes: ' · refreshes every 15 s',
      path: 'Request path',
      web: 'Web client',
      api: 'API server',
      database: 'Database',
      mode: 'Mode',
      /** Vite's build mode; a custom mode (vite --mode staging) is shown as named. */
      modeName: (mode: string) => mode,
      milliseconds: (ms: number) => `${ms} ms`,
      roundTrip: 'Round trip',
      version: 'Version',
      uptime: 'Uptime',
      query: 'Query',
      browserCalls: 'The browser calls',
      apiQueries: ', and the API runs a query against PostgreSQL before it answers.',
      reference: 'API reference',
    },
  },
  {
    headline: {
      unreachable: 'Няма връзка с API',
      erroring: 'API връща грешки',
      checking: 'Връзките се проверяват…',
      databaseDown: 'Няма връзка с базата данни',
      operational: 'Всички системи работят',
    },
    uptime: {
      days: (d: number, h: number) => `${d} д ${h} ч`,
      hours: (h: number, m: number) => `${h} ч ${m} мин`,
      minutes: (m: number) => `${m} мин`,
      seconds: (s: number) => `${s} с`,
    },
    tier: { up: 'Свързан', degraded: 'Влошен', down: 'Недостъпен', unknown: 'Неизвестно' },
    page: {
      eyebrow: 'Система',
      title: 'Състояние на системата',
      description:
        'Montra работи като три отделни слоя. Тази страница проверява всяка връзка по веригата.',
      checkNow: 'Провери сега',
      lastChecked: (time: string) => `Последна проверка в ${time}`,
      waiting: 'Изчаква първата проверка',
      refreshes: ' · обновява се на всеки 15 с',
      path: 'Път на заявката',
      web: 'Уеб клиент',
      api: 'API сървър',
      database: 'База данни',
      mode: 'Режим',
      modeName: (mode: string) => BULGARIAN_MODES[mode] ?? mode,
      milliseconds: (ms: number) => `${ms} мс`,
      roundTrip: 'Време за отговор',
      version: 'Версия',
      uptime: 'Време на работа',
      query: 'Заявка',
      browserCalls: 'Браузърът извиква',
      apiQueries: ', а API изпълнява заявка към PostgreSQL, преди да отговори.',
      reference: 'Документация на API',
    },
  },
);
