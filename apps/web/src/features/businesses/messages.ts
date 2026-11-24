import { defineMessages } from '../../i18n';

export const businessMessages = defineMessages(
  {
    switcher: {
      label: (name: string) => `Business: ${name}. Switch business`,
      heading: 'Your businesses',
      owner: 'Owner',
      viewer: 'Viewer',
      add: 'Add business',
      addHint: (owned: number, limit: number) => `${owned} of ${limit} on your plan`,
      upgrade: 'Add more businesses',
      upgradeHint: 'Pro: up to 3 · Business: up to 5',
      settings: 'Business settings',
    },
    create: {
      title: 'Add a business',
      description:
        'Its books are kept apart from your other businesses: its own transactions, budgets and forecast.',
      allowance: (owned: number, limit: number) =>
        `You own ${owned} of the ${limit} businesses your plan includes.`,
      details: 'About the business',
      detailsHint: 'Its name, what it sells, and the currency and time zone it keeps its books in.',
      preferences: 'Money settings',
      preferencesHint: 'All optional, and all can be changed later in Settings.',
      submit: 'Create business',
      submitting: 'Creating…',
      cancel: 'Cancel',
      created: (name: string) => `${name} is ready`,
      createdBody: 'You are now looking at its dashboard.',
      failed: 'Could not create the business',
      limitTitle: 'You have reached your plan’s business limit',
      limitBody: (limit: number) =>
        limit === 1
          ? 'Your plan includes one business. Pro includes up to 3, and Business up to 5.'
          : `Your plan includes up to ${limit} businesses, and you own that many already.`,
      seePlans: 'See plans',
      viewerTitle: 'Only business owners can add a business',
      viewerBody:
        'You can open the businesses shared with you, but not create one from this account.',
      back: 'Back to the dashboard',
    },
  },
  {
    switcher: {
      label: (name: string) => `Бизнес: ${name}. Смяна на бизнеса`,
      heading: 'Вашите бизнеси',
      owner: 'Собственик',
      viewer: 'Наблюдател',
      add: 'Добави бизнес',
      addHint: (owned: number, limit: number) => `${owned} от ${limit} в плана ви`,
      upgrade: 'Добавете още бизнеси',
      upgradeHint: 'Pro: до 3 · Business: до 5',
      settings: 'Настройки на бизнеса',
    },
    create: {
      title: 'Добавяне на бизнес',
      description:
        'Счетоводството му се води отделно от другите ви бизнеси: собствени транзакции, бюджети и прогноза.',
      allowance: (owned: number, limit: number) =>
        `Притежавате ${owned} от ${limit} бизнеса, включени в плана ви.`,
      details: 'За бизнеса',
      detailsHint:
        'Име, какво продава, и валутата и часовата зона, в които води счетоводството си.',
      preferences: 'Финансови настройки',
      preferencesHint: 'Всички са по желание и могат да се променят по-късно в Настройки.',
      submit: 'Създай бизнеса',
      submitting: 'Създаване…',
      cancel: 'Отказ',
      created: (name: string) => `${name} е готов`,
      createdBody: 'Вече гледате неговото табло.',
      failed: 'Бизнесът не може да се създаде',
      limitTitle: 'Достигнахте лимита за бизнеси в плана си',
      limitBody: (limit: number) =>
        limit === 1
          ? 'Планът ви включва един бизнес. Pro включва до 3, а Business – до 5.'
          : `Планът ви включва до ${limit} бизнеса и вече притежавате толкова.`,
      seePlans: 'Виж плановете',
      viewerTitle: 'Само собственици на бизнес могат да добавят бизнес',
      viewerBody:
        'Можете да отваряте бизнесите, споделени с вас, но не и да създавате бизнес от този профил.',
      back: 'Обратно към таблото',
    },
  },
);
