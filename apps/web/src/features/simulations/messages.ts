import { defineMessages } from '../../i18n';

export const simulationMessages = defineMessages(
  {
    page: {
      eyebrow: 'Planning',
      title: 'Simulations',
      description:
        'Test a decision before you make it. Each scenario is compared with your current plan over the next 90 days.',
      newHint: 'Building custom scenarios arrives with the simulations API.',
      new: 'New scenario',
      loadError: 'Could not load scenarios',
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
  },
  {
    page: {
      eyebrow: 'Планиране',
      title: 'Симулации',
      description:
        'Изпробвайте решение, преди да го вземете. Всеки сценарий се сравнява с текущия ви план за следващите 90 дни.',
      newHint: 'Създаването на собствени сценарии идва с API за симулациите.',
      new: 'Нов сценарий',
      loadError: 'Сценариите не могат да се заредят',
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
  },
);
