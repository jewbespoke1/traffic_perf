'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useChartRenderer } from '@/hooks/useChartRenderer';
import { ChartDomains } from '@/lib/types';

type BarChartProps = {
  stacks: {
    label: string;
    color: string;
    values: number[];
  }[];
  categories: string[];
  height?: number;
  title?: string;
};

export function BarChart({
  stacks,
  categories,
  height = 220,
  title,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });

  const bars = useMemo(() => {
    const groupCount = stacks.length > 0 ? stacks[0].values.length : 0;
    if (groupCount === 0) {
      return Float32Array.from([]);
    }
    const margin = 48;
    const chartWidth = Math.max(1, dimensions.width - margin * 2);
    const chartHeight = Math.max(1, dimensions.height - margin * 2);
    const groupWidth = chartWidth / groupCount;
    const stackWidth = Math.max(4, groupWidth / stacks.length - 8);
    const totals = new Array<number>(groupCount).fill(0);
    stacks.forEach((stack) => {
      stack.values.forEach((value, index) => {
        totals[index] += value ?? 0;
      });
    });
    const maxY = totals.reduce((max, value) => Math.max(max, value), 1);

    const values = new Float32Array(groupCount * stacks.length * 4);
    let ptr = 0;

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      let offsetY = 0;
      for (let stackIndex = 0; stackIndex < stacks.length; stackIndex++) {
        const stack = stacks[stackIndex];
        const value = stack.values[groupIndex] ?? 0;
        const heightPx = (value / maxY) * chartHeight;
        const x =
          margin +
          groupIndex * groupWidth +
          stackIndex * (stackWidth + 4) +
          4;
        const y =
          margin + chartHeight - heightPx - offsetY;
        offsetY += heightPx;
        values[ptr++] = x;
        values[ptr++] = y;
        values[ptr++] = stackWidth;
        values[ptr++] = heightPx;
      }
    }
    return values;
  }, [stacks, dimensions]);

  const domains: ChartDomains = useMemo(
    () => ({
      x: [0, dimensions.width],
      y: [0, dimensions.height],
    }),
    [dimensions],
  );

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
    bars: {
      values: bars,
      colorOf(index) {
        const stackIndex = index % stacks.length;
        return stacks[stackIndex].color;
      },
    },
    domains,
    drawKind: 'bar',
    width: dimensions.width,
    height: dimensions.height,
    margin: 48,
    axes: false,
    xFormatter: () => '',
    yFormatter: () => '',
  });

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      {title ? <h3 className="text-sm font-semibold text-slate-200">{title}</h3> : null}
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-slate-800 bg-slate-950/40"
        style={{ height: `${dimensions.height}px` }}
      />
      <div className="flex gap-6 text-xs text-slate-300">
        {stacks.map((stack) => (
          <span key={stack.label} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: stack.color }}
            />
            {stack.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wide text-slate-500">
        {categories.map((category) => (
          <span key={category}>{category}</span>
        ))}
      </div>
    </div>
  );
}
