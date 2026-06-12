'use strict';

function hideAll() {
  ['modeOv', 'taOv', 'classicOv', 'nickOv', 'lbOv', 'bindOv'].forEach(id => document.getElementById(id).classList.add('hidden'));
}

function showSplash() {
  gameRunning = false; animating = false; sel = null;
  cancelSlice();
  hideAll();
  document.getElementById('hud').style.display = 'none';
  document.getElementById('infoStrip').style.display = 'none';
  document.getElementById('sliceBtn').style.display = 'none';
  document.getElementById('backBtn').style.display = 'none';
  const btn = document.getElementById('playBtn');
  btn.textContent = '▶ \xa0PLAY';
  btn.disabled = false;
  document.getElementById('splashOv').classList.remove('hidden');
  updateCity();
}

async function onPlay() {
  const btn = document.getElementById('playBtn');
  btn.disabled = true;

  const progress = await _progressPromise;
  if (progress) {
    if (progress.nickname && !getNickname()) localStorage.setItem('cb3d_nickname', progress.nickname);
    if (progress.stars) Object.entries(progress.stars).forEach(([i, s]) => localStorage.setItem('cb3d_s' + i, s));
    if (progress.bestLeft) Object.entries(progress.bestLeft).forEach(([i, v]) => localStorage.setItem('cb3d_bl' + i, v));
    if (progress.tools && progress.tools.slice != null) sliceUses = progress.tools.slice;
    if (progress.classicBest > getClassicBest()) localStorage.setItem('cb3d_classic_best', progress.classicBest);
    if (progress.taBest > getTaBest()) localStorage.setItem('cb3d_ta_best', progress.taBest);
    if (progress.blocksElim > totalBlocksElim) {
      totalBlocksElim = progress.blocksElim;
      localStorage.setItem('cb3d_blocks', totalBlocksElim);
    }
  }

  const today = new Date().toDateString();
  const cloudSliceDay = progress && progress.sliceDay;
  const localSliceDay = localStorage.getItem('cb3d_sliceday');
  if (cloudSliceDay !== today && localSliceDay !== today) {
    sliceUses += 6;
    localStorage.setItem('cb3d_sliceday', today);
    window._dailySliceBonus = true;
    saveProgress('tools', { slice: sliceUses }); saveProgress('sliceDay', today);
  }

  if (!isAnonymousUser()) {
    claimFriendBlockRewards().then(reward => {
      if (reward > 0) {
        totalBlocksElim += reward;
        localStorage.setItem('cb3d_blocks', totalBlocksElim);
        saveProgress('blocksElim', totalBlocksElim);
        setTimeout(() => showToast('🧱 Your friends earned you +' + reward + ' blocks!'), 800);
      }
    });
    getFriendRequestCount().then(n => {
      const badge = document.getElementById('friendReqBadge');
      if (badge) badge.style.display = n > 0 ? 'block' : 'none';
    });
  }

  document.getElementById('splashOv').classList.add('hidden');
  updateSliceBtn();

  const isNewUser = !localStorage.getItem('cb3d_tut');
  function afterNick() {
    if (isNewUser) { showTutorial(() => showModeSelect()); } else { showModeSelect(); }
  }

  if (!getNickname() && !isAnonymousUser()) {
    const u = _auth && _auth.currentUser;
    const emailPrefix = u && u.email ? (u.email.split('@')[0].replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 14) || 'Player') : null;
    const displayName = u && u.displayName;
    if (emailPrefix) await _autoAssignNickname(emailPrefix);
    else if (displayName) await _autoAssignNickname(displayName);
  }
  if (!getNickname()) { showNickSetup(afterNick); } else { afterNick(); }
}

// ── Settings ──
function showSettings() {
  document.getElementById('splashOv').classList.add('hidden');
  document.getElementById('settingSound').checked = _getSetting('cb3d_sound', true);
  document.getElementById('settingVibration').checked = _getSetting('cb3d_vibration', true);
  document.getElementById('settingsOv').classList.remove('hidden');
}
function hideSettings() {
  document.getElementById('settingsOv').classList.add('hidden');
  document.getElementById('splashOv').classList.remove('hidden');
}
function onSettingSound(v) { localStorage.setItem('cb3d_sound', v ? '1' : '0'); }
function onSettingVibration(v) { localStorage.setItem('cb3d_vibration', v ? '1' : '0'); }

// ── Boot ──
requestAnimationFrame(() => requestAnimationFrame(() => {
  resize();
  rot = m3.mul(m3.rotX(-0.38), m3.mul(m3.rotY(0.5), m3.id()));
  draw();
}));

let _progressPromise = initFirebase().then(() => loadProgress());
