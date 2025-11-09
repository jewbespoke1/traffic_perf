'use client';

import { ChangeEvent, useMemo } from 'react';

import { useDataContext } from '@/components/providers/DataProvider';
import { SUBDOMAINS } from '@/lib/types';

const STATUS_BUCKETS: { label: string; range: [number, number] }[] = [
  { label: '2xx', range: [200, 299] },
  { label: '4xx', range: [400, 499] },
  { label: '5xx', range: [500, 599] },
];

export function FilterPanel() {
  const { filters, setFilters, isPending } = useDataContext();

  const latencySteps = useMemo(
    () => [50, 100, 200, 400, 800, 1600, 3200],
    [],
  );

  const toggleSubdomain = (subdomain: string) => {
    const hasSubdomain = filters.subdomains.includes(subdomain);
    const next = hasSubdomain
      ? filters.subdomains.filter((value) => value !== subdomain)
      : [...filters.subdomains, subdomain];
    setFilters({ ...filters, subdomains: next });
  };

  const setStatusRange = (range: [number, number]) => {
    setFilters({ ...filters, status: range });
  };

  const updateLatency = (event: ChangeEvent<HTMLInputElement>) => {
    const upper = Number(event.target.value);
    setFilters({ ...filters, latency: [0, upper] });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Filters</h3>
        {isPending ? <span className="text-xs text-sky-400">updating…</span> : null}
      </header>
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Subdomains
        </h4>
        <div className="flex flex-wrap gap-2">
          {SUBDOMAINS.map((subdomain) => {
            const active =
              filters.subdomains.length === 0 ||
              filters.subdomains.includes(subdomain);
            return (
              <button
                key={subdomain}
                type="button"
                onClick={() => toggleSubdomain(subdomain)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? 'border border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {subdomain}.dummdomain
              </button>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Status buckets
        </h4>
        <div className="flex gap-2">
          {STATUS_BUCKETS.map((bucket) => {
            const active =
              filters.status[0] === bucket.range[0] &&
              filters.status[1] === bucket.range[1];
            return (
              <button
                key={bucket.label}
                type="button"
                onClick={() => setStatusRange(bucket.range)}
                className={`rounded px-3 py-1 text-xs ${
                  active
                    ? 'border border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {bucket.label}
              </button>
            );
          })}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Latency ceiling
        </h4>
        <input
          type="range"
          min={latencySteps[0]}
          max={latencySteps[latencySteps.length - 1]}
          step={50}
          value={filters.latency[1]}
          onChange={updateLatency}
          className="accent-sky-400"
        />
        <div className="flex justify-between text-[10px] uppercase text-slate-500">
          <span>0ms</span>
          <span>{filters.latency[1]}ms</span>
        </div>
      </section>
    </div>
  );
}

