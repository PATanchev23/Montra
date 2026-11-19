import { ArrowUpRight, Check, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
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
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { useMessages } from '../../i18n';
import { deriveStatus } from '../status/deriveStatus';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { settingsMessages } from './messages';

const SECTIONS = [
  'profile',
  'business',
  'appearance',
  'language',
  'notifications',
  'system',
  'deleteAccount',
] as const;

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
  const m = useMessages(settingsMessages);
  return (
    <>
      <p className="text-[12px] text-muted">{note}</p>
      <Button size="sm" variant="primary" disabled>
        {m.saveChanges}
      </Button>
    </>
  );
}

const themeOptions: { value: ThemePreference; icon: typeof Sun; preview: string }[] = [
  { value: 'dark', icon: Moon, preview: 'bg-[#071216]' },
  { value: 'light', icon: Sun, preview: 'bg-[#f4f6f7]' },
  {
    value: 'system',
    icon: Monitor,
    preview: 'bg-[linear-gradient(90deg,#071216_50%,#f4f6f7_50%)]',
  },
];

const NOTIFICATIONS: (keyof NotificationPrefs)[] = [
  'dueReminders',
  'budgetAlerts',
  'lowBalance',
  'weeklySummary',
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
  const m = useMessages(settingsMessages);
  const [deleting, setDeleting] = useState(false);
  const ownedBusinesses = memberships
    .filter((entry) => entry.role === 'OWNER')
    .map((entry) => entry.business.name);
  const deletionConsequence = ownedBusinesses.length
    ? m.deleteAccount.withBusinesses(ownedBusinesses.join(', '))
    : m.deleteAccount.profileOnly;

  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow={m.page.eyebrow} title={m.page.title} description={m.page.description} />

      <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,760px)]">
        <nav aria-label={m.sectionsLabel} className="sticky top-6 hidden lg:block">
          <ul className="flex flex-col gap-0.5 border-l border-line">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={cn(
                    '-ml-px block border-l-2 py-1.5 pl-4 text-[13px] transition-colors',
                    location.hash === `#${id}`
                      ? 'border-accent text-ink'
                      : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {m.sections[id]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            id="profile"
            title={m.sections.profile}
            description={m.profile.description}
            footer={<PendingFooter note={m.profile.pending} />}
          >
            <div className="flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-full border border-line-strong bg-raised text-[20px] font-medium text-ink-2">
                {user.name[0]}
              </span>
              <div>
                <p className="font-medium text-ink">{user.name}</p>
                {membership && (
                  <p className="text-[13px] text-muted">
                    {membership.role === 'OWNER' ? m.profile.owner : m.profile.viewer} ·{' '}
                    {membership.business.name}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label={m.profile.fullName} htmlFor="name">
                <Input id="name" defaultValue={user.name} />
              </Field>
              <Field label={m.profile.email} htmlFor="email">
                <Input id="email" type="email" defaultValue={user.email} />
              </Field>
            </div>
          </Section>

          <Section
            id="business"
            title={m.sections.business}
            description={m.business.description}
            footer={<PendingFooter note={m.business.pending} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={m.business.name} htmlFor="business-name">
                <Input id="business-name" defaultValue={business.name} />
              </Field>
              <Field label={m.business.type} htmlFor="business-type">
                <Input id="business-type" defaultValue={business.kind} />
              </Field>
              <Field label={m.business.currency} htmlFor="currency" hint={m.business.currencyHint}>
                <Select
                  id="currency"
                  label={m.business.currency}
                  value="EUR"
                  onChange={() => {}}
                  options={[{ value: 'EUR', label: m.business.euro }]}
                  className="w-full"
                />
              </Field>
              <Field label={m.business.timeZone} htmlFor="timezone">
                <Select
                  id="timezone"
                  label={m.business.timeZone}
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
            title={m.sections.appearance}
            description={m.appearance.description}
          >
            <div
              role="radiogroup"
              aria-label={m.appearance.theme}
              className="grid gap-3 sm:grid-cols-3"
            >
              {themeOptions.map(({ value, icon: Icon, preview }) => {
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
                      {m.appearance[value]}
                      {active && (
                        <Check className="ml-auto size-4 text-accent" strokeWidth={2.25} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section id="language" title={m.sections.language} description={m.language.description}>
            <LanguageSwitch size="md" />
          </Section>

          <Section
            id="notifications"
            title={m.sections.notifications}
            description={m.notifications.description}
          >
            <ul className="-my-2 divide-y divide-line-soft">
              {NOTIFICATIONS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-6 py-3.5">
                  <label htmlFor={`notify-${key}`} className="min-w-0 cursor-pointer">
                    <span className="block text-[14px] text-ink">{m.notifications[key].title}</span>
                    <span className="block text-[13px] text-muted">
                      {m.notifications[key].body}
                    </span>
                  </label>
                  <Switch
                    id={`notify-${key}`}
                    checked={notifications[key]}
                    onCheckedChange={(v) => setNotification(key, v)}
                  />
                </li>
              ))}
            </ul>
          </Section>

          <Section id="system" title={m.sections.system} description={m.system.description}>
            <dl className="divide-y divide-line-soft text-[13px]">
              <div className="flex items-center justify-between gap-4 pb-3">
                <dt className="text-muted">{m.system.status}</dt>
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
                <dt className="text-muted">{m.system.apiVersion}</dt>
                <dd className="tabular font-mono text-[12px] text-ink">
                  {health.data?.version ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">{m.system.financialData}</dt>
                <dd>
                  <Badge tone="analytic">{m.system.sampleData}</Badge>
                </dd>
              </div>
            </dl>
            <Button asChild size="sm" className="mt-3">
              <Link to="/status">
                {m.system.open}
                <ArrowUpRight />
              </Link>
            </Button>
          </Section>

          <Section
            id="deleteAccount"
            title={m.sections.deleteAccount}
            description={m.deleteAccount.description}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-md text-[13px] leading-relaxed text-muted">
                {deletionConsequence} {m.deleteAccount.irreversible}
              </p>
              <Button
                size="sm"
                onClick={() => setDeleting(true)}
                className="border-negative/40 text-negative hover:border-negative hover:bg-negative-soft hover:text-negative"
              >
                <Trash2 />
                {m.deleteAccount.open}
              </Button>
            </div>
            <DeleteAccountDialog
              open={deleting}
              onOpenChange={setDeleting}
              consequence={deletionConsequence}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
