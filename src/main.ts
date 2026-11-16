import './styles.css';
import { Sounds } from './audio';
import { CONFIG, Game, Tool, WARMTH_TEXT } from './game/game';
import { hashString } from './game/rng';
import { buildShareText } from './game/share';
import { Renderer } from './render/renderer';
import type { FpsMode } from './fps/FpsMode';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

type ViewMode = '2d' | '3d';

const canvas = $<HTMLCanvasElement>('forest');
const renderer = new Renderer(canvas);
const sounds = new Sounds();

let game: Game | null = null;
let viewMode: ViewMode = '2d';
let fps: FpsMode | null = null;
let mapLabel = '';
let running = false;
let started = false;
let resultShown = false;
let lastFrame = performance.now();
let toastTimer = 0;

const TOOL_HINTS: Record<Tool, string> = {
  dig: 'Kattints egy fűvel borított mezőre az ásáshoz.',
  detector: 'Kattints egy mezőre: a fémkereső megmondja, milyen messze van a kincs.',
  dog: 'Morzsi megszagolja az erdőt, és leül a kincs közelébe.',
};

const in3d = () => viewMode === '3d' && fps !== null;

// ------------------------------------------------------------------ game lifecycle

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The 3D mode (Three.js) is loaded only when somebody picks it - the 2D game stays small. */
async function ensureFps(): Promise<FpsMode> {
  if (!fps) {
    const { FpsMode } = await import('./fps/FpsMode');
    fps = new FpsMode($('fps-root'), sounds, {
      toast: showToast,
      refreshHud: updateHud,
      exitToMenu: backToMenu,
    });
    // dev-only handle for browser tests (stripped from production builds by Vite)
    if (import.meta.env?.DEV) (window as unknown as { __fps: FpsMode }).__fps = fps;
  }
  return fps;
}

async function startGame(mode: 'daily' | 'random'): Promise<void> {
  sounds.unlock();
  const seed = mode === 'daily' ? hashString(`daily-${today()}`) : (Math.random() * 2 ** 32) >>> 0;
  mapLabel = `${mode === 'daily' ? `napi térkép, ${today()}` : `véletlen térkép #${seed.toString(36)}`}${viewMode === '3d' ? ' (3D)' : ''}`;

  game = new Game(seed);
  resultShown = false;
  started = true;
  hide('start-screen');
  hide('result-screen');

  if (viewMode === '3d') {
    let mode3d: FpsMode;
    try {
      mode3d = await ensureFps();
    } catch (error) {
      console.error(error);
      showToast('A 3D mód nem indult el ezen az eszközön – marad a térképes nézet.');
      viewMode = '2d';
      return startGame(mode);
    }
    document.querySelector('.app')!.classList.add('hidden');
    mode3d.start(game);
  } else {
    fps?.stop();
    document.querySelector('.app')!.classList.remove('hidden');
    renderer.setGame(game);
    renderClues();
    selectTool('dig');
  }

  running = true;
  updateHud();
}

function backToMenu(): void {
  fps?.stop();
  document.querySelector('.app')!.classList.remove('hidden');
  hide('result-screen');
  running = false;
  started = false;
  if (game) {
    renderer.setGame(game);
    renderClues();
  }
  show('start-screen');
}

function renderClues(): void {
  const list = $<HTMLOListElement>('clues');
  list.replaceChildren(
    ...game!.puzzle.clues.map((clue) => {
      const item = document.createElement('li');
      item.textContent = clue.text;
      return item;
    }),
  );
}

function selectTool(tool: Tool): void {
  if (in3d()) {
    fps!.setTool(tool);
    updateHud();
    return;
  }

  renderer.tool = tool;
  document.querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  $('tool-hint').textContent = TOOL_HINTS[tool];

  if (tool === 'dog' && game?.status === 'playing') {
    const result = game.useDog();
    if (result.ok) {
      renderer.onDog(performance.now());
      sounds.play('bark');
      showToast('🐕 Morzsi szimatol… és leül. Valahol a közelben lesz!');
    } else {
      showToast(result.reason);
    }
    // the dog is a one-off action; go back to digging
    window.setTimeout(() => selectTool('dig'), 50);
    updateHud();
  }
}

/** 2D: click on a tile. (3D actions are handled inside FpsMode.) */
function act(x: number, y: number): void {
  if (!game || game.status !== 'playing') return;
  const now = performance.now();

  if (renderer.tool === 'detector') {
    const result = game.detect(x, y);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    renderer.onDetect(result.value, result.value.warmth, now);
    sounds.play('beep', result.value.warmth);
    showToast(`📡 ${WARMTH_TEXT[result.value.warmth]}`);
    if (game.detectorsLeft === 0) selectTool('dig');
  } else {
    const result = game.dig(x, y);
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    const dig = result.value;
    renderer.onDig(dig, dig.kind, now);
    if (dig.kind === 'treasure') {
      sounds.play('dig');
      window.setTimeout(() => sounds.play('win'), 350);
      showToast('💰 MEGVAN!');
    } else if (dig.kind === 'junk') {
      sounds.play('junk');
      showToast(`Találtál ${dig.item}. Pénz az nincs.`);
    } else {
      sounds.play('dig');
      showToast(`Csak föld. (−${CONFIG.digPenaltyMs / 1000} mp)`);
    }
  }
  updateHud();
}

function checkEnd(now: number): void {
  if (!game || game.status === 'playing' || resultShown || !started) return;
  resultShown = true;
  if (!in3d() && game.status === 'lost') {
    renderer.revealTreasure(now);
    sounds.play('lose');
  }
  const delay = in3d() ? (game.status === 'won' ? 4200 : 4200) : game.status === 'won' ? 1600 : 1300;
  window.setTimeout(showResult, delay);
}

function showResult(): void {
  if (!game) return;
  const won = game.status === 'won';
  $('result-emoji').textContent = won ? '💰' : game.lossReason === 'time' ? '🚙' : '🪏';
  $('result-title').textContent = won
    ? `Megvan a ${game.billions().toLocaleString('hu-HU')} milliárd!`
    : game.lossReason === 'time' ? 'Lebuktál!' : 'Elfogyott az ásás!';
  const where = in3d() ? 'A kincs ott volt, ahol a fényoszlop áll.' : 'A kincs a villogó helyen volt.';
  $('result-text').textContent = won
    ? `${game.rating()} – ${game.digs.length}. ásásra, ${Math.ceil(game.timeLeftMs / 1000)} másodperccel a Különítmény előtt.`
    : game.lossReason === 'time'
      ? `A Különítmény terepjárója befordult a tisztásra. ${where}`
      : `Elfogytak az ásások. ${where}`;
  $('result-stats').innerHTML = won
    ? `<span>Pontszám <b>${game.score().toLocaleString('hu-HU')}</b></span><span>Ásás <b>${game.digs.length}</b></span><span>Mérés <b>${game.detections.length}</b></span>`
    : `<span>Ásás <b>${game.digs.length}</b></span><span>Mérés <b>${game.detections.length}</b></span>`;
  $('share-preview').textContent = shareText();
  show('result-screen');
}

function shareText(): string {
  return buildShareText(game!, mapLabel, location.href.split('?')[0].split('#')[0]);
}

async function share(): Promise<void> {
  const text = shareText();
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // cancelled or not allowed here (e.g. embedded frame) - fall back to the clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Vágólapra másolva!');
  } catch {
    showToast('Nem sikerült megosztani – másold ki kézzel.');
  }
}

// ------------------------------------------------------------------ HUD & helpers

function setAll(name: string, apply: (el: HTMLElement) => void): void {
  document.querySelectorAll<HTMLElement>(`[data-hud="${name}"]`).forEach(apply);
}

function updateHud(): void {
  if (!game) return;
  const g = game;
  setAll('digs', (el) => (el.textContent = String(g.digsLeft)));
  setAll('detectors', (el) => (el.textContent = String(g.detectorsLeft)));
  setAll('dogs', (el) => (el.textContent = String(g.dogsLeft)));

  const seconds = Math.ceil(g.timeLeftMs / 1000);
  const fraction = g.timeLeftMs / CONFIG.timeMs;
  setAll('time', (el) => (el.textContent = String(seconds)));
  setAll('fill', (el) => (el.style.width = `${fraction * 100}%`));
  setAll('car', (el) => (el.style.left = `calc(${fraction * 100}% - 14px)`));
  document.body.classList.toggle('hurry', g.status === 'playing' && seconds <= 15);

  document.querySelectorAll<HTMLButtonElement>('.tool, .fps-tool').forEach((b) => {
    const tool = b.dataset.tool as Tool;
    b.disabled = g.status !== 'playing' || (tool === 'detector' && g.detectorsLeft === 0) || (tool === 'dog' && g.dogsLeft === 0);
  });
}

function showToast(text: string, durationMs = 2200): void {
  document.querySelectorAll<HTMLElement>('[data-toast]').forEach((toast) => {
    toast.textContent = text;
    toast.classList.add('visible');
  });
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => document.querySelectorAll<HTMLElement>('[data-toast]').forEach((t) => t.classList.remove('visible')),
    durationMs,
  );
}

const show = (id: string) => $(id).classList.remove('hidden');
const hide = (id: string) => $(id).classList.add('hidden');

// ------------------------------------------------------------------ main loop

function frame(now: number): void {
  const dt = Math.min(100, now - lastFrame);
  lastFrame = now;
  if (game) {
    if (in3d() && started) {
      if (running && game.status === 'playing' && !fps!.paused) {
        game.tick(dt);
        updateHud();
      }
      checkEnd(now);
      fps!.update(now, dt);
    } else {
      if (running && game.status === 'playing') {
        game.tick(dt);
        updateHud();
      }
      checkEnd(now);
      renderer.draw(now, dt);
    }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ input

canvas.addEventListener('pointermove', (e) => {
  renderer.hover = renderer.tileAt(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => {
  renderer.hover = null;
});
canvas.addEventListener('pointerdown', (e) => {
  const tile = renderer.tileAt(e.clientX, e.clientY);
  if (tile) {
    renderer.hover = tile;
    act(tile.x, tile.y);
  }
});

document.querySelectorAll<HTMLButtonElement>('.tool').forEach((button) =>
  button.addEventListener('click', () => {
    sounds.play('click');
    selectTool(button.dataset.tool as Tool);
  }),
);

document.querySelectorAll<HTMLButtonElement>('.mode').forEach((button) =>
  button.addEventListener('click', () => {
    viewMode = button.dataset.mode as ViewMode;
    document.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => {
      b.classList.toggle('active', b === button);
      b.setAttribute('aria-checked', String(b === button));
    });
  }),
);

window.addEventListener('keydown', (e) => {
  if (!started) return;
  if (e.key === '1') selectTool('dig');
  if (e.key === '2' && game && game.detectorsLeft > 0) selectTool('detector');
  if (e.key === '3' && game && game.dogsLeft > 0) selectTool('dog');
  if (e.key.toLowerCase() === 'm' && !in3d()) toggleSound();
});

function toggleSound(): void {
  sounds.muted = !sounds.muted;
  $('btn-sound').textContent = sounds.muted ? '🔇' : '🔊';
}

$('btn-daily').addEventListener('click', () => void startGame('daily'));
$('btn-random').addEventListener('click', () => void startGame('random'));
$('btn-again').addEventListener('click', () => void startGame('random'));
$('btn-menu').addEventListener('click', backToMenu);
$('btn-share').addEventListener('click', () => void share());
$('btn-sound').addEventListener('click', toggleSound);
$('btn-help').addEventListener('click', () => {
  running = false;
  show('help-screen');
});
$('btn-help-close').addEventListener('click', () => {
  hide('help-screen');
  running = started;
});
window.addEventListener('resize', () => renderer.resize());

// A decorative forest behind the start screen.
game = new Game(hashString(`daily-${today()}`));
renderer.setGame(game);
renderClues();
requestAnimationFrame(frame);
