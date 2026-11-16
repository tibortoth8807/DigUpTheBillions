import './styles.css';
import { Sounds } from './audio';
import { CONFIG, Game, Tool, WARMTH_TEXT } from './game/game';
import { hashString } from './game/rng';
import { buildShareText } from './game/share';
import { Renderer } from './render/renderer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('forest');
const renderer = new Renderer(canvas);
const sounds = new Sounds();

let game: Game | null = null;
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

// ------------------------------------------------------------------ game lifecycle

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startGame(mode: 'daily' | 'random'): void {
  sounds.unlock();
  const seed = mode === 'daily' ? hashString(`daily-${today()}`) : (Math.random() * 2 ** 32) >>> 0;
  mapLabel = mode === 'daily' ? `napi térkép, ${today()}` : `véletlen térkép #${seed.toString(36)}`;

  game = new Game(seed);
  renderer.setGame(game);
  renderClues();
  selectTool('dig');
  resultShown = false;
  running = true;
  started = true;
  hide('start-screen');
  hide('result-screen');
  updateHud();
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
  if (!game || game.status === 'playing' || resultShown) return;
  resultShown = true;
  if (game.status === 'lost') {
    renderer.revealTreasure(now);
    sounds.play('lose');
  }
  window.setTimeout(showResult, game.status === 'won' ? 1600 : 1300);
}

function showResult(): void {
  if (!game) return;
  const won = game.status === 'won';
  $('result-emoji').textContent = won ? '💰' : game.lossReason === 'time' ? '🚙' : '🪏';
  $('result-title').textContent = won ? `Megvan a ${game.billions().toLocaleString('hu-HU')} milliárd!` : game.lossReason === 'time' ? 'Lebuktál!' : 'Elfogyott az ásás!';
  $('result-text').textContent = won
    ? `${game.rating()} – ${game.digs.length}. ásásra, ${Math.ceil(game.timeLeftMs / 1000)} másodperccel a Különítmény előtt.`
    : game.lossReason === 'time'
      ? 'A Különítmény terepjárója befordult a tisztásra. A kincs a villogó helyen volt.'
      : 'Elfogytak az ásások. A kincs a villogó helyen volt.';
  $('result-stats').innerHTML = won
    ? `<span>Pontszám <b>${game.score().toLocaleString('hu-HU')}</b></span><span>Ásás <b>${game.digs.length}</b></span><span>Mérés <b>${game.detections.length}</b></span>`
    : `<span>Ásás <b>${game.digs.length}</b></span><span>Mérés <b>${game.detections.length}</b></span>`;
  $('share-preview').textContent = shareText();
  show('result-screen');
}

function shareText(): string {
  return buildShareText(game!, mapLabel, location.href.split('?')[0]);
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

function updateHud(): void {
  if (!game) return;
  $('hud-digs').textContent = String(game.digsLeft);
  $('hud-detectors').textContent = String(game.detectorsLeft);
  $('hud-dogs').textContent = String(game.dogsLeft);

  const seconds = Math.ceil(game.timeLeftMs / 1000);
  $('hud-time').textContent = String(seconds);
  const fraction = game.timeLeftMs / CONFIG.timeMs;
  $('timer-fill').style.width = `${fraction * 100}%`;
  $('timer-car').style.left = `calc(${fraction * 100}% - 14px)`;
  document.body.classList.toggle('hurry', game.status === 'playing' && seconds <= 15);

  document.querySelectorAll<HTMLButtonElement>('.tool').forEach((b) => {
    const tool = b.dataset.tool as Tool;
    b.disabled = game!.status !== 'playing' || (tool === 'detector' && game!.detectorsLeft === 0) || (tool === 'dog' && game!.dogsLeft === 0);
  });
}

function showToast(text: string): void {
  const toast = $('toast');
  toast.textContent = text;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

const show = (id: string) => $(id).classList.remove('hidden');
const hide = (id: string) => $(id).classList.add('hidden');

// ------------------------------------------------------------------ main loop

function frame(now: number): void {
  const dt = Math.min(100, now - lastFrame);
  lastFrame = now;
  if (game) {
    if (running && game.status === 'playing') {
      game.tick(dt);
      updateHud();
    }
    checkEnd(now);
    renderer.draw(now, dt);
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

window.addEventListener('keydown', (e) => {
  if (e.key === '1') selectTool('dig');
  if (e.key === '2' && game && game.detectorsLeft > 0) selectTool('detector');
  if (e.key === '3' && game && game.dogsLeft > 0) selectTool('dog');
  if (e.key.toLowerCase() === 'm') toggleSound();
});

function toggleSound(): void {
  sounds.muted = !sounds.muted;
  $('btn-sound').textContent = sounds.muted ? '🔇' : '🔊';
}

$('btn-daily').addEventListener('click', () => startGame('daily'));
$('btn-random').addEventListener('click', () => startGame('random'));
$('btn-again').addEventListener('click', () => startGame('random'));
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
running = false;
requestAnimationFrame(frame);
