import { AggregatePoint, RequestEvent, SUBDOMAINS, Subdomain } from './types';

export function toBucket(ts: number, bucketMs: number): number {
  const size = Math.max(1, bucketMs);
  return Math.floor(ts / size) * size;
}

export function aggregate(
  events: readonly RequestEvent[],
  bucketMs: number,
): Map<number, AggregatePoint> {
  const buckets = new Map<number, AggregatePoint>();
  const latencies = new Map<number, number[]>();

  for (const event of events) {
    const bucketStart = toBucket(event.ts, bucketMs);
    let bucket = buckets.get(bucketStart);
    if (!bucket) {
      bucket = createEmptyAggregate(bucketStart, bucketMs);
      buckets.set(bucketStart, bucket);
    }
    bucket.totalRequests += 1;
    bucket.rps = bucket.totalRequests * (1_000 / bucketMs);
    bucket.bySubdomain[event.subdomain] += 1;
    if (event.status >= 500) {
      bucket.errors += 1;
    }

    let arr = latencies.get(bucketStart);
    if (!arr) {
      arr = [];
      latencies.set(bucketStart, arr);
    }
    arr.push(event.latencyMs);
  }

  for (const [bucketStart, bucket] of buckets.entries()) {
    const arr = latencies.get(bucketStart);
    if (!arr || arr.length === 0) {
      bucket.p50 = 0;
      bucket.p95 = 0;
      continue;
    }
    arr.sort((a, b) => a - b);
    const [p50, p95] = computePercentiles(arr, [0.5, 0.95]);
    bucket.p50 = p50;
    bucket.p95 = p95;
  }

  return buckets;
}

export function mergeAggregates(
  a: Map<number, AggregatePoint>,
  b: Map<number, AggregatePoint>,
): Map<number, AggregatePoint> {
  const result = new Map<number, AggregatePoint>();
  for (const [key, value] of a.entries()) {
    result.set(key, cloneAggregate(value));
  }
  for (const [key, value] of b.entries()) {
    const existing = result.get(key);
    if (!existing) {
      result.set(key, cloneAggregate(value));
      continue;
    }
    existing.totalRequests += value.totalRequests;
    existing.errors += value.errors;
    existing.rps = existing.totalRequests * (1_000 / existing.bucketSize);
    for (const sub of SUBDOMAINS) {
      existing.bySubdomain[sub] += value.bySubdomain[sub];
    }
    existing.p50 = (existing.p50 + value.p50) / 2;
    existing.p95 = (existing.p95 + value.p95) / 2;
  }
  return result;
}

export function computePercentiles(
  sortedSamples: readonly number[],
  quantiles: readonly number[],
): number[] {
  if (sortedSamples.length === 0) {
    return quantiles.map(() => 0);
  }
  return quantiles.map((q) => {
    const clamped = Math.min(1, Math.max(0, q));
    const position = (sortedSamples.length - 1) * clamped;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) {
      return sortedSamples[lowerIndex];
    }
    const weight = position - lowerIndex;
    return (
      sortedSamples[lowerIndex] * (1 - weight) +
      sortedSamples[upperIndex] * weight
    );
  });
}

function createEmptyAggregate(
  bucketStart: number,
  bucketSize: number,
): AggregatePoint {
  const bySubdomain = {} as Record<Subdomain, number>;
  for (const sub of SUBDOMAINS) {
    bySubdomain[sub] = 0;
  }
  return {
    bucketStart,
    bucketSize,
    rps: 0,
    bySubdomain,
    p50: 0,
    p95: 0,
    errors: 0,
    totalRequests: 0,
  };
}

function cloneAggregate(source: AggregatePoint): AggregatePoint {
  const bySubdomain = {} as Record<Subdomain, number>;
  for (const sub of SUBDOMAINS) {
    bySubdomain[sub] = source.bySubdomain[sub];
  }
  return {
    bucketStart: source.bucketStart,
    bucketSize: source.bucketSize,
    rps: source.rps,
    bySubdomain,
    p50: source.p50,
    p95: source.p95,
    errors: source.errors,
    totalRequests: source.totalRequests,
  };
}

