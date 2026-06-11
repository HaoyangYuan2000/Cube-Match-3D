'use strict';

let _actx = null;

function getACtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}

// Helper: create a master compressor so sounds never clip
function _getMaster(ac) {
  if (!_actx._master) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(ac.destination);
    _actx._master = comp;
  }
  return _actx._master;
}

// Pentatonic scale — start bright, chain combos climb higher
const CHIME_NOTES = [523, 622, 784, 987, 1175, 1480, 1760, 2093, 2637, 3136];

function playShatter(x, y, canvasW, canvasH, idx) {
  try {
    const ac = getACtx();
    const master = _getMaster(ac);
    const now = ac.currentTime;
    const delay = (idx || 0) * 0.055;
    const noteIdx = Math.min((idx || 0), CHIME_NOTES.length - 1);
    const freq = CHIME_NOTES[noteIdx];
    const chainBoost = 1 + Math.min(noteIdx, 6) * 0.06; // louder on combos

    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, (x / canvasW - 0.5) * 1.6));
    pan.connect(master);

    // Main tone: sine + octave harmonic for richness
    [[freq, 'sine', 0.38], [freq * 2, 'sine', 0.12], [freq * 3, 'triangle', 0.06]].forEach(([f, type, vol]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(vol * chainBoost, now + delay + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.32);
      osc.connect(g); g.connect(pan);
      osc.start(now + delay); osc.stop(now + delay + 0.35);
    });

    // Punchy transient noise (gives the "pop" feel)
    const bufLen = Math.floor(ac.sampleRate * 0.018);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.5);
    const click = ac.createBufferSource();
    click.buffer = buf;
    const cg = ac.createGain();
    cg.gain.value = 0.22 * chainBoost;
    click.connect(cg); cg.connect(pan);
    click.start(now + delay);

    // Bright shimmer (high-freq sine, quick decay) — adds sparkle on higher chains
    if (noteIdx >= 3) {
      const shimmer = ac.createOscillator();
      const sg = ac.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * 4;
      sg.gain.setValueAtTime(0, now + delay);
      sg.gain.linearRampToValueAtTime(0.08, now + delay + 0.004);
      sg.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
      shimmer.connect(sg); sg.connect(pan);
      shimmer.start(now + delay); shimmer.stop(now + delay + 0.15);
    }
  } catch (e) {}
}

function playBoom(x, canvasW) {
  try {
    const ac = getACtx();
    const master = _getMaster(ac);
    const now = ac.currentTime;

    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / canvasW - 0.5) * 1.2));
    pan.connect(master);

    // Sub-bass kick: deep pitch sweep
    const kick = ac.createOscillator();
    const kg = ac.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(160, now);
    kick.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    kg.gain.setValueAtTime(0.9, now);
    kg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    kick.connect(kg); kg.connect(pan);
    kick.start(now); kick.stop(now + 0.42);

    // Mid punch (adds body)
    const mid = ac.createOscillator();
    const mg = ac.createGain();
    mid.type = 'triangle';
    mid.frequency.setValueAtTime(280, now);
    mid.frequency.exponentialRampToValueAtTime(90, now + 0.15);
    mg.gain.setValueAtTime(0.45, now);
    mg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    mid.connect(mg); mg.connect(pan);
    mid.start(now); mid.stop(now + 0.25);

    // Explosive noise burst with bandpass
    const bufLen = Math.floor(ac.sampleRate * 0.22);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.2);
    const ns = ac.createBufferSource();
    ns.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.value = 0.5;
    ns.connect(bp); bp.connect(ng); ng.connect(pan);
    ns.start(now);

    // Metallic ring (gives "crunch" edge)
    const ring = ac.createOscillator();
    const rg = ac.createGain();
    ring.type = 'sawtooth';
    ring.frequency.setValueAtTime(520, now);
    ring.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    rg.gain.setValueAtTime(0.18, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    ring.connect(rg); rg.connect(pan);
    ring.start(now); ring.stop(now + 0.14);

  } catch (e) {}
}

function playRocket(x, canvasW) {
  try {
    const ac = getACtx();
    const master = _getMaster(ac);
    const now = ac.currentTime;

    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / canvasW - 0.5) * 1.2));
    pan.connect(master);

    // Electric whoosh: fast ascending sawtooth sweep
    const sweep = ac.createOscillator();
    const sg = ac.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(120, now);
    sweep.frequency.exponentialRampToValueAtTime(1800, now + 0.3);
    sg.gain.setValueAtTime(0.0, now);
    sg.gain.linearRampToValueAtTime(0.28, now + 0.06);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    // Add distortion via waveshaper
    const ws = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x2 = i * 2 / 256 - 1; curve[i] = Math.tanh(x2 * 3); }
    ws.curve = curve;
    sweep.connect(ws); ws.connect(sg); sg.connect(pan);
    sweep.start(now); sweep.stop(now + 0.42);

    // Noise rush (feels like a blast of air)
    const bufLen = Math.floor(ac.sampleRate * 0.28);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 0.7);
    const ns = ac.createBufferSource();
    ns.buffer = buf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const ng = ac.createGain();
    ng.gain.value = 0.2;
    ns.connect(hp); hp.connect(ng); ng.connect(pan);
    ns.start(now);

    // Victory arpeggio: ascending pentatonic burst
    [392, 523, 659, 880, 1047, 1319].forEach((freq, i) => {
      const t = now + 0.04 + i * 0.048;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = i < 3 ? 'triangle' : 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.32 - i * 0.02, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(pan);
      o.start(t); o.stop(t + 0.22);
    });

    // Final sparkle: high-pitched ping at the end
    const ping = ac.createOscillator();
    const pg = ac.createGain();
    ping.type = 'sine';
    ping.frequency.value = 2637;
    pg.gain.setValueAtTime(0, now + 0.32);
    pg.gain.linearRampToValueAtTime(0.22, now + 0.33);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    ping.connect(pg); pg.connect(pan);
    ping.start(now + 0.32); ping.stop(now + 0.58);

  } catch (e) {}
}
