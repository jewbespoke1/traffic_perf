'use client';

import { useMemo } from 'react';

import { useVirtualization } from '@/hooks/useVirtualization';
import { RequestEvent } from '@/lib/types';

type DataTableProps = {
  rows: RequestEvent[];
  height?: number;
};

const COLUMNS: { key: keyof RequestEvent | 'time'; label: string; width: string }[] = [
  { key: 'time', label: 'Timestamp', width: '18%' },
  { key: 'subdomain', label: 'Subdomain', width: '12%' },
  { key: 'path', label: 'Path', width: '26%' },
  { key: 'status', label: 'Status', width: '10%' },
  { key: 'latencyMs', label: 'Latency', width: '12%' },
  { key: 'sizeBytes', label: 'Payload', width: '12%' },
];

export function DataTable({ rows, height = 320 }: DataTableProps) {
  const rowHeight = 32;
  const virtualization = useVirtualization(rows.length, rowHeight, height);

  const visible = useMemo(() => {
    return rows.slice(virtualization.start, virtualization.end);
  }, [rows, virtualization.start, virtualization.end]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
        {COLUMNS.map((column) => (
          <div key={column.key} style={{ width: column.width }} className="px-3 py-2">
            {column.label}
          </div>
        ))}
      </div>
      <div
        className="relative overflow-auto text-xs text-slate-200"
        style={{ height }}
        onScroll={virtualization.onScroll}
      >
        <div style={{ height: rows.length * rowHeight }}>
          <div style={{ transform: `translateY(${virtualization.offsetTop}px)` }}>
            {visible.map((row, index) => (
              <div
                key={`${row.ts}-${index}`}
                className="flex border-b border-slate-800/60 px-3 py-1.5"
                style={{ height: rowHeight }}
              >
                <div style={{ width: COLUMNS[0].width }}>{formatTime(row.ts)}</div>
                <div style={{ width: COLUMNS[1].width }}>{row.subdomain}.dummdomain</div>
                <div style={{ width: COLUMNS[2].width }} className="truncate">
                  {row.path}
                </div>
                <div style={{ width: COLUMNS[3].width }} className={statusColor(row.status)}>
                  {row.status}
                </div>
                <div style={{ width: COLUMNS[4].width }}>{row.latencyMs.toFixed(0)}ms</div>
                <div style={{ width: COLUMNS[5].width }}>{formatBytes(row.sizeBytes)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${date.toLocaleTimeString('en-US', { hour12: false })}.${date
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(1)}KB`;
  return `${bytes}B`;
}

function statusColor(status: number): string {
  if (status >= 500) return 'text-rose-300';
  if (status >= 400) return 'text-amber-300';
  return 'text-emerald-300';
}

