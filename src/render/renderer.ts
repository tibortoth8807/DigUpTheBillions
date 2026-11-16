import { Point } from '../game/forest';
import { Game, Tool, Warmth } from '../game/game';
import { mulberry32 } from '../game/rng';
import {
  drawBigStone,
  drawCan,
  drawDog,
  drawHole,
  drawHuntingStand,
  drawLog,
  drawOak,
  drawPawPrints,
  drawPine,
  drawRock,
  drawTreasure,
  drawTree,
} from './sprites';

export const TILE = 64;

const WARMTH_COLORS: Record<Warmth, string> = {
  3: '#ef4444',
  2: '#f97316',
  1: '#facc15',
  0: '#60a5fa',
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  kind: 'dirt' | 'bill' | 'spark';
}

/** Draws the forest on a canvas. Holds only visual state (animations); game rules live in Game. */
export class Renderer {
  hover: Point | null = null;
  tool: Tool = 'dig';

  private readonly ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private game: Game | null = null;
  private particles: Particle[] = [];
  private readonly digStarted = new Map<string, number>();
  private readonly pulses: { x: number; y: number; warmth: Warmth; start: number }[] = [];
  private treasureStart = 0;
  private revealStart = 0;
  private shakeUntil = 0;
  private dogStart = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
  }

  get width(): number {
    return (this.game?.forest.cols ?? 12) * TILE;
  }

  get height(): number {
    return (this.game?.forest.rows ?? 9) * TILE;
  }

  setGame(game: Game): void {
    this.game = game;
    this.particles = [];
    this.digStarted.clear();
    this.pulses.length = 0;
    this.treasureStart = 0;
    this.revealStart = 0;
    this.dogStart = 0;
    this.resize();
    this.background = this.renderBackground(game);
  }

  /** Crisp on high-DPI screens; CSS scales the canvas to the layout. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Converts a pointer position to a tile, or null outside the map. */
  tileAt(clientX: number, clientY: number): Point | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * (this.width / TILE));
    const y = Math.floor(((clientY - rect.top) / rect.height) * (this.height / TILE));
    if (!this.game || x < 0 || y < 0 || x >= this.game.forest.cols || y >= this.game.forest.rows) return null;
    return { x, y };
  }

  // ------------------------------------------------------------ events from the UI

  onDig(p: Point, kind: 'treasure' | 'junk' | 'empty', now: number): void {
    this.digStarted.set(`${p.x},${p.y}`, now);
    this.burst(p, 'dirt', 18);
    if (kind === 'treasure') {
      this.treasureStart = now + 350;
      this.shakeUntil = now + 400;
      window.setTimeout(() => this.burst(p, 'bill', 40), 450);
      window.setTimeout(() => this.burst(p, 'spark', 24), 450);
    }
  }

  onDetect(p: Point, warmth: Warmth, now: number): void {
    this.pulses.push({ ...p, warmth, start: now });
  }

  onDog(now: number): void {
    this.dogStart = now;
  }

  /** After losing, show where the treasure was. */
  revealTreasure(now: number): void {
    this.revealStart = now;
  }

  // ------------------------------------------------------------ frame

  draw(now: number, dt: number): void {
    const { ctx, game } = this;
    if (!game || !this.background) return;

    ctx.save();
    if (now < this.shakeUntil) {
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }

    ctx.drawImage(this.background, 0, 0, this.width, this.height);

    // ground layer: paw prints, holes, detector marks
    if (game.dogMark) drawPawPrints(ctx, game.dogMark.x * TILE, game.dogMark.y * TILE, TILE);

    for (const dig of game.digs) {
      const started = this.digStarted.get(`${dig.x},${dig.y}`) ?? 0;
      const progress = started === 0 ? 1 : (now - started) / 250;
      if (dig.kind !== 'treasure') {
        drawHole(ctx, dig.x * TILE, dig.y * TILE, TILE, progress);
        if (dig.kind === 'junk' && progress >= 1) drawCan(ctx, dig.x * TILE, dig.y * TILE, TILE);
      } else {
        drawHole(ctx, dig.x * TILE, dig.y * TILE, TILE, progress);
      }
    }

    for (const d of game.detections) {
      this.drawDetection(d.x, d.y, d.warmth);
    }

    // objects, row by row so lower ones overlap upper ones
    const sway = Math.sin(now / 1400);
    for (let y = 0; y < game.forest.rows; y++) {
      for (let x = 0; x < game.forest.cols; x++) {
        const px = x * TILE;
        const py = y * TILE;
        switch (game.forest.tiles[y][x]) {
          case 'tree':
            drawTree(ctx, px, py, TILE, sway + x * 0.3);
            break;
          case 'pine':
            drawPine(ctx, px, py, TILE, sway + y * 0.3);
            break;
          case 'rock':
            drawRock(ctx, px, py, TILE);
            break;
          case 'landmark':
            this.drawLandmark(x, y, sway);
            break;
          default:
            break;
        }
      }
    }

    // treasure
    const t = game.treasure;
    if (this.treasureStart > 0 && now >= this.treasureStart) {
      drawTreasure(ctx, t.x * TILE, t.y * TILE - 6, TILE, clamp01((now - this.treasureStart) / 500), now);
    } else if (this.revealStart > 0) {
      const blink = 0.5 + Math.sin(now / 200) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.6 + blink * 0.4;
      drawTreasure(ctx, t.x * TILE, t.y * TILE - 6, TILE, 0, now);
      ctx.restore();
      this.outline(t.x, t.y, `rgba(255, 215, 90, ${0.5 + blink * 0.5})`, 3);
    }

    // dog sits on its mark
    if (game.dogMark) {
      const arrive = clamp01((now - this.dogStart) / 600);
      const fromX = -1;
      const dx = fromX + (game.dogMark.x - fromX) * easeOut(arrive);
      drawDog(ctx, dx * TILE, game.dogMark.y * TILE, TILE, now);
    }

    // detector pulses
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i];
      const age = Math.max(0, (now - pulse.start) / 1200);
      if (age >= 1) {
        this.pulses.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = WARMTH_COLORS[pulse.warmth];
      ctx.globalAlpha = 1 - age;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc((pulse.x + 0.5) * TILE, (pulse.y + 0.5) * TILE, TILE * (0.3 + age * 2.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.drawHover(now);
    this.updateParticles(dt);
    this.drawVignette();
    ctx.restore();
  }

  // ------------------------------------------------------------ pieces

  private drawLandmark(x: number, y: number, sway: number): void {
    const game = this.game!;
    const landmark = game.forest.landmarks.find((l) => l.x === x && l.y === y);
    if (!landmark) return;
    const px = x * TILE;
    const py = y * TILE;

    switch (landmark.id) {
      case 'stand':
        drawHuntingStand(this.ctx, px, py, TILE);
        break;
      case 'log':
        drawLog(this.ctx, px, py, TILE);
        break;
      case 'stone':
        drawBigStone(this.ctx, px, py, TILE);
        break;
      case 'oak':
        drawOak(this.ctx, px, py, TILE, sway);
        break;
    }

    // label
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = landmark.name;
    const w = ctx.measureText(label).width + 12;
    const lx = px + TILE / 2;
    const ly = py + TILE - 4;
    ctx.fillStyle = 'rgba(243, 230, 196, 0.92)';
    ctx.beginPath();
    ctx.roundRect(lx - w / 2, ly - 9, w, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#3b2a14';
    ctx.fillText(label, lx, ly + 0.5);
    ctx.restore();
  }

  private drawDetection(x: number, y: number, warmth: Warmth): void {
    const ctx = this.ctx;
    const cx = (x + 0.5) * TILE;
    const cy = (y + 0.5) * TILE;
    ctx.save();
    ctx.fillStyle = WARMTH_COLORS[warmth];
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = WARMTH_COLORS[warmth];
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // signal bars
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < warmth ? WARMTH_COLORS[warmth] : 'rgba(255,255,255,0.35)';
      ctx.fillRect(cx - 12 + i * 9, cy + 8 - i * 6, 6, 6 + i * 6);
    }
    ctx.restore();
  }

  private drawHover(now: number): void {
    const game = this.game!;
    if (!this.hover || game.status !== 'playing' || this.tool === 'dog') return;
    const { x, y } = this.hover;
    const ok = game.forest.tiles[y][x] === 'grass' && (this.tool !== 'dig' || !game.isDug(x, y));
    const pulse = 0.6 + Math.sin(now / 180) * 0.4;
    this.outline(x, y, ok ? `rgba(255, 248, 225, ${pulse})` : 'rgba(239, 68, 68, 0.9)', 2.5);

    const ctx = this.ctx;
    const cx = (x + 0.5) * TILE;
    const cy = (y + 0.5) * TILE;
    ctx.save();
    if (!ok) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 10);
      ctx.lineTo(cx + 10, cy + 10);
      ctx.moveTo(cx + 10, cy - 10);
      ctx.lineTo(cx - 10, cy + 10);
      ctx.stroke();
    } else if (this.tool === 'detector') {
      ctx.strokeStyle = `rgba(255, 248, 225, ${pulse})`;
      ctx.lineWidth = 2;
      for (const r of [8, 16]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // little shovel
      ctx.translate(cx + 6, cy - 6);
      ctx.rotate(0.7);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(-2, -18, 4, 22);
      ctx.fillStyle = '#c0c6cc';
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(8, 4);
      ctx.lineTo(6, 16);
      ctx.lineTo(0, 20);
      ctx.lineTo(-6, 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private outline(x: number, y: number, color: string, width: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.roundRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6, 10);
    ctx.stroke();
    ctx.restore();
  }

  private burst(p: Point, kind: Particle['kind'], count: number): void {
    const cx = (p.x + 0.5) * TILE;
    const cy = (p.y + 0.55) * TILE;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (kind === 'dirt' ? 2.2 : 2.8);
      const speed = kind === 'dirt' ? 80 + Math.random() * 120 : 140 + Math.random() * 220;
      const life = kind === 'bill' ? 1.6 + Math.random() * 0.8 : 0.6 + Math.random() * 0.4;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: kind === 'bill' ? 10 : kind === 'spark' ? 3 : 3 + Math.random() * 4,
        color:
          kind === 'bill' ? (Math.random() < 0.5 ? '#3f9d55' : '#6cc57f') : kind === 'spark' ? '#ffe08a' : Math.random() < 0.5 ? '#5a3a1e' : '#7a5532',
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8,
        kind,
      });
    }
  }

  private updateParticles(dt: number): void {
    const ctx = this.ctx;
    const seconds = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= seconds;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const gravity = p.kind === 'bill' ? 160 : 520;
      p.vy += gravity * seconds;
      if (p.kind === 'bill') {
        p.vx *= 0.985;
        p.vy *= 0.97;
        p.vx += Math.sin(p.life * 6) * 6;
      }
      p.x += p.vx * seconds;
      p.y += p.vy * seconds;
      p.rotation += p.spin * seconds;

      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.kind === 'bill') {
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(-p.size * 0.4, -p.size * 0.25, p.size * 0.8, p.size * 0.5);
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  private drawVignette(): void {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.height * 0.35,
      this.width / 2, this.height / 2, this.width * 0.72,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(5,15,8,0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Static forest floor: drawn once per map into an offscreen canvas. */
  private renderBackground(game: Game): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const rng = mulberry32(game.seed ^ 0x5bd1e995);

    ctx.fillStyle = '#4f7f3a';
    ctx.fillRect(0, 0, this.width, this.height);

    // tile-level color variation
    for (let y = 0; y < game.forest.rows; y++) {
      for (let x = 0; x < game.forest.cols; x++) {
        const shade = Math.floor(rng() * 3);
        ctx.fillStyle = ['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.04)', 'rgba(120,160,60,0.06)'][shade];
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // soft patches of moss and soil
    for (let i = 0; i < 40; i++) {
      const px = rng() * this.width;
      const py = rng() * this.height;
      const r = 20 + rng() * 60;
      const g = ctx.createRadialGradient(px, py, 1, px, py, r);
      const color = rng() < 0.5 ? '70, 110, 45' : '110, 90, 50';
      g.addColorStop(0, `rgba(${color}, 0.25)`);
      g.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }

    // grass blades
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 1400; i++) {
      const px = rng() * this.width;
      const py = rng() * this.height;
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(120, 170, 80, 0.55)' : 'rgba(40, 80, 30, 0.45)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (rng() - 0.5) * 4, py - 3 - rng() * 5);
      ctx.stroke();
    }

    // decor
    for (const d of game.forest.decor) {
      const px = (d.x + d.ox) * TILE;
      const py = (d.y + d.oy) * TILE;
      switch (d.kind) {
        case 'flower': {
          const color = ['#fff7e6', '#ffd54a', '#c39bd3'][d.variant];
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(px + Math.cos(a) * 3, py + Math.sin(a) * 3, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#e0a526';
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'mushroom':
          ctx.fillStyle = '#f2ead3';
          ctx.fillRect(px - 1.5, py - 2, 3, 6);
          ctx.fillStyle = d.variant === 0 ? '#c0392b' : '#a0522d';
          ctx.beginPath();
          ctx.arc(px, py - 2, 5, Math.PI, 0);
          ctx.fill();
          if (d.variant === 0) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(px - 2.5, py - 5, 1.5, 1.5);
            ctx.fillRect(px + 1, py - 4, 1.5, 1.5);
          }
          break;
        case 'leaves':
          for (let k = 0; k < 3; k++) {
            ctx.fillStyle = ['#b5651d', '#d4a017', '#8b4513'][(d.variant + k) % 3];
            ctx.beginPath();
            ctx.ellipse(px + k * 5 - 5, py + (k % 2) * 3, 4, 2, k, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'tuft':
          ctx.strokeStyle = '#7fb04f';
          ctx.lineWidth = 1.6;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(px + k * 2, py + 3);
            ctx.lineTo(px + k * 3.5, py - 6 - Math.abs(k));
            ctx.stroke();
          }
          break;
      }
    }

    return canvas;
  }
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
