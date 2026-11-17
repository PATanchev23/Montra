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
      transactions: (n: string, count: number) => `${n} transaction${count === 1 ? '' : 's'}`,
      fromDate: 'From date',
      to: 'to',
      toDate: 'To date',
      quickPeriod: 'Quick period',
    },
    states: {
      checkRange: 'Check the date range',
      loadError: 'Could not load the dashboard',
      empty: 'No transactions yet',
      emptyOwner: 'Your dashboard fills in as soon as you record a payment or import your history.',
      emptyViewer: 'The dashboard fills in once the business owner records transactions.',
      addOrImport: 'Add or import transactions',
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
    },
    panels: {
      viewAll: 'View all',
      sampleNote:
        'Deterministic TechStore sample data, not this business’s own figures. Live data arrives with the financial API.',
      sampleAsOf: (date: string) => `Sample data · as of ${date}`,
      sampleAsOfLong: (date: string, note: string) => `Sample data as of ${date}. ${note}`,
      breakdown: 'Expense breakdown',
      otherCategories: 'Other categories',
      noExpenses: 'No expenses in this period.',
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
      nothingDue: 'Nothing is due in the next 30 days.',
      estimated: 'est. · ',
      scenario: 'Scenario preview',
      viewAllScenarios: 'View all scenarios',
      scenarioError: 'Could not load the scenario',
      currentPlan: 'Current plan',
      balanceIn: (days: number) => `Balance in ${days} days`,
      vsPlan: 'vs. plan',
      assumptions: 'Assumptions',
      run: 'Run simulation',
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
      empty: 'Все още няма транзакции',
      emptyOwner:
        'Таблото ви се попълва веднага щом запишете плащане или импортирате историята си.',
      emptyViewer: 'Таблото се попълва, когато собственикът на бизнеса запише транзакции.',
      addOrImport: 'Добавете или импортирайте транзакции',
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
    },
    panels: {
      viewAll: 'Виж всички',
      sampleNote:
        'Постоянни примерни данни на TechStore, а не собствените данни на този бизнес. Реалните данни идват с финансовия API.',
      sampleAsOf: (date: string) => `Примерни данни · към ${date}`,
      sampleAsOfLong: (date: string, note: string) => `Примерни данни към ${date}. ${note}`,
      breakdown: 'Разходи по категории',
      otherCategories: 'Други категории',
      noExpenses: 'Няма разходи за този период.',
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
      nothingDue: 'Нищо не е дължимо през следващите 30 дни.',
      estimated: 'прибл. · ',
      scenario: 'Преглед на сценарий',
      viewAllScenarios: 'Виж всички сценарии',
      scenarioError: 'Сценарият не може да се зареди',
      currentPlan: 'Текущ план',
      balanceIn: (days: number) => `Баланс след ${days} дни`,
      vsPlan: 'спрямо плана',
      assumptions: 'Допускания',
      run: 'Пусни симулацията',
    },
  },
);
