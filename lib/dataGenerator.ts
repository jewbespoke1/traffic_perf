import { aggregate } from './aggregation';
import { SUBDOMAINS, Subdomain, AggregatePoint, RequestEvent } from './types';

type RNG = () => number;

const defaultWeights: Record<Subdomain, number> = {
  www: 1.8,
  api: 1.4,
  auth: 0.6,
  cdn: 1.2,
  media: 0.8,
  blog: 0.7,
  shop: 1.3,
  support: 0.5,
  status: 0.2,
  dev: 0.4,
  docs: 0.9,
  analytics: 1.0,
};

const subdomainPaths: Record<Subdomain, string[]> = {
  www: ['/', '/news', '/trending', '/search', '/category/:id', '/article/:id'],
  api: [
    '/v1/users',
    '/v1/orders',
    '/v1/checkout',
    '/v1/inventory',
    '/v2/analytics',
    '/v2/feature-flags',
  ],
  auth: ['/login', '/logout', '/refresh', '/oauth/callback', '/password/reset'],
  cdn: ['/assets/:hash', '/images/:id', '/video/:id', '/fonts/:hash'],
  media: ['/stream/:id', '/playlist/:id', '/upload', '/transcode/:id'],
  blog: ['/', '/tags/:tag', '/authors/:id', '/archive/:year/:month', '/post/:slug'],
  shop: ['/product/:id', '/checkout', '/cart', '/recommendations', '/offers'],
  support: ['/ticket/:id', '/livechat', '/faq', '/status', '/docs/:topic'],
  status: ['/', '/history', '/incidents/:id', '/metrics'],
  dev: ['/docs', '/sdk/download', '/playground', '/apps/:id/logs'],
  docs: ['/guide/:id', '/reference', '/tutorials', '/api/:version', '/examples'],
  analytics: ['/dash', '/segments', '/reports/:id', '/funnels', '/realtime'],
};

const latencyProfiles: Record<
  Subdomain,
  { base: number; jitter: number; heavyTail: number }
> = {
  www: { base: 85, jitter: 30, heavyTail: 200 },
  api: { base: 95, jitter: 40, heavyTail: 250 },
  auth: { base: 110, jitter: 55, heavyTail: 300 },
  cdn: { base: 45, jitter: 20, heavyTail: 120 },
  media: { base: 130, jitter: 65, heavyTail: 340 },
  blog: { base: 75, jitter: 28, heavyTail: 180 },
  shop: { base: 120, jitter: 60, heavyTail: 320 },
  support: { base: 140, jitter: 70, heavyTail: 380 },
  status: { base: 65, jitter: 24, heavyTail: 150 },
  dev: { base: 90, jitter: 35, heavyTail: 220 },
  docs: { base: 80, jitter: 30, heavyTail: 190 },
  analytics: { base: 150, jitter: 80, heavyTail: 420 },
};

const sizeProfiles: Record<Subdomain, { base: number; jitter: number }> = {
  www: { base: 90_000, jitter: 25_000 },
  api: { base: 18_000, jitter: 5_000 },
  auth: { base: 12_000, jitter: 3_000 },
  cdn: { base: 320_000, jitter: 170_000 },
  media: { base: 1_200_000, jitter: 650_000 },
  blog: { base: 160_000, jitter: 55_000 },
  shop: { base: 210_000, jitter: 70_000 },
  support: { base: 140_000, jitter: 45_000 },
  status: { base: 70_000, jitter: 18_000 },
  dev: { base: 95_000, jitter: 25_000 },
  docs: { base: 85_000, jitter: 24_000 },
  analytics: { base: 260_000, jitter: 90_000 },
};

let rng: RNG = mulberry32(Date.now());
let targetRps = 10_000;
let profileEnabled = true;
let currentWeights: Record<Subdomain, number> = { ...defaultWeights };
let circadianPhase = 0;
let simTs = Date.now();

type BurstState = {
  probabilityPerSec: number;
  multiplier: number;
  durationMs: number;
  active: boolean;
  remainingMs: number;
};

const burstState: BurstState = {
  probabilityPerSec: 0.04,
  multiplier: 2.5,
  durationMs: 8_000,
  active: false,
  remainingMs: 0,
};

export function initTrafficModel(seed?: number) {
  rng = mulberry32(seed ?? Date.now());
  currentWeights = { ...defaultWeights };
  simTs = Date.now();
  circadianPhase = randFloat(0, Math.PI * 2);
  burstState.active = false;
  burstState.remainingMs = 0;
}

export function setTrafficRate(rps: number) {
  targetRps = Math.max(0, Math.min(100_000, rps));
}

export function setCircadianProfile(enabled: boolean) {
  profileEnabled = enabled;
}

export function setSubdomainWeights(
  weights: Partial<Record<Subdomain, number>>,
) {
  currentWeights = {
    ...defaultWeights,
    ...weights,
  };
}

export function randomBurst(probabilityPerSec: number, multiplier: number) {
  burstState.probabilityPerSec = Math.max(0, probabilityPerSec);
  burstState.multiplier = Math.max(1, multiplier);
}

export function getEmphasisWeights(): Record<Subdomain, number> {
  const overrides: Partial<Record<Subdomain, number>> = {
    shop: 1.8,
    media: 1.6,
    api: 1.5,
    analytics: 1.5,
    www: 1.4,
    support: 1.1,
  };
  const record = {} as Record<Subdomain, number>;
  for (const key of SUBDOMAINS) {
    record[key] = overrides[key] ?? 1;
  }
  return record;
}

export function nextRequestBatch(dtMs: number): RequestEvent[] {
  if (dtMs <= 0) {
    return [];
  }

  simTs += dtMs;
  const now = simTs;

  const circadianMultiplier = profileEnabled
    ? 0.65 + 0.45 * Math.sin((now / 3_600_000) * Math.PI * 2 + circadianPhase)
    : 1;

  let effectiveRps = targetRps * circadianMultiplier;

  if (!burstState.active) {
    const eventProbability = 1 - Math.exp(
      (-burstState.probabilityPerSec * dtMs) / 1_000,
    );
    if (rand() < eventProbability) {
      burstState.active = true;
      burstState.remainingMs = burstState.durationMs;
    }
  } else {
    effectiveRps *= burstState.multiplier;
    burstState.remainingMs -= dtMs;
    if (burstState.remainingMs <= 0) {
      burstState.active = false;
    }
  }

  const expected = (effectiveRps * dtMs) / 1_000;
  const reqCount = sampleCount(expected);
  if (reqCount === 0) {
    return [];
  }

  const events: RequestEvent[] = new Array(reqCount);
  for (let i = 0; i < reqCount; i++) {
    const subdomain = pickSubdomain();
    const ts = now - rand() * dtMs;
    events[i] = {
      ts,
      subdomain,
      path: interpolatePath(subdomain, pickPath(subdomain)),
      status: pickStatus(),
      latencyMs: sampleLatency(subdomain),
      sizeBytes: sampleSize(subdomain),
    };
  }
  return events;
}

export function generateInitialSnapshot(
  minutes: number,
  bucketMs = 1_000,
): AggregatePoint[] {
  const totalMs = Math.max(minutes, 1) * 60 * 1_000;
  const iterations = Math.ceil(totalMs / bucketMs);
  const snapshotEvents: RequestEvent[] = [];
  const originalTs = simTs;

  for (let i = 0; i < iterations; i++) {
    const batch = nextRequestBatch(bucketMs);
    snapshotEvents.push(...batch);
  }

  simTs = originalTs;

  const aggregated = aggregate(snapshotEvents, bucketMs);
  return Array.from(aggregated.values()).sort(
    (a, b) => a.bucketStart - b.bucketStart,
  );
}

function pickSubdomain(): Subdomain {
  const totalWeight = SUBDOMAINS.reduce(
    (sum, key) => sum + currentWeights[key],
    0,
  );
  const roll = rand() * totalWeight;
  let acc = 0;
  for (const key of SUBDOMAINS) {
    acc += currentWeights[key];
    if (roll <= acc) {
      return key;
    }
  }
  return SUBDOMAINS[SUBDOMAINS.length - 1];
}

function pickPath(subdomain: Subdomain): string {
  const paths = subdomainPaths[subdomain];
  return paths[Math.floor(rand() * paths.length)];
}

function interpolatePath(subdomain: Subdomain, template: string): string {
  if (!template.includes(':')) {
    return template;
  }
  return template.replace(/:([a-z]+)/g, (_, key) => {
    switch (key) {
      case 'id':
        return String(Math.floor(rand() * 10_000));
      case 'slug':
        return `article-${Math.floor(rand() * 5_000)}`;
      case 'hash':
        return Math.random().toString(36).slice(2, 10);
      case 'tag':
        return ['performance', 'security', 'release', 'growth'][
          Math.floor(rand() * 4)
        ];
      case 'topic':
        return ['triage', 'billing', 'infra', 'api'][Math.floor(rand() * 4)];
      case 'version':
        return ['v1', 'v2', 'beta'][Math.floor(rand() * 3)];
      case 'year':
        return String(2022 + Math.floor(rand() * 4));
      case 'month':
        return String(1 + Math.floor(rand() * 12)).padStart(2, '0');
      default:
        return `${key}-${Math.floor(rand() * 1_000)}`;
    }
  });
}

function pickStatus(): number {
  const roll = rand();
  if (roll < 0.92) return 200;
  if (roll < 0.98) return [400, 401, 403, 404][Math.floor(rand() * 4)];
  return [500, 502, 503, 504][Math.floor(rand() * 4)];
}

function sampleLatency(subdomain: Subdomain): number {
  const profile = latencyProfiles[subdomain];
  const base = normal(profile.base, profile.jitter);
  if (rand() < 0.06) {
    return Math.max(20, base + rand() * profile.heavyTail);
  }
  return Math.max(12, base);
}

function sampleSize(subdomain: Subdomain): number {
  const profile = sizeProfiles[subdomain];
  return Math.max(1_800, normal(profile.base, profile.jitter));
}

function sampleCount(expected: number): number {
  if (expected <= 0) return 0;
  if (expected < 20) {
    // Knuth algorithm for small lambdas
    const L = Math.exp(-expected);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rand();
    } while (p > L);
    return k - 1;
  }
  const gaussian = normal(expected, Math.sqrt(expected));
  return Math.max(0, Math.round(gaussian));
}

let spare: number | undefined;
let hasSpare = false;

function normal(mean: number, stdDev: number): number {
  if (stdDev <= 0) {
    return mean;
  }
  if (hasSpare && spare !== undefined) {
    hasSpare = false;
    const val = spare;
    spare = undefined;
    return mean + stdDev * val;
  }
  let u: number;
  let v: number;
  let s: number;
  do {
    u = rand() * 2 - 1;
    v = rand() * 2 - 1;
    s = u * u + v * v;
  } while (s === 0 || s >= 1);
  const mul = Math.sqrt((-2 * Math.log(s)) / s);
  spare = v * mul;
  hasSpare = true;
  return mean + stdDev * u * mul;
}

function rand(): number {
  return rng();
}

function randFloat(min: number, max: number): number {
  return min + rand() * (max - min);
}

function mulberry32(seed: number): RNG {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
