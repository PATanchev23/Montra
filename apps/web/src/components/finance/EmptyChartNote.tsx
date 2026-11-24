import { Upload } from 'lucide-react';
import { Link } from 'react-router';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

/**
 * A note laid over a chart whose tracks are empty because the business has
 * no transactions yet. It sits on the plot's centre; the chart beneath keeps
 * its keyboard readout and data table. An owner can be offered Import
 * (`withImport`); a viewer only reads "No transactions yet". Its plate takes
 * the colour of whatever the chart sits on (`plate`), so it never reads as a
 * box of its own.
 */
export function EmptyChartNote({
  canEdit,
  ownerText,
  withImport = true,
  plate = 'surface',
}: {
  canEdit: boolean;
  ownerText: string;
  withImport?: boolean;
  plate?: 'surface' | 'canvas';
}) {
  const m = useMessages(common).noTransactions;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div
        className={cn(
          'pointer-events-auto flex max-w-sm flex-col items-center gap-4 px-6 py-5 text-center',
          plate === 'canvas' ? 'bg-canvas/90' : 'bg-surface/90',
        )}
      >
        <p className="text-body text-ink-2">{canEdit ? ownerText : m.title}</p>
        {canEdit && withImport && (
          <Button asChild variant="primary">
            <Link to="/transactions?import=new">
              <Upload />
              {m.import}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
