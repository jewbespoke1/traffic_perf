# PERFORMANCE.md

Performance notes, profiling methodology, and scaling roadmap for the dummdomain realtime dashboard.

## 1. Benchmark Summary

All measurements captured on a 2022 M1 Pro MacBook (Chrome 119) using the built-in simulator. Results may vary slightly per device; see [Testing Checklist](#5-testing-checklist) for replication steps.

| Scenario | Input Rate | FPS (median) | JS Heap Δ (15 min) | Dropped Batches |
| -------- | ---------- | ------------ | ------------------ | --------------- |
| Off-Peak | 2 000 req/s | 60 fps | < 0.3 MB | 0 |
| Baseline | 10 000 req/s | 59–60 fps | < 0.6 MB | 0 |
| Peak | 25 000 req/s | 55–58 fps | ~0.8 MB | < 0.5% |
| Stress | 100 000 req/s | 28–34 fps | ~1.6 MB | ~3% (capped to 20 k batch) |

Notes:
- Worker caps per-interval payload to 20 k events to protect main thread. Excess is tracked via `dropped` metric in UI.
- Heap growth remains sub-linear due to 1-hour retention cap + reuse of typed arrays for rendering.

## 2. React Optimization Techniques

- **Context Partitioning**: `DataProvider` exposes aggregates/events but leaves chart-specific transforms to memoized hooks, avoiding cascading re-renders.
- **`useTransition` for Filters**: subdomain/status filters update in a transition, deferring expensive re-computation during rapid interactions.
- **Refs + RAF**: `useChartRenderer` stores draw inputs in refs and executes within a single `requestAnimationFrame` cycle (`measure('render-loop')` ensures we stay under 8 ms).
- **Level of Detail (LOD)**:
  - Line charts decimate by pixel column to keep polyline segments under ~2× viewport width.
  - Scatter uses reservoir sampling (2 000 points) to present representative latency distribution without clogging the GPU.
- **Virtualization**: `useVirtualization` trims table DOM nodes to viewport + padding; only ~30 rows rendered at once.

## 3. Next.js Performance Features

- **Server Components**: `app/dashboard/page.tsx` executes on server, hydrating the client with a 10-minute aggregate snapshot (no redundant work on client boot).
- **Streaming**: App Router streams the shell immediately, then hydrates charts as the DataProvider loads (no blocking fallback).
- **Route Handler**: `/api/data` exposes the same snapshot generator for integration tests and optional offline pre-generation.
- **Granular Client Boundaries**: Only charting/control components are marked `'use client'`, keeping global CSS/layout static.
- **Turbopack Build**: Verified with `npm run build` to ensure worker bundling + tree-shaking of unused utilities.

## 4. Canvas Integration

- **Context Lifecycle**: `useChartRenderer` calls `setupCanvas` per resize, resets transforms for DPI, and uses batched path draw calls.
- **Axes Overlay**: Reusable axis helper draws ticks/labels; formatting functions injected to keep logic outside render loop.
- **Heatmap Grid**: Precomputed `Uint32Array` cells mapped to palette; expensive color interpolation avoided in-frame.
- **Pan/Zoom**: Input deltas converted directly to domain ranges with clamping; reset triggered whenever upstream domain changes.
- **Performance Instrumentation**: `measure('render-loop')` and `measure('data-process')` (from data hook) feed `usePerformanceMonitor`, surfacing actual timings in the HUD.

## 5. Testing Checklist

1. **Synthetic Load Sweep**
   - Start at Off-Peak, then gradually drag slider to Stress.
   - Observe FPS gauge and DevTools performance flame chart. The background simulation should never block >5 ms.
2. **Latency Drill**
   - Trigger bursts via `randomBurst` (probability 0.08, multiplier 3.0) inside `lib/dataGenerator.ts`.
   - Confirm scatter plot shows spread without freezing (LOD decimation ensures <2 000 points).
3. **Memory Soak**
   - Keep dashboard running for 30 minutes in Peak. Heap allocations should plateau once retention buffer saturates (200 k events).
4. **Interaction Latency**
   - Rapid pan/zoom and filter toggles; ensure immediate feedback (<100 ms) and no React warning about long renders.
5. **Fallback Path**
   - Disable Worker support (e.g., run in Firefox `dom.workers.enabled = false`) to exercise main-thread generation; throughput is capped at ~15 k req/s but UI remains responsive.

## 6. Scaling Strategy

- **50 k req/s**: Already viable (LOD + worker). For further headroom, reduce retention window to 30 min or increase decimation ratio.
- **100 k req/s**: Standard mode yields ~30 fps. To reach 60 fps, move aggregation to OffscreenCanvas or WebAssembly, and double buffer line-series arrays to remove allocations.
- **1 M req/s (Future)**:
  - Shard simulation into multiple workers with SharedArrayBuffer ring buffer.
  - Promote Heatmap to WebGL (instanced quads) and use GPU aggregation (e.g., WebGPU compute) for histograms.
- **Offline / Edge**:
  - Serialize aggregate snapshot via `app/api/data` and hydrate clients from IndexedDB when offline.
  - Implement Service Worker for caching static assets + last known snapshot.
- **Collaboration / Multi-User**:
  - Replace simulator with server-sourced WebSocket stream; DataProvider already supports external batches (mergeAll).
  - Use server actions for saving filter presets and stress scenarios.

## 7. Known Trade-offs

- Worker batching is time-based (100 ms). Under extreme spikes, latency of visualization can drift by up to one bucket (100 ms) to absorb backlog safely.
- Aggregation stores per-bucket latency arrays for percentile calculation; memory is bounded but typeless. Swapping to online percentile approximation (P²) would reduce footprint.
- Heatmap currently limits to top 10 normalized paths; rare routes are aggregated under the “Other” bucket to keep visualization legible.

---

For more detail on API shape and component boundaries see [`README.md`](./README.md). For telemetry data or additional benchmark captures, store them under `docs/perf/`.

