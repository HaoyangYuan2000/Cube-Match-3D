'use strict';

let _actx = null;

function getACtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}

// Pentatonic scale across 3 octaves — chain combos climb higher
const CHIME_NOTES = [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093];

function playShatter(x, y, canvasW, canvasH, idx) {
  try {
    const ac = getACtx();
    const now = ac.currentTime;
    const delay = (idx || 0) * 0.07;

    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / canvasW - 0.5) * 1.4));
    pan.connect(ac.destination);

    const noteIdx = Math.min((idx || 0), CHIME_NOTES.length - 1);
    const freq = CHIME_NOTES[noteIdx];

    // Sine + triangle mix for warm bell tone
    [
      { type: 'sine',     vol: 0.35 },
      { type: 'triangle', vol: 0.15 },
    ].forEach(({ type, vol }) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(vol, now + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      osc.connect(g);
      g.connect(pan);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });

    // Soft click attack
    const bufLen = Math.floor(ac.sampleRate * 0.012);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random()*2-1) * (1 - i/bufLen);
    const click = ac.createBufferSource();
    click.buffer = buf;
    const cg = ac.createGain();
    cg.gain.value = 0.12;
    click.connect(cg);
    cg.connect(pan);
    click.start(now + delay);

  } catch (e) {}
}

function playBoom(x, canvasW) {
  try {
    const ac = getACtx();
    const now = ac.currentTime;
    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / canvasW - 0.5) * 1.2));
    pan.connect(ac.destination);

    // Low-frequency thud
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g); g.connect(pan);
    osc.start(now); osc.stop(now + 0.4);

    // Noise burst
    const bufLen = Math.floor(ac.sampleRate * 0.18);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random()*2-1) * Math.pow(1 - i/bufLen, 1.5);
    const ns = ac.createBufferSource();
    ns.buffer = buf;
    const ng = ac.createGain();
    ng.gain.value = 0.35;
    ns.connect(ng); ng.connect(pan);
    ns.start(now);
  } catch(e) {}
}

function playRocket(x, canvasW) {
  try {
    const ac = getACtx();
    const now = ac.currentTime;
    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / canvasW - 0.5) * 1.2));
    pan.connect(ac.destination);

    // Rising whoosh
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g); g.connect(pan);
    osc.start(now); osc.stop(now + 0.45);

    // Ascending chime burst
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'sine';
      o2.frequency.value = freq;
      const t = now + 0.05 + i * 0.055;
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.28, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o2.connect(g2); g2.connect(pan);
      o2.start(t); o2.stop(t + 0.25);
    });
  } catch(e) {}
}
