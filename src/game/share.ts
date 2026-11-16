import { Game } from './game';

/** Wordle-style result text: one emoji per dig, no spoilers about where the treasure is. */
export function buildShareText(game: Game, label: string, url: string): string {
  const trail = game.digs.map((d) => (d.kind === 'treasure' ? '💰' : d.kind === 'junk' ? '🥫' : '🟫')).join('');
  const headline =
    game.status === 'won'
      ? `💰 Megvan! ${game.billions().toLocaleString('hu-HU')} milliárd, ${game.digs.length} ásásból, ${Math.ceil(game.timeLeftMs / 1000)} mp-cel a Különítmény előtt.`
      : game.lossReason === 'time'
        ? '🚙 A Különítmény ért oda előbb.'
        : '🪏 Kifogytam az ásásokból.';

  return [`Ásd ki a milliárdokat! – ${label}`, headline, `🪏 ${trail}`, `📡 ${game.detections.length}/3  🐕 ${game.dogMark ? 'igen' : 'nem'}`, url].join('\n');
}
