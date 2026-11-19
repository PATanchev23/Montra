import { defineMessages } from '../../i18n';

export const cashFlowMessages = defineMessages(
  {
    page: {
      eyebrow: 'Analysis',
      title: 'Cash flow',
      description:
        'Twelve months of your transactions and a 90-day projection built from your recurring payments and recent averages.',
      loadError: 'Could not load cash flow',
      bankBalance: 'Bank balance',
      noneRecurring:
        'No recurring payments found yet. Payments that repeat monthly appear here after three months.',
      chartOwner: 'Add your first transactions to see income and expenses month by month',
      balanceOwner: 'Your balance and its 90-day projection appear once you add transactions',
      noUpcoming: 'No upcoming payments yet',
    },
    note: {
      from: (amount: string, date: string) =>
        `Balances start from ${amount} in the bank on ${date}, then follow your transactions.`,
      unsetOwner:
        'Balances start from 0 until you enter what is in the bank today. Your transactions then carry it forward.',
      unsetViewer: 'Balances start from 0: the owner has not entered the bank balance yet.',
      set: 'Enter bank balance',
    },
    settings: {
      title: 'Bank balance',
      description: 'What a transaction file cannot tell Montra. Projections start from it.',
      balance: (currency: string) => `Bank balance today (${currency})`,
      balanceHint:
        'All your business accounts together. Use a minus sign if overdrawn. Leave empty to start from 0.',
      threshold: (currency: string) => `Warn me below (${currency})`,
      thresholdHint: 'Optional. You are warned when the projected balance drops below it.',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      saved: 'Bank balance saved',
    },
    stats: {
      opening: 'Opening balance',
      moneyIn: 'Money in',
      moneyOut: 'Money out',
      last12: 'Last 12 months',
      today: 'Balance today',
      projected: 'Projected',
      in90: 'In 90 days',
    },
    monthly: {
      title: 'Income vs. expenses',
      description: 'Monthly totals · the last three months are projected from your history',
      income: 'Income',
      expenses: 'Expenses',
      projected: 'Projected',
      chart: 'Monthly income and expenses, with three projected months',
      projectedSuffix: ' · projected',
      net: 'Net',
    },
    balance: {
      title: 'Balance & projection',
      description:
        'Daily balance for the last five months, then the expected path with its likely range',
      balance: 'Balance',
      projection: 'Projection',
      range: 'Likely range',
      chart: 'Daily cash balance with a 90-day projection',
      today: 'Today',
      buffer: (amount: string) => `Safety buffer ${amount}`,
      lowest: 'Lowest projected balance',
      on: (date: string) => `on ${date}`,
      headroom: 'Headroom above buffer',
      change: 'Change over 90 days',
      noBuffer: 'No warning level set',
    },
    upcoming: {
      title: 'Next 30 days',
      description:
        'Payments that repeat every month and transactions dated ahead, with the projected balance after each',
      in: 'In',
      out: 'Out',
      due: 'Due',
      item: 'Item',
      basis: 'Basis',
      amount: 'Amount',
      after: 'Balance after',
      scheduled: 'Scheduled',
      estimated: 'Estimated',
      showFewer: 'Show fewer',
      showAll: (n: number) => `Show all ${n}`,
    },
  },
  {
    page: {
      eyebrow: 'Анализ',
      title: 'Паричен поток',
      description:
        'Дванадесет месеца от вашите транзакции и прогноза за 90 дни, изградена от повтарящите се плащания и скорошните средни стойности.',
      loadError: 'Паричният поток не може да се зареди',
      bankBalance: 'Наличност в банката',
      noneRecurring:
        'Все още няма открити повтарящи се плащания. Плащанията, които се повтарят всеки месец, се появяват тук след три месеца.',
      chartOwner: 'Добавете първите си транзакции, за да видите приходите и разходите по месеци',
      balanceOwner: 'Наличността и прогнозата за 90 дни се появяват, щом добавите транзакции',
      noUpcoming: 'Все още няма предстоящи плащания',
    },
    note: {
      from: (amount: string, date: string) =>
        `Балансът започва от ${amount} в банката на ${date}, след което следва вашите транзакции.`,
      unsetOwner:
        'Балансът започва от 0, докато не въведете колко има в банката днес. След това транзакциите ви го продължават.',
      unsetViewer: 'Балансът започва от 0: собственикът още не е въвел наличността в банката.',
      set: 'Въведи наличност',
    },
    settings: {
      title: 'Наличност в банката',
      description:
        'Това, което файлът с транзакции не може да каже на Montra. Прогнозите започват от него.',
      balance: (currency: string) => `Наличност в банката днес (${currency})`,
      balanceHint:
        'Всички фирмени сметки заедно. Използвайте знак минус при овърдрафт. Оставете празно, за да започнете от 0.',
      threshold: (currency: string) => `Предупреди ме под (${currency})`,
      thresholdHint:
        'По избор. Получавате предупреждение, когато прогнозният баланс падне под него.',
      save: 'Запази',
      saving: 'Запазване…',
      cancel: 'Отказ',
      saved: 'Наличността е запазена',
    },
    stats: {
      opening: 'Начален баланс',
      moneyIn: 'Постъпления',
      moneyOut: 'Плащания',
      last12: 'За 12 месеца',
      today: 'Баланс днес',
      projected: 'Прогноза',
      in90: 'След 90 дни',
    },
    monthly: {
      title: 'Приходи и разходи',
      description: 'Месечни суми · последните три месеца са прогноза въз основа на историята ви',
      income: 'Приходи',
      expenses: 'Разходи',
      projected: 'Прогноза',
      chart: 'Месечни приходи и разходи, с три прогнозни месеца',
      projectedSuffix: ' · прогноза',
      net: 'Нетно',
    },
    balance: {
      title: 'Баланс и прогноза',
      description:
        'Дневен баланс за последните пет месеца, след това очакваният ход с вероятния диапазон',
      balance: 'Баланс',
      projection: 'Прогноза',
      range: 'Вероятен диапазон',
      chart: 'Дневен паричен баланс с прогноза за 90 дни',
      today: 'Днес',
      buffer: (amount: string) => `Предпазен резерв ${amount}`,
      lowest: 'Най-нисък прогнозен баланс',
      on: (date: string) => `на ${date}`,
      headroom: 'Запас над резерва',
      change: 'Промяна за 90 дни',
      noBuffer: 'Няма зададено ниво за предупреждение',
    },
    upcoming: {
      title: 'Следващите 30 дни',
      description:
        'Плащания, които се повтарят всеки месец, и транзакции с бъдеща дата, с прогнозния баланс след всяко',
      in: 'Постъпления',
      out: 'Плащания',
      due: 'Падеж',
      item: 'Позиция',
      basis: 'Основание',
      amount: 'Сума',
      after: 'Остатък',
      scheduled: 'Планирано',
      estimated: 'Прогнозно',
      showFewer: 'Покажи по-малко',
      showAll: (n: number) => `Покажи всички ${n}`,
    },
  },
);
