'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useChartRenderer } from '@/hooks/useChartRenderer';
import { usePanZoom } from '@/hooks/usePanZoom';
import { ChartSeries } from '@/lib/types';

type LineChartProps = {
  series: ChartSeries[];
  xDomain: [number, number];
  yDomain: [number, number];
  lod?: boolean;
  height?: number;
  title?: string;
};

export function LineChart({
  series,
  xDomain,
  yDomain,
  lod = true,
  height = 260,
  title,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const { domain, reset } = usePanZoom(
    containerRef,
    { x: xDomain, y: yDomain },
    { minZoom: 0.05, maxZoom: 20 },
  );

  const chartSeries = useMemo(() => {
    return series.map((item) => ({
      ...item,
      x: item.x,
      y: item.y,
    }));
  }, [series]);

  const domainKey = `${xDomain[0]}-${xDomain[1]}-${yDomain[0]}-${yDomain[1]}`;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setDimensions((prev) => ({
        width: Math.max(320, entry.contentRect.width),
        height: prev.height,
      }));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    reset();
  }, [reset, domainKey]);

  useChartRenderer(canvasRef, {
    series: chartSeries,
    domains: domain,
    drawKind: 'line',
    lod,
    width: dimensions.width,
    height: dimensions.height,
    margin: 40,
    xFormatter: formatTimestamp,
    yFormatter: formatNumber,
  });

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        {title ? <h3 className="text-sm font-semibold text-slate-200">{title}</h3> : null}
        <button
          type="button"
          onClick={reset}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
        >
          Reset
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/40 shadow-inner"
        style={{ height: `${dimensions.height}px` }}
      />
      <Legend series={chartSeries} />
    </div>
  );
}

function Legend({ series }: { series: ChartSeries[] }) {
  if (!series.length) return null;
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-300">
      {series.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function formatTimestamp(value: number): string {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}
