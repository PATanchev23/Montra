import type { IndustryKind } from '@montra/shared';
import { defineMessages } from '../../i18n';

export const simulationMessages = defineMessages(
  {
    page: {
      eyebrow: 'Planning',
      title: 'Simulations',
      description:
        'Test a decision before you make it. Each scenario is compared with your current plan over the next 90 days.',
      new: 'New scenario',
      noScenariosHint:
        'Scenarios are built from your own figures. They appear here once there are a few months of transactions to read.',
      loadError: 'Could not load scenarios',
      noScenarios: 'No scenarios yet',
      noScenario: 'No scenario yet',
      chartOwner: 'Add your first transactions to test decisions against your own cash flow',
      runError: 'Could not run this scenario',
    },
    list: { title: 'Scenarios', choose: 'Choose a scenario' },
    stats: {
      currentPlan: 'Current plan',
      withScenario: 'With scenario',
      balanceIn90: 'Balance in 90 days',
      difference: 'Difference',
      less: 'Less cash than planned',
      more: 'More cash than planned',
      lowest: 'Lowest point',
    },
    chart: {
      title: 'Projected balance',
      description: 'Next 90 days',
      scenario: 'Scenario',
      label: (name: string) => `Projected balance: current plan versus ${name}`,
    },
    months: {
      title: 'Month by month',
      description: 'Net cash flow for each projected month',
      month: 'Month',
    },
    describe: {
      income: (change: string) => `Income ${change}`,
      expenses: (change: string) => `Expenses ${change}`,
      category: (category: string, change: string) => `${category} ${change}`,
      monthly: (amount: string, from: string) => `${amount} more each month from ${from}`,
      oneOffOut: (amount: string, date: string) => `One-off payment of ${amount} on ${date}`,
      oneOffIn: (amount: string, date: string) => `One-off income of ${amount} on ${date}`,
      noChange: 'No changes yet',
      presets: {
        incomeDrop: (month: string, change: string) => ({
          name: 'Sales slow down',
          description: `In ${month} you brought in ${change} less than in a usual month. What if every month ran like that?`,
        }),
        incomeDropWeek: (week: string, change: string) => ({
          name: 'Sales slow down',
          description: `The week of ${week} brought in ${change} less than a usual week. What if every week ran like that?`,
        }),
        incomeGrowth: (month: string, change: string) => ({
          name: 'Sales grow',
          description: `${month} brought in ${change} more than a usual month. What if that became your usual?`,
        }),
        incomeGrowthWeek: (week: string, change: string) => ({
          name: 'Sales grow',
          description: `The week of ${week} brought in ${change} more than a usual week. What if that became your usual?`,
        }),
        topCostUp: (category: string, month: string, change: string) => ({
          name: `${category} costs rise`,
          description: `${category} is your largest cost. In ${month} it ran ${change} above usual. What if every month cost that much?`,
        }),
        topCostUpWeek: (category: string, week: string, change: string) => ({
          name: `${category} costs rise`,
          description: `${category} is your largest cost. The week of ${week} it ran ${change} above a usual week. What if every week cost that much?`,
        }),
        newMonthlyCost: (category: string, amount: string, from: string) => ({
          name: 'A new monthly commitment',
          description: `${category} is your largest monthly payment, at ${amount}. What if another one that size started on ${from}?`,
        }),
        oneOffPurchase: (description: string, amount: string, paid: string, again: string) => ({
          name: 'A large one-off purchase',
          description: `Your largest one-off payment this year was ${amount} for “${description}” on ${paid}. What if one like it came on ${again}?`,
        }),
        topIncomeLoss: (category: string, share: string) => ({
          name: `Without ${category}`,
          description: `${category} brings in ${share} of your income. What if it stopped?`,
        }),
        risingCost: (category: string, change: string) => ({
          name: `${category} keeps rising`,
          description: `${category} cost ${change} more over the last three months than before. What if it rose that much again?`,
        }),
        trimCost: (category: string, month: string, amount: string) => ({
          name: `Spend less on ${category}`,
          description: `In ${month} you spent only ${amount} on ${category}. What if every month looked like that?`,
        }),
        trimCostWeek: (category: string, week: string, amount: string) => ({
          name: `Spend less on ${category}`,
          description: `The week of ${week} you spent only ${amount} on ${category}. What if every week looked like that?`,
        }),
        bigSale: (
          description: string,
          amount: string,
          paid: string,
          times: string,
          again: string,
        ) => ({
          name: 'Another big sale',
          description: `Your biggest sale this year was ${amount} for “${description}” on ${paid}, ${times} times a usual one. What if another like it came on ${again}?`,
        }),
        costsRise: (change: string) => ({
          name: 'Prices go up',
          description: `Your costs ran ${change} higher over the last three months than before. What if they rose that much again?`,
        }),
        costsRiseMonth: (month: string, change: string) => ({
          name: 'Prices go up',
          description: `In ${month} your costs ran ${change} above a usual month. What if every month cost that much?`,
        }),
        costsFall: (month: string, change: string) => ({
          name: 'Leaner months',
          description: `In ${month} your costs were ${change} below a usual month. What if every month cost that little?`,
        }),
        peakStockUp: (month: string, category: string, amount: string, date: string) => ({
          name: `Stock up for ${month}`,
          description: `What if you spent an extra month’s ${category}, ${amount}, on ${date} to be ready?`,
        }),
        peakSeason: (month: string, industry: string) =>
          `${month} is usually a busy month for ${industry}.`,
        peakLastYear: (month: string, change: string) =>
          `Last ${month} you sold ${change} more than in a usual month.`,
        industries: {
          electronics: 'electronics shops',
          fashion: 'fashion shops',
          home: 'home and living shops',
          beauty: 'beauty and health shops',
          food: 'food and drink sellers',
          sports: 'sports and outdoor shops',
          handmade: 'handmade and art sellers',
        } satisfies Record<IndustryKind, string>,
        cashInjection: (amount: string, date: string) => ({
          name: 'A loan or investment',
          description: `${amount} coming in on ${date} to steady your cash.`,
        }),
        belowLine: (line: string, crossing: string, amount: string, date: string) =>
          `Your plan dips below your ${line} low-balance line on ${crossing}. ${amount} coming in on ${date} would keep you above it.`,
        belowZero: (crossing: string, amount: string, date: string) =>
          `Your plan runs out of cash on ${crossing}. ${amount} coming in on ${date} would keep you above zero.`,
        shortfall: (gap: string, amount: string, date: string) =>
          `You have been spending ${gap} a month more than you bring in. What if ${amount}, three months of that gap, came in on ${date}?`,
        custom: {
          name: 'Your scenario',
          description: 'The changes you chose, applied to your current plan.',
        },
      },
    },
    builder: {
      title: 'New scenario',
      description: 'Change any of these and compare the result with your current plan.',
      income: 'Change in income (%)',
      expenses: 'Change in expenses (%)',
      percentHint: 'For example −20 or 15. Leave empty for no change.',
      category: 'One category',
      categoryPlaceholder: 'Choose a category',
      categoryChange: 'Its change (%)',
      monthly: (currency: string) => `New monthly cost (${currency})`,
      monthlyHint: 'Paid on the first of every month, starting next month.',
      oneOff: 'One-off payment',
      oneOffType: 'Direction',
      out: 'Money out',
      in: 'Money in',
      oneOffAmount: (currency: string) => `Amount (${currency})`,
      oneOffDate: 'Date',
      suggested: 'Suggested from your figures',
      suggestedHint: 'Open one to see what it would do, or build your own below.',
      changes: 'What changes',
      impact: 'Over the next 90 days',
      planWas: (amount: string) => `Plan: ${amount}`,
      impactError: 'Its effect could not be worked out just now. You can still run it.',
      adjustHint: 'Close it to adjust the figures yourself.',
      run: 'Run scenario',
      cancel: 'Cancel',
      wholePercent: 'Enter a whole percentage between −100 and 500.',
      needCategory: 'Choose a category and how much it changes.',
      needOneOff: 'Give the one-off payment an amount and a date.',
    },
  },
  {
    page: {
      eyebrow: 'Планиране',
      title: 'Симулации',
      description:
        'Изпробвайте решение, преди да го вземете. Всеки сценарий се сравнява с текущия ви план за следващите 90 дни.',
      new: 'Нов сценарий',
      noScenariosHint:
        'Сценариите се изграждат от вашите собствени данни. Появяват се тук, щом има транзакции за няколко месеца.',
      loadError: 'Сценариите не могат да се заредят',
      noScenarios: 'Все още няма сценарии',
      noScenario: 'Все още няма сценарий',
      chartOwner:
        'Добавете първите си транзакции, за да тествате решения спрямо собствения си паричен поток',
      runError: 'Този сценарий не може да се изчисли',
    },
    list: { title: 'Сценарии', choose: 'Изберете сценарий' },
    stats: {
      currentPlan: 'Текущ план',
      withScenario: 'Със сценария',
      balanceIn90: 'Баланс след 90 дни',
      difference: 'Разлика',
      less: 'По-малко пари от планираното',
      more: 'Повече пари от планираното',
      lowest: 'Най-ниска точка',
    },
    chart: {
      title: 'Прогнозен баланс',
      description: 'Следващите 90 дни',
      scenario: 'Сценарий',
      label: (name: string) => `Прогнозен баланс: текущ план спрямо „${name}“`,
    },
    months: {
      title: 'По месеци',
      description: 'Нетен паричен поток за всеки прогнозен месец',
      month: 'Месец',
    },
    describe: {
      income: (change: string) => `Приходи ${change}`,
      expenses: (change: string) => `Разходи ${change}`,
      category: (category: string, change: string) => `${category} ${change}`,
      monthly: (amount: string, from: string) => `${amount} повече всеки месец от ${from}`,
      oneOffOut: (amount: string, date: string) => `Еднократно плащане от ${amount} на ${date}`,
      oneOffIn: (amount: string, date: string) => `Еднократен приход от ${amount} на ${date}`,
      noChange: 'Все още няма промени',
      presets: {
        incomeDrop: (month: string, change: string) => ({
          name: 'Продажбите се забавят',
          description: `През ${month} приходите ви бяха с ${change} по-ниски от обичайния месец. Какво ако всеки месец е такъв?`,
        }),
        incomeDropWeek: (week: string, change: string) => ({
          name: 'Продажбите се забавят',
          description: `През седмицата от ${week} приходите ви бяха с ${change} по-ниски от обичайната седмица. Какво ако всяка седмица е такава?`,
        }),
        incomeGrowth: (month: string, change: string) => ({
          name: 'Продажбите растат',
          description: `През ${month} приходите ви бяха с ${change} по-високи от обичайния месец. Какво ако това стане обичайното?`,
        }),
        incomeGrowthWeek: (week: string, change: string) => ({
          name: 'Продажбите растат',
          description: `През седмицата от ${week} приходите ви бяха с ${change} по-високи от обичайната седмица. Какво ако това стане обичайното?`,
        }),
        topCostUp: (category: string, month: string, change: string) => ({
          name: `Разходите за „${category}“ растат`,
          description: `„${category}“ е най-големият ви разход. През ${month} беше с ${change} над обичайното. Какво ако всеки месец струва толкова?`,
        }),
        topCostUpWeek: (category: string, week: string, change: string) => ({
          name: `Разходите за „${category}“ растат`,
          description: `„${category}“ е най-големият ви разход. През седмицата от ${week} беше с ${change} над обичайната седмица. Какво ако всяка седмица струва толкова?`,
        }),
        newMonthlyCost: (category: string, amount: string, from: string) => ({
          name: 'Нов месечен ангажимент',
          description: `„${category}“ е най-голямото ви месечно плащане – ${amount}. Какво ако от ${from} започне още едно такова?`,
        }),
        oneOffPurchase: (description: string, amount: string, paid: string, again: string) => ({
          name: 'Голяма еднократна покупка',
          description: `Най-голямото ви еднократно плащане тази година беше ${amount} за „${description}“ на ${paid}. Какво ако подобно дойде на ${again}?`,
        }),
        topIncomeLoss: (category: string, share: string) => ({
          name: `Без „${category}“`,
          description: `„${category}“ носи ${share} от приходите ви. Какво ако спре?`,
        }),
        risingCost: (category: string, change: string) => ({
          name: `„${category}“ продължава да расте`,
          description: `„${category}“ ви струваше с ${change} повече през последните три месеца, отколкото преди тях. Какво ако се повиши със същото отново?`,
        }),
        trimCost: (category: string, month: string, amount: string) => ({
          name: `По-малко за „${category}“`,
          description: `През ${month} похарчихте само ${amount} за „${category}“. Какво ако всеки месец е такъв?`,
        }),
        trimCostWeek: (category: string, week: string, amount: string) => ({
          name: `По-малко за „${category}“`,
          description: `През седмицата от ${week} похарчихте само ${amount} за „${category}“. Какво ако всяка седмица е такава?`,
        }),
        bigSale: (
          description: string,
          amount: string,
          paid: string,
          times: string,
          again: string,
        ) => ({
          name: 'Още една голяма продажба',
          description: `Най-голямата ви продажба тази година беше ${amount} за „${description}“ на ${paid} – ${times} пъти повече от обичайната. Какво ако подобна дойде на ${again}?`,
        }),
        costsRise: (change: string) => ({
          name: 'Цените се покачват',
          description: `Разходите ви бяха с ${change} по-високи през последните три месеца, отколкото преди тях. Какво ако се покачат със същото отново?`,
        }),
        costsRiseMonth: (month: string, change: string) => ({
          name: 'Цените се покачват',
          description: `През ${month} разходите ви бяха с ${change} над обичайния месец. Какво ако всеки месец струва толкова?`,
        }),
        costsFall: (month: string, change: string) => ({
          name: 'По-икономични месеци',
          description: `През ${month} разходите ви бяха с ${change} под обичайния месец. Какво ако всеки месец струва толкова малко?`,
        }),
        peakStockUp: (month: string, category: string, amount: string, date: string) => ({
          name: `Запас за ${month}`,
          description: `Какво ако на ${date} похарчите още един месец „${category}“ – ${amount}, за да сте готови?`,
        }),
        peakSeason: (month: string, industry: string) =>
          `${month} обикновено е натоварен месец за ${industry}.`,
        peakLastYear: (month: string, change: string) =>
          `Миналия ${month} продадохте с ${change} повече от обичайния месец.`,
        industries: {
          electronics: 'магазините за електроника',
          fashion: 'модните магазини',
          home: 'магазините за дома',
          beauty: 'магазините за красота и здраве',
          food: 'търговците на храни и напитки',
          sports: 'магазините за спорт и туризъм',
          handmade: 'търговците на ръчна изработка',
        },
        cashInjection: (amount: string, date: string) => ({
          name: 'Заем или инвестиция',
          description: `${amount} постъпват на ${date}, за да укрепят наличните ви пари.`,
        }),
        belowLine: (line: string, crossing: string, amount: string, date: string) =>
          `Планът ви пада под границата ви за нисък баланс от ${line} на ${crossing}. ${amount} на ${date} ще ви задържат над нея.`,
        belowZero: (crossing: string, amount: string, date: string) =>
          `Според плана парите ви свършват на ${crossing}. ${amount} на ${date} ще ви задържат на плюс.`,
        shortfall: (gap: string, amount: string, date: string) =>
          `Харчите с ${gap} на месец повече, отколкото печелите. Какво ако ${amount} – три месеца от тази разлика – постъпят на ${date}?`,
        custom: {
          name: 'Вашият сценарий',
          description: 'Избраните от вас промени, приложени към текущия ви план.',
        },
      },
    },
    builder: {
      title: 'Нов сценарий',
      description: 'Променете което и да е от тези и сравнете резултата с текущия си план.',
      income: 'Промяна в приходите (%)',
      expenses: 'Промяна в разходите (%)',
      percentHint: 'Например −20 или 15. Оставете празно, ако няма промяна.',
      category: 'Една категория',
      categoryPlaceholder: 'Изберете категория',
      categoryChange: 'Нейната промяна (%)',
      monthly: (currency: string) => `Нов месечен разход (${currency})`,
      monthlyHint: 'Плаща се на първо число всеки месец, от следващия месец.',
      oneOff: 'Еднократно плащане',
      oneOffType: 'Посока',
      out: 'Плащане',
      in: 'Постъпление',
      oneOffAmount: (currency: string) => `Сума (${currency})`,
      oneOffDate: 'Дата',
      suggested: 'Препоръчани според вашите данни',
      suggestedHint: 'Отворете един, за да видите ефекта му, или създайте свой по-долу.',
      changes: 'Какво се променя',
      impact: 'През следващите 90 дни',
      planWas: (amount: string) => `План: ${amount}`,
      impactError: 'Ефектът му не може да се изчисли в момента. Пак можете да го изчислите.',
      adjustHint: 'Затворете го, за да промените стойностите сами.',
      run: 'Изчисли сценария',
      cancel: 'Отказ',
      wholePercent: 'Въведете цял процент между −100 и 500.',
      needCategory: 'Изберете категория и колко се променя.',
      needOneOff: 'Въведете сума и дата за еднократното плащане.',
    },
  },
);
