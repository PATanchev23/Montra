import { resolvePeriod, todayIn, type DashboardPeriod } from '@montra/shared';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from '../../components/ui/Menu';
import { useUiStore } from '../../stores/ui';
import { useCurrentMembership } from '../auth/currentUser';
import { periodOptions, previewRange, rangeLabel } from './period';

import { useMessages } from '../../i18n';
import { dashboardMessages } from './messages';
/**
 * The dashboard's reporting period as a date-range menu: the trigger shows
 * the dates in view, and each choice lists the dates it covers today. From
 * 1024px the trigger spells the range out; narrower it names the period, and
 * on phones it is the calendar alone.
 */
export function PeriodPicker() {
  const params = useUiStore((s) => s.period);
  const setPeriod = useUiStore((s) => s.setPeriod);
  const navigate = useNavigate();
  const { business } = useCurrentMembership();
  const today = todayIn(business.timezone);
  const current = previewRange(params, today);
  const m = useMessages(dashboardMessages);
  const options = periodOptions();
  const currentLabel = options.find((o) => o.value === params.period)!.label;

  return (
    <Menu>
      <MenuTrigger
        className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-hover px-3 text-body-sm font-medium text-ink transition-colors duration-150 hover:bg-pressed data-[state=open]:bg-pressed sm:px-4"
        aria-label={m.picker.trigger(currentLabel)}
      >
        <CalendarDays aria-hidden className="size-4 text-ink-2" strokeWidth={1.75} />
        <span className="tabular hidden whitespace-nowrap lg:inline">
          {current ? rangeLabel(current.from, current.to) : currentLabel}
        </span>
        <span className="hidden whitespace-nowrap sm:inline lg:hidden">{currentLabel}</span>
        <ChevronDown aria-hidden className="hidden size-4 text-muted sm:block" strokeWidth={1.75} />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>{m.picker.title}</MenuLabel>
        <MenuRadioGroup
          value={params.period}
          onValueChange={(value) => {
            const period = value as DashboardPeriod;
            if (period !== 'custom') return setPeriod({ period });
            // A custom range starts from the dates in view; adjust them on the dashboard.
            setPeriod({ period, from: current?.from, to: current?.to });
            navigate('/');
          }}
        >
          {options.map((option) => {
            const range =
              option.value === 'custom'
                ? params.period === 'custom' && current
                  ? current
                  : null
                : resolvePeriod({ period: option.value }, today);
            return (
              <MenuRadioItem
                key={option.value}
                value={option.value}
                className="h-auto py-2"
                hint={range ? rangeLabel(range.from, range.to) : m.picker.chooseDates}
              >
                {option.label}
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
