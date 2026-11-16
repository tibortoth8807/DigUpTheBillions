/** Hand-drawn style sprites, drawn with Canvas 2D paths - no image assets needed. */

export type Ctx = CanvasRenderingContext2D;

export function shadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.28): void {
  ctx.save();
  ctx.fillStyle = `rgba(10, 20, 8, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTree(ctx: Ctx, x: number, y: number, t: number, sway: number): void {
  const cx = x + t / 2;
  const base = y + t * 0.86;
  shadow(ctx, cx + t * 0.06, base, t * 0.36, t * 0.12);

  ctx.fillStyle = '#6b4423';
  ctx.fillRect(cx - t * 0.06, y + t * 0.5, t * 0.12, t * 0.36);

  const s = sway * t * 0.02;
  circle(ctx, cx - t * 0.15 + s, y + t * 0.42, t * 0.24, '#2f5d2a');
  circle(ctx, cx + t * 0.16 + s, y + t * 0.4, t * 0.23, '#2f5d2a');
  circle(ctx, cx + s, y + t * 0.26, t * 0.28, '#3b7a33');
  circle(ctx, cx - t * 0.07 + s, y + t * 0.2, t * 0.14, '#4c9440');
  circle(ctx, cx + t * 0.1 + s, y + t * 0.32, t * 0.09, '#4c9440');
}

export function drawPine(ctx: Ctx, x: number, y: number, t: number, sway: number): void {
  const cx = x + t / 2;
  const s = sway * t * 0.015;
  shadow(ctx, cx + t * 0.05, y + t * 0.88, t * 0.28, t * 0.1);
  ctx.fillStyle = '#5a3a1e';
  ctx.fillRect(cx - t * 0.05, y + t * 0.72, t * 0.1, t * 0.16);

  const layers = [
    { top: 0.06, bottom: 0.42, half: 0.2, color: '#2d6a4f' },
    { top: 0.22, bottom: 0.6, half: 0.28, color: '#245a42' },
    { top: 0.4, bottom: 0.78, half: 0.36, color: '#1b4332' },
  ];
  for (const layer of [...layers].reverse()) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(cx + s, y + t * layer.top);
    ctx.lineTo(cx + t * layer.half, y + t * layer.bottom);
    ctx.lineTo(cx - t * layer.half, y + t * layer.bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + s, y + t * 0.08);
  ctx.lineTo(cx - t * 0.12, y + t * 0.36);
  ctx.stroke();
}

export function drawRock(ctx: Ctx, x: number, y: number, t: number): void {
  shadow(ctx, x + t * 0.52, y + t * 0.74, t * 0.3, t * 0.1);
  ctx.fillStyle = '#7c8580';
  ctx.beginPath();
  ctx.moveTo(x + t * 0.22, y + t * 0.72);
  ctx.lineTo(x + t * 0.28, y + t * 0.48);
  ctx.lineTo(x + t * 0.46, y + t * 0.38);
  ctx.lineTo(x + t * 0.68, y + t * 0.44);
  ctx.lineTo(x + t * 0.8, y + t * 0.66);
  ctx.lineTo(x + t * 0.66, y + t * 0.76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9aa39e';
  ctx.beginPath();
  ctx.moveTo(x + t * 0.32, y + t * 0.5);
  ctx.lineTo(x + t * 0.46, y + t * 0.42);
  ctx.lineTo(x + t * 0.6, y + t * 0.47);
  ctx.lineTo(x + t * 0.44, y + t * 0.54);
  ctx.closePath();
  ctx.fill();
}

export function drawHuntingStand(ctx: Ctx, x: number, y: number, t: number): void {
  const cx = x + t / 2;
  shadow(ctx, cx + t * 0.08, y + t * 0.9, t * 0.38, t * 0.1);
  ctx.strokeStyle = '#5b3a1c';
  ctx.lineWidth = t * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.26, y + t * 0.9);
  ctx.lineTo(cx - t * 0.16, y + t * 0.36);
  ctx.moveTo(cx + t * 0.26, y + t * 0.9);
  ctx.lineTo(cx + t * 0.16, y + t * 0.36);
  ctx.moveTo(cx - t * 0.2, y + t * 0.66);
  ctx.lineTo(cx + t * 0.2, y + t * 0.66);
  ctx.stroke();
  // ladder rungs
  ctx.lineWidth = t * 0.025;
  for (let i = 0; i < 3; i++) {
    const ry = y + t * (0.74 + i * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.07, ry);
    ctx.lineTo(cx + t * 0.07, ry);
    ctx.stroke();
  }
  // cabin
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(cx - t * 0.22, y + t * 0.18, t * 0.44, t * 0.22);
  ctx.fillStyle = '#2b1a0c';
  ctx.fillRect(cx - t * 0.14, y + t * 0.23, t * 0.28, t * 0.07);
  ctx.fillStyle = '#4a2f17';
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.3, y + t * 0.2);
  ctx.lineTo(cx, y + t * 0.04);
  ctx.lineTo(cx + t * 0.3, y + t * 0.2);
  ctx.closePath();
  ctx.fill();
}

export function drawLog(ctx: Ctx, x: number, y: number, t: number): void {
  shadow(ctx, x + t * 0.52, y + t * 0.7, t * 0.48, t * 0.1);
  ctx.save();
  ctx.translate(x + t / 2, y + t * 0.56);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.roundRect(-t * 0.46, -t * 0.12, t * 0.88, t * 0.24, t * 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 24, 10, 0.5)';
  ctx.lineWidth = 2;
  for (const offset of [-0.25, 0, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(t * offset, -t * 0.08);
    ctx.lineTo(t * (offset + 0.12), -t * 0.02);
    ctx.stroke();
  }
  circle(ctx, t * 0.42, 0, t * 0.12, '#c49a6c');
  ctx.strokeStyle = '#8a6440';
  ctx.beginPath();
  ctx.arc(t * 0.42, 0, t * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  // moss
  circle(ctx, -t * 0.2, -t * 0.1, t * 0.05, '#6aa84f');
  circle(ctx, -t * 0.12, -t * 0.12, t * 0.04, '#6aa84f');
  ctx.restore();
}

export function drawBigStone(ctx: Ctx, x: number, y: number, t: number): void {
  shadow(ctx, x + t * 0.54, y + t * 0.82, t * 0.44, t * 0.12);
  ctx.fillStyle = '#6b7470';
  ctx.beginPath();
  ctx.moveTo(x + t * 0.1, y + t * 0.8);
  ctx.quadraticCurveTo(x + t * 0.04, y + t * 0.4, x + t * 0.36, y + t * 0.22);
  ctx.quadraticCurveTo(x + t * 0.72, y + t * 0.1, x + t * 0.88, y + t * 0.46);
  ctx.quadraticCurveTo(x + t * 0.96, y + t * 0.74, x + t * 0.78, y + t * 0.84);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8d9692';
  ctx.beginPath();
  ctx.ellipse(x + t * 0.42, y + t * 0.36, t * 0.18, t * 0.08, -0.3, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, x + t * 0.7, y + t * 0.3, t * 0.07, '#5d9c42');
  circle(ctx, x + t * 0.78, y + t * 0.36, t * 0.05, '#5d9c42');
}

export function drawOak(ctx: Ctx, x: number, y: number, t: number, sway: number): void {
  const cx = x + t / 2;
  const s = sway * t * 0.012;
  shadow(ctx, cx + t * 0.08, y + t * 0.9, t * 0.5, t * 0.14, 0.32);
  ctx.fillStyle = '#5a3b20';
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.12, y + t * 0.92);
  ctx.lineTo(cx - t * 0.07, y + t * 0.45);
  ctx.lineTo(cx + t * 0.07, y + t * 0.45);
  ctx.lineTo(cx + t * 0.12, y + t * 0.92);
  ctx.closePath();
  ctx.fill();
  circle(ctx, cx - t * 0.26 + s, y + t * 0.36, t * 0.26, '#264d1f');
  circle(ctx, cx + t * 0.26 + s, y + t * 0.36, t * 0.26, '#264d1f');
  circle(ctx, cx + s, y + t * 0.18, t * 0.32, '#2f6b28');
  circle(ctx, cx - t * 0.14 + s, y + t * 0.1, t * 0.14, '#3f8a34');
  circle(ctx, cx + t * 0.18 + s, y + t * 0.24, t * 0.1, '#3f8a34');
  // acorns
  for (const [ax, ay] of [[-0.2, 0.4], [0.24, 0.42], [0.05, 0.3]] as const) {
    circle(ctx, cx + t * ax + s, y + t * ay, t * 0.025, '#b07a33');
  }
}

export function drawHole(ctx: Ctx, x: number, y: number, t: number, progress: number): void {
  // Clamp: the click timestamp can be a few ms newer than the frame timestamp.
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return;
  const cx = x + t / 2;
  const cy = y + t * 0.56;
  // dirt mound
  ctx.fillStyle = '#7a5532';
  ctx.beginPath();
  ctx.ellipse(cx + t * 0.18, cy - t * 0.14, t * 0.2 * p, t * 0.1 * p, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3019';
  ctx.beginPath();
  ctx.ellipse(cx, cy, t * 0.3 * p, t * 0.18 * p, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#24160b';
  ctx.beginPath();
  ctx.ellipse(cx, cy + t * 0.02, t * 0.22 * p, t * 0.12 * p, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawCan(ctx: Ctx, x: number, y: number, t: number): void {
  const cx = x + t * 0.5;
  const cy = y + t * 0.52;
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(cx - t * 0.06, cy - t * 0.08, t * 0.12, t * 0.1);
  ctx.fillStyle = '#c8cdd2';
  ctx.beginPath();
  ctx.ellipse(cx, cy - t * 0.08, t * 0.06, t * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b4532a';
  ctx.fillRect(cx - t * 0.06, cy - t * 0.05, t * 0.12, t * 0.03);
}

export function drawTreasure(ctx: Ctx, x: number, y: number, t: number, open: number, time: number): void {
  const cx = x + t / 2;
  const cy = y + t * 0.6;
  // glow
  const glow = ctx.createRadialGradient(cx, cy - t * 0.1, 2, cx, cy - t * 0.1, t * 0.7);
  glow.addColorStop(0, `rgba(255, 215, 90, ${0.55 * open})`);
  glow.addColorStop(1, 'rgba(255, 215, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - t * 0.3, y - t * 0.3, t * 1.6, t * 1.6);

  // chest body
  ctx.fillStyle = '#7b4a1e';
  ctx.beginPath();
  ctx.roundRect(cx - t * 0.3, cy - t * 0.14, t * 0.6, t * 0.26, 4);
  ctx.fill();
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(cx - t * 0.3, cy - t * 0.04, t * 0.6, t * 0.04);
  ctx.fillRect(cx - t * 0.04, cy - t * 0.14, t * 0.08, t * 0.26);

  // bills sticking out
  if (open > 0.3) {
    for (let i = 0; i < 5; i++) {
      const bx = cx - t * 0.24 + i * t * 0.11;
      const by = cy - t * 0.2 - Math.sin(time / 300 + i) * 2 - (i % 2) * 4;
      ctx.fillStyle = i % 2 ? '#3f9d55' : '#55b86b';
      ctx.fillRect(bx, by, t * 0.1, t * 0.1);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(bx + 2, by + 3, t * 0.06, 2);
    }
  }

  // lid
  ctx.save();
  ctx.translate(cx, cy - t * 0.14);
  ctx.rotate(-open * 0.9);
  ctx.fillStyle = '#8f5826';
  ctx.beginPath();
  ctx.roundRect(-t * 0.3, -t * 0.12, t * 0.6, t * 0.12, [8, 8, 2, 2]);
  ctx.fill();
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(-t * 0.04, -t * 0.12, t * 0.08, t * 0.12);
  ctx.restore();
}

export function drawDog(ctx: Ctx, x: number, y: number, t: number, time: number): void {
  const cx = x + t * 0.5;
  const cy = y + t * 0.62;
  const wag = Math.sin(time / 90) * 0.5;
  shadow(ctx, cx, cy + t * 0.16, t * 0.26, t * 0.07);

  // tail
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = t * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.18, cy);
  ctx.lineTo(cx - t * 0.3, cy - t * 0.1 + wag * t * 0.08);
  ctx.stroke();

  // body + legs
  ctx.fillStyle = '#a86f38';
  ctx.beginPath();
  ctx.ellipse(cx - t * 0.02, cy + t * 0.02, t * 0.2, t * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - t * 0.14, cy + t * 0.06, t * 0.05, t * 0.1);
  ctx.fillRect(cx + t * 0.06, cy + t * 0.06, t * 0.05, t * 0.1);

  // head
  const hx = cx + t * 0.18;
  const hy = cy - t * 0.1 + Math.sin(time / 200) * 1.5;
  circle(ctx, hx, hy, t * 0.11, '#b97c41');
  ctx.fillStyle = '#6e4420';
  ctx.beginPath();
  ctx.ellipse(hx - t * 0.07, hy - t * 0.02, t * 0.04, t * 0.08, 0.4, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, hx + t * 0.1, hy + t * 0.02, t * 0.03, '#2a1a0c');
  circle(ctx, hx + t * 0.03, hy - t * 0.03, t * 0.017, '#1a1a1a');

  // "!" bubble (kept inside the canvas on the top row)
  const by = Math.max(t * 0.11, hy - t * 0.24);
  ctx.fillStyle = '#fff8e1';
  ctx.beginPath();
  ctx.arc(hx + t * 0.12, by, t * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.font = `bold ${Math.round(t * 0.16)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', hx + t * 0.12, by + t * 0.005);
}

export function drawPawPrints(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.fillStyle = 'rgba(60, 35, 15, 0.45)';
  for (const [px, py] of [[0.2, 0.3], [0.35, 0.18], [0.7, 0.75], [0.82, 0.62]] as const) {
    const cx = x + t * px;
    const cy = y + t * py;
    circle(ctx, cx, cy, t * 0.035, ctx.fillStyle as string);
    circle(ctx, cx - t * 0.04, cy - t * 0.045, t * 0.015, ctx.fillStyle as string);
    circle(ctx, cx, cy - t * 0.06, t * 0.015, ctx.fillStyle as string);
    circle(ctx, cx + t * 0.04, cy - t * 0.045, t * 0.015, ctx.fillStyle as string);
  }
}
