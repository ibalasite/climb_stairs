// Web Audio synthesized SFX. No assets shipped.
// Persistence: 'climb-stairs:muted' (localStorage)

const STORAGE_KEY = 'climb-stairs:muted';

let ctx: AudioContext | null = null;
let primed = false;
let muted = readMuted();

// Prime the AudioContext on the first user gesture. iOS / Chrome create
// AudioContexts in the 'suspended' state — scheduling notes before resume()
// makes them play late or all at once. Resolving a primed promise on first
// click guarantees ctx.currentTime is moving by the time we schedule sounds.
function setupAudioUnlock(): void {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  const unlock = (): void => {
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    if (muted) { primed = true; return; }
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor === undefined) { primed = true; return; }
      ctx = new Ctor();
      void ctx.resume().finally(() => { primed = true; });
    } catch {
      primed = true;
    }
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
}
setupAudioUnlock();

function readMuted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function ensureCtx(): AudioContext | null {
  if (muted) return null;
  // Don't try to play before user gesture has unlocked the context — would
  // schedule against a suspended currentTime and replay all queued notes
  // simultaneously when the context finally resumes.
  if (!primed || ctx === null) return null;
  if (ctx.state !== 'running') {
    void ctx.resume();
    return null;
  }
  return ctx;
}

interface ToneOpts {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  attackMs?: number;
  releaseMs?: number;
  gain?: number;
  /** Absolute AudioContext time. If omitted, schedules at currentTime. */
  at?: number;
}

function tone(opts: ToneOpts): void {
  const c = ensureCtx();
  if (c === null) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.value = opts.freq;
  const peak = opts.gain ?? 0.18;
  // Always use absolute time; never re-read currentTime so a slow loop doesn't
  // make later iterations slip behind real time.
  const start = opts.at ?? (c.currentTime + 0.02);
  const attack = (opts.attackMs ?? 5) / 1000;
  const release = (opts.releaseMs ?? 80) / 1000;
  const dur = opts.durationMs / 1000;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.linearRampToValueAtTime(0, start + dur + release);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + release + 0.05);
}

/** Footstep — soft thud each ladder rung step. */
export function playFootstep(): void {
  tone({ freq: 220, durationMs: 70, type: 'triangle', gain: 0.12, releaseMs: 50 });
}

/** Loser reveal — short low blip. */
export function playLoser(): void {
  const c = ensureCtx();
  if (c === null) return;
  tone({ freq: 280, durationMs: 180, type: 'sawtooth', gain: 0.12, releaseMs: 120, at: c.currentTime + 0.02 });
}

/** Winner reveal — three-note ascending chime. */
export function playWinner(): void {
  const c = ensureCtx();
  if (c === null) return;
  const base = c.currentTime + 0.02;
  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((f, i) => {
    tone({ freq: f, durationMs: 220, type: 'sine', gain: 0.22, at: base + i * 0.12 });
  });
}

/** Climb-stairs sequence — N quick footsteps over a duration. */
export function playClimb(steps: number, totalMs: number): void {
  if (muted || steps <= 0) return;
  const c = ensureCtx();
  if (c === null) return;
  // Snapshot baseline once. Earlier we read currentTime inside each tone()
  // call — on a cold first run the loop took long enough that early
  // iterations were scheduled in the past, so the leading footsteps were
  // dropped and the climb appeared to start mid-way through the animation.
  const base = c.currentTime + 0.05;
  const interval = Math.max(0.05, (totalMs / steps) / 1000);
  for (let i = 0; i < steps; i++) {
    tone({
      freq: 200 + (i % 3) * 30,
      durationMs: 60,
      type: 'triangle',
      gain: 0.1,
      releaseMs: 40,
      at: base + i * interval,
    });
  }
}

let warmedUp = false;

/**
 * Resolve once the AudioContext is running AND the audio output pipeline is
 * actually flowing. iOS / Chrome take ~200-300ms after resume() before the
 * first sample reaches the speaker — without this warm-up the very first
 * climb's leading notes are inaudible (the climb animation appears to play
 * with sound starting halfway through).
 */
export async function unlockAudio(): Promise<void> {
  if (muted) return;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) { primed = true; return; }
    if (ctx === null) ctx = new Ctor();
    if (ctx.state !== 'running') await ctx.resume();
    primed = true;
    if (!warmedUp) {
      // Play a 250ms silent oscillator to spin up the output pipeline.
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001; // effectively silent
      osc.frequency.value = 440;
      osc.connect(g).connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + 0.25);
      // Wait for the warmup to complete before resolving — this is what
      // guarantees the next scheduled note plays in real time.
      await new Promise<void>((resolve) => setTimeout(resolve, 280));
      warmedUp = true;
    }
  } catch {
    primed = true;
  }
}

export function isMuted(): boolean { return muted; }

export function setMuted(value: boolean): void {
  muted = value;
  try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
  if (muted && ctx !== null) {
    void ctx.suspend();
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}
