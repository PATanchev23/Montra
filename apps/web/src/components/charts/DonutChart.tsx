import { arc, pie, type PieArcDatum } from 'd3-shape';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface DonutItem {
  id: string;
  label: string;
  value: number;
  /** Tailwind fill class, e.g. fill-chart-1 */
  fill: string;
}

/** A segmented ring with rounded, gapped segments and a centred total. */
export function DonutChart({
  items,
  size = 160,
  thickness = 20,
  active,
  onActiveChange,
  center,
  ariaLabel,
}: {
  items: DonutItem[];
  size?: number;
  thickness?: number;
  active?: string | null;
  onActiveChange?: (id: string | null) => void;
  center?: ReactNode;
  ariaLabel: string;
}) {
  const radius = size / 2;
  const slices = pie<DonutItem>()
    .sort(null)
    .value((d) => d.value)
    .padAngle(0.035)(items);
  const shape = arc<PieArcDatum<DonutItem>>().cornerRadius(4);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        <g transform={`translate(${radius},${radius})`}>
          {slices.map((slice, i) => {
            const isActive = active === slice.data.id;
            const d =
              shape({
                ...slice,
                innerRadius: radius - thickness - (isActive ? 2 : 0),
                outerRadius: radius + (isActive ? 3 : 0),
              } as PieArcDatum<DonutItem> & { innerRadius: number; outerRadius: number }) ?? '';
            return (
              <motion.path
                key={slice.data.id}
                d={d}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: active && !isActive ? 0.4 : 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className={cn(slice.data.fill, 'cursor-pointer')}
                onMouseEnter={() => onActiveChange?.(slice.data.id)}
                onMouseLeave={() => onActiveChange?.(null)}
              />
            );
          })}
        </g>
      </svg>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      )}
    </div>
  );
}
