// Síntese de sons de notificação via Web Audio API
// Cada tipo tem um perfil sonoro distinto para identificação auditiva

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return _ctx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  t: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function slide(
  ctx: AudioContext,
  freqStart: number,
  freqEnd: number,
  t: number,
  dur: number,
  vol: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.linearRampToValueAtTime(freqEnd, t + dur * 0.7);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export type SoundType =
  | 'mention'
  | 'comment'
  | 'assign'
  | 'activity_added'
  | 'activity_moved'
  | 'activity_updated'
  | 'activity_removed';

/**
 * Toca um som de notificação. Identidade sonora por tipo:
 * - mention        : C5→E5→G5 ascendente (urgente)
 * - comment        : G4 ping suave
 * - assign         : C4→G4 dois toques graves
 * - activity_added : A4→A5 chirp crescente
 * - activity_moved : D5→F#5 slide suave
 * - activity_updated: E5 blip duplo
 * - activity_removed: G4→D4 descendente
 */
export function playNotificationSound(type: SoundType, volume = 0.5): void {
  const ctx = getCtx();
  if (!ctx) return;
  // Alguns navegadores suspendem o contexto até uma interação do usuário
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const v = Math.max(0, Math.min(1, volume));

  switch (type) {
    case 'mention':
      // Três notas ascendentes rápidas — C5 E5 G5
      tone(ctx, 523, t,        0.18, v * 0.55);
      tone(ctx, 659, t + 0.15, 0.18, v * 0.55);
      tone(ctx, 784, t + 0.30, 0.32, v * 0.65);
      break;

    case 'comment':
      // Ping suave — G4 com decay longo
      tone(ctx, 392, t, 0.5, v * 0.45);
      break;

    case 'assign':
      // Dois toques C4 → G4
      tone(ctx, 262, t,        0.22, v * 0.50);
      tone(ctx, 392, t + 0.20, 0.38, v * 0.55);
      break;

    case 'activity_added':
      // Chirp ascendente A4 → A5
      slide(ctx, 440, 880, t, 0.28, v * 0.4);
      break;

    case 'activity_moved':
      // Slide suave D5 → F#5
      slide(ctx, 587, 740, t, 0.32, v * 0.38);
      break;

    case 'activity_updated':
      // Blip duplo E5
      tone(ctx, 659, t,        0.10, v * 0.35);
      tone(ctx, 659, t + 0.13, 0.16, v * 0.35);
      break;

    case 'activity_removed':
      // Descendente G4 → D4
      tone(ctx, 392, t,        0.20, v * 0.45);
      tone(ctx, 294, t + 0.18, 0.32, v * 0.40);
      break;
  }
}
