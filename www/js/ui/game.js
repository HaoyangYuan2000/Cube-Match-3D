'use strict';

function updateHUD() {
  document.getElementById('se').textContent = score.toLocaleString();
  if (window._gameMode === 'timed') {
    document.getElementById('be').textContent = getTaBest().toLocaleString() || '0';
  } else if (window._gameMode === 'classic') {
    document.getElementById('me').textContent = moves;
    document.getElementById('be').textContent = getClassicBest().toLocaleString() || '0';
  }
}

function checkEnd() {
  if (window._gameMode === 'timed') return;
  if (moves <= 0) endClassicGame();
}

function updateSliceBtn() {
  const lbl = document.getElementById('sliceLabel');
  if (lbl) lbl.textContent = 'Slice ×' + sliceUses;
}

function confirmExitGame() {
  document.getElementById('exitConfirmOv').style.display = 'flex';
}
function hideExitConfirm() {
  document.getElementById('exitConfirmOv').style.display = 'none';
}
function doExitGame() {
  hideExitConfirm();
  showModeSelect();
}

function showModeSelect() {
  gameRunning = false; animating = false; sel = null;
  clearInterval(_taTimer); _taTimer = null;
  cancelSlice();
  hideAll();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('infoStrip').style.display = 'none';
  document.getElementById('sliceBtn').style.display = 'none';
  document.getElementById('backBtn').style.display = 'none';
  document.getElementById('modeOv').classList.remove('hidden');
  if (window._dailySliceBonus) {
    window._dailySliceBonus = false;
    setTimeout(showDailyToast, 400);
  }
}

function selectMode(mode) {
  window._gameMode = mode;
  if (mode === 'classic') { startClassicGame(); } else { startTimedGame(); }
}

// ── Classic ──
const CLASSIC_MOVES = 20;

function getClassicBest() { return +localStorage.getItem('cb3d_classic_best') || 0; }

function startClassicGame() {
  window._gameMode = 'classic';
  level = 0; score = 0; moves = CLASSIC_MOVES;
  rot = m3.mul(m3.rotX(-0.42), m3.mul(m3.rotY(0.55), m3.id()));
  faceGravity = FACES.map(() => ({ axis: 'row', dir: 1 }));
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  createBoard();
  gameRunning = true; animating = false; sel = null; particles = []; shakeAmt = 0;
  document.getElementById('hud').style.display = '';
  document.getElementById('infoStrip').style.display = '';
  document.getElementById('backBtn').style.display = '';
  document.getElementById('sliceBtn').style.display = '';
  document.getElementById('starHb').style.display = 'none';
  document.getElementById('timerPill').style.display = 'none';
  document.getElementById('me').style.display = '';
  document.getElementById('modeLabel').textContent = 'Moves Left';
  document.getElementById('le').textContent = '🏆';
  document.getElementById('beLabel').textContent = 'Best';
  document.getElementById('be').textContent = getClassicBest().toLocaleString() || '0';
  cancelSlice(); updateSliceBtn(); updateHUD(); resize();
}

async function endClassicGame() {
  gameRunning = false;
  const best = Math.max(score, getClassicBest());
  localStorage.setItem('cb3d_classic_best', best);
  const finalScore = score;
  saveProgress('blocksElim', totalBlocksElim);
  saveProgress('classicBest', best);
  await submitScore('classic', finalScore);
  document.getElementById('classicScore').textContent = finalScore.toLocaleString();
  document.getElementById('classicBest').textContent = best.toLocaleString();
  document.getElementById('be').textContent = best.toLocaleString();
  document.getElementById('classicLb').innerHTML = '<div class="lb-loading">Loading...</div>';
  setTimeout(() => { document.getElementById('classicOv').classList.remove('hidden'); flushCityToasts(); }, 400);
  const rows = await fetchLeaderboard('classic');
  renderLeaderboard('classicLb', rows, localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if (_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

// ── Timed ──
let _taTimer = null;
let _taRemaining = 0;
let _taPausedAt = null;
const TA_DURATION = 60;

function _taFreeze() {
  if (window._gameMode !== 'timed' || _taPausedAt !== null) return;
  _taPausedAt = Date.now();
  document.getElementById('timerPill').classList.add('frozen');
}
function _taUnfreeze() {
  if (window._gameMode !== 'timed' || _taPausedAt === null) return;
  _taPausedAt = null;
  document.getElementById('timerPill').classList.remove('frozen');
  if (_taRemaining <= 0) { clearInterval(_taTimer); endTimedGame(); }
}

function getTaBest() { return +localStorage.getItem('cb3d_ta_best') || 0; }

function startTimedGame() {
  window._gameMode = 'timed';
  level = 0; score = 0;
  rot = m3.mul(m3.rotX(-0.42), m3.mul(m3.rotY(0.55), m3.id()));
  faceGravity = FACES.map(() => ({ axis: 'row', dir: 1 }));
  hideAll();
  document.getElementById('splashOv').classList.add('hidden');
  createBoard();
  gameRunning = true; animating = false; sel = null; particles = []; shakeAmt = 0;
  document.getElementById('hud').style.display = '';
  document.getElementById('infoStrip').style.display = '';
  document.getElementById('backBtn').style.display = '';
  document.getElementById('sliceBtn').style.display = '';
  document.getElementById('starHb').style.display = 'none';
  document.getElementById('me').style.display = 'none';
  document.getElementById('timerPill').style.display = '';
  document.getElementById('timerPill').classList.remove('urgent');
  document.getElementById('modeLabel').textContent = 'Time Left';
  document.getElementById('le').textContent = '⏱';
  document.getElementById('se').textContent = '0';
  document.getElementById('beLabel').textContent = 'Highest';
  document.getElementById('be').textContent = getTaBest().toLocaleString() || '0';
  document.getElementById('be').style.color = '';
  cancelSlice(); updateSliceBtn(); resize();
  clearInterval(_taTimer);
  _taRemaining = TA_DURATION;
  _taPausedAt = null;
  updateTimerDisplay(Math.ceil(_taRemaining));
  _taTimer = setInterval(() => {
    if (_taPausedAt !== null) return;
    _taRemaining = Math.max(0, _taRemaining - 1);
    updateTimerDisplay(Math.ceil(_taRemaining));
    if (_taRemaining <= 10) document.getElementById('timerPill').classList.add('urgent');
    if (_taRemaining <= 0) { clearInterval(_taTimer); endTimedGame(); }
  }, 1000);
}

function updateTimerDisplay(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  document.getElementById('timerPill').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

async function endTimedGame() {
  gameRunning = false;
  clearInterval(_taTimer);
  _taPausedAt = null;
  document.getElementById('timerPill').classList.remove('frozen', 'urgent');
  const best = Math.max(score, getTaBest());
  localStorage.setItem('cb3d_ta_best', best);
  document.getElementById('timerPill').textContent = '0:00';
  const finalScore = score;
  saveProgress('blocksElim', totalBlocksElim);
  saveProgress('taBest', best);
  await submitScore('timed', finalScore);
  document.getElementById('taScore').textContent = finalScore.toLocaleString();
  document.getElementById('taBest').textContent = best.toLocaleString();
  document.getElementById('be').textContent = best.toLocaleString();
  document.getElementById('taLb').innerHTML = '<div class="lb-loading">Loading...</div>';
  setTimeout(() => { document.getElementById('taOv').classList.remove('hidden'); flushCityToasts(); }, 400);
  const rows = await fetchLeaderboard('timed');
  renderLeaderboard('taLb', rows, localStorage.getItem('cb3d_nickname'));
  _incrementGamesPlayed();
  if (_shouldShowBindPrompt()) setTimeout(showBindPrompt, 1800);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { _taFreeze(); } else { _taUnfreeze(); }
});
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) { _taFreeze(); } else { _taUnfreeze(); }
  });
}
