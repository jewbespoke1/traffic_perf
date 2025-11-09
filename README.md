# dummdomain Performance Dashboard

High-frequency traffic simulator and real-time operations dashboard for `dummdomain` and its 12 subdomains. Built with Next.js 16 (App Router) and TypeScript, the UI maintains 60fps while visualizing 100k+ synthetic request events per second using custom Canvas + SVG rendering.

## Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Performance & Testing](#performance--testing)
- [Browser Support](#browser-support)
- [Feature Highlights](#feature-highlights)
- [Next.js & React Optimizations](#nextjs--react-optimizations)
- [Data Model](#data-model)

## Architecture Overview

- **App Router**: `app/dashboard/page.tsx` streams an initial 10-minute aggregate snapshot, then hydrates a client-only data provider.
- **Simulation Pipeline**:
  - `lib/dataGenerator.ts` produces Poisson-esque workloads with circadian modulation, bursts, and subdomain weighting.
  - Web Worker (`workers/traffic.worker.ts`) offloads batch generation (100 ms cadence) and enforces back-pressure.
  - `hooks/useDataStream.ts` merges worker batches, manages retention (1h), down-samples events, and exposes aggregation windows.
- **Rendering**:
  - Canvas for high-density charts, SVG-styled overlays for axes/legends via handcrafted helpers in `lib/canvasUtils.ts`.
  - LOD (level-of-detail) utilities (`lib/lod.ts`) perform pixel decimation, reservoir sampling, and grid binning.
- **State Management**:
  - Lightweight React Context (`DataProvider`) + hooks, leveraging `useTransition`, memoization, and refs instead of external stores.

## Getting Started

```bash
npm install
npm run dev
```

Visit http://localhost:3000/dashboard to launch the simulator.

Environment variables are not required for local development.

## Available Scripts

- `npm run dev` – Start Next.js dev server with fast refresh.
- `npm run lint` – TypeScript-aware ESLint (React Compiler compliance checks).
- `npm run build` – Production build (Turbopack) + type checking.
- `npm run start` – Serve the production build locally (after `npm run build`).

## Performance & Testing

1. **Local Profiling**
   - Toggle presets (Off-Peak → Stress) to validate 2 k–100 k req/s.
   - Open Chrome DevTools → Performance tab, record a 10 s session; verify main-thread frame budget <16 ms.
   - Enable Chrome DevTools → Memory to ensure heap delta stays <1 MB over 15 minutes.
2. **Automated Checks**
   - `npm run lint` is required before committing.
   - `npm run build` executes full TS type checking and ensures Worker bundling succeeds.
3. **Manual QA**
   - Resize window across breakpoints (≥320px) and validate responsive grid realignment.
   - Test Safari (17+), Chrome, Edge, and Firefox for pointer controls (pan/zoom) and slider input.

Benchmark snapshots are documented in [`PERFORMANCE.md`](./PERFORMANCE.md).

## Browser Support

- **Desktop**: Chrome 118+, Edge 118+, Firefox 118+, Safari 17+.
- **Mobile / Tablet**: Latest iOS Safari and Android Chrome. Pointer gestures fall back to touch events; OffscreenCanvas is feature-detected.
- Graceful degradation: When Web Workers are unavailable, `useDataStream` falls back to main-thread generation with capped throughput.

## Feature Highlights

| Module | Description |
| ------ | ----------- |
| Realtime Traffic Controls | Slider (`0–100 k req/s`) with presets, circadian auto profile toggle, burst injection. |
| Line Chart | Canvas-rendered RPS timeline with pan/zoom, total + focus subdomain overlays, adaptive LOD. |
| Bar Chart | Recent bucket stack contributions per subdomain, responsive group sizing. |
| Scatter Plot | Reservoir-sampled latency timeline (2k points), highlighting jitter under load. |
| Heatmap | Subdomain × path intensity grid (top 10 normalized routes) with custom palette. |
| Data Table | Virtualized (32 px rows) stream of latest 5 000 filtered events with status coloring & payload sizing. |
| Performance HUD | FPS counter, render/process timings, JS heap (if available), drop counts. |

### Screenshots

Capture fresh screenshots after running `npm run dev`:

```text
public/screenshots/dashboard-overview.png
public/screenshots/traffic-controls.png
public/screenshots/performance-hud.png
```

Reference them in documentation or slide decks as needed:

```markdown
![Dashboard Overview](./public/screenshots/dashboard-overview.png)
```

## Next.js & React Optimizations

- **Server Components**: `app/dashboard/page.tsx` streams initial aggregate snapshot; API handler (`app/api/data/route.ts`) mirrors SSR path for tooling.
- **Client Boundary**: All interactive visualizations live beneath `DataProvider` client component.
- **Streaming**: App Router automatically streams initial payload (skeleton states optional via Suspense boundaries).
- **Memoization**:
  - `useMemo` for derived datasets (line, bar, heatmap) to avoid recalculating typed arrays.
  - `useTransition` for filter updates (`FilterPanel`) to keep FPS stable during heavy re-filtering.
- **Custom Hooks**:
  - `useChartRenderer` wraps `requestAnimationFrame` loops and consolidates Canvas draws in a single measured pass.
  - `usePanZoom` provides pointer-based navigation with domain clamping and reset.
  - `useVirtualization` handles scrolling offsets for the data table without third-party libs.
- **Off-Main-Thread Work**: Workers handle simulation to prevent blocking React rendering; fallback throttles throughput instead of dropping frames.

## Data Model

```ts
type Subdomain =
  | 'www' | 'api' | 'auth' | 'cdn' | 'media' | 'blog'
  | 'shop' | 'support' | 'status' | 'dev' | 'docs' | 'analytics';

interface RequestEvent {
  ts: number;
  subdomain: Subdomain;
  path: string;
  status: number;
  latencyMs: number;
  sizeBytes: number;
}

interface AggregatePoint {
  bucketStart: number;
  bucketSize: number;
  rps: number;
  bySubdomain: Record<Subdomain, number>;
  p50: number;
  p95: number;
  errors: number;
  totalRequests: number;
}
```

Subdomain paths are normalized (dynamic segments collapsed to `:id`) for heatmap bucketing. Aggregation windows (1 m / 5 m / 1 h) are derived on demand inside `useDataStream`.

---

For deep performance notes, implementation trade-offs, and scaling ideas see [`PERFORMANCE.md`](./PERFORMANCE.md).

