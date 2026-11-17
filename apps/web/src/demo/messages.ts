import { defineMessages, messagesFor } from '../i18n';
import type { CategoryId } from './types';

type ScenarioId = 'ads-plus-20' | 'hire-support' | 'black-friday' | 'lose-marketplace';

interface ScenarioText {
  name: string;
  description: string;
  assumptions: string[];
}

/**
 * Text the TechStore sample layer shows: its category names, its generic
 * record descriptions, the what-if scenarios and the notifications. Brand
 * names ("Meta Ads", "Shopify") stay as they are, as in anyone's own data.
 */
export const sampleMessages = defineMessages(
  {
    categories: {
      'sales-store': 'Online store',
      'sales-marketplace': 'Marketplace',
      'sales-b2b': 'B2B orders',
      inventory: 'Inventory',
      advertising: 'Advertising',
      shipping: 'Shipping',
      payroll: 'Payroll',
      rent: 'Rent',
      software: 'Software',
      fees: 'Payment fees',
      utilities: 'Utilities',
      taxes: 'Taxes',
    } satisfies Record<CategoryId, string>,
    other: 'Other',
    /** Bulgarian names for the store's own record descriptions; English keeps them as written. */
    descriptions: {} as Record<string, string>,
    order: (ref: string) => `Order ${ref}`,
    supplierInvoice: (ref: string) => `Supplier invoice ${ref}`,
    vatPayment: (quarter: string) => `VAT payment ${quarter}`,
    expectedPayout: 'Expected payout',
    campaignPayment: 'Campaign payment',
    scenarios: {
      'ads-plus-20': (): ScenarioText => ({
        name: 'Increase ad spend by 20%',
        description: 'Scale Meta and Google campaigns ahead of the holiday season.',
        assumptions: ['Advertising +20%', 'Revenue +3% from extra traffic', 'Margins unchanged'],
      }),
      'hire-support': (month: string): ScenarioText => ({
        name: 'Hire a support agent',
        description: 'A full-time customer support hire starting next month.',
        assumptions: ['+€1,850 payroll per month', `Starts ${month}`],
      }),
      'black-friday': (month: string, orderDay: string): ScenarioText => ({
        name: 'Black Friday stock-up',
        description: 'Pre-order €8,500 of extra stock to capture more Black Friday demand.',
        assumptions: [`One-off inventory €8,500 on ${orderDay}`, `Revenue +18% in ${month}`],
      }),
      'lose-marketplace': (): ScenarioText => ({
        name: 'Lose the marketplace channel',
        description: 'What if the marketplace delists TechStore from next week?',
        assumptions: ['Marketplace revenue stops', 'Inventory purchases −20%'],
      }),
    },
    notifications: {
      due: (description: string, weekday: string) => `${description} is due ${weekday}`,
      dueBody: (amount: string, to: string) => `${amount} to ${to}`,
      overBudget: (category: string) => `${category} is over budget`,
      overBudgetBody: (spent: string, limit: string) => `${spent} spent of ${limit}`,
      payout: 'Marketplace payout received',
      payoutBody: 'Weekly settlement cleared to the main account',
      today: 'Today',
      yesterday: 'Yesterday',
      twoDaysAgo: '2 days ago',
    },
  },
  {
    categories: {
      'sales-store': 'Онлайн магазин',
      'sales-marketplace': 'Маркетплейс',
      'sales-b2b': 'B2B поръчки',
      inventory: 'Стоки',
      advertising: 'Реклама',
      shipping: 'Доставка',
      payroll: 'Заплати',
      rent: 'Наем',
      software: 'Софтуер',
      fees: 'Такси за плащания',
      utilities: 'Комунални услуги',
      taxes: 'Данъци',
    },
    other: 'Други',
    descriptions: {
      'Shopify payout': 'Плащане от Shopify',
      'Marketplace payout': 'Плащане от маркетплейса',
      'Courier invoice': 'Фактура за куриер',
      'Warehouse rent': 'Наем на склад',
      Payroll: 'Заплати',
      'Payment processing fees': 'Такси за обработка на плащания',
      'Internet & power': 'Интернет и ток',
      'Shopify plan': 'Абонамент за Shopify',
      'Ledgerly accounting': 'Счетоводство в Ledgerly',
    },
    order: (ref: string) => `Поръчка ${ref}`,
    supplierInvoice: (ref: string) => `Фактура от доставчик ${ref}`,
    vatPayment: (quarter: string) => `Плащане на ДДС за ${quarter}`,
    expectedPayout: 'Очаквано плащане',
    campaignPayment: 'Плащане за кампания',
    scenarios: {
      'ads-plus-20': (): ScenarioText => ({
        name: 'Увеличаване на рекламата с 20%',
        description: 'Разширете кампаниите в Meta и Google преди празничния сезон.',
        assumptions: [
          'Реклама +20%',
          'Приходи +3% от допълнителния трафик',
          'Маржовете остават същите',
        ],
      }),
      'hire-support': (month: string): ScenarioText => ({
        name: 'Наемане на служител по поддръжката',
        description: 'Служител на пълен работен ден за обслужване на клиенти от следващия месец.',
        assumptions: ['+1850 € заплати на месец', `Започва през ${month}`],
      }),
      'black-friday': (month: string, orderDay: string): ScenarioText => ({
        name: 'Зареждане със стока за Black Friday',
        description:
          'Предварителна поръчка на допълнителна стока за 8500 €, за да се посрещне по-голямото търсене за Black Friday.',
        assumptions: [
          `Еднократна покупка на стока за 8500 € на ${orderDay}`,
          `Приходи +18% през ${month}`,
        ],
      }),
      'lose-marketplace': (): ScenarioText => ({
        name: 'Загуба на канала в маркетплейса',
        description:
          'Какво става, ако маркетплейсът спре да продава TechStore от следващата седмица?',
        assumptions: ['Приходите от маркетплейса спират', 'Покупките на стока −20%'],
      }),
    },
    notifications: {
      due: (description: string, weekday: string) => `${description} — падеж в ${weekday}`,
      dueBody: (amount: string, to: string) => `${amount} към ${to}`,
      overBudget: (category: string) => `${category}: бюджетът е надхвърлен`,
      overBudgetBody: (spent: string, limit: string) => `Изхарчени ${spent} от ${limit}`,
      payout: 'Получено плащане от маркетплейса',
      payoutBody: 'Седмичното плащане е постъпило в основната сметка',
      today: 'Днес',
      yesterday: 'Вчера',
      twoDaysAgo: 'Преди 2 дни',
    },
  },
);

export type { ScenarioId };

/** A sample category's name in the interface language. */
export const categoryName = (id: CategoryId) => messagesFor(sampleMessages).categories[id];

/** A sample record's description in the interface language (brand names stay as they are). */
export function sampleDescription(text: string): string {
  const m = messagesFor(sampleMessages);
  const exact = m.descriptions[text];
  if (exact) return exact;
  const order = /^Order (#\d+)$/.exec(text);
  if (order) return m.order(order[1]!);
  const invoice = /^Supplier invoice (#\d+)$/.exec(text);
  if (invoice) return m.supplierInvoice(invoice[1]!);
  const vat = /^VAT payment (Q\d)$/.exec(text);
  if (vat) return m.vatPayment(vat[1]!);
  return text;
}
