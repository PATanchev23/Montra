import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { format, parseISO } from 'date-fns';

/**
 * Opens a DatePicker and chooses `date` (yyyy-mm-dd) as a person would: the
 * month arrows until the month shows, then the day. English interface only.
 */
export async function pickDate(user: UserEvent, trigger: HTMLElement, date: string) {
  await user.click(trigger);
  const calendar = await screen.findByRole('dialog', { name: 'Calendar' });
  const wanted = date.slice(0, 7);
  for (let step = 0; step < 240; step++) {
    const shown = within(calendar).getByRole('grid').getAttribute('data-month')!;
    if (shown === wanted) break;
    await user.click(
      within(calendar).getByRole('button', {
        name: shown < wanted ? 'Next month' : 'Previous month',
      }),
    );
  }
  await user.click(
    within(calendar).getByRole('button', { name: format(parseISO(date), 'EEEE, d MMMM yyyy') }),
  );
}
