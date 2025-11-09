export function decimateLineByPixel(
  xs: Float32Array,
  ys: Float32Array,
  widthPx: number,
): { x: Float32Array; y: Float32Array } {
  const length = Math.min(xs.length, ys.length);
  if (length <= 2 || widthPx <= 0 || length <= widthPx * 2) {
    return { x: xs, y: ys };
  }

  const step = Math.max(1, Math.floor(length / widthPx));
  const bucketedX = new Float32Array(widthPx * 2);
  const bucketedY = new Float32Array(widthPx * 2);
  let ptr = 0;

  for (let i = 0; i < length; i += step) {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minX = xs[i];
    let maxX = xs[Math.min(length - 1, i + step - 1)];

    for (let j = i; j < i + step && j < length; j++) {
      const y = ys[j];
      if (y < minY) {
        minY = y;
        minX = xs[j];
      }
      if (y > maxY) {
        maxY = y;
        maxX = xs[j];
      }
    }

    bucketedX[ptr] = minX;
    bucketedY[ptr] = minY;
    ptr += 1;
    if (minY !== maxY) {
      bucketedX[ptr] = maxX;
      bucketedY[ptr] = maxY;
      ptr += 1;
    }
  }

  return {
    x: bucketedX.subarray(0, ptr),
    y: bucketedY.subarray(0, ptr),
  };
}

export function reservoirSample<T>(
  arr: readonly T[],
  k: number,
  seed = Date.now(),
): T[] {
  if (k <= 0 || arr.length <= k) {
    return Array.isArray(arr) ? [...arr] : Array.from(arr);
  }
  const rng = mulberry32(seed);
  const sample = arr.slice(0, k);
  for (let i = k; i < arr.length; i++) {
    const j = Math.floor(rng() * (i + 1));
    if (j < k) {
      sample[j] = arr[i];
    }
  }
  return sample;
}

export function gridBin2D(
  points: readonly { x: number; y: number }[],
  gridW: number,
  gridH: number,
): Uint32Array {
  const cols = Math.max(1, Math.floor(gridW));
  const rows = Math.max(1, Math.floor(gridH));
  const grid = new Uint32Array(cols * rows);
  if (points.length === 0) {
    return grid;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;

  for (const point of points) {
    const col = Math.min(
      cols - 1,
      Math.max(0, Math.floor(((point.x - minX) / dx) * cols)),
    );
    const row = Math.min(
      rows - 1,
      Math.max(0, Math.floor(((point.y - minY) / dy) * rows)),
    );
    grid[row * cols + col] += 1;
  }
  return grid;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

