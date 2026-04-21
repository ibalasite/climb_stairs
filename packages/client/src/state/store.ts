import type { Room, ResultSlot } from '@ladder-room/shared';

export interface AppState {
  view: 'lobby' | 'waiting' | 'game' | 'results';
  myPlayerId: string | null;
  myToken: string | null;
  room: Room | null;
  revealedResults: ResultSlot[];
  error: string | null;
}

const initialState: AppState = {
  view: 'lobby',
  myPlayerId: null,
  myToken: null,
  room: null,
  revealedResults: [],
  error: null,
};

export const state: AppState = { ...initialState };

type RenderFn = () => void;
let renderFn: RenderFn | null = null;

export function setRenderer(fn: RenderFn): void {
  renderFn = fn;
}

export function setState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
  renderFn?.();
}

export function resetState(): void {
  Object.assign(state, initialState);
  renderFn?.();
}
