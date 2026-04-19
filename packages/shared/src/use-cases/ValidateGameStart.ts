export type GameStartError =
  | { code: 'INSUFFICIENT_PLAYERS'; message: string }
  | { code: 'PRIZES_NOT_SET'; message: string }
  | { code: 'INVALID_PRIZES_COUNT'; message: string };

export function validateGameStart(
  playerCount: number,
  winnerCount: number | null,
): GameStartError | null {
  if (playerCount < 2) {
    return { code: 'INSUFFICIENT_PLAYERS', message: '人數不足（至少需要 2 位玩家）' };
  }
  if (winnerCount === null) {
    return { code: 'PRIZES_NOT_SET', message: '請先設定中獎名額' };
  }
  if (winnerCount < 1 || winnerCount >= playerCount) {
    return { code: 'INVALID_PRIZES_COUNT', message: `中獎名額須介於 1 到 ${playerCount - 1}` };
  }
  return null;
}
