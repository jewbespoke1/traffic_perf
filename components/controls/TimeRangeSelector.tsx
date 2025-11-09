'use client';

import { AggregationWindow } from '@/lib/types';

type TimeRangeSelectorProps = {
  value: AggregationWindow;
  onChange: (value: AggregationWindow) => void;
};

const OPTIONS: AggregationWindow[] = ['1m', '5m', '1h'];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Time range
      </h3>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onChange(option)}
            className={`rounded px-3 py-1 text-xs ${
              option === value
                ? 'border border-sky-400 bg-sky-500/20 text-sky-100'
                : 'border border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-100'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

