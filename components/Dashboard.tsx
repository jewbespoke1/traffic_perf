'use client';

import { useMemo, useState } from 'react';

import { BarChart } from '@/components/charts/BarChart';
import { Heatmap } from '@/components/charts/Heatmap';
import { LineChart } from '@/components/charts/LineChart';
import { ScatterPlot } from '@/components/charts/ScatterPlot';
import { FilterPanel } from '@/components/controls/FilterPanel';
import { TimeRangeSelector } from '@/components/controls/TimeRangeSelector';
import { TrafficControl } from '@/components/controls/TrafficControl';
import { useDataContext } from '@/components/providers/DataProvider';
import { DataTable } from '@/components/ui/DataTable';
import { PerformanceMonitor } from '@/components/ui/PerformanceMonitor';
import { getColorForSubdomain } from '@/lib/colors';
import { AggregationWindow, ChartDomains, ChartSeries, SUBDOMAINS } from '@/lib/types';

const FOCUS_SUBDOMAINS = ['shop', 'api', 'media', 'analytics'] as const;

export function DashboardShell() {
  const {
    aggregates,
    latestEvents,
    filters,
    setRate,
    selectWindow,
    windowSize,
    dropped,
    setMetrics,
  } = useDataContext();

  const [traffic, setTraffic] = useState(12_000);

  const sortedAggregates = useMemo(
    () =>
      Array.from(aggregates.values()).sort(
        (a, b) => a.bucketStart - b.bucketStart,
      ),
    [aggregates],
  );

  const filteredEvents = useMemo(() => {
    return latestEvents
      .filter((event) => {
        const subdomainOk =
          filters.subdomains.length === 0 ||
          filters.subdomains.includes(event.subdomain);
        const statusOk =
          event.status >= filters.status[0] &&
          event.status <= filters.status[1];
        const latencyOk =
          event.latencyMs >= filters.latency[0] &&
          event.latencyMs <= filters.latency[1];
        return subdomainOk && statusOk && latencyOk;
      })
      .slice(-5_000);
  }, [latestEvents, filters]);

  const lineSeries = useMemo<{
    series: ChartSeries[];
    domains: ChartDomains;
  }>(() => {
    if (sortedAggregates.length === 0) {
      return {
        series: [],
        domains: { x: [0, 1], y: [0, 1] },
      };
    }
    const len = sortedAggregates.length;
    const totalX = new Float32Array(len);
    const totalY = new Float32Array(len);
    let ptr = 0;
    let maxY = 0;

    const activeSubs =
      filters.subdomains.length > 0
        ? filters.subdomains
        : FOCUS_SUBDOMAINS;

    const seriesMap = new Map<string, { x: Float32Array; y: Float32Array }>();
    activeSubs.forEach((subdomain) => {
      seriesMap.set(subdomain, {
        x: new Float32Array(len),
        y: new Float32Array(len),
      });
    });

    for (const point of sortedAggregates) {
      totalX[ptr] = point.bucketStart;
      totalY[ptr] = point.rps;
      maxY = Math.max(maxY, point.rps);
      for (const subdomain of activeSubs) {
        const record = seriesMap.get(subdomain);
        if (!record) continue;
        record.x[ptr] = point.bucketStart;
        record.y[ptr] =
          (point.bySubdomain[subdomain as keyof typeof point.bySubdomain] *
            1_000) /
          point.bucketSize;
        maxY = Math.max(maxY, record.y[ptr]);
      }
      ptr += 1;
    }

    const series: ChartSeries[] = [
      {
        label: 'Total RPS',
        color: '#4db9e7',
        x: totalX,
        y: totalY,
      },
    ];

    seriesMap.forEach((record, key) => {
      series.push({
        label: `${key}.dummdomain`,
        color: getColorForSubdomain(key),
        x: record.x,
        y: record.y,
      });
    });

    return {
      series,
      domains: {
        x: [sortedAggregates[0].bucketStart, sortedAggregates[len - 1].bucketStart],
        y: [0, maxY * 1.2],
      },
    };
  }, [sortedAggregates, filters.subdomains]);

  const barSeries = useMemo(() => {
    const latestBuckets = sortedAggregates.slice(-8);
    const categories = latestBuckets.map((point) =>
      new Date(point.bucketStart).toLocaleTimeString('en-US', {
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
      }),
    );
    const activeSubs =
      filters.subdomains.length > 0 ? filters.subdomains : FOCUS_SUBDOMAINS;
    const stacks = activeSubs.map((subdomain) => ({
      label: `${subdomain}.dummdomain`,
      color: getColorForSubdomain(subdomain),
      values: latestBuckets.map(
        (point) =>
          (point.bySubdomain[subdomain as keyof typeof point.bySubdomain] *
            1_000) /
          point.bucketSize,
      ),
    }));
    return { stacks, categories };
  }, [sortedAggregates, filters.subdomains]);

  const scatterPoints = useMemo(
    () =>
      filteredEvents.map((event) => ({
        x: event.ts,
        y: event.latencyMs,
      })),
    [filteredEvents],
  );

  const heatmap = useMemo(() => {
    const counts = new Map<string, number>();
    const pathTotals = new Map<string, number>();
    filteredEvents.forEach((event) => {
      const normalized = normalizePath(event.path);
      const key = `${event.subdomain}|${normalized}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      pathTotals.set(normalized, (pathTotals.get(normalized) ?? 0) + 1);
    });
    const topPaths = Array.from(pathTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path]) => path);
    const rows =
      filters.subdomains.length > 0
        ? filters.subdomains
        : SUBDOMAINS.slice(0, 8);
    const points = Array.from(counts.entries()).map(([key, weight]) => {
      const [subdomain, path] = key.split('|');
      return { x: path, y: subdomain, weight };
    });
    return {
      points,
      xLabels: topPaths,
      yLabels: rows,
    };
  }, [filteredEvents, filters.subdomains]);

  const topCards = useMemo(() => {
    const current = sortedAggregates[sortedAggregates.length - 1];
    const totalRps = current?.rps ?? 0;
    const errors = current?.errors ?? 0;
    const latency = current?.p95 ?? 0;
    return [
      {
        label: 'Current RPS',
        value: formatNumber(totalRps),
        badge: 'live',
      },
      {
        label: '95p latency',
        value: `${latency.toFixed(0)} ms`,
        badge: 'p95',
      },
      {
        label: 'Errors/min',
        value: errors.toString(),
        badge: '5xx',
      },
    ];
  }, [sortedAggregates]);

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-950 px-6 pb-16 pt-6 text-slate-50">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            dummdomain Network Pulse
          </h1>
          <p className="text-sm text-slate-400">
            Real-time traffic analytics across 12 subdomains with 100k req/s simulation capability.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {topCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 shadow-lg"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{card.label}</span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 uppercase tracking-wide text-[10px] text-slate-500">
                  {card.badge}
                </span>
              </div>
              <div className="pt-2 text-lg font-semibold text-slate-50">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <TrafficControl
            value={traffic}
            onChange={(value) => {
              setTraffic(value);
              setRate(value);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TimeRangeSelector
              value={windowSize}
              onChange={(windowKey: AggregationWindow) => selectWindow(windowKey)}
            />
            <PerformanceMonitor targetDropped={dropped} onMetrics={setMetrics} />
          </div>
        </div>
        <FilterPanel />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <LineChart
          series={lineSeries.series}
          xDomain={lineSeries.domains.x}
          yDomain={lineSeries.domains.y}
          title="Requests per second"
        />
        <ScatterPlot
          points={scatterPoints}
          title="Latency timeline"
          sampleSize={2_000}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <BarChart
          stacks={barSeries.stacks}
          categories={barSeries.categories}
          title="Subdomain load (recent buckets)"
        />
        <Heatmap
          points={heatmap.points}
          xLabels={heatmap.xLabels}
          yLabels={heatmap.yLabels}
          title="Path intensity"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">
          Recent requests
        </h2>
        <DataTable rows={filteredEvents.slice().reverse()} />
      </section>
    </div>
  );
}

function normalizePath(path: string): string {
  return path.replace(/[0-9a-f]{4,}/gi, ':id').replace(/\d+/g, ':id');
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}
