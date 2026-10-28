import { ArrowUpRight, Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { business } from '../../api/finance';
import { useHealth } from '../../api/health';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { StatusDot } from '../../components/ui/StatusDot';
import { Switch } from '../../components/ui/Switch';
import { cn } from '../../lib/cn';
import { useUiStore, type NotificationPrefs, type ThemePreference } from '../../stores/ui';
import { useSignedInUser } from '../auth/currentUser';
import { deriveStatus } from '../status/deriveStatus';

const sections = [
  { id: 'profile', label: 'Profile' },
  { id: 'business', label: 'Business' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'system', label: 'System' },
];

function Section({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Panel id={id} className="scroll-mt-6 overflow-hidden" aria-labelledby={`${id}-title`}>
      <div className="px-5 pt-5 pb-5 sm:px-6">
        <PanelHeader id={`${id}-title`} title={title} description={description} />
      </div>
      <div className="border-t border-line px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken/60 px-5 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </Panel>
  );
}

function PendingFooter({ note }: { note: string }) {
  return (
    <>
      <p className="text-[12px] text-muted">{note}</p>
      <Button size="sm" variant="primary" disabled>
        Save changes
      </Button>
    </>
  );
}

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun; preview: string }[] =
  [
    { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#071216]' },
    { value: 'light', label: 'Light', icon: Sun, preview: 'bg-[#f4f6f7]' },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      preview: 'bg-[linear-gradient(90deg,#071216_50%,#f4f6f7_50%)]',
    },
  ];

const notificationRows: { key: keyof NotificationPrefs; title: string; body: string }[] = [
  {
    key: 'dueReminders',
    title: 'Payment reminders',
    body: 'Two days before a supplier invoice or recurring payment is due.',
  },
  {
    key: 'budgetAlerts',
    title: 'Budget alerts',
    body: 'When a category reaches 90% of its monthly limit.',
  },
  {
    key: 'lowBalance',
    title: 'Low balance warnings',
    body: 'When the projected balance drops below your safety buffer.',
  },
  {
    key: 'weeklySummary',
    title: 'Weekly summary',
    body: 'A Monday email with last week’s cash flow and what’s coming up.',
  },
];

export function SettingsPage() {
  const location = useLocation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const notifications = useUiStore((s) => s.notifications);
  const setNotification = useUiStore((s) => s.setNotification);
  const health = useHealth();
  const status = deriveStatus(health.data, health.error);
  const { user, memberships } = useSignedInUser();
  const membership = memberships[0];

  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Your profile, business details and how Montra looks and notifies you."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,760px)]">
        <nav aria-label="Settings sections" className="sticky top-6 hidden lg:block">
          <ul className="flex flex-col gap-0.5 border-l border-line">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cn(
                    '-ml-px block border-l-2 py-1.5 pl-4 text-[13px] transition-colors',
                    location.hash === `#${s.id}`
                      ? 'border-accent text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            id="profile"
            title="Profile"
            description="How you appear across Montra."
            footer={<PendingFooter note="Editing your profile arrives in a later release." />}
          >
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-full border border-line-strong bg-raised text-[20px] font-medium text-ink-2">
                {user.name[0]}
              </span>
              <div>
                <p className="font-medium text-ink">{user.name}</p>
                {membership && (
                  <p className="text-[13px] text-muted">
                    {membership.role === 'OWNER' ? 'Owner' : 'Viewer'} · {membership.business.name}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name">
                <Input id="name" defaultValue={user.name} />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" defaultValue={user.email} />
              </Field>
            </div>
          </Section>

          <Section
            id="business"
            title="Business"
            description="Used for reports, exports and currency formatting."
            footer={
              <PendingFooter note="Business details are stored once accounts are connected." />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business name" htmlFor="business-name">
                <Input id="business-name" defaultValue={business.name} />
              </Field>
              <Field label="Business type" htmlFor="business-type">
                <Input id="business-type" defaultValue={business.kind} />
              </Field>
              <Field
                label="Currency"
                htmlFor="currency"
                hint="Bulgaria uses the euro since 1 January 2026."
              >
                <Select
                  id="currency"
                  label="Currency"
                  value="EUR"
                  onChange={() => {}}
                  options={[{ value: 'EUR', label: 'Euro (€)' }]}
                  className="w-full"
                />
              </Field>
              <Field label="Time zone" htmlFor="timezone">
                <Select
                  id="timezone"
                  label="Time zone"
                  value="Europe/Sofia"
                  onChange={() => {}}
                  options={[{ value: 'Europe/Sofia', label: 'Europe/Sofia (EET)' }]}
                  className="w-full"
                />
              </Field>
            </div>
          </Section>

          <Section
            id="appearance"
            title="Appearance"
            description="Dark is Montra’s signature theme; light suits bright rooms and printing."
          >
            <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
              {themeOptions.map(({ value, label, icon: Icon, preview }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'cursor-pointer overflow-hidden rounded-control border text-left transition-colors',
                      active
                        ? 'border-accent ring-1 ring-accent'
                        : 'border-line hover:border-line-strong',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-20 items-end gap-1.5 border-b border-line p-3',
                        preview,
                      )}
                    >
                      {[40, 64, 52, 78].map((h, i) => (
                        <span
                          key={i}
                          className="w-3 rounded-full bg-[#9575fa]"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </span>
                    <span className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink">
                      <Icon className="size-4 text-muted" strokeWidth={1.75} />
                      {label}
                      {active && (
                        <Check className="ml-auto size-4 text-accent" strokeWidth={2.25} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            id="notifications"
            title="Notifications"
            description="Choose what Montra tells you about. Saved on this device."
          >
            <ul className="-my-2 divide-y divide-line-soft">
              {notificationRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-6 py-3.5">
                  <label htmlFor={`notify-${row.key}`} className="min-w-0 cursor-pointer">
                    <span className="block text-[14px] text-ink">{row.title}</span>
                    <span className="block text-[13px] text-muted">{row.body}</span>
                  </label>
                  <Switch
                    id={`notify-${row.key}`}
                    checked={notifications[row.key]}
                    onCheckedChange={(v) => setNotification(row.key, v)}
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="system"
            title="System"
            description="Connection between this app, the API and the database."
          >
            <dl className="divide-y divide-line-soft text-[13px]">
              <div className="flex items-center justify-between gap-4 pb-3">
                <dt className="text-muted">Status</dt>
                <dd className="flex items-center gap-2 text-ink">
                  <StatusDot
                    status={
                      status.overall === 'operational'
                        ? 'up'
                        : status.overall === 'checking'
                          ? 'unknown'
                          : 'down'
                    }
                  />
                  {status.headline}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">API version</dt>
                <dd className="tabular font-mono text-[12px] text-ink">
                  {health.data?.version ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">Financial data</dt>
                <dd>
                  <Badge tone="analytic">TechStore sample data</Badge>
                </dd>
              </div>
            </dl>
            <Button asChild size="sm" className="mt-3">
              <Link to="/status">
                Open system status
                <ArrowUpRight />
              </Link>
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}
