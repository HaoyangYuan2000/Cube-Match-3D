'use strict';

function getNickname() { return localStorage.getItem('cb3d_nickname') || ''; }

async function saveNickname() {
  const val = document.getElementById('nickInput').value.trim();
  const btn = document.getElementById('nickConfirmBtn');
  const err = document.getElementById('nickError');
  if (!val) { err.textContent = 'Please enter a nickname'; err.style.display = ''; return; }
  if (val.length < 2) { err.textContent = 'Nickname must be at least 2 characters'; err.style.display = ''; return; }
  if (val.length > 16) { err.textContent = 'Nickname must be 16 characters or fewer'; err.style.display = ''; return; }
  if (!/^[a-zA-Z0-9_\- ]+$/.test(val)) { err.textContent = 'Nickname can only contain letters, numbers, spaces, - and _'; err.style.display = ''; return; }
  btn.disabled = true;
  btn.textContent = 'Checking...';
  err.style.display = 'none';
  if (val === getNickname()) {
    document.getElementById('nickOv').classList.add('hidden');
    if (window._pendingAfterNick) { const fn = window._pendingAfterNick; window._pendingAfterNick = null; fn(); }
    return;
  }
  const status = await checkNickname(val);
  if (status === 'taken') {
    err.textContent = 'Name already taken';
    err.style.display = '';
    btn.disabled = false;
    btn.textContent = 'Confirm';
    return;
  }
  await claimNickname(val);
  localStorage.setItem('cb3d_nickname', val);
  document.getElementById('nickOv').classList.add('hidden');
  if (window._pendingAfterNick) { const fn = window._pendingAfterNick; window._pendingAfterNick = null; fn(); }
}

function showNickSetup(then, prefill = '') {
  window._pendingAfterNick = then || null;
  document.getElementById('nickInput').value = prefill;
  document.getElementById('nickError').style.display = 'none';
  document.getElementById('nickConfirmBtn').disabled = false;
  document.getElementById('nickConfirmBtn').textContent = 'Confirm';
  document.getElementById('nickOv').classList.remove('hidden');
  setTimeout(() => document.getElementById('nickInput').focus(), 100);
}

function openNickOverlay() {
  document.getElementById('nickInput').value = getNickname() || '';
  document.getElementById('nickError').style.display = 'none';
  const btn = document.getElementById('nickConfirmBtn');
  btn.disabled = false; btn.textContent = 'Confirm';
  document.getElementById('nickOv').classList.remove('hidden');
}

async function _autoAssignNickname(displayName) {
  let base = (displayName || '').replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 14);
  if (base.length < 2) base = 'Player';
  let candidate = base, n = 2;
  while (n <= 99) {
    const status = await checkNickname(candidate);
    if (status !== 'taken') {
      await claimNickname(candidate);
      localStorage.setItem('cb3d_nickname', candidate);
      return;
    }
    candidate = (base + n).slice(0, 16); n++;
  }
}

// ── Google account binding ──
let _bindShownThisSession = false;

function _incrementGamesPlayed() {
  const n = (+localStorage.getItem('cb3d_gp') || 0) + 1;
  localStorage.setItem('cb3d_gp', n);
  return n;
}

function _shouldShowBindPrompt() {
  if (_bindShownThisSession) return false;
  if (!isAnonymousUser()) return false;
  const n = +localStorage.getItem('cb3d_gp') || 0;
  return n >= 3;
}

function onAccountBtn() {
  if (!isAnonymousUser()) {
    document.getElementById('bindOvTitle').textContent = 'Account Linked ✓';
    document.getElementById('bindOvDesc').textContent = 'Your progress is saved to your Google account.';
    document.getElementById('bindGoogleBtn').style.display = 'none';
    document.getElementById('bindError').style.display = 'none';
    document.getElementById('changeNameBtn').style.display = '';
    document.getElementById('signOutBtn').style.display = '';
    document.getElementById('bindOv').classList.remove('hidden');
  } else {
    document.getElementById('bindOvTitle').textContent = 'Save Your Progress';
    document.getElementById('bindOvDesc').textContent = 'Link your Google account to sync progress across devices and never lose your score.';
    document.getElementById('bindGoogleBtn').style.display = '';
    document.getElementById('bindGoogleBtn').disabled = false;
    document.getElementById('bindError').style.display = 'none';
    document.getElementById('changeNameBtn').style.display = 'none';
    document.getElementById('signOutBtn').style.display = 'none';
    document.getElementById('bindOv').classList.remove('hidden');
  }
}

function showBindPrompt() {
  _bindShownThisSession = true;
  document.getElementById('bindOvTitle').textContent = 'Save Your Progress';
  document.getElementById('bindOvDesc').textContent = 'Link your Google account to sync progress across devices and never lose your score.';
  document.getElementById('bindGoogleBtn').style.display = '';
  document.getElementById('bindGoogleBtn').disabled = false;
  document.getElementById('bindError').style.display = 'none';
  document.getElementById('changeNameBtn').style.display = 'none';
  document.getElementById('signOutBtn').style.display = 'none';
  document.getElementById('bindOv').classList.remove('hidden');
}

function hideBindPrompt() {
  document.getElementById('bindOv').classList.add('hidden');
}

async function doSignOut() {
  await signOutUser();
  hideBindPrompt();
  localStorage.removeItem('cb3d_nickname');
  showToast('Signed out.');
  setTimeout(() => location.reload(), 800);
}

async function doGoogleLink() {
  const btn = document.getElementById('bindGoogleBtn');
  const err = document.getElementById('bindError');
  btn.disabled = true;
  err.style.display = 'none';
  await initFirebase();
  let result = await linkWithGoogle();
  const retryDelays = [2000, 3000];
  for (const delay of retryDelays) {
    if (result.success || result.error === 'cancelled' || result.error === 'in_progress') break;
    await new Promise(r => setTimeout(r, delay));
    result = await linkWithGoogle();
  }
  if (result.success) {
    hideBindPrompt();
    showToast('✅ Account linked! Progress saved.');
    const hadNickname = getNickname();
    const progress = await loadProgress();
    if (progress) {
      if (progress.nickname) localStorage.setItem('cb3d_nickname', progress.nickname);
      if (progress.stars) Object.entries(progress.stars).forEach(([i, s]) => localStorage.setItem('cb3d_s' + i, s));
      if (progress.bestLeft) Object.entries(progress.bestLeft).forEach(([i, v]) => localStorage.setItem('cb3d_bl' + i, v));
      if (progress.blocksElim > totalBlocksElim) {
        totalBlocksElim = progress.blocksElim;
        localStorage.setItem('cb3d_blocks', totalBlocksElim);
      }
      if (progress.classicBest > getClassicBest()) localStorage.setItem('cb3d_classic_best', progress.classicBest);
      if (progress.taBest > getTaBest()) localStorage.setItem('cb3d_ta_best', progress.taBest);
    }
    const today = new Date().toDateString();
    const googleBase = progress && progress.tools && progress.tools.slice != null ? progress.tools.slice : 0;
    const localSliceDay = localStorage.getItem('cb3d_sliceday');
    const alreadyClaimed = (progress && progress.sliceDay === today) || localSliceDay === today;
    if (alreadyClaimed) {
      sliceUses = googleBase;
      window._dailySliceBonus = false;
    } else {
      sliceUses = googleBase + 6;
      localStorage.setItem('cb3d_sliceday', today);
      window._dailySliceBonus = true;
      saveProgress('tools', { slice: sliceUses }); saveProgress('sliceDay', today);
    }
    updateSliceBtn();
    updateCity();
    if (!progress?.nickname) {
      if (hadNickname) {
        await claimNickname(hadNickname);
      } else {
        const emailPrefix = (result.email || '').split('@')[0].replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 14);
        showNickSetup(null, emailPrefix || 'Player');
      }
    }
    getFriendRequestCount().then(n => {
      const badge = document.getElementById('friendReqBadge');
      if (badge) { badge.textContent = n; badge.style.display = n > 0 ? '' : 'none'; }
    });
  } else if (result.error === 'cancelled') {
    btn.disabled = false;
  } else {
    err.textContent = 'Sign-in failed (' + (result.error || 'unknown') + ')';
    err.style.display = '';
    btn.disabled = false;
  }
}
