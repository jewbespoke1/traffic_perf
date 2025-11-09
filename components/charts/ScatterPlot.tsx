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
};

export function ScatterPlot({
  points,
  sampleSize = 2000,
  height = 240,
  title,
  xLabel = 'Latency (ms)',
  yLabel = 'Requests per second',
}: ScatterPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  const { xs, ys, domains } = useMemo(() => {
    const sampled = points.length > sampleSize ? reservoirSample(points, sampleSize) : points;
    const xs = new Float32Array(sampled.map((point) => point.x));
    const ys = new Float32Array(sampled.map((point) => point.y));
    const domainX: [number, number] = [
      Math.min(...sampled.map((p) => p.x), 0),
      Math.max(...sampled.map((p) => p.x), 1),
    ];
    const domainY: [number, number] = [
      Math.min(...sampled.map((p) => p.y), 0),
      Math.max(...sampled.map((p) => p.y), 1),
    ];
    return {
      xs,
      ys,
      domains: { x: domainX, y: domainY } satisfies ChartDomains,
    };
  }, [points, sampleSize]);

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
    xFormatter: (value) => `${value.toFixed(0)}ms`,
    yFormatter: (value) => value.toFixed(0),
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

