'use strict';

let _tutDemoRaf = null;
let _tutOnClose = null;

function _startCrossDemo() {
  const cv = document.getElementById('tutCrossDemo');
  if (!cv) return;
  const c2 = cv.getContext('2d');
  const W = 90, H = 90;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  c2.scale(dpr, dpr);

  const tcx = W / 2, tcy = H / 2 + 4;
  const tScale = W * 0.28;
  const CAM_D = 3.5;
  function tProj(p) { const z = p[2] + CAM_D, s = tScale * CAM_D / z; return [tcx + p[0] * s, tcy - p[1] * s]; }
  function tFaceUV(f, u, v) { const { n, r: fr, u: up } = f; return [n[0] + u * fr[0] + v * up[0], n[1] + u * fr[1] + v * up[1], n[2] + u * fr[2] + v * up[2]]; }
  function tCellUV(row, col, fc) { const sz = 1.7 / fc, gap = 0.04, step = sz + gap, off = -(fc - 1) * step / 2; return [off + col * step, off + (fc - 1 - row) * step]; }

  const FC3 = 3;
  const board0 = [[1, 0, 2], [3, 4, 2], [0, 1, 3]];
  const board1 = [[2, 3, 0], [2, 2, 1], [4, 0, 3]];
  function isMatch0(r, c) { return r === 1 && c === 2; }
  function isMatch1(r, c) { return r === 1 && (c === 0 || c === 1); }

  let tRot = m3.mul(m3.rotX(-0.28), m3.rotY(2.36));
  let angle = 0;

  const PHASES = [50, 25, 15, 25];
  const TOTAL = PHASES.reduce((a, b) => a + b, 0);
  let frame = 0;
  function getPhase(f) {
    let acc = 0;
    for (let i = 0; i < PHASES.length; i++) { acc += PHASES[i]; if (f < acc) return { ph: i, t: (f - (acc - PHASES[i])) / PHASES[i] }; }
    return { ph: 0, t: 0 };
  }

  function drawFace3D(faceIdx, board, matchFn, ph, t) {
    const f = FACES[faceIdx];
    const rn = m3.app(tRot, f.n);
    if (rn[2] > -0.05) return;
    const bright = Math.max(0.7, Math.min(1.2, -v3.dot(rn, [0.5, 0.9, -0.5]) * 0.35 + 0.9));
    const h = 1.0;
    const corners = [tFaceUV(f, -h, h), tFaceUV(f, h, h), tFaceUV(f, h, -h), tFaceUV(f, -h, -h)].map(p => tProj(m3.app(tRot, p)));
    c2.save();
    c2.beginPath(); c2.moveTo(corners[0][0], corners[0][1]);
    corners.slice(1).forEach(p => c2.lineTo(p[0], p[1]));
    c2.closePath(); c2.clip();
    c2.fillStyle = `rgba(30,24,60,${0.7 * bright})`; c2.fill();
    for (let r = 0; r < FC3; r++) {
      for (let col = 0; col < FC3; col++) {
        const [u, v] = tCellUV(r, col, FC3);
        const sz = 0.26;
        const pts = [tFaceUV(f, u - sz, v + sz), tFaceUV(f, u + sz, v + sz), tFaceUV(f, u + sz, v - sz), tFaceUV(f, u - sz, v - sz)].map(p => tProj(m3.app(tRot, p)));
        const match = matchFn(r, col);
        let alpha = match ? 1 : 0.55, glow = false, scaleOff = 0;
        if (match) {
          if (ph === 1) { scaleOff = t * 0.18; glow = true; }
          else if (ph === 2) { alpha = 1 - t; scaleOff = 0; }
          else if (ph === 3) { alpha = t; scaleOff = 0; }
        }
        if (alpha <= 0.01) continue;
        const cx2 = (pts[0][0] + pts[2][0]) / 2, cy2 = (pts[0][1] + pts[2][1]) / 2;
        const scaled = pts.map(p => [cx2 + (p[0] - cx2) * (1 + scaleOff), cy2 + (p[1] - cy2) * (1 + scaleOff)]);
        c2.save(); c2.globalAlpha = alpha;
        if (glow) { c2.shadowColor = COLORS[board[r][col]]; c2.shadowBlur = 8 * dpr; }
        c2.beginPath(); c2.moveTo(scaled[0][0], scaled[0][1]); scaled.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
        c2.fillStyle = shadeHex(COLORS_LO[board[r][col]], bright * 0.45); c2.fill();
        const bv = 0.06;
        const inner = [tFaceUV(f, u - sz + bv, v + sz - bv), tFaceUV(f, u + sz - bv, v + sz - bv), tFaceUV(f, u + sz - bv, v - sz + bv), tFaceUV(f, u - sz + bv, v - sz + bv)].map(p => tProj(m3.app(tRot, p)));
        const si = inner.map(p => [cx2 + (p[0] - cx2) * (1 + scaleOff), cy2 + (p[1] - cy2) * (1 + scaleOff)]);
        c2.beginPath(); c2.moveTo(si[0][0], si[0][1]); si.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
        c2.fillStyle = shadeHex(COLORS[board[r][col]], bright); c2.fill();
        if (match || alpha > 0.5) {
          const glintPts = [tFaceUV(f, u - sz + bv, v + sz - bv), tFaceUV(f, u - sz * 0.2, v + sz - bv), tFaceUV(f, u - sz + bv, v + sz * 0.2)].map(p => tProj(m3.app(tRot, p)));
          const sg = glintPts.map(p => [cx2 + (p[0] - cx2) * (1 + scaleOff), cy2 + (p[1] - cy2) * (1 + scaleOff)]);
          c2.globalAlpha = alpha * 0.35;
          c2.beginPath(); c2.moveTo(sg[0][0], sg[0][1]); c2.lineTo(sg[1][0], sg[1][1]); c2.lineTo(sg[2][0], sg[2][1]); c2.closePath();
          c2.fillStyle = '#fff'; c2.fill();
        }
        c2.restore();
      }
    }
    c2.restore();
  }

  function tick() {
    _tutDemoRaf = requestAnimationFrame(tick);
    frame = (frame + 1) % TOTAL;
    const { ph, t } = getPhase(frame);
    angle += 0.008;
    tRot = m3.mul(m3.rotX(-0.28), m3.rotY(2.36 + Math.sin(angle) * 0.12));
    c2.clearRect(0, 0, W, H);
    const faceOrder = [0, 1, 2, 3, 4, 5].map(fi => { const rn = m3.app(tRot, FACES[fi].n); return { fi, depth: rn[2] }; }).sort((a, b) => b.depth - a.depth);
    for (const { fi } of faceOrder) {
      if (fi === 0) drawFace3D(0, board0, isMatch0, ph, t);
      else if (fi === 1) drawFace3D(1, board1, isMatch1, ph, t);
      else {
        const f = FACES[fi], rn = m3.app(tRot, f.n);
        if (rn[2] > -0.05) continue;
        const h = 1.0;
        const corners = [tFaceUV(f, -h, h), tFaceUV(f, h, h), tFaceUV(f, h, -h), tFaceUV(f, -h, -h)].map(p => tProj(m3.app(tRot, p)));
        c2.save(); c2.beginPath(); c2.moveTo(corners[0][0], corners[0][1]); corners.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
        c2.fillStyle = 'rgba(20,16,48,0.6)'; c2.fill();
        c2.strokeStyle = 'rgba(255,255,255,0.08)'; c2.lineWidth = 0.5; c2.stroke(); c2.restore();
      }
    }
    if ((ph === 1 || ph === 2) && tRot) {
      const alpha = ph === 1 ? t * 0.8 : (1 - t) * 0.8;
      const f0 = FACES[0];
      const edgePts = [tFaceUV(f0, 1, -1), tFaceUV(f0, 1, 1)].map(p => tProj(m3.app(tRot, p)));
      c2.save(); c2.globalAlpha = alpha; c2.strokeStyle = '#00eeff'; c2.lineWidth = 2.5;
      c2.shadowColor = '#00eeff'; c2.shadowBlur = 6;
      c2.beginPath(); c2.moveTo(edgePts[0][0], edgePts[0][1]); c2.lineTo(edgePts[1][0], edgePts[1][1]); c2.stroke(); c2.restore();
    }
  }
  tick();
}

let _gravDemoRaf = null;

function _startGravityDemo() {
  const cv = document.getElementById('tutGravityDemo');
  if (!cv) return;
  const c2 = cv.getContext('2d');
  const W = 90, H = 90;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  c2.scale(dpr, dpr);

  const tcx = W / 2, tcy = H / 2 + 2;
  const tSc = W * 0.23, CAM = 3.5;
  function gProj(p) { const z = p[2] + CAM, s = tSc * CAM / z; return [tcx + p[0] * s, tcy - p[1] * s]; }
  function gFuv(f, u, v) { const { n, r: fr, u: up } = f; return [n[0] + u * fr[0] + v * up[0], n[1] + u * fr[1] + v * up[1], n[2] + u * fr[2] + v * up[2]]; }
  function gCuv(rowF, colF, fc) { const sz = 1.55 / fc, gap = 0.05, step = sz + gap, off = -(fc - 1) * step / 2; return [off + colF * step, off + (fc - 1 - rowF) * step]; }
  function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  const FC = 4;
  const B0 = [[0, 3, 2, 4], [4, 0, 3, 1], [2, 4, 0, 3], [1, 1, 1, 1]];
  const B0f = [[-1, -1, -1, -1], [0, 3, 2, 4], [4, 0, 3, 1], [2, 4, 0, 3]];
  const B1 = [[2, 0, 3, 4], [2, 4, 0, 3], [2, 3, 4, 0], [2, 0, 4, 3]];
  const B1f = [[0, 3, 4, -1], [4, 0, 3, -1], [3, 4, 0, -1], [0, 4, 3, -1]];

  const PD = [30, 15, 12, 22, 8, 45, 25, 15, 12, 22, 120];
  const TOT = PD.reduce((a, b) => a + b, 0);
  function phaseOf(f) { let acc = 0; for (let i = 0; i < PD.length; i++) { acc += PD[i]; if (f < acc) return { ph: i, t: (f - (acc - PD[i])) / PD[i] }; } return { ph: 0, t: 0 }; }

  function drawGem(f, tRot, rowF, colF, ci, alpha, sc, glow) {
    if (alpha < 0.02 || sc < 0.02 || ci < 0) return;
    const [u, v] = gCuv(rowF, colF, FC);
    const sz = 0.8 / FC, bv = sz * 0.14;
    const pts = [[-sz, sz], [sz, sz], [sz, -sz], [-sz, -sz]].map(([du, dv]) => gProj(m3.app(tRot, gFuv(f, u + du, v + dv))));
    const gx = (pts[0][0] + pts[2][0]) / 2, gy = (pts[0][1] + pts[2][1]) / 2;
    const sp = pts.map(p => [gx + (p[0] - gx) * sc, gy + (p[1] - gy) * sc]);
    const ip = [[-sz + bv, sz - bv], [sz - bv, sz - bv], [sz - bv, -sz + bv], [-sz + bv, -sz + bv]].map(([du, dv]) => gProj(m3.app(tRot, gFuv(f, u + du, v + dv))));
    const si = ip.map(p => [gx + (p[0] - gx) * sc, gy + (p[1] - gy) * sc]);
    c2.save(); c2.globalAlpha = alpha;
    if (glow) { c2.shadowColor = COLORS[ci]; c2.shadowBlur = 6; }
    c2.beginPath(); c2.moveTo(sp[0][0], sp[0][1]); sp.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
    c2.fillStyle = COLORS_LO[ci]; c2.fill();
    c2.beginPath(); c2.moveTo(si[0][0], si[0][1]); si.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
    c2.fillStyle = COLORS[ci]; c2.fill();
    c2.restore();
  }

  function drawFace0(board, tRot, hlIdx, hlAxis, hlSc, hlAl, fallT, fallBoard, fallAxis) {
    const f = FACES[0];
    const rn = m3.app(tRot, f.n);
    if (rn[2] > -0.03) return;
    const h = 1.0;
    const cor = [gFuv(f, -h, h), gFuv(f, h, h), gFuv(f, h, -h), gFuv(f, -h, -h)].map(p => gProj(m3.app(tRot, p)));
    c2.save();
    c2.beginPath(); c2.moveTo(cor[0][0], cor[0][1]); cor.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
    c2.fillStyle = 'rgba(18,14,44,0.6)'; c2.fill();
    c2.strokeStyle = 'rgba(255,255,255,0.09)'; c2.lineWidth = 0.5; c2.stroke(); c2.clip();
    for (let r = 0; r < FC; r++) {
      for (let col = 0; col < FC; col++) {
        const isHL = hlAxis === 'row' ? r === hlIdx : col === hlIdx;
        const ci = board[r][col];
        if (ci < 0) continue;
        if (fallT > 0 && fallAxis === 'row') {
          if (r === 0) { drawGem(f, tRot, r, col, fallBoard[r][col], fallT * 0.8, 1, false); }
          else { const rowF = (r - 1) + ease(fallT); drawGem(f, tRot, rowF, col, board[r - 1][col], 0.85, 1, false); }
        } else if (fallT > 0 && fallAxis === 'col') {
          if (col === FC - 1) { drawGem(f, tRot, r, col, fallBoard[r][col], fallT * 0.8, 1, false); }
          else { const colF = (col + 1) - ease(fallT); drawGem(f, tRot, r, colF, board[r][col + 1], 0.85, 1, false); }
        } else {
          const sc = isHL ? hlSc : 1, al = isHL ? hlAl : 0.75;
          drawGem(f, tRot, r, col, ci, al, sc, isHL && hlSc > 1);
        }
      }
    }
    c2.restore();
    const au = hlAxis === 'col' ? -1.2 : 0, av = hlAxis === 'col' ? 0 : -1.2;
    const apt = gProj(m3.app(tRot, gFuv(f, au, av)));
    c2.save(); c2.globalAlpha = 0.7; c2.fillStyle = '#ffd700';
    c2.font = 'bold 11px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText('↓', apt[0], apt[1]); c2.restore();
  }

  function drawOtherFaces(tRot) {
    [0, 1, 2, 3, 4, 5].map(fi => ({ fi, d: m3.app(tRot, FACES[fi].n)[2] })).sort((a, b) => b.d - a.d).forEach(({ fi }) => {
      if (fi === 0) return;
      const f = FACES[fi], rn = m3.app(tRot, f.n);
      if (rn[2] > -0.03) return;
      const h = 1.0;
      const cor = [gFuv(f, -h, h), gFuv(f, h, h), gFuv(f, h, -h), gFuv(f, -h, -h)].map(p => gProj(m3.app(tRot, p)));
      c2.save(); c2.beginPath(); c2.moveTo(cor[0][0], cor[0][1]); cor.slice(1).forEach(p => c2.lineTo(p[0], p[1])); c2.closePath();
      c2.fillStyle = 'rgba(18,14,44,0.4)'; c2.fill();
      c2.strokeStyle = 'rgba(255,255,255,0.06)'; c2.lineWidth = 0.5; c2.stroke(); c2.restore();
    });
  }

  let frame = 0;
  function tick() {
    _gravDemoRaf = requestAnimationFrame(tick);
    frame = (frame + 1) % TOT;
    const { ph, t } = phaseOf(frame);
    c2.clearRect(0, 0, W, H);
    const twist = ph < 5 ? 0 : ph === 5 ? -Math.PI / 2 * ease(t) : -Math.PI / 2;
    const tRot = m3.mul(m3.rotX(-0.18), m3.mul(rotZ(twist), m3.rotY(Math.PI)));
    drawOtherFaces(tRot);
    if (ph < 5) {
      let hlSc = 1, hlAl = ph === 0 ? 0.5 + Math.sin(frame * 0.2) * 0.5 : 1;
      if (ph === 1) { hlSc = 1 + t * 0.13; hlAl = 1; }
      else if (ph === 2) { hlSc = 1 - t; hlAl = 1 - t; }
      const brd = ph >= 4 ? B0f : B0;
      const fallT = ph === 3 ? t : 0;
      drawFace0(brd, tRot, ph < 3 ? 3 : -1, 'row', hlSc, hlAl, fallT, B0f, 'row');
    } else if (ph === 5) {
      const axis = t < 0.5 ? 'row' : 'col';
      drawFace0(B0f, tRot, -1, axis, 1, 0.75, 0, null, axis);
    } else {
      let hlSc = 1, hlAl = ph === 6 ? 0.5 + Math.sin(frame * 0.2) * 0.5 : 1;
      if (ph === 7) { hlSc = 1 + t * 0.13; hlAl = 1; }
      else if (ph === 8) { hlSc = 1 - t; hlAl = 1 - t; }
      const brd = ph >= 10 ? B1f : B1;
      const fallT = ph === 9 ? t : 0;
      drawFace0(brd, tRot, ph < 8 ? 0 : -1, 'col', hlSc, hlAl, fallT, B1f, 'col');
    }
  }
  tick();
}

function showTutorial(onClose) {
  _tutOnClose = onClose || null;
  if (_tutDemoRaf) { cancelAnimationFrame(_tutDemoRaf); _tutDemoRaf = null; }
  if (_gravDemoRaf) { cancelAnimationFrame(_gravDemoRaf); _gravDemoRaf = null; }
  document.getElementById('tutOv').classList.remove('hidden');
  localStorage.setItem('cb3d_tut', '1');
  _taFreeze();
  _startCrossDemo();
  _startGravityDemo();
}

function closeTutorial() {
  document.getElementById('tutOv').classList.add('hidden');
  if (_tutDemoRaf) { cancelAnimationFrame(_tutDemoRaf); _tutDemoRaf = null; }
  if (_gravDemoRaf) { cancelAnimationFrame(_gravDemoRaf); _gravDemoRaf = null; }
  _taUnfreeze();
  const cb = _tutOnClose; _tutOnClose = null;
  if (cb) cb();
}
