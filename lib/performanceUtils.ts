type MeasureFn<T> = () => T;

export function now(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
}

export function measure<T>(name: string, fn: MeasureFn<T>): T {
  const start = now();
  const result = fn();
  const duration = now() - start;
  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark(`${name}-start`);
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch {
      // Ignore support issues
    }
  }
  Reflect.set(measureTimings, name, duration);
  return result;
}

const measureTimings: Record<string, number> = {};

export function getLastMeasure(name: string): number | undefined {
  return measureTimings[name];
}

export function createFPSCounter(windowSeconds = 1) {
  const samples: number[] = [];
  return {
    tick() {
      const t = now();
      samples.push(t);
      const windowMs = windowSeconds * 1_000;
      while (samples.length && samples[0] <= t - windowMs) {
        samples.shift();
      }
    },
    fps() {
      if (samples.length < 2) return 0;
      const duration = samples[samples.length - 1] - samples[0];
      return duration > 0 ? (samples.length / duration) * 1_000 : 0;
    },
  };
}

export function getMemoryMB(): number | undefined {
  const nav = globalThis.performance as
    | (Performance & { memory?: { usedJSHeapSize: number } })
    | undefined;
  if (!nav?.memory) {
    return undefined;
  }
  return nav.memory.usedJSHeapSize / (1024 * 1024);
}

