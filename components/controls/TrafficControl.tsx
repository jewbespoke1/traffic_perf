'use client';

import { ChangeEvent } from 'react';

type TrafficControlProps = {
  value: number;
  onChange: (value: number) => void;
  onPreset?: (value: number) => void;
};

const PRESETS: { label: string; value: number }[] = [
  { label: 'Idle', value: 0 },
  { label: 'Off-Peak', value: 2_000 },
  { label: 'Baseline', value: 10_000 },
  { label: 'Peak', value: 25_000 },
  { label: 'Stress', value: 100_000 },
];

export function TrafficControl({
  value,
  onChange,
  onPreset,
}: TrafficControlProps) {
  const handleSlider = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Traffic</h3>
        <span className="text-xs text-slate-400">{formatNumber(value)} req/s</span>
      </div>
      <input
        type="range"
        min={0}
        max={100_000}
        value={value}
        step={500}
        onChange={handleSlider}
        className="accent-sky-400"
      />
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.label}
            onClick={() => {
              onChange(preset.value);
              onPreset?.(preset.value);
            }}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-sky-400 hover:text-sky-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatNumber(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

