'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
} from 'react';

import { useDataStream } from '@/hooks/useDataStream';
import { AggregatePoint, AggregationWindow, PerformanceMetrics, RequestEvent } from '@/lib/types';

type FilterState = {
  subdomains: string[];
  paths: string[];
  status: [number, number];
  latency: [number, number];
};

type DataContextValue = {
  aggregates: Map<number, AggregatePoint>;
  latestEvents: RequestEvent[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  dropped: number;
  setRate: (rps: number) => void;
  setProfile: (enabled: boolean) => void;
  reset: () => void;
  windowSize: AggregationWindow;
  selectWindow: (windowKey: AggregationWindow) => void;
  metrics: PerformanceMetrics | null;
  setMetrics: (metrics: PerformanceMetrics) => void;
  isPending: boolean;
};

const DataContext = createContext<DataContextValue | undefined>(undefined);

type DataProviderProps = {
  initialData: AggregatePoint[];
  children: ReactNode;
};

const defaultFilters: FilterState = {
  subdomains: [],
  paths: [],
  status: [200, 599],
  latency: [0, 2_000],
};

export function DataProvider({ initialData, children }: DataProviderProps) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isPending, startTransition] = useTransition();

  const stream = useDataStream({
    initialRps: 12_000,
    profile: true,
    bucketMs: 1_000,
    retentionMs: 60 * 60 * 1_000,
    initialAggregates: initialData,
    worker: true,
  });

  const value = useMemo<DataContextValue>(
    () => ({
      aggregates: stream.aggregates,
      latestEvents: stream.latestEvents,
      filters,
      setFilters: (next) => startTransition(() => setFilters(next)),
      dropped: stream.dropped,
      setRate: stream.setRate,
      setProfile: stream.setProfile,
      reset: stream.reset,
      windowSize: stream.windowSize,
      selectWindow: stream.selectWindow,
      metrics,
      setMetrics,
      isPending,
    }),
    [
      stream.aggregates,
      stream.latestEvents,
      filters,
      stream.dropped,
      stream.setRate,
      stream.setProfile,
      stream.reset,
      stream.windowSize,
      stream.selectWindow,
      metrics,
      isPending,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
}

