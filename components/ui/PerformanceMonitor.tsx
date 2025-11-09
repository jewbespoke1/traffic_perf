'use client';

import { useEffect } from 'react';

import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { PerformanceMetrics } from '@/lib/types';

type PerformanceMonitorProps = {
  targetDropped: number;
  onMetrics: (metrics: PerformanceMetrics) => void;
};

export function PerformanceMonitor({
  targetDropped,
  onMetrics,
}: PerformanceMonitorProps) {
  const { metrics, markDropped } = usePerformanceMonitor();

  useEffect(() => {
    markDropped(targetDropped);
  }, [targetDropped, markDropped]);

  useEffect(() => {
    onMetrics(metrics);
  }, [metrics, onMetrics]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 shadow-lg">
      <h3 className="text-sm font-semibold text-slate-200">Performance</h3>
      <div className="grid grid-cols-2 gap-y-2 pt-3">
        <Metric label="FPS" value={metrics.fps.toFixed(1)} />
        <Metric label="Render" value={`${metrics.renderMs.toFixed(2)} ms`} />
        <Metric label="Process" value={`${metrics.processMs.toFixed(2)} ms`} />
        <Metric
          label="Memory"
          value={
            metrics.memMB ? `${metrics.memMB.toFixed(1)} MB` : 'n/a'
          }
        />
        <Metric label="Dropped" value={String(metrics.dropped)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="uppercase tracking-wide text-[10px] text-slate-500">
        {label}
      </span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  );
}

