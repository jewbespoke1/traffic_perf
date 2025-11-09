'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { createFPSCounter, getLastMeasure, getMemoryMB, now } from '@/lib/performanceUtils';
import { PerformanceMetrics } from '@/lib/types';

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() => ({
    fps: 0,
    renderMs: 0,
    processMs: 0,
    dropped: 0,
  }));
  const counterRef = useRef(createFPSCounter(1));
  const droppedRef = useRef(0);

  useEffect(() => {
    let animationFrame: number;
    const update = () => {
      counterRef.current.tick();
      animationFrame = requestAnimationFrame(update);
    };
    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const fps = counterRef.current.fps();
      const render = getLastMeasure('render-loop') ?? 0;
      const process = getLastMeasure('data-process') ?? 0;
      const mem = getMemoryMB();
      setMetrics((prev) => ({
        fps,
        renderMs: render || prev.renderMs,
        processMs: process || prev.processMs,
        memMB: mem,
        dropped: droppedRef.current,
      }));
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const markDropped = useCallback((count: number) => {
    droppedRef.current = count;
  }, []);

  return {
    metrics,
    markDropped,
  };
}

export function useRafLoop(step: () => void, enabled = true) {
  const stepRef = useRef(step);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame: number;
    const loop = () => {
      stepRef.current();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);
}

export function useStopwatch() {
  const startRef = useRef<number | null>(null);
  return {
    start() {
      startRef.current = now();
    },
    stop() {
      if (startRef.current === null) return 0;
      const duration = now() - startRef.current;
      startRef.current = null;
      return duration;
    },
  };
}
