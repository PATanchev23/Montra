import { API_PREFIX } from '@montra/shared';
import { ArrowUpRight, Database, Globe, RefreshCw, Server, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useHealth } from '../../api/health';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { StatusDot, type Status } from '../../components/ui/StatusDot';
import { cn } from '../../lib/cn';
import { deriveStatus, formatUptime } from './deriveStatus';

const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' });

const statusLabel: Record<Status, string> = {
  up: 'Connected',
  degraded: 'Degraded',
  down: 'Unreachable',
  unknown: 'Unknown',
};

interface Tier {
  name: string;
  role: string;
  icon: LucideIcon;
  status: Status;
  facts: { label: string; value: string }[];
}

export function SystemStatusPage() {
  const { data, error, isFetching, refetch, dataUpdatedAt, errorUpdatedAt } = useHealth();
  const status = deriveStatus(data, error);
  const checkedAt = Math.max(dataUpdatedAt, errorUpdatedAt);
  const live = error ? undefined : data;

  const tiers: Tier[] = [
    {
      name: 'Web client',
      role: 'React · Vite',
      icon: Globe,
      status: 'up',
      facts: [{ label: 'Mode', value: import.meta.env.MODE }],
    },
    {
      name: 'API server',
      role: 'Fastify · REST',
      icon: Server,
      status: status.api,
      facts: live
        ? [
            { label: 'Round trip', value: `${live.roundTripMs} ms` },
            { label: 'Version', value: live.version },
            { label: 'Uptime', value: formatUptime(live.uptimeSeconds) },
          ]
        : [],
    },
    {
      name: 'Database',
      role: 'PostgreSQL · Prisma',
      icon: Database,
      status: status.database,
      facts:
        live?.checks.database.latencyMs != null
          ? [{ label: 'Query', value: `${live.checks.database.latencyMs} ms` }]
          : [],
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="System"
        title="System status"
        description="Montra runs as three separate tiers. This page checks every link in the chain."
        actions={
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
            Check now
          </Button>
        }
      />

      <Panel className="overflow-hidden">
        <section aria-live="polite" className="px-5 py-7 sm:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={status.overall}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'text-[26px] leading-tight font-semibold tracking-[-0.025em]',
                status.overall === 'operational' && 'text-ink',
                status.overall === 'checking' && 'text-faint',
                status.overall === 'degraded' && 'text-warning',
                status.overall === 'offline' && 'text-negative',
              )}
            >
              {status.headline}
            </motion.p>
          </AnimatePresence>
          <p className="tabular mt-2 text-muted">
            {checkedAt > 0
              ? `Last checked ${timeFormat.format(checkedAt)}`
              : 'Waiting for first check'}
            <span className="text-faint"> · refreshes every 15 s</span>
          </p>
        </section>

        <ol className="grid border-t border-line md:grid-cols-3" aria-label="Request path">
          {tiers.map((tier, index) => (
            <TierColumn
              key={tier.name}
              tier={tier}
              index={index}
              linkStatus={tiers[index + 1]?.status}
            />
          ))}
        </ol>
      </Panel>

      <p className="text-[13px] text-muted">
        The browser calls{' '}
        <code className="font-mono text-[12px] text-ink">{API_PREFIX}/health</code>, and the API
        runs a query against PostgreSQL before it answers.{' '}
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline"
        >
          API reference
          <ArrowUpRight className="size-3.5" strokeWidth={2} />
        </a>
      </p>
    </div>
  );
}

function TierColumn({
  tier,
  index,
  linkStatus,
}: {
  tier: Tier;
  index: number;
  linkStatus?: Status;
}) {
  const Icon = tier.icon;
  return (
    <li
      className={cn(
        'relative px-5 py-6 sm:px-8',
        index > 0 && 'border-t border-line md:border-t-0 md:border-l',
      )}
    >
      {/* Connector to the next tier: lights up when the request gets through. */}
      {linkStatus && (
        <span
          aria-hidden
          className={cn(
            'absolute top-[42px] -right-px z-10 hidden h-0.5 w-8 translate-x-1/2 rounded-full transition-colors md:block',
            linkStatus === 'up' ? 'bg-positive' : 'bg-line-strong',
          )}
        />
      )}

      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-hover text-ink-2">
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink">{tier.name}</p>
          <p className="text-[12px] text-muted">{tier.role}</p>
        </div>
      </div>

      <p className="mt-5 flex items-center gap-2 text-[13px]">
        <StatusDot status={tier.status} />
        <span className={tier.status === 'down' ? 'text-negative' : 'text-ink'}>
          {statusLabel[tier.status]}
        </span>
      </p>

      <dl className="mt-4 space-y-1.5 text-[13px]">
        {tier.facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-4">
            <dt className="text-muted">{fact.label}</dt>
            <dd className="tabular font-mono text-[12px] text-ink">{fact.value}</dd>
          </div>
        ))}
        {tier.facts.length === 0 && <div className="text-faint">—</div>}
      </dl>
    </li>
  );
}
