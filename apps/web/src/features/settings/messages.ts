import { defineMessages } from '../../i18n';

export const settingsMessages = defineMessages(
  {
    sections: {
      profile: 'Profile',
      business: 'Business',
      appearance: 'Appearance',
      language: 'Language',
      notifications: 'Notifications',
      system: 'System',
      deleteAccount: 'Delete account',
    },
    sectionsLabel: 'Settings sections',
    saveChanges: 'Save changes',
    page: {
      eyebrow: 'Settings',
      title: 'Settings',
      description: 'Your profile, business details and how Montra looks and notifies you.',
    },
    profile: {
      description: 'How you appear across Montra.',
      pending: 'Editing your profile arrives in a later release.',
      owner: 'Owner',
      viewer: 'Viewer',
      fullName: 'Full name',
      email: 'Email',
    },
    business: {
      description: 'Used for reports, exports and currency formatting.',
      pending: 'Changing these after setup arrives in a later release.',
      name: 'Business name',
      type: 'Business type',
      currency: 'Currency',
      currencyHint: 'Bulgaria uses the euro since 1 January 2026.',
      euro: 'Euro (€)',
      timeZone: 'Time zone',
    },
    appearance: {
      description: 'Dark is Montra’s signature theme; light suits bright rooms and printing.',
      theme: 'Theme',
      dark: 'Dark',
      light: 'Light',
      system: 'System',
    },
    language: {
      description:
        'The language of the interface, dates and figures. Your own entries stay as you typed them.',
    },
    notifications: {
      description: 'Choose what Montra tells you about. Saved on this device.',
      dueReminders: {
        title: 'Payment reminders',
        body: 'Two days before a supplier invoice or recurring payment is due.',
      },
      budgetAlerts: {
        title: 'Budget alerts',
        body: 'When a category reaches 90% of its monthly limit.',
      },
      lowBalance: {
        title: 'Low balance warnings',
        body: 'When the projected balance drops below your safety buffer.',
      },
      weeklySummary: {
        title: 'Weekly summary',
        body: 'A Monday email with last week’s cash flow and what’s coming up.',
      },
    },
    system: {
      description: 'Connection between this app, the API and the database.',
      status: 'Status',
      apiVersion: 'API version',
      financialData: 'Financial data',
      sampleData: 'Your transactions',
      open: 'Open system status',
    },
    deleteAccount: {
      description: 'Remove your account and everything it owns from Montra.',
      profileOnly: 'Your profile is deleted and you’re signed out on every device.',
      withBusinesses: (names: string) =>
        `Your profile is deleted and you’re signed out on every device. ${names} goes too, with all of its transactions and imports, unless it has another owner.`,
      irreversible: 'This cannot be undone.',
      open: 'Delete account…',
      dialogTitle: 'Delete your account?',
      password: 'Password',
      passwordHint: 'Enter your password to confirm it’s you.',
      passwordMissing: 'Enter your password.',
      confirm: 'Delete account',
      deleting: 'Deleting…',
    },
  },
  {
    sections: {
      profile: 'Профил',
      business: 'Бизнес',
      appearance: 'Външен вид',
      language: 'Език',
      notifications: 'Известия',
      system: 'Система',
      deleteAccount: 'Изтриване на профила',
    },
    sectionsLabel: 'Раздели на настройките',
    saveChanges: 'Запази промените',
    page: {
      eyebrow: 'Настройки',
      title: 'Настройки',
      description: 'Вашият профил, данните на бизнеса и как Montra изглежда и ви известява.',
    },
    profile: {
      description: 'Как се показвате в Montra.',
      pending: 'Редактирането на профила идва в следваща версия.',
      owner: 'Собственик',
      viewer: 'Наблюдател',
      fullName: 'Име и фамилия',
      email: 'Имейл',
    },
    business: {
      description: 'Използва се за отчети, експорти и форматиране на валутата.',
      pending: 'Промяната им след първоначалната настройка идва в следваща версия.',
      name: 'Име на бизнеса',
      type: 'Вид бизнес',
      currency: 'Валута',
      currencyHint: 'България използва еврото от 1 януари 2026 г.',
      euro: 'Евро (€)',
      timeZone: 'Часова зона',
    },
    appearance: {
      description:
        'Тъмната тема е запазената марка на Montra; светлата е удобна в светли стаи и при печат.',
      theme: 'Тема',
      dark: 'Тъмна',
      light: 'Светла',
      system: 'Като системата',
    },
    language: {
      description:
        'Езикът на интерфейса, датите и сумите. Вашите собствени записи остават така, както сте ги въвели.',
    },
    notifications: {
      description: 'Изберете за какво да ви известява Montra. Запазва се на това устройство.',
      dueReminders: {
        title: 'Напомняния за плащания',
        body: 'Два дни преди падежа на фактура от доставчик или повтарящо се плащане.',
      },
      budgetAlerts: {
        title: 'Сигнали за бюджета',
        body: 'Когато категория достигне 90% от месечния си лимит.',
      },
      lowBalance: {
        title: 'Предупреждения за нисък баланс',
        body: 'Когато прогнозният баланс падне под предпазния ви резерв.',
      },
      weeklySummary: {
        title: 'Седмично обобщение',
        body: 'Имейл всеки понеделник с паричния поток от миналата седмица и предстоящото.',
      },
    },
    system: {
      description: 'Връзката между това приложение, API и базата данни.',
      status: 'Състояние',
      apiVersion: 'Версия на API',
      financialData: 'Финансови данни',
      sampleData: 'Вашите транзакции',
      open: 'Отвори състоянието на системата',
    },
    deleteAccount: {
      description: 'Премахнете профила си и всичко, което притежава, от Montra.',
      profileOnly: 'Профилът ви се изтрива и излизате от всички устройства.',
      withBusinesses: (names: string) =>
        `Профилът ви се изтрива и излизате от всички устройства. ${names} също се изтрива, с всички транзакции и импорти, освен ако няма друг собственик.`,
      irreversible: 'Това действие е необратимо.',
      open: 'Изтрий профила…',
      dialogTitle: 'Да изтрием ли профила ви?',
      password: 'Парола',
      passwordHint: 'Въведете паролата си, за да потвърдите, че сте вие.',
      passwordMissing: 'Въведете паролата си.',
      confirm: 'Изтрий профила',
      deleting: 'Изтриване…',
    },
  },
);
