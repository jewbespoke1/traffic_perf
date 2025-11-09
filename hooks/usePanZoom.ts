'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { ChartDomains } from '@/lib/types';

type UsePanZoomOptions = {
  minZoom?: number;
  maxZoom?: number;
};

export function usePanZoom(
  targetRef: RefObject<HTMLElement | null>,
  initial: ChartDomains,
  options: UsePanZoomOptions = {},
) {
  const [domain, setDomain] = useState<ChartDomains>(initial);
  const draggingRef = useRef<{ x: number; y: number } | null>(null);
  const minZoom = options.minZoom ?? 0.1;
  const maxZoom = options.maxZoom ?? 100;

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const anchorX = (event.clientX - rect.left) / rect.width;
      const anchorY = (event.clientY - rect.top) / rect.height;
      const zoom = Math.exp(-event.deltaY * 0.001);
      setDomain((current) => zoomDomain(current, zoom, anchorX, anchorY, minZoom, maxZoom));
    };

    const handlePointerDown = (event: PointerEvent) => {
      draggingRef.current = { x: event.clientX, y: event.clientY };
      target.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const rect = target.getBoundingClientRect();
      const dx = event.clientX - draggingRef.current.x;
      const dy = event.clientY - draggingRef.current.y;
      setDomain((current) => panDomain(current, dx / rect.width, dy / rect.height));
    };

    const handlePointerUp = (event: PointerEvent) => {
      draggingRef.current = null;
      target.releasePointerCapture(event.pointerId);
    };

    target.addEventListener('wheel', handleWheel, { passive: false });
    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointerleave', handlePointerUp);

    return () => {
      target.removeEventListener('wheel', handleWheel);
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [targetRef, minZoom, maxZoom]);

  const reset = useCallback(() => {
    setDomain(initial);
  }, [initial]);

  return {
    domain,
    reset,
  };
}

function zoomDomain(
  domain: ChartDomains,
  zoom: number,
  anchorX: number,
  anchorY: number,
  minZoom: number,
  maxZoom: number,
): ChartDomains {
  const rangeX = domain.x[1] - domain.x[0];
  const rangeY = domain.y[1] - domain.y[0];
  const nextRangeX = clamp(rangeX / zoom, rangeX * minZoom, rangeX * maxZoom);
  const nextRangeY = clamp(rangeY / zoom, rangeY * minZoom, rangeY * maxZoom);
  const centerX = domain.x[0] + rangeX * anchorX;
  const centerY = domain.y[0] + rangeY * anchorY;
  return {
    x: [centerX - nextRangeX * anchorX, centerX + nextRangeX * (1 - anchorX)],
    y: [centerY - nextRangeY * (1 - anchorY), centerY + nextRangeY * anchorY],
  };
}

function panDomain(domain: ChartDomains, dxNorm: number, dyNorm: number): ChartDomains {
  const rangeX = domain.x[1] - domain.x[0];
  const rangeY = domain.y[1] - domain.y[0];
  const shiftX = rangeX * dxNorm;
  const shiftY = rangeY * dyNorm;
  return {
    x: [domain.x[0] - shiftX, domain.x[1] - shiftX],
    y: [domain.y[0] + shiftY, domain.y[1] + shiftY],
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
