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
