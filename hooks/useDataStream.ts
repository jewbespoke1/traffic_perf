'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { aggregate, mergeAggregates, toBucket } from '@/lib/aggregation';
import {
  getEmphasisWeights,
  initTrafficModel,
  nextRequestBatch,
  randomBurst,
  setCircadianProfile,
  setSubdomainWeights,
  setTrafficRate,
} from '@/lib/dataGenerator';
import {
  AggregatePoint,
  AggregationWindow,
  RequestEvent,
  SUBDOMAINS,
} from '@/lib/types';

type UseDataStreamOptions = {
  initialRps: number;
  profile?: boolean;
  bucketMs?: number;
  retentionMs?: number;
  worker?: boolean;
  bufferCapacity?: number;
  burst?: { probabilityPerSec: number; multiplier: number };
  initialAggregates?: AggregatePoint[];
  initialEvents?: RequestEvent[];
};

const WINDOW_TO_BUCKET: Record<AggregationWindow, number> = {
  '1m': 1_000,
  '5m': 5_000,
  '1h': 60_000,
};

export function useDataStream({
  initialRps,
  profile = true,
  bucketMs = 1_000,
  retentionMs = 60 * 60 * 1_000,
  worker = true,
  bufferCapacity = 200_000,
  burst = { probabilityPerSec: 0.04, multiplier: 2.5 },
  initialAggregates,
  initialEvents = [],
}: UseDataStreamOptions) {
  const [aggregates, setAggregates] = useState<Map<number, AggregatePoint>>(() =>
    initialAggregates
      ? aggregateFromPoints(
          initialAggregates.map((point) => ({
            ...point,
            bucketSize: bucketMs,
          })),
          bucketMs,
        )
      : new Map(),
  );
  const [latestEvents, setLatestEvents] = useState<RequestEvent[]>(initialEvents);
  const [dropped, setDropped] = useState(0);
  const [windowSize, setWindowSize] =
    useState<AggregationWindow>('1m');

  const workerRef = useRef<Worker | null>(null);
  const localInterval = useRef<number | null>(null);
  const hasWorkerSupport = useMemo(
    () => worker && typeof Worker !== 'undefined',
    [worker],
  );

  const retainAggregates = useCallback(
    (current: Map<number, AggregatePoint>) => {
      const cutoff = Date.now() - retentionMs;
      for (const key of current.keys()) {
        if (key < cutoff) {
          current.delete(key);
        }
      }
      return current;
    },
    [retentionMs],
  );

  const handleEvents = useCallback(
    (events: RequestEvent[], droppedCount = 0) => {
      if (events.length === 0 && droppedCount === 0) return;

      setDropped((value) => value + droppedCount);

      setAggregates((prev) => {
        const merged = mergeAggregates(prev, aggregate(events, bucketMs));
        return new Map(retainAggregates(merged));
      });

      setLatestEvents((prev) => {
        const next = [...prev, ...events];
        if (next.length > bufferCapacity) {
          next.splice(0, next.length - bufferCapacity);
        }
        return next;
      });
    },
    [bucketMs, bufferCapacity, retainAggregates],
  );

  useEffect(() => {
    initTrafficModel(Date.now());
    setTrafficRate(initialRps);
    setCircadianProfile(profile);
    randomBurst(burst.probabilityPerSec, burst.multiplier);
    setSubdomainWeights(getEmphasisWeights());
  }, [initialRps, profile, burst]);

  useEffect(() => {
    if (!initialAggregates) return;
    setAggregates(
      aggregateFromPoints(
        initialAggregates.map((point) => ({
          ...point,
          bucketSize: bucketMs,
        })),
        bucketMs,
      ),
    );
  }, [initialAggregates, bucketMs]);

  useEffect(() => {
    if (!hasWorkerSupport) {
      const interval = window.setInterval(() => {
        const events = nextRequestBatch(100);
        handleEvents(events);
      }, 100);
      localInterval.current = interval;
      return () => {
        if (interval) {
          window.clearInterval(interval);
        }
      };
    }

    const instance = new Worker(
      new URL('../workers/traffic.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = instance;
    instance.postMessage({
      type: 'start',
      rps: initialRps,
      profile,
      seed: Date.now(),
      burst,
    });
    instance.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === 'batch') {
        handleEvents(event.data.events, event.data.dropped);
      }
    };
    return () => {
      instance.postMessage({ type: 'stop' });
      instance.terminate();
      workerRef.current = null;
    };
  }, [hasWorkerSupport, handleEvents, initialRps, profile, burst]);

  const setRate = useCallback((rps: number) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'setRate', rps });
    } else {
      setTrafficRate(rps);
    }
  }, []);

  const setProfile = useCallback((enabled: boolean) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'setProfile', enabled });
    } else {
      setCircadianProfile(enabled);
    }
  }, []);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'start',
        rps: initialRps,
        profile,
        seed: Date.now(),
        burst,
      });
    } else {
      initTrafficModel(Date.now());
      setTrafficRate(initialRps);
      setCircadianProfile(profile);
    }
    setAggregates(new Map());
    setLatestEvents([]);
    setDropped(0);
  }, [initialRps, profile, burst]);

  const selectWindow = useCallback(
    (windowKey: AggregationWindow) => {
      setWindowSize(windowKey);
      const newBucket = WINDOW_TO_BUCKET[windowKey];
      setAggregates((prev) => {
        const flattened = Array.from(prev.values()).flatMap((point) => {
          return {
            bucketStart: toBucket(point.bucketStart, newBucket),
            bucketSize: newBucket,
            rps: point.rps,
            totalRequests: point.totalRequests,
            bySubdomain: point.bySubdomain,
            errors: point.errors,
            p50: point.p50,
            p95: point.p95,
          };
        });
        return aggregateFromPoints(flattened, newBucket);
      });
    },
    [],
  );

  return {
    aggregates,
    latestEvents,
    dropped,
    setRate,
    setProfile,
    reset,
    windowSize,
    selectWindow,
  };
}

type WorkerMessage =
  | { type: 'batch'; events: RequestEvent[]; dropped: number }
  | { type: 'ready' };

type FlatAggregate = Pick<
  AggregatePoint,
  | 'bucketStart'
  | 'bucketSize'
  | 'rps'
  | 'totalRequests'
  | 'errors'
  | 'p50'
  | 'p95'
  | 'bySubdomain'
>;

function aggregateFromPoints(
  points: FlatAggregate[],
  bucketSize: number,
): Map<number, AggregatePoint> {
  const map = new Map<number, AggregatePoint>();
  for (const point of points) {
    const start = toBucket(point.bucketStart, bucketSize);
    const existing = map.get(start);
    if (!existing) {
      const clone = {
        bucketStart: start,
        bucketSize,
        rps: point.totalRequests * (1_000 / bucketSize),
        totalRequests: point.totalRequests,
        errors: point.errors,
        p50: point.p50,
        p95: point.p95,
        bySubdomain: { ...point.bySubdomain },
      };
      map.set(start, clone);
    } else {
      existing.totalRequests += point.totalRequests;
      existing.errors += point.errors;
      existing.p50 = (existing.p50 + point.p50) / 2;
      existing.p95 = (existing.p95 + point.p95) / 2;
      for (const sub of SUBDOMAINS) {
        existing.bySubdomain[sub] += point.bySubdomain[sub];
      }
      existing.rps = existing.totalRequests * (1_000 / bucketSize);
    }
  }
  return map;
}
