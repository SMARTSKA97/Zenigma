/** Result card: a picture of the finished board (no digits or letters, so nothing is spoiled) with time, rank and streak. */

export interface CardInput {
  name: string;
  /** "Daily 2026-10-12" or "Level 12". */
  label: string;
  /** OKLCH hue of the game's tile colour. */
  hue: number;
  /** The grid as emoji squares, one string per cell. */
  grid: string[][];
  time?: string;
  /** Short line for games without a clock, e.g. "4/6". */
  score?: string;
  rank?: number | null;
  stars?: number;
  streak?: number | null;
}

const SQUARE: Record<string, string> = {
  '🟥': '#e5534b',
  '🟧': '#f0883e',
  '🟨': '#f2c744',
  '🟩': '#4cae6b',
  '🟦': '#4a90d9',
  '🟪': '#9b6bd6',
  '🟫': '#8b6b4a',
  '⬛': '#2d3136',
  '⬜': '#e6eaec',
  '👑': '#f5b82e',
  '🌞': '#f6c445',
  '🌙': '#5b6ea8',
};

const isCell = (ch: string) => ch in SQUARE;

/** The rows of a share text that are made only of squares (the board), as arrays of one emoji per cell. */
export function gridFromText(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    const cells = Array.from(line.trim());
    if (cells.length && cells.every(isCell)) rows.push(cells);
  }
  return rows;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, color: string, fallback: string): void {
  ctx.fillStyle = fallback;
  ctx.fillStyle = color; // ignored when the browser does not know the colour syntax, keeping the fallback
}

/** Small drawn symbols so the card never depends on an emoji font. */
function mark(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number): void {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.save();
  if (kind === '👑') {
    ctx.fillStyle = '#4a3200';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.28, cy + s * 0.2);
    ctx.lineTo(cx - s * 0.32, cy - s * 0.2);
    ctx.lineTo(cx - s * 0.13, cy - s * 0.02);
    ctx.lineTo(cx, cy - s * 0.26);
    ctx.lineTo(cx + s * 0.13, cy - s * 0.02);
    ctx.lineTo(cx + s * 0.32, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.28, cy + s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (kind === '🌞') {
    ctx.strokeStyle = '#7a4f00';
    ctx.fillStyle = '#7a4f00';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * s * 0.26, cy + Math.sin(ang) * s * 0.26);
      ctx.lineTo(cx + Math.cos(ang) * s * 0.36, cy + Math.sin(ang) * s * 0.36);
      ctx.stroke();
    }
  } else if (kind === '🌙') {
    ctx.fillStyle = '#e9edff';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + s * 0.14, cy - s * 0.1, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draws the card and returns it as a PNG. */
export async function renderCard(input: CardInput): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background: a deep gradient in the game's colour.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  paint(ctx, `oklch(0.36 0.1 ${input.hue})`, '#1f4a44');
  const top = ctx.fillStyle;
  paint(ctx, `oklch(0.2 0.06 ${input.hue})`, '#102825');
  const bottom = ctx.fillStyle;
  bg.addColorStop(0, String(top));
  bg.addColorStop(1, String(bottom));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Soft glow behind the board.
  const glow = ctx.createRadialGradient(W / 2, 600, 80, W / 2, 600, 620);
  glow.addColorStop(0, 'rgba(255,255,255,0.16)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const font = (weight: number, size: number) => `${weight} ${size}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;
  ctx.textBaseline = 'alphabetic';

  // Brand mark: the four-square logo and the name.
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    roundRect(ctx, 72 + dx * 26, 70 + dy * 26, 20, 20, 5);
    ctx.fill();
  }
  ctx.font = font(700, 40);
  ctx.fillText('Zenigma', 142, 114);

  ctx.font = font(800, 84);
  ctx.fillText(input.name, 72, 240);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = font(500, 40);
  ctx.fillText(input.label, 72, 298);

  // The board.
  const rows = input.grid.length;
  const cols = Math.max(1, ...input.grid.map((r) => r.length));
  if (rows) {
    const area = { x: 72, y: 350, w: W - 144, h: 560 };
    const gap = Math.max(4, Math.round(24 / Math.max(rows, cols)) + 4);
    const cell = Math.min(120, Math.floor((area.w - gap * (cols - 1)) / cols), Math.floor((area.h - gap * (rows - 1)) / rows));
    const bw = cols * cell + (cols - 1) * gap;
    const bh = rows * cell + (rows - 1) * gap;
    const ox = area.x + (area.w - bw) / 2;
    const oy = area.y + (area.h - bh) / 2;
    // A light plate under the board.
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, ox - 22, oy - 22, bw + 44, bh + 44, 34);
    ctx.fill();
    input.grid.forEach((row, r) =>
      row.forEach((emoji, c) => {
        const x = ox + c * (cell + gap);
        const y = oy + r * (cell + gap);
        ctx.fillStyle = SQUARE[emoji] ?? '#888';
        roundRect(ctx, x, y, cell, cell, Math.max(6, cell * 0.2));
        ctx.fill();
        if (emoji === '👑' || emoji === '🌞' || emoji === '🌙') mark(ctx, emoji, x, y, cell);
      }),
    );
  }

  if (!rows) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(W / 2, 630, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 105, 640);
    ctx.lineTo(W / 2 - 25, 725);
    ctx.lineTo(W / 2 + 120, 545);
    ctx.stroke();
  }

  // Result line.
  ctx.fillStyle = '#ffffff';
  ctx.font = font(800, 120);
  ctx.fillText(input.time ?? input.score ?? '', 72, 1070);
  const chips: string[] = [];
  if (input.time && input.score) chips.push(input.score);
  if (input.rank) chips.push(`#${input.rank} today`);
  if (input.stars) chips.push('★'.repeat(input.stars) + '☆'.repeat(3 - input.stars));
  if (input.streak && input.streak > 1) chips.push(`${input.streak}-day streak`);
  let x = 72;
  ctx.font = font(700, 38);
  for (const chip of chips) {
    const w = ctx.measureText(chip).width + 56;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, x, 1110, w, 76, 38);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(chip, x + 28, 1160);
    x += w + 16;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = font(500, 34);
  ctx.fillText('zenigma.ska97homelab.uk', 72, 1272);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('card'))), 'image/png'));
}

// ---------------------------------------------------------------------------------------------- streak card

export interface StreakCardInput {
  days: number;
  /** The player's name for the footer (a guest gets a plain line). */
  name: string;
  /** "Oct 24, 2026". */
  date: string;
  best?: number;
}

/** A flame, drawn from curves so it needs no emoji font. `h` is its height; (cx, top) is the tip. */
function flame(ctx: CanvasRenderingContext2D, cx: number, top: number, h: number, outer: string, inner: string): void {
  const w = h * 0.78;
  const body = (scale: number, dy: number, color: string) => {
    const s = scale;
    const x = cx;
    const y = top + dy;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + w * 0.1 * s, y + h * 0.22 * s, x + w * 0.52 * s, y + h * 0.34 * s, x + w * 0.5 * s, y + h * 0.68 * s);
    ctx.bezierCurveTo(x + w * 0.48 * s, y + h * 0.9 * s, x + w * 0.26 * s, y + h * s, x, y + h * s);
    ctx.bezierCurveTo(x - w * 0.26 * s, y + h * s, x - w * 0.48 * s, y + h * 0.9 * s, x - w * 0.5 * s, y + h * 0.68 * s);
    ctx.bezierCurveTo(x - w * 0.52 * s, y + h * 0.46 * s, x - w * 0.22 * s, y + h * 0.4 * s, x - w * 0.14 * s, y + h * 0.18 * s);
    ctx.bezierCurveTo(x - w * 0.1 * s, y + h * 0.1 * s, x - w * 0.04 * s, y + h * 0.04 * s, x, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  body(1, 0, outer);
  body(0.52, h * 0.48, inner);
}

/**
 * The streak picture: a solid card (to post as it is) or a sticker with a clear background (to lay over any photo).
 */
export async function renderStreak(input: StreakCardInput, variant: 'card' | 'sticker'): Promise<Blob> {
  const W = 1080;
  const H = variant === 'card' ? 1350 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (weight: number, size: number) => `${weight} ${size}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  if (variant === 'card') {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ff9a1f');
    bg.addColorStop(1, '#f2570f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 560);
    glow.addColorStop(0, 'rgba(255,240,150,0.55)');
    glow.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // The four-square brand mark and name, centred at the top.
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      roundRect(ctx, W / 2 - 150 + dx * 26, 96 + dy * 26, 20, 20, 5);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.font = font(800, 56);
    ctx.fillText('Zenigma', W / 2 - 100, 146);
    ctx.textAlign = 'center';
    flame(ctx, W / 2, 190, 330, '#ffe14a', '#fff6c2');
    ctx.fillStyle = '#fff6c2';
    ctx.font = font(900, input.days >= 100 ? 300 : 360);
    ctx.fillText(String(input.days), W / 2, 910);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(800, 96);
    ctx.fillText('day streak', W / 2, 1030);
    ctx.font = font(600, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'left';
    ctx.fillText(input.name, 72, 1270);
    ctx.textAlign = 'right';
    ctx.fillText(input.date, W - 72, 1270);
    ctx.textAlign = 'center';
  } else {
    // A sticker: nothing behind it, so it stays readable on a light or a dark photo through a soft shadow.
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 6;
    flame(ctx, W / 2, 120, 300, '#ff9a1f', '#ffe14a');
    ctx.fillStyle = '#ffffff';
    ctx.font = font(900, 300);
    ctx.fillText(String(input.days), W / 2, 700);
    ctx.font = font(800, 90);
    ctx.fillText('day streak', W / 2, 810);
    ctx.shadowColor = 'transparent';
    ctx.font = font(600, 38);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Zenigma', W / 2, 920);
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('card'))), 'image/png'));
}
