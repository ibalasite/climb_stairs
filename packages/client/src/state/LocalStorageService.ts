export const LocalStorageService = {
  getNickname(): string {
    return localStorage.getItem('ladder_last_nickname') ?? '';
  },
  setNickname(v: string): void {
    localStorage.setItem('ladder_last_nickname', v);
  },
  getPlayerId(): string {
    return localStorage.getItem('playerId') ?? '';
  },
  setPlayerId(v: string): void {
    localStorage.setItem('playerId', v);
  },
  clearPlayerId(): void {
    localStorage.removeItem('playerId');
  },
};
