'use client';

import { RefObject, useCallback, useEffect, useRef } from 'react';

import {
  clearCanvas,
  drawAxes,
  drawBars,
  drawHeatmap,
  drawLine,
  drawScatter,
  setupCanvas,
} from '@/lib/canvasUtils';
import { decimateLineByPixel } from '@/lib/lod';
import { measure } from '@/lib/performanceUtils';
import { ChartDomains, ChartSeries, HeatmapMatrix } from '@/lib/types';

type DrawKind = 'line' | 'bar' | 'scatter' | 'heatmap';

type ChartRendererOptions = {
  series?: ChartSeries[];
  scatter?: {
    xs: Float32Array;
    ys: Float32Array;
    color: string;
    radius: number;
  };
  bars?: { values: Float32Array; colorOf: (index: number) => string };
  heatmap?: HeatmapMatrix;
  domains: ChartDomains;
  drawKind: DrawKind;
  lod?: boolean;
  width: number;
  height: number;
  margin?: number;
  axes?: boolean;
  xFormatter?: (value: number) => string;
  yFormatter?: (value: number) => string;
};

export function useChartRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: ChartRendererOptions,
) {
  const domainsRef = useRef(options.domains);
  const optsRef = useRef(options);

  useEffect(() => {
    domainsRef.current = options.domains;
    optsRef.current = options;
  }, [options]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const opts = optsRef.current;
    if (!canvas) return;

    const margin = opts.margin ?? 32;
    const width = opts.width;
    const height = opts.height;

    const ctx = setupCanvas(canvas, width, height);
    measure('render-loop', () => {
      clearCanvas(ctx, width, height);
      const xScale = createScale(
        opts.domains.x,
        [margin, width - margin],
      );
      const yScale = createScale(
        opts.domains.y,
        [height - margin, margin],
      );

      if (opts.axes !== false) {
        const xTicks = linearTicks(opts.domains.x, 6);
        const yTicks = linearTicks(opts.domains.y, 6);
        drawAxes(ctx, {
          xTicks,
          yTicks,
          xScale,
          yScale,
          width,
          height,
          margin,
          formatX: opts.xFormatter,
          formatY: opts.yFormatter,
        });
      }

      switch (opts.drawKind) {
        case 'line':
          opts.series?.forEach((series) => {
            const screenX = project(series.x, xScale);
            const screenY = project(series.y, yScale);
            const { x, y } = opts.lod
              ? decimateLineByPixel(screenX, screenY, width)
              : { x: screenX, y: screenY };
            drawLine(ctx, { x, y, color: series.color, width: 2 });
          });
          break;
        case 'bar':
          if (opts.bars) {
            drawBars(ctx, opts.bars.values, opts.bars.colorOf);
          }
          break;
        case 'scatter':
          if (opts.scatter) {
            const xs = project(opts.scatter.xs, xScale);
            const ys = project(opts.scatter.ys, yScale);
            drawScatter(ctx, xs, ys, {
              color: opts.scatter.color,
              radius: opts.scatter.radius,
              alpha: 0.7,
            });
          }
          break;
        case 'heatmap':
          if (opts.heatmap) {
            drawHeatmap(ctx, opts.heatmap.matrix, opts.heatmap.cols, opts.heatmap.rows, {
              palette: HEATMAP_PALETTE,
              width,
              height,
              margin,
            });
          }
          break;
        default:
          break;
      }
    });
  }, [canvasRef]);

  useEffect(() => {
    render();
  }, [render, options.drawKind, options.series, options.scatter, options.bars, options.heatmap, options.domains]);

  return {
    redraw: render,
    setDomains(domains: ChartDomains) {
      domainsRef.current = domains;
      optsRef.current = { ...optsRef.current, domains };
    },
  };
}

function createScale(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const scale = (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
  return scale;
}

function project(values: Float32Array, scale: (value: number) => number) {
  const result = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    result[i] = scale(values[i]);
  }
  return result;
}

function linearTicks(domain: [number, number], count: number): number[] {
  const [start, end] = domain;
  const span = end - start;
  if (span === 0 || !isFinite(span)) return [start];
  const step = niceStep(span / (count - 1));
  const ticks = [];
  const first = Math.ceil(start / step) * step;
  for (let value = first; value <= end; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function niceStep(step: number): number {
  const exp = Math.floor(Math.log10(step));
  const magnitude = Math.pow(10, exp);
  const residual = step / magnitude;
  if (residual >= 5) return 5 * magnitude;
  if (residual >= 2) return 2 * magnitude;
  if (residual >= 1) return magnitude;
  return 0.5 * magnitude;
}

const HEATMAP_PALETTE = [
  '#141b2d',
  '#17233a',
  '#1b2e4c',
  '#1f3b61',
  '#244776',
  '#29528a',
  '#2f5da0',
  '#3668b6',
  '#3f74cd',
  '#3f87d6',
  '#47a0df',
  '#4db9e7',
];
