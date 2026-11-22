// Range images (D-091): a 13×13 grid drawn on a canvas, each cell split into action-coloured
// bars by frequency, with a title and a legend; downloaded as a PNG.

export type Segment = { x: number; w: number; color: string };
export type Cell = { name: string; x: number; y: number; size: number; segments: Segment[]; faded: boolean };

export const CELL = 44;
export const MARGIN = 16;
export const HEADER = 56;

/** Layout of the grid: where each class sits and how its width splits between actions. */
export function gridLayout(classes: string[], strategy: number[][], colors: string[], reach?: number[]): Cell[] {
  return classes.map((name, i) => {
    const row = Math.floor(i / 13);
    const col = i % 13;
    const x = MARGIN + col * CELL;
    const y = HEADER + row * CELL;
    let cursor = x;
    const segments: Segment[] = [];
    strategy[i]!.forEach((f, k) => {
      const w = f * CELL;
      if (w > 0) segments.push({ x: cursor, w, color: colors[k]! });
      cursor += w;
    });
    return { name, x, y, size: CELL, segments, faded: reach !== undefined && reach[i]! < 0.005 };
  });
}

export function drawRange(ctx: CanvasRenderingContext2D, opts: { classes: string[]; strategy: number[][]; colors: string[]; actions: string[]; reach?: number[]; title: string; subtitle: string }) {
  const width = MARGIN * 2 + 13 * CELL;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, HEADER + 13 * CELL + 48);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(opts.title, MARGIN, 24);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(opts.subtitle, MARGIN, 44);
  for (const c of gridLayout(opts.classes, opts.strategy, opts.colors, opts.reach)) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(c.x, c.y, c.size, c.size);
    if (!c.faded) for (const s of c.segments) (ctx.fillStyle = s.color === 'transparent' ? '#f3f4f6' : s.color), ctx.fillRect(s.x, c.y, s.w, c.size);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(c.x, c.y, c.size, c.size);
    ctx.fillStyle = c.faded ? '#9ca3af' : '#111827';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(c.name, c.x + 4, c.y + 14);
  }
  // Legend.
  let x = MARGIN;
  const y = HEADER + 13 * CELL + 24;
  ctx.font = '12px system-ui, sans-serif';
  opts.actions.forEach((a, k) => {
    ctx.fillStyle = opts.colors[k] === 'transparent' ? '#f3f4f6' : opts.colors[k]!;
    ctx.fillRect(x, y - 10, 12, 12);
    ctx.fillStyle = '#111827';
    ctx.fillText(a, x + 16, y);
    x += 24 + ctx.measureText(a).width;
  });
}

/** Render to a PNG and download it. */
export async function downloadRangeImage(file: string, opts: Parameters<typeof drawRange>[1]) {
  const canvas = document.createElement('canvas');
  canvas.width = MARGIN * 2 + 13 * CELL;
  canvas.height = HEADER + 13 * CELL + 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas not available');
  drawRange(ctx, opts);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('could not create the image');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
