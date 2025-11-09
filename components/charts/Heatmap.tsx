'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useChartRenderer } from '@/hooks/useChartRenderer';
import { HeatmapMatrix } from '@/lib/types';

type HeatmapProps = {
  points: { x: string; y: string; weight: number }[];
  xLabels: string[];
  yLabels: string[];
  height?: number;
  title?: string;
};

export function Heatmap({
  points,
  xLabels,
  yLabels,
  height = 260,
  title,
}: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  const heatmap: HeatmapMatrix = useMemo(() => {
    const cols = Math.max(1, xLabels.length);
    const rows = Math.max(1, yLabels.length);
    const map = new Map<string, number>();
    points.forEach((point) => {
      const key = `${point.x}|${point.y}`;
      map.set(key, (map.get(key) ?? 0) + point.weight);
    });
    const matrix = new Uint32Array(cols * rows);
    yLabels.forEach((yLabel, row) => {
      xLabels.forEach((xLabel, col) => {
        const key = `${xLabel}|${yLabel}`;
        matrix[row * cols + col] = map.get(key) ?? 0;
      });
    });

    return {
      cols,
      rows,
      matrix,
      xLabels,
      yLabels,
    };
  }, [points, xLabels, yLabels]);

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

  useChartRenderer(canvasRef, {
    heatmap,
    domains: {
      x: [0, dimensions.width],
      y: [0, dimensions.height],
    },
    drawKind: 'heatmap',
    width: dimensions.width,
    height: dimensions.height,
    margin: 48,
    axes: false,
  });

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      {title ? <h3 className="text-sm font-semibold text-slate-200">{title}</h3> : null}
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/40"
        style={{ height: `${dimensions.height}px` }}
      />
      <div className="grid grid-cols-4 gap-3 text-[10px] uppercase tracking-wide text-slate-500">
        {yLabels.slice(0, 12).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
