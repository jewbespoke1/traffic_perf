'use client';

import { UIEvent, useCallback, useMemo, useState } from 'react';

export function useVirtualization(
  total: number,
  rowHeight: number,
  viewportHeight: number,
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = useMemo(
    () => Math.ceil(viewportHeight / rowHeight) + 2,
    [viewportHeight, rowHeight],
  );

  const start = useMemo(
    () => Math.max(0, Math.floor(scrollTop / rowHeight)),
    [scrollTop, rowHeight],
  );

  const end = useMemo(
    () => Math.min(total, start + visibleCount),
    [start, visibleCount, total],
  );

  const offsetTop = start * rowHeight;

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  return {
    start,
    end,
    offsetTop,
    onScroll,
  };
}

