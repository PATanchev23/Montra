import { defineMessages } from '../../i18n';

type Interval = 'day' | 'week' | 'month';

export const dashboardMessages = defineMessages(
  {
    quickRanges: { '7d': '7 days', '30d': '30 days', '90d': '90 days' },
    periods: {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      month: 'This month',
      'last-month': 'Last month',
      custom: 'Custom range',
    },
    rolling: (days: number) => ({
      label: `Last ${days} days`,
      phrase: `in the last ${days} days`,
      comparison: `vs. previous ${days} days`,
    }),
    thisMonth: { phrase: 'this month so far', comparison: 'vs. same days last month' },
    lastMonth: (month: string, previousMonth: string) => ({
      phrase: `in ${month}`,
      comparison: `vs. ${previousMonth}`,
    }),
    custom: (range: string, days: number) => ({
      phrase: `${days === 1 ? 'on' : 'over'} ${range}`,
      comparison: `vs. previous ${days} day${days === 1 ? '' : 's'}`,
    }),
    rangeStartMissing: 'Choose a start and an end date.',
    rangeReversed: 'The start date is after the end date.',
    header: {
      performed: (business: string, phrase: string) =>
        `Here’s how ${business} performed ${phrase}.`,
      doing: (business: string) => `Here’s how ${business} is doing.`,
      startOwner: (business: string) =>
        `Add your first transactions to see how ${business} is doing.`,
      startViewer: 'No transactions yet.',
      import: 'Import',
      addTransaction: 'Add transaction',
      transactions: (n: string, count: number) => `${n} transaction${count === 1 ? '' : 's'}`,
      fromDate: 'From date',
      to: 'to',
      toDate: 'To date',
      quickPeriod: 'Quick period',
    },
    states: {
      checkRange: 'Check the date range',
      loadError: 'Could not load the dashboard',
    },
    picker: {
      title: 'Reporting period',
      trigger: (label: string) => `Reporting period: ${label}`,
      chooseDates: 'Choose dates on the dashboard',
    },
    thousandsSuffix: 'k',
    kpi: { net: 'Net cash flow', income: 'Income', expenses: 'Expenses' },
    overview: {
      title: 'Cash flow overview',
      fallback: 'Income and expenses over the period',
      summary: (
        total: string,
        measure: 'income' | 'expenses',
        average: string,
        interval: Interval,
      ) =>
        `${total} ${measure === 'income' ? 'earned' : 'spent'} · ${average} ${
          { day: 'daily', week: 'weekly', month: 'monthly' }[interval]
        } average`,
      measure: 'Measure',
      income: 'Income',
      expenses: 'Expenses',
      net: 'Net',
      chartLabel: (measure: string, interval: Interval, period: string) =>
        `${measure} by ${interval}, ${period}`,
      describe: (title: string, income: string, expenses: string, net: string) =>
        `${title}: income ${income}, expenses ${expenses}, net ${net}.`,
      noTransactions: 'No transactions in this period.',
      firstTransactions: 'Add your first transactions to see your daily cash flow',
      noTransactionsYet: 'No transactions yet',
    },
    panels: {
      viewAll: 'View all',
      breakdown: 'Expense breakdown',
      otherCategories: 'Other categories',
      noExpenses: 'No expenses in this period.',
      noExpensesYet: 'No expenses yet',
      expensesByCategory: 'Expenses by category',
      expenseCategories: 'Expense categories',
      total: 'Total',
      recent: 'Recent transactions',
      recentHint: 'Newest first, whatever the period',
      viewAllTransactions: 'View all transactions',
      noneRecorded: 'No transactions recorded yet.',
      latest: 'Latest transactions',
      upcoming: 'Upcoming payments',
      viewAllUpcoming: 'View all upcoming payments',
      upcomingError: 'Could not load upcoming payments',
      nothingDue: 'No recurring payments are due in the next 30 days.',
      upcomingHint: 'Recurring payments from your transactions',
      upcomingStart: 'Payments due in the next 30 days will appear here.',
      estimated: 'est. · ',
      scenario: 'Scenario preview',
      viewAllScenarios: 'View all scenarios',
      scenarioError: 'Could not load the scenario',
      scenarioHint: 'Tested against your own forecast',
      noScenario: 'Scenarios appear once there are transactions to forecast from.',
      currentPlan: 'Current plan',
      balanceIn: (days: number) => `Balance in ${days} days`,
      vsPlan: 'vs. plan',
      assumptions: 'Assumptions',
      run: 'Run simulation',
      scenarioStart:
        'Once your transactions are in, you can test a decision here before you make it.',
    },
  },
  {
    quickRanges: { '7d': '7 дни', '30d': '30 дни', '90d': '90 дни' },
    periods: {
      '7d': 'Последните 7 дни',
      '30d': 'Последните 30 дни',
      '90d': 'Последните 90 дни',
      month: 'Този месец',
      'last-month': 'Миналия месец',
      custom: 'Избран период',
    },
    rolling: (days: number) => ({
      label: `Последните ${days} дни`,
      phrase: `през последните ${days} дни`,
      comparison: `спрямо предходните ${days} дни`,
    }),
    thisMonth: { phrase: 'досега този месец', comparison: 'спрямо същите дни на миналия месец' },
    lastMonth: (month: string, previousMonth: string) => ({
      phrase: `през ${month}`,
      comparison: `спрямо ${previousMonth}`,
    }),
    custom: (range: string, days: number) => ({
      phrase: `${days === 1 ? 'на' : 'за периода'} ${range}`,
      comparison: days === 1 ? 'спрямо предходния ден' : `спрямо предходните ${days} дни`,
    }),
    rangeStartMissing: 'Изберете начална и крайна дата.',
    rangeReversed: 'Началната дата е след крайната.',
    header: {
      performed: (business: string, phrase: string) =>
        `Ето как се представи ${business} ${phrase}.`,
      doing: (business: string) => `Ето как се справя ${business}.`,
      startOwner: (business: string) =>
        `Добавете първите си транзакции, за да видите как се справя ${business}.`,
      startViewer: 'Все още няма транзакции.',
      import: 'Импорт',
      addTransaction: 'Добави транзакция',
      transactions: (n: string, count: number) =>
        `${n} ${count === 1 ? 'транзакция' : 'транзакции'}`,
      fromDate: 'Начална дата',
      to: 'до',
      toDate: 'Крайна дата',
      quickPeriod: 'Бърз избор на период',
    },
    states: {
      checkRange: 'Проверете периода',
      loadError: 'Таблото не може да се зареди',
    },
    picker: {
      title: 'Отчетен период',
      trigger: (label: string) => `Отчетен период: ${label}`,
      chooseDates: 'Изберете дати на таблото',
    },
    thousandsSuffix: ' хил.',
    kpi: { net: 'Нетен паричен поток', income: 'Приходи', expenses: 'Разходи' },
    overview: {
      title: 'Паричен поток',
      fallback: 'Приходи и разходи за периода',
      summary: (
        total: string,
        measure: 'income' | 'expenses',
        average: string,
        interval: Interval,
      ) =>
        `${total} ${measure === 'income' ? 'приходи' : 'разходи'} · средно ${average} ${
          { day: 'на ден', week: 'на седмица', month: 'на месец' }[interval]
        }`,
      measure: 'Показател',
      income: 'Приходи',
      expenses: 'Разходи',
      net: 'Нетно',
      chartLabel: (measure: string, interval: Interval, period: string) =>
        `${measure} по ${{ day: 'дни', week: 'седмици', month: 'месеци' }[interval]}, ${period}`,
      describe: (title: string, income: string, expenses: string, net: string) =>
        `${title}: приходи ${income}, разходи ${expenses}, нетно ${net}.`,
      noTransactions: 'Няма транзакции за този период.',
      firstTransactions: 'Добавете първите си транзакции, за да видите дневния си паричен поток',
      noTransactionsYet: 'Все още няма транзакции',
    },
    panels: {
      viewAll: 'Виж всички',
      breakdown: 'Разходи по категории',
      otherCategories: 'Други категории',
      noExpenses: 'Няма разходи за този период.',
      noExpensesYet: 'Все още няма разходи',
      expensesByCategory: 'Разходи по категории',
      expenseCategories: 'Категории разходи',
      total: 'Общо',
      recent: 'Последни транзакции',
      recentHint: 'Най-новите първо, независимо от периода',
      viewAllTransactions: 'Виж всички транзакции',
      noneRecorded: 'Все още няма записани транзакции.',
      latest: 'Последни транзакции',
      upcoming: 'Предстоящи плащания',
      viewAllUpcoming: 'Виж всички предстоящи плащания',
      upcomingError: 'Предстоящите плащания не могат да се заредят',
      nothingDue: 'Няма повтарящи се плащания през следващите 30 дни.',
      upcomingHint: 'Повтарящи се плащания от вашите транзакции',
      upcomingStart: 'Тук ще се показват плащанията за следващите 30 дни.',
      estimated: 'прибл. · ',
      scenario: 'Преглед на сценарий',
      viewAllScenarios: 'Виж всички сценарии',
      scenarioError: 'Сценарият не може да се зареди',
      scenarioHint: 'Изпробван спрямо собствената ви прогноза',
      noScenario: 'Сценариите се появяват, щом има транзакции, от които да се прогнозира.',
      currentPlan: 'Текущ план',
      balanceIn: (days: number) => `Баланс след ${days} дни`,
      vsPlan: 'спрямо плана',
      assumptions: 'Допускания',
      run: 'Пусни симулацията',
      scenarioStart:
        'Щом транзакциите ви са тук, ще можете да тествате решение, преди да го вземете.',
    },
  },
);
