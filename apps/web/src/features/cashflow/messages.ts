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
      mismatchTitle: 'Your bank balance and your transactions don’t add up',
      mismatch: (since: string, net: string, balance: string, on: string, start: string) =>
        `Since ${since} your transactions bring in ${net} more than they pay out, but the bank held ${balance} on ${on}. For both to be true, you would have started at ${start}.`,
      mismatchOwner: (balance: string, since: string) =>
        `If ${balance} was what you had before ${since}, choose “When my records start” in Update bank balance. Otherwise some money left that isn’t in your transactions (owner withdrawals, transfers to savings, loan payments), or the balance needs updating.`,
      mismatchViewer:
        'Usually some money left that isn’t in the transactions, or the owner needs to update the balance.',
      update: 'Update bank balance',
    },
    settings: {
      title: 'Bank balance',
      description: 'What is in your business accounts today, all together.',
      balance: (currency: string) => `Bank balance today (${currency})`,
      balanceBefore: (currency: string, first: string) =>
        `Bank balance before ${first} (${currency})`,
      balanceOn: (currency: string) => `Bank balance on a date (${currency})`,
      asOf: 'When the balance was true',
      asOfToday: 'Today',
      asOfStart: 'When my records start',
      asOfOther: 'Another date',
      dateLabel: 'Date of the balance',
      pickDate: 'Choose the date this balance was true.',
      startPreview: (amount: string, first: string) =>
        `Your records start from ${amount} before ${first}; your transactions carry it forward to today.`,
      otherPreview: (amount: string, date: string) =>
        `${amount} at the end of ${date}, after that day’s transactions; everything before and after is counted from there.`,
      firstDayHint: (date: string) =>
        `Your records start on ${date}. If this was the balance before that day’s transactions, choose “When my records start”.`,
      balancePreview: (amount: string) => `Projections start from ${amount} today.`,
      balanceEmpty: 'Empty: balances start from 0.',
      balanceHint: 'Use a minus sign if overdrawn.',
      threshold: (currency: string) => `Warn me below (${currency})`,
      thresholdPlaceholder: 'Optional',
      thresholdEmpty: 'No warning. Enter an amount to be told before cash runs low.',
      thresholdPreview: (amount: string) =>
        `You will be warned if the projected balance drops below ${amount}.`,
      headroom: (amount: string) => `${amount} of room before the warning.`,
      alreadyBelow: 'Your balance is already below this level, so the warning shows right away.',
      meterWarning: (amount: string) => `Warning ${amount}`,
      meterBalance: (amount: string) => `Balance ${amount}`,
      lastSaved: (amount: string, date: string) => `Last saved: ${amount} on ${date}`,
      neverSaved: 'Not saved before',
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
      mismatchTitle: 'Наличността в банката и транзакциите ви не се връзват',
      mismatch: (since: string, net: string, balance: string, on: string, start: string) =>
        `От ${since} транзакциите ви носят с ${net} повече, отколкото плащат, но в банката е имало ${balance} на ${on}. За да са верни и двете, бихте започнали от ${start}.`,
      mismatchOwner: (balance: string, since: string) =>
        `Ако ${balance} е била наличността ви преди ${since}, изберете „Началото на записите“ в „Обнови наличността“. Иначе са излезли пари, които ги няма в транзакциите (тегления от собственика, преводи към спестовна сметка, вноски по заем), или наличността трябва да се обнови.`,
      mismatchViewer:
        'Обикновено това означава, че са излезли пари, които ги няма в транзакциите, или че собственикът трябва да обнови наличността.',
      update: 'Обнови наличността',
    },
    settings: {
      title: 'Наличност в банката',
      description: 'Колко има по фирмените ви сметки днес, общо.',
      balance: (currency: string) => `Наличност в банката днес (${currency})`,
      balanceBefore: (currency: string, first: string) =>
        `Наличност в банката преди ${first} (${currency})`,
      balanceOn: (currency: string) => `Наличност в банката на дата (${currency})`,
      asOf: 'Към кога е наличността',
      asOfToday: 'Днес',
      asOfStart: 'Началото на записите',
      asOfOther: 'Друга дата',
      dateLabel: 'Дата на наличността',
      pickDate: 'Изберете датата, към която е тази наличност.',
      startPreview: (amount: string, first: string) =>
        `Записите ви започват от ${amount} преди ${first}; транзакциите ви я пренасят до днес.`,
      otherPreview: (amount: string, date: string) =>
        `${amount} в края на ${date}, след транзакциите от този ден; всичко преди и след това се отчита оттам.`,
      firstDayHint: (date: string) =>
        `Записите ви започват на ${date}. Ако това е била наличността преди транзакциите от този ден, изберете „Началото на записите“.`,
      balancePreview: (amount: string) => `Прогнозите започват от ${amount} днес.`,
      balanceEmpty: 'Празно: балансите започват от 0.',
      balanceHint: 'Използвайте знак минус при овърдрафт.',
      threshold: (currency: string) => `Предупреди ме под (${currency})`,
      thresholdPlaceholder: 'По избор',
      thresholdEmpty:
        'Без предупреждение. Въведете сума, за да научите навреме, преди парите да намалеят.',
      thresholdPreview: (amount: string) =>
        `Ще получите предупреждение, ако прогнозният баланс падне под ${amount}.`,
      headroom: (amount: string) => `${amount} запас до предупреждението.`,
      alreadyBelow:
        'Наличността ви вече е под това ниво, така че предупреждението се показва веднага.',
      meterWarning: (amount: string) => `Предупреждение ${amount}`,
      meterBalance: (amount: string) => `Наличност ${amount}`,
      lastSaved: (amount: string, date: string) => `Последно запазено: ${amount} на ${date}`,
      neverSaved: 'Не е запазвано досега',
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
