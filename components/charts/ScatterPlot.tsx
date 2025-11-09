'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useChartRenderer } from '@/hooks/useChartRenderer';
import { reservoirSample } from '@/lib/lod';
import { ChartDomains } from '@/lib/types';

type ScatterPlotProps = {
  points: { x: number; y: number }[];
  sampleSize?: number;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  domain?: ChartDomains;
};

export function ScatterPlot({
  points,
  sampleSize = 2000,
  height = 240,
  title,
  xLabel = 'Time (s)',
  yLabel = 'Latency (ms)',
  domain,
}: ScatterPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  const { xs, ys, domains } = useMemo(() => {
    const sampled =
      points.length > sampleSize ? reservoirSample(points, sampleSize) : points;
    if (sampled.length === 0) {
      return {
        xs: new Float32Array(0),
        ys: new Float32Array(0),
        domains:
          domain ??
          ({
            x: [0, 1] as [number, number],
            y: [0, 1] as [number, number],
          } as ChartDomains),
      };
    }
    const xs = new Float32Array(sampled.map((point) => point.x));
    const ys = new Float32Array(sampled.map((point) => point.y));
    const baseDomain: ChartDomains =
      domain ?? {
        x: [
          Math.min(...sampled.map((p) => p.x)),
          Math.max(...sampled.map((p) => p.x)),
        ] as [number, number],
        y: [
          Math.min(...sampled.map((p) => p.y)),
          Math.max(...sampled.map((p) => p.y)),
        ] as [number, number],
      };
    const safeDomain: ChartDomains = {
      x:
        baseDomain.x[0] === baseDomain.x[1]
          ? ([baseDomain.x[0] - 500, baseDomain.x[0] + 500] as [number, number])
          : baseDomain.x,
      y:
        baseDomain.y[0] === baseDomain.y[1]
          ? ([baseDomain.y[0] - 10, baseDomain.y[0] + 10] as [number, number])
          : baseDomain.y,
    };
    return {
      xs,
      ys,
      domains: safeDomain,
    };
  }, [points, sampleSize, domain]);

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
    scatter: {
      xs,
      ys,
      color: '#4db9e7',
      radius: 2,
    },
    domains,
    drawKind: 'scatter',
    width: dimensions.width,
    height: dimensions.height,
    margin: 40,
    xFormatter: (value) => formatTime(value),
    yFormatter: (value) => `${value.toFixed(0)}ms`,
  });

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <div className="flex items-center justify-between text-sm text-slate-300">
        {title ? <h3 className="font-semibold text-slate-200">{title}</h3> : null}
        <span>
          {xLabel} vs {yLabel}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/40"
        style={{ height: `${dimensions.height}px` }}
      />
    </div>
  );
}

function formatTime(value: number) {
  const date = new Date(value);
  return `${date.getMinutes().toString().padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}`;
}
