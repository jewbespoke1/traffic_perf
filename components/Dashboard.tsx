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
import {
  AggregatePoint,
  AggregationWindow,
  ChartDomains,
  ChartSeries,
  SUBDOMAINS,
} from '@/lib/types';

const FOCUS_SUBDOMAINS = ['shop', 'api', 'media', 'analytics'] as const;

function createEmptyPoint(ts: number, bucketSize: number): AggregatePoint {
  const bySubdomain: AggregatePoint['bySubdomain'] = {
    www: 0,
    api: 0,
    auth: 0,
    cdn: 0,
    media: 0,
    blog: 0,
    shop: 0,
    support: 0,
    status: 0,
    dev: 0,
    docs: 0,
    analytics: 0,
  };
  return {
    bucketStart: ts,
    bucketSize,
    rps: 0,
    bySubdomain,
    p50: 0,
    p95: 0,
    errors: 0,
    totalRequests: 0,
  };
}

export function DashboardShell() {
  const {
    aggregates,
    latestEvents,
    filters,
    setRate,
    setProfile,
    selectWindow,
    windowSize,
    dropped,
    setMetrics,
  } = useDataContext();

  const [traffic, setTraffic] = useState(12_000);
  const [autoProfile, setAutoProfile] = useState(true);

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

  const latestBucketTs = sortedAggregates.length
    ? sortedAggregates[sortedAggregates.length - 1].bucketStart
    : 0;

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

    const bucketSize = sortedAggregates[0]?.bucketSize ?? 1_000;
    const latest = sortedAggregates[sortedAggregates.length - 1];
    const bucketCount = Math.max(1, Math.ceil(60_000 / bucketSize));
    const normalizedEnd = latest.bucketStart;
    const normalizedStart = normalizedEnd - (bucketCount - 1) * bucketSize;
    const horizonEnd = normalizedEnd + bucketSize;
    const bucketMap = new Map(sortedAggregates.map((point) => [point.bucketStart, point]));

    const activeSubs =
      filters.subdomains.length > 0 ? filters.subdomains : FOCUS_SUBDOMAINS;

    const totalX = new Float32Array(bucketCount);
    const totalY = new Float32Array(bucketCount);
    const subSeries = new Map<string, { x: Float32Array; y: Float32Array }>();
    activeSubs.forEach((subdomain) => {
      subSeries.set(subdomain, {
        x: new Float32Array(bucketCount),
        y: new Float32Array(bucketCount),
      });
    });

    let maxY = 0;
    let ptr = 0;
    for (let ts = normalizedStart; ts <= normalizedEnd; ts += bucketSize) {
      const point = bucketMap.get(ts) ?? createEmptyPoint(ts, bucketSize);
      totalX[ptr] = ts;
      totalY[ptr] = point.rps;
      maxY = Math.max(maxY, point.rps);

      for (const subdomain of activeSubs) {
        const record = subSeries.get(subdomain);
        if (!record) continue;
        record.x[ptr] = ts;
        const perSecond =
          (point.bySubdomain[subdomain as keyof typeof point.bySubdomain] * 1_000) /
          point.bucketSize;
        record.y[ptr] = perSecond;
        maxY = Math.max(maxY, perSecond);
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

    subSeries.forEach((record, key) => {
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
        x: [normalizedStart, horizonEnd],
        y: [0, Math.max(maxY * 1.15, 1)],
      },
    };
  }, [sortedAggregates, filters.subdomains]);

  const barSeries = useMemo(() => {
    if (sortedAggregates.length === 0) {
      return { stacks: [], categories: [] as string[] };
    }
    const bucketSize = sortedAggregates[0]?.bucketSize ?? 1_000;
    const latest = sortedAggregates[sortedAggregates.length - 1];
    const bucketCount = Math.max(1, Math.ceil(15_000 / bucketSize));
    const normalizedEnd = latest.bucketStart;
    const normalizedStart = normalizedEnd - (bucketCount - 1) * bucketSize;
    const bucketMap = new Map(sortedAggregates.map((point) => [point.bucketStart, point]));
    const activeSubs =
      filters.subdomains.length > 0 ? filters.subdomains : FOCUS_SUBDOMAINS;

    const categories: string[] = [];
    const matrix: Record<string, number[]> = {};
    activeSubs.forEach((subdomain) => {
      matrix[subdomain] = new Array(bucketCount).fill(0);
    });

    let index = 0;
    for (let ts = normalizedStart; ts <= normalizedEnd; ts += bucketSize) {
      const point = bucketMap.get(ts) ?? createEmptyPoint(ts, bucketSize);
      categories.push(
        new Date(ts).toLocaleTimeString('en-US', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        }),
      );
      for (const subdomain of activeSubs) {
        const rps =
          (point.bySubdomain[subdomain as keyof typeof point.bySubdomain] * 1_000) /
          point.bucketSize;
        matrix[subdomain][index] = rps;
      }
      index += 1;
    }

    const stacks = activeSubs.map((subdomain) => ({
      label: `${subdomain}.dummdomain`,
      color: getColorForSubdomain(subdomain),
      values: matrix[subdomain],
    }));
    return { stacks, categories };
  }, [sortedAggregates, filters.subdomains]);

  const scatterData = useMemo(() => {
    if (filteredEvents.length === 0) {
      return {
        points: [] as { x: number; y: number }[],
        domain: { x: [0, 1], y: [0, 1] } satisfies ChartDomains,
      };
    }
    const fallbackTs = latestBucketTs || filteredEvents[filteredEvents.length - 1].ts;
    const latestTs = filteredEvents[filteredEvents.length - 1]?.ts ?? fallbackTs;
    const horizonStart = latestTs - 60_000;
    const recent = filteredEvents
      .filter((event) => event.ts >= horizonStart)
      .sort((a, b) => a.ts - b.ts);
    const maxLatency =
      recent.reduce((max, event) => Math.max(max, event.latencyMs), 0) || 100;
    return {
      points: recent.map((event) => ({
        x: event.ts,
        y: event.latencyMs,
      })),
      domain: {
        x: [horizonStart, latestTs] as [number, number],
        y: [0, Math.max(maxLatency * 1.1, 50)] as [number, number],
      } satisfies ChartDomains,
    };
  }, [filteredEvents, latestBucketTs]);

  const heatmap = useMemo(() => {
    if (filteredEvents.length === 0) {
      return {
        points: [] as { x: string; y: string; weight: number }[],
        xLabels: [] as string[],
        yLabels: [] as string[],
      };
    }

    const fallbackTs =
      latestBucketTs || filteredEvents[filteredEvents.length - 1]?.ts || 0;
    const latestTs = filteredEvents[filteredEvents.length - 1]?.ts ?? fallbackTs;
    const horizonStart = latestTs - 60_000;
    const recent = filteredEvents.filter((event) => event.ts >= horizonStart);

    const counts = new Map<string, number>();
    const pathTotals = new Map<string, number>();
    recent.forEach((event) => {
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
  }, [filteredEvents, filters.subdomains, latestBucketTs]);

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
              if (autoProfile) {
                setAutoProfile(false);
                setProfile(false);
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const next = !autoProfile;
              setAutoProfile(next);
              setProfile(next);
            }}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
              autoProfile
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-100'
                : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <span>{autoProfile ? 'Circadian profile enabled' : 'Manual traffic control'}</span>
            <span className="uppercase tracking-wide">
              {autoProfile ? 'on' : 'off'}
            </span>
          </button>
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
          points={scatterData.points}
          domain={scatterData.domain}
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
