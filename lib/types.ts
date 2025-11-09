export const SUBDOMAINS = [
  'www',
  'api',
  'auth',
  'cdn',
  'media',
  'blog',
  'shop',
  'support',
  'status',
  'dev',
  'docs',
  'analytics',
] as const;

export type Subdomain = (typeof SUBDOMAINS)[number];

export interface RequestEvent {
  ts: number;
  subdomain: Subdomain;
  path: string;
  status: number;
  latencyMs: number;
  sizeBytes: number;
}

export interface AggregatePoint {
  bucketStart: number;
  bucketSize: number;
  rps: number;
  bySubdomain: Record<Subdomain, number>;
  p50: number;
  p95: number;
  errors: number;
  totalRequests: number;
}

export interface PerformanceMetrics {
  fps: number;
  memMB?: number;
  renderMs: number;
  processMs: number;
  dropped: number;
}

export type AggregationWindow = '1m' | '5m' | '1h';

export interface TrafficState {
  targetRps: number;
  profileEnabled: boolean;
  seed?: number;
}

export interface ChartDomains {
  x: [number, number];
  y: [number, number];
}

export interface HeatmapMatrix {
  cols: number;
  rows: number;
  matrix: Uint32Array;
  xLabels: string[];
  yLabels: string[];
}

export interface ChartSeries {
  color: string;
  label: string;
  x: Float32Array;
  y: Float32Array;
}

export interface SimulationMetrics {
  produced: number;
  dropped: number;
}

