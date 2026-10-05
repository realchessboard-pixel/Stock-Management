/** Short beep + vibration so the shopkeeper knows a scan registered without looking. */
let ctx: AudioContext | null = null;

export function scanFeedback(ok = true) {
  try {
    navigator.vibrate?.(ok ? 60 : [40, 60, 40]);
  } catch {}
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 1250 : 330;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.2));
  } catch {}
}
