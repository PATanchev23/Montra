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
  const currentLabel = periodOptions.find((o) => o.value === params.period)!.label;

  return (
    <Menu>
      <MenuTrigger
        className="flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-field border border-line-strong bg-surface px-3 text-body-sm font-medium text-ink transition-colors hover:border-control data-[state=open]:border-control sm:px-3.5"
        aria-label={`Reporting period: ${currentLabel}`}
      >
        <CalendarDays aria-hidden className="size-[18px] text-ink-2" strokeWidth={1.6} />
        <span className="tabular hidden whitespace-nowrap lg:inline">
          {current ? rangeLabel(current.from, current.to) : currentLabel}
        </span>
        <span className="hidden whitespace-nowrap sm:inline lg:hidden">{currentLabel}</span>
        <ChevronDown aria-hidden className="hidden size-4 text-muted sm:block" strokeWidth={1.75} />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel>Reporting period</MenuLabel>
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
          {periodOptions.map((option) => {
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
                hint={range ? rangeLabel(range.from, range.to) : 'Choose dates on the dashboard'}
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
