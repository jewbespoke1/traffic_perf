export function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D context');
  }
  return ctx;
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = getCtx(canvas);
  ctx.resetTransform();
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx;
}

export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  opts: {
    xTicks: number[];
    yTicks: number[];
    xScale: (value: number) => number;
    yScale: (value: number) => number;
    formatX?: (value: number) => string;
    formatY?: (value: number) => string;
    width: number;
    height: number;
    margin: number;
  },
) {
  const {
    xTicks,
    yTicks,
    xScale,
    yScale,
    formatX = (v) => v.toString(),
    formatY = (v) => v.toString(),
    width,
    height,
    margin,
  } = opts;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.font = '11px Inter, system-ui, sans-serif';

  ctx.beginPath();
  ctx.moveTo(margin, margin);
  ctx.lineTo(margin, height - margin);
  ctx.lineTo(width - margin, height - margin);
  ctx.stroke();

  for (const tick of yTicks) {
    const y = yScale(tick);
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(width - margin, y);
    ctx.stroke();
    ctx.fillText(formatY(tick), 6, y - 2);
  }

  for (const tick of xTicks) {
    const x = xScale(tick);
    ctx.beginPath();
    ctx.moveTo(x, height - margin);
    ctx.lineTo(x, margin);
    ctx.stroke();
    ctx.fillText(formatX(tick), x - 14, height - margin + 14);
  }
  ctx.restore();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  series: { x: Float32Array; y: Float32Array; color: string; width: number },
) {
  const length = Math.min(series.x.length, series.y.length);
  if (length === 0) return;
  ctx.save();
  ctx.strokeStyle = series.color;
  ctx.lineWidth = series.width;
  ctx.beginPath();
  ctx.moveTo(series.x[0], series.y[0]);
  for (let i = 1; i < length; i++) {
    ctx.lineTo(series.x[i], series.y[i]);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBars(
  ctx: CanvasRenderingContext2D,
  bars: Float32Array,
  colorOf: (index: number) => string,
) {
  ctx.save();
  for (let i = 0; i < bars.length; i += 4) {
    const x = bars[i];
    const y = bars[i + 1];
    const width = bars[i + 2];
    const height = bars[i + 3];
    ctx.fillStyle = colorOf(i / 4);
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

export function drawScatter(
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array,
  opts: { color: string; radius: number; alpha?: number },
) {
  const count = Math.min(xs.length, ys.length);
  if (count === 0) return;
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.globalAlpha = opts.alpha ?? 0.8;
  for (let i = 0; i < count; i++) {
    const x = xs[i];
    const y = ys[i];
    ctx.beginPath();
    ctx.arc(x, y, opts.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  matrix: Uint32Array,
  cols: number,
  rows: number,
  opts: { palette: readonly string[]; width: number; height: number; margin: number },
) {
  if (matrix.length === 0 || cols * rows !== matrix.length) {
    return;
  }

  const { palette, width, height, margin } = opts;
  const cellWidth = (width - margin * 2) / cols;
  const cellHeight = (height - margin * 2) / rows;
  const max = matrix.reduce((acc, value) => Math.max(acc, value), 0);
  const paletteLength = palette.length - 1;

  ctx.save();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const value = matrix[row * cols + col];
      const ratio = max === 0 ? 0 : value / max;
      const index = Math.min(
        paletteLength,
        Math.floor(ratio * paletteLength),
      );
      ctx.fillStyle = palette[index];
      ctx.fillRect(
        margin + col * cellWidth,
        margin + row * cellHeight,
        cellWidth,
        cellHeight,
      );
    }
  }
  ctx.restore();
}

